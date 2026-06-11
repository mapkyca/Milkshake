import { randomUUID } from 'crypto';
import { format } from 'date-fns';
import { getDb } from '../db/knex';
import { computeNextDueDate } from './RecurrenceService';
import { getLists } from './ListService';
import { evaluateSLQL } from './slql';
import type {
  Task,
  TaskRow,
  TaskTagRow,
  TaskNoteRow,
  TaskNote,
  CreateTaskInput,
  UpdateTaskInput,
  TaskFilters,
  Priority,
} from '../types';

// ─── Mappers ─────────────────────────────────────────────────────────────────

function rowToTask(row: TaskRow, tags: string[] = []): Task {
  return {
    id: row.id,
    listId: row.list_id,
    parentId: row.parent_id,
    title: row.title,
    description: row.description,
    priority: row.priority as Priority,
    dueDate: row.due_date,
    rrule: row.rrule,
    isCompleted: row.is_completed === 1,
    isArchived: row.is_archived === 1,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    seriesId: row.series_id,
    tags,
  };
}

function rowToNote(row: TaskNoteRow): TaskNote {
  return {
    id: row.id,
    taskId: row.task_id,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── Tag helpers ──────────────────────────────────────────────────────────────

async function setTags(taskId: string, tags: string[]): Promise<void> {
  const db = getDb();
  await db('task_tags').where({ task_id: taskId }).delete();
  if (tags.length > 0) {
    await db('task_tags').insert(
      tags.map((tag) => ({ task_id: taskId, tag: tag.toLowerCase().trim() })),
    );
  }
}

async function getTagsForTasks(taskIds: string[]): Promise<Map<string, string[]>> {
  if (taskIds.length === 0) return new Map();
  const db = getDb();
  const rows = await db<TaskTagRow>('task_tags').whereIn('task_id', taskIds);
  const map = new Map<string, string[]>();
  for (const r of rows) {
    if (!map.has(r.task_id)) map.set(r.task_id, []);
    map.get(r.task_id)!.push(r.tag);
  }
  return map;
}

// ─── Query helpers ────────────────────────────────────────────────────────────

function todayString(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getTasks(filters: TaskFilters = {}): Promise<Task[]> {
  const db = getDb();

  // Check if listId is a smart list
  if (filters.listId) {
    const listRow = await db('lists').where({ id: filters.listId }).first();
    if (listRow && listRow.is_smart === 1 && listRow.smart_filter) {
      const all = await getAllTasksForEvaluation();
      const lists = await getLists();
      let tasks = evaluateSLQL(listRow.smart_filter, all, lists, {
        now: new Date(),
        timezone: 'Europe/London',
        startOfWeek: 'monday',
      });
      if (filters.completed !== undefined) {
        tasks = tasks.filter((t) => t.isCompleted === filters.completed);
      }
      return tasks;
    }
  }

  // If evaluating today/upcoming via SLQL
  if (filters.today || filters.upcoming) {
    const all = await getAllTasksForEvaluation();
    const lists = await getLists();
    const timezone = 'Europe/London';
    const now = new Date();
    let tasks: Task[];

    if (filters.today) {
      tasks = evaluateSLQL("status:any and (due:today or due:overdue)", all, lists, {
        now,
        timezone,
        startOfWeek: 'monday',
      });
    } else {
      const todayStr = format(now, 'yyyy-MM-dd');
      const in7 = format(new Date(now.getTime() + 7 * 86_400_000), 'yyyy-MM-dd');
      const queryStr = `status:any and due>${todayStr} and due<=${in7}`;
      tasks = evaluateSLQL(queryStr, all, lists, {
        now,
        timezone,
        startOfWeek: 'monday',
      });
    }

    // Apply additional filters
    if (filters.listId) {
      tasks = tasks.filter((t) => t.listId === filters.listId);
    }
    if (filters.tags && filters.tags.length > 0) {
      tasks = tasks.filter((t) => t.tags.some((tag) => filters.tags!.includes(tag)));
    }
    if (filters.priority !== undefined) {
      tasks = tasks.filter((t) => t.priority === filters.priority);
    }
    if (filters.search) {
      const term = filters.search.toLowerCase();
      tasks = tasks.filter(
        (t) =>
          t.title.toLowerCase().includes(term) ||
          (t.description || '').toLowerCase().includes(term)
      );
    }
    return tasks;
  }

  let query = db<TaskRow>('tasks').where({ is_archived: 0 });

  if (filters.listId) query = query.where({ list_id: filters.listId });

  if (filters.completed !== undefined) {
    query = query.where({ is_completed: filters.completed ? 1 : 0 });
  } else {
    // Default: only show incomplete tasks
    query = query.where({ is_completed: 0 });
  }

  if (filters.parentId !== undefined) {
    if (filters.parentId === null) {
      query = query.whereNull('parent_id');
    } else {
      query = query.where({ parent_id: filters.parentId });
    }
  } else {
    // Default: only top-level tasks
    query = query.whereNull('parent_id');
  }

  if (filters.today) {
    const today = todayString();
    query = query.where('due_date', '<=', today).whereNotNull('due_date');
  }

  if (filters.upcoming) {
    const today = todayString();
    const in7 = format(new Date(Date.now() + 7 * 86_400_000), 'yyyy-MM-dd');
    query = query
      .where('due_date', '>', today)
      .where('due_date', '<=', in7)
      .whereNotNull('due_date');
  }

  if (filters.priority !== undefined) {
    query = query.where({ priority: filters.priority });
  }

  if (filters.search) {
    const term = `%${filters.search}%`;
    query = query.where((b) => b.whereLike('title', term).orWhereLike('description', term));
  }

  if (filters.tags && filters.tags.length > 0) {
    const taggedIds = await db<TaskTagRow>('task_tags')
      .whereIn('tag', filters.tags)
      .distinct('task_id')
      .pluck('task_id');
    query = query.whereIn('id', taggedIds);
  }

  const rows = await query.orderBy('due_date', 'asc').orderBy('priority', 'asc');
  const tagMap = await getTagsForTasks(rows.map((r) => r.id));

  return rows.map((r) => rowToTask(r, tagMap.get(r.id) ?? []));
}

export async function getTask(id: string): Promise<Task> {
  const db = getDb();
  const row = await db<TaskRow>('tasks').where({ id }).first();
  if (!row) throw new Error(`Task not found: ${id}`);

  const tagMap = await getTagsForTasks([id]);
  const task = rowToTask(row, tagMap.get(id) ?? []);

  // Attach subtasks
  const subtaskRows = await db<TaskRow>('tasks')
    .where({ parent_id: id, is_archived: 0 })
    .orderBy('created_at', 'asc');
  const subtaskIds = subtaskRows.map((r) => r.id);
  const subtaskTagMap = await getTagsForTasks(subtaskIds);
  task.subtasks = subtaskRows.map((r) => rowToTask(r, subtaskTagMap.get(r.id) ?? []));

  // Attach notes
  const noteRows = await db<TaskNoteRow>('task_notes')
    .where({ task_id: id })
    .orderBy('created_at', 'asc');
  task.notes = noteRows.map(rowToNote);

  return task;
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const db = getDb();
  const now = new Date().toISOString();
  const id = randomUUID();

  await db('tasks').insert({
    id,
    list_id: input.listId,
    parent_id: input.parentId ?? null,
    series_id: input.seriesId ?? null,
    title: input.title.trim(),
    description: input.description ?? null,
    priority: input.priority ?? 0,
    due_date: input.dueDate ?? null,
    rrule: input.rrule ?? null,
    is_completed: 0,
    is_archived: 0,
    completed_at: null,
    created_at: now,
    updated_at: now,
  });

  if (input.tags && input.tags.length > 0) {
    await setTags(id, input.tags);
  }

  return getTask(id);
}

export async function updateTask(id: string, input: UpdateTaskInput): Promise<Task> {
  const db = getDb();
  const now = new Date().toISOString();

  const update: Record<string, unknown> = { updated_at: now };
  if (input.title !== undefined) update.title = input.title.trim();
  if (input.description !== undefined) update.description = input.description;
  if (input.priority !== undefined) update.priority = input.priority;
  if (input.dueDate !== undefined) update.due_date = input.dueDate;
  if (input.rrule !== undefined) update.rrule = input.rrule;
  if (input.listId !== undefined) update.list_id = input.listId;

  await db('tasks').where({ id }).update(update);

  if (input.tags !== undefined) {
    await setTags(id, input.tags);
  }

  return getTask(id);
}

/**
 * Mark a task complete. If the task has a recurrence rule, spawn a new row
 * for the next occurrence (new row approach preserves history).
 */
export async function completeTask(id: string): Promise<{ task: Task; next: Task | null }> {
  const db = getDb();
  const now = new Date().toISOString();

  const row = await db<TaskRow>('tasks').where({ id }).first();
  if (!row) throw new Error(`Task not found: ${id}`);

  await db('tasks').where({ id }).update({
    is_completed: 1,
    completed_at: now,
    updated_at: now,
  });

  const task = await getTask(id);
  let next: Task | null = null;

  // Spawn the next occurrence if this is a recurring task
  if (row.rrule) {
    const nextDue = computeNextDueDate(row.rrule, row.due_date);
    const tagMap = await getTagsForTasks([id]);
    const tags = tagMap.get(id) ?? [];

    next = await createTask({
      listId: row.list_id,
      parentId: row.parent_id ?? undefined,
      title: row.title,
      description: row.description ?? undefined,
      priority: row.priority as Priority,
      dueDate: nextDue,
      rrule: row.rrule,
      tags,
      seriesId: row.series_id ?? row.id,
    });
  }

  return { task, next };
}

export async function uncompleteTask(id: string): Promise<Task> {
  const db = getDb();
  await db('tasks').where({ id }).update({
    is_completed: 0,
    completed_at: null,
    updated_at: new Date().toISOString(),
  });
  return getTask(id);
}

export async function archiveTask(id: string): Promise<void> {
  const db = getDb();
  await db('tasks').where({ id }).update({
    is_archived: 1,
    updated_at: new Date().toISOString(),
  });
}

export async function deleteTask(id: string): Promise<void> {
  const db = getDb();
  await db('tasks').where({ id }).delete();
}

export async function addNote(taskId: string, body: string): Promise<TaskNote> {
  const db = getDb();
  const now = new Date().toISOString();
  const id = randomUUID();

  await db('task_notes').insert({
    id,
    task_id: taskId,
    body: body.trim(),
    created_at: now,
    updated_at: now,
  });

  const row = await db<TaskNoteRow>('task_notes').where({ id }).first();
  return rowToNote(row!);
}

export async function getAllTasksForEvaluation(): Promise<Task[]> {
  const db = getDb();
  // Fetch all non-archived tasks
  const rows = await db<TaskRow>('tasks').where({ is_archived: 0 });
  const tagMap = await getTagsForTasks(rows.map((r) => r.id));

  const tasks = rows.map((r) => rowToTask(r, tagMap.get(r.id) ?? []));

  // Attach notes and subtasks
  for (const task of tasks) {
    const noteRows = await db<TaskNoteRow>('task_notes')
      .where({ task_id: task.id })
      .orderBy('created_at', 'asc');
    task.notes = noteRows.map(rowToNote);

    const subtaskRows = await db<TaskRow>('tasks')
      .where({ parent_id: task.id, is_archived: 0 })
      .orderBy('created_at', 'asc');
    const subtaskIds = subtaskRows.map((r) => r.id);
    const subtaskTagMap = await getTagsForTasks(subtaskIds);
    task.subtasks = subtaskRows.map((r) => rowToTask(r, subtaskTagMap.get(r.id) ?? []));
  }

  return tasks;
}
