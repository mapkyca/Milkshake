import fs from 'fs';
import { randomUUID } from 'crypto';
import { getDb } from '../db/knex';
import type { ImportOptions, ImportSummary, Priority } from '../types';

// ─── RTM export shape (actual flat export format) ─────────────────────────────

interface RTMList {
  id: string;
  name: string;
  date_created?: number;
  date_modified?: number;
  date_archived?: number;
  syncable?: boolean;
}

interface RTMTask {
  id: string;
  series_id: string;
  list_id: string;
  name: string;
  priority: string;          // "PN" | "P1" | "P2" | "P3"
  date_created?: number;     // Unix ms
  date_added?: number;       // Unix ms
  date_modified?: number;    // Unix ms
  date_completed?: number;   // Unix ms (absent/null if not done)
  date_due?: number;         // Unix ms (absent/null if no due date)
  date_due_has_time?: boolean;
  date_start?: number;       // Unix ms
  date_start_has_time?: boolean;
  postponed?: number;
  source?: string;
  repeat?: string | false;
  repeat_every?: string | boolean;
  parent_id?: string;
  tags?: string[];
}

interface RTMNote {
  id: string;
  series_id: string;         // Matches task.series_id
  date_created?: number;
  date_modified?: number;
  title?: string;
  content?: string;
}

interface RTMExport {
  lists?: RTMList[];
  tasks?: RTMTask[];
  notes?: RTMNote[];
  // other top-level keys ignored
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert Unix millisecond timestamp → "YYYY-MM-DD" or null. */
function msToDate(ms?: number | null): string | null {
  if (!ms) return null;
  return new Date(ms).toISOString().slice(0, 10);
}

/** Convert Unix millisecond timestamp → ISO-8601 string or null. */
function msToISO(ms?: number | null): string | null {
  if (!ms) return null;
  return new Date(ms).toISOString();
}

/** Map RTM priority code to our 0-3 scale. */
function mapPriority(code: string): Priority {
  switch (code) {
    case 'P1': return 1;
    case 'P2': return 2;
    case 'P3': return 3;
    default:   return 0;  // 'PN' or anything else
  }
}

// ─── Main importer ────────────────────────────────────────────────────────────

export async function importRTM(
  filePath: string,
  options: ImportOptions = {}
): Promise<ImportSummary> {
  const { dryRun = false, openOnly = false } = options;

  const summary: ImportSummary = {
    listsImported: 0,
    listsSkipped: 0,
    tasksImported: 0,
    tasksSkipped: 0,
    notesImported: 0,
    errors: [],
    dryRun,
  };

  // ── Parse file ──────────────────────────────────────────────────────────────
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, 'utf-8');
  } catch (err: any) {
    summary.errors.push(`Cannot read file: ${err.message}`);
    return summary;
  }

  let parsed: RTMExport;
  try {
    parsed = JSON.parse(raw);
  } catch (err: any) {
    summary.errors.push(`Cannot parse JSON: ${err.message}`);
    return summary;
  }

  const rtmLists  = parsed.lists  ?? [];
  const rtmTasks  = parsed.tasks  ?? [];
  const rtmNotes  = parsed.notes  ?? [];

  if (rtmLists.length === 0) {
    summary.errors.push('No lists found in export.');
    return summary;
  }

  // ── Build note lookup: series_id → notes[] ──────────────────────────────────
  const notesBySeries = new Map<string, RTMNote[]>();
  for (const note of rtmNotes) {
    if (!note.series_id) continue;
    if (!notesBySeries.has(note.series_id)) notesBySeries.set(note.series_id, []);
    notesBySeries.get(note.series_id)!.push(note);
  }

  // ── Transaction ─────────────────────────────────────────────────────────────
  const db = getDb();

  await db.transaction(async (trx) => {
    const now = new Date().toISOString();

    // Map RTM list id → internal list id
    const listIdMap = new Map<string, string>();

    // ── Import lists ──────────────────────────────────────────────────────────
    for (const rtmList of rtmLists) {
      // Skip archived / system lists with no meaningful name
      if (!rtmList.name?.trim()) continue;

      const alreadyImported = await trx('import_records')
        .where({ source: 'rtm', external_id: rtmList.id, entity_type: 'list' })
        .first();

      if (alreadyImported) {
        listIdMap.set(rtmList.id, alreadyImported.internal_id);
        summary.listsSkipped++;
        continue;
      }

      // Reuse existing list with the same name if present
      const existing = await trx('lists')
        .where({ name: rtmList.name.trim(), is_archived: 0 })
        .first();

      let internalListId: string;
      if (existing) {
        internalListId = existing.id;
        summary.listsSkipped++;
      } else {
        internalListId = randomUUID();
        const maxRow = await trx('lists').max('sort_order as m').first();
        const sortOrder = ((maxRow?.m as number | null) ?? -1) + 1;

        if (!dryRun) {
          await trx('lists').insert({
            id: internalListId,
            name: rtmList.name.trim(),
            is_smart: 0,
            smart_filter: null,
            is_archived: rtmList.date_archived ? 1 : 0,
            sort_order: sortOrder,
            created_at: msToISO(rtmList.date_created) ?? now,
            updated_at: msToISO(rtmList.date_modified) ?? now,
          });
        }
        summary.listsImported++;
      }

      listIdMap.set(rtmList.id, internalListId);

      if (!dryRun) {
        await trx('import_records').insert({
          id: randomUUID(),
          source: 'rtm',
          external_id: rtmList.id,
          entity_type: 'list',
          internal_id: internalListId,
          imported_at: now,
        }).onConflict(['source', 'external_id', 'entity_type']).ignore();
      }
    }

    // ── Import tasks ──────────────────────────────────────────────────────────
    for (const rtmTask of rtmTasks) {
      const isCompleted = !!rtmTask.date_completed;

      if (openOnly && isCompleted) {
        summary.tasksSkipped++;
        continue;
      }

      // Skip if already imported (idempotent by task id)
      const alreadyImported = await trx('import_records')
        .where({ source: 'rtm', external_id: rtmTask.id, entity_type: 'task' })
        .first();

      if (alreadyImported) {
        summary.tasksSkipped++;
        continue;
      }

      // Resolve list
      const internalListId = listIdMap.get(rtmTask.list_id);
      if (!internalListId) {
        // List wasn't imported (e.g. system list) — skip
        summary.tasksSkipped++;
        continue;
      }

      const dueDate = msToDate(rtmTask.date_due);
      const completedAt = msToISO(rtmTask.date_completed);
      const createdAt = msToISO(rtmTask.date_created ?? rtmTask.date_added) ?? now;
      const updatedAt = msToISO(rtmTask.date_modified) ?? now;
      const priority = mapPriority(rtmTask.priority ?? 'PN');
      const tags = Array.isArray(rtmTask.tags) ? rtmTask.tags : [];

      const internalTaskId = randomUUID();

      if (!dryRun) {
        try {
          await trx('tasks').insert({
            id: internalTaskId,
            list_id: internalListId,
            parent_id: null,
            series_id: rtmTask.series_id ?? null,
            title: (rtmTask.name || 'Untitled').trim(),
            description: null,
            priority,
            due_date: dueDate,
            rrule: null,
            is_completed: isCompleted ? 1 : 0,
            is_archived: 0,
            completed_at: completedAt,
            created_at: createdAt,
            updated_at: updatedAt,
          });

          if (tags.length > 0) {
            await trx('task_tags').insert(
              tags.map((tag) => ({ task_id: internalTaskId, tag: tag.toLowerCase().trim() }))
            );
          }

          await trx('import_records').insert({
            id: randomUUID(),
            source: 'rtm',
            external_id: rtmTask.id,
            entity_type: 'task',
            internal_id: internalTaskId,
            imported_at: now,
          });
        } catch (err: any) {
          summary.errors.push(`Task "${rtmTask.name}": ${err.message}`);
          continue;
        }
      }

      summary.tasksImported++;

      // ── Import notes for this task (matched via series_id) ────────────────
      const taskNotes = notesBySeries.get(rtmTask.series_id) ?? [];
      for (const note of taskNotes) {
        const noteBody = (note.content || note.title || '').trim();
        if (!noteBody) continue;

        const noteAlreadyDone = await trx('import_records')
          .where({ source: 'rtm', external_id: note.id, entity_type: 'note' })
          .first();
        if (noteAlreadyDone) continue;

        if (!dryRun) {
          try {
            const internalNoteId = randomUUID();
            const noteCreated = msToISO(note.date_created) ?? now;
            const noteUpdated = msToISO(note.date_modified) ?? now;

            await trx('task_notes').insert({
              id: internalNoteId,
              task_id: internalTaskId,
              body: noteBody,
              created_at: noteCreated,
              updated_at: noteUpdated,
            });

            await trx('import_records').insert({
              id: randomUUID(),
              source: 'rtm',
              external_id: note.id,
              entity_type: 'note',
              internal_id: internalNoteId,
              imported_at: now,
            });
          } catch (err: any) {
            summary.errors.push(`Note for task "${rtmTask.name}": ${err.message}`);
            continue;
          }
        }
        summary.notesImported++;
      }
    }

    // Force rollback for dry runs
    if (dryRun) throw new Error('DRY_RUN_ROLLBACK');

  }).catch((err: Error) => {
    if (err.message !== 'DRY_RUN_ROLLBACK') {
      summary.errors.push(`Transaction error: ${err.message}`);
    }
  });

  return summary;
}
