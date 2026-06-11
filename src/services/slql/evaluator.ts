import { QueryNode, EvaluationContext } from './types';
import type { Task, List } from '../../types';

export function evaluate(
  ast: QueryNode,
  tasks: Task[],
  lists: List[],
  context: EvaluationContext
): Task[] {
  const timezone = context.timezone || 'Europe/London';

  // 1. Calculate local reference dates
  const todayStr = getLocalDateString(context.now, timezone);

  const midday = getLocalMidday(context.now, timezone);

  const tomorrowStr = getLocalDateString(addOffset(midday, 1, 'day'), timezone);
  const yesterdayStr = getLocalDateString(addOffset(midday, -1, 'day'), timezone);

  // This Week & Next Week
  const dayOfWeek = midday.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.
  let thisWeekStartStr = '';
  let thisWeekEndStr = '';
  let nextWeekStartStr = '';
  let nextWeekEndStr = '';

  if (context.startOfWeek === 'monday') {
    const idx = (dayOfWeek + 6) % 7; // Monday = 0, Sunday = 6
    thisWeekStartStr = getLocalDateString(addOffset(midday, -idx, 'day'), timezone);
    thisWeekEndStr = getLocalDateString(addOffset(midday, 6 - idx, 'day'), timezone);
    nextWeekStartStr = getLocalDateString(addOffset(midday, 7 - idx, 'day'), timezone);
    nextWeekEndStr = getLocalDateString(addOffset(midday, 13 - idx, 'day'), timezone);
  } else {
    // sunday
    const idx = dayOfWeek; // Sunday = 0, Saturday = 6
    thisWeekStartStr = getLocalDateString(addOffset(midday, -idx, 'day'), timezone);
    thisWeekEndStr = getLocalDateString(addOffset(midday, 6 - idx, 'day'), timezone);
    nextWeekStartStr = getLocalDateString(addOffset(midday, 7 - idx, 'day'), timezone);
    nextWeekEndStr = getLocalDateString(addOffset(midday, 13 - idx, 'day'), timezone);
  }

  // This Month & Next Month
  const [y, m, d] = todayStr.split('-').map(Number);
  const thisMonthStartStr = `${y}-${String(m).padStart(2, '0')}-01`;
  const thisMonthEndStr = getLocalDateString(
    addOffset(new Date(Date.UTC(y, m, 1, 12, 0, 0)), -1, 'day'),
    timezone
  );
  const nextMonthStartStr = getLocalDateString(new Date(Date.UTC(y, m, 1, 12, 0, 0)), timezone);
  const nextMonthEndStr = getLocalDateString(
    addOffset(new Date(Date.UTC(y, m + 1, 1, 12, 0, 0)), -1, 'day'),
    timezone
  );

  const datesInfo = {
    todayStr,
    tomorrowStr,
    yesterdayStr,
    thisWeekStartStr,
    thisWeekEndStr,
    nextWeekStartStr,
    nextWeekEndStr,
    thisMonthStartStr,
    thisMonthEndStr,
    nextMonthStartStr,
    nextMonthEndStr,
    midday,
  };

  const checkSubtasks = queriesSubtasks(ast);

  // Filter tasks
  return tasks.filter((task) => {
    // Heuristic: skip subtasks unless specifically queried
    if (task.parentId && !checkSubtasks) {
      return false;
    }

    return matchNode(ast, task, lists, datesInfo, timezone);
  });
}

function matchNode(
  node: QueryNode,
  task: Task,
  lists: List[],
  datesInfo: any,
  timezone: string
): boolean {
  if (node.type === 'and') {
    return node.children.every((child) => matchNode(child, task, lists, datesInfo, timezone));
  }
  if (node.type === 'or') {
    return node.children.some((child) => matchNode(child, task, lists, datesInfo, timezone));
  }
  if (node.type === 'not') {
    return !matchNode(node.child, task, lists, datesInfo, timezone);
  }

  const { field, operator, value } = node;

  // Status match
  if (field === 'status') {
    if (value === 'completed') return task.isCompleted;
    if (value === 'incomplete') return !task.isCompleted;
    if (value === 'any') return true;
    return false;
  }

  // Priority match
  if (field === 'priority') {
    if (value === 'any') return task.priority > 0;
    if (value === 'none') return task.priority === 0;

    const numericVal = parseInt(value, 10);
    const taskPriority = task.priority;

    if (operator === '=') return taskPriority === numericVal;
    if (operator === ':') return taskPriority === numericVal;
    if (operator === '<=') return taskPriority >= 1 && taskPriority <= numericVal;
    if (operator === '>=') return taskPriority >= numericVal && taskPriority <= 3;
    if (operator === '<') return taskPriority >= 1 && taskPriority < numericVal;
    if (operator === '>') return taskPriority > numericVal && taskPriority <= 3;
    return false;
  }

  // List match
  if (field === 'list') {
    const list = lists.find((l) => l.id === task.listId);
    const listName = list ? list.name : '';
    const matchVal = value.toLowerCase();
    return listName.toLowerCase() === matchVal || task.listId === value;
  }

  // Tag match
  if (field === 'tag') {
    const tags = task.tags || [];
    return tags.some((t) => t.toLowerCase() === value.toLowerCase());
  }

  // Recurrence match
  if (field === 'repeat') {
    const hasRrule = !!task.rrule;
    if (value === 'any') return hasRrule;
    if (value === 'none') return !hasRrule;
    return false;
  }

  // Subtask related matches
  if (field === 'is') {
    if (value === 'subtask') return !!task.parentId;
    if (value === 'repeating') return !!task.rrule;
    return false;
  }

  if (field === 'has') {
    if (value === 'subtasks') return !!task.subtasks && task.subtasks.length > 0;
    if (value === 'url') return hasUrl(task);
    return false;
  }

  if (field === 'parent') {
    const hasParent = !!task.parentId;
    if (value === 'any') return hasParent;
    if (value === 'none') return !hasParent;
    return false;
  }

  // Text search
  if (field === 'text') {
    return containsText(task, value);
  }
  if (field === 'title') {
    return task.title.toLowerCase().includes(value.toLowerCase());
  }
  if (field === 'description') {
    return (
      (task.description || '').toLowerCase().includes(value.toLowerCase()) ||
      (task.notes || []).some((n) => n.body.toLowerCase().includes(value.toLowerCase()))
    );
  }

  // URL matching
  if (field === 'url') {
    return (
      (task.description || '').toLowerCase().includes(value.toLowerCase()) ||
      (task.notes || []).some((n) => n.body.toLowerCase().includes(value.toLowerCase()))
    );
  }

  // Estimate matching (mock metadata logic)
  if (field === 'estimate') {
    if (value === 'none') return true;
    if (value === 'any') return false;
    return false;
  }

  // Date fields (due, added, completed, created, updated)
  if (
    field === 'due' ||
    field === 'added' ||
    field === 'completed' ||
    field === 'created' ||
    field === 'updated'
  ) {
    let taskDateStr: string | null = null;
    if (field === 'due') {
      taskDateStr = task.dueDate || null;
    } else if (field === 'added' || field === 'created') {
      taskDateStr = getLocalDateStringFromISO(task.createdAt, timezone);
    } else if (field === 'updated') {
      taskDateStr = getLocalDateStringFromISO(task.updatedAt, timezone);
    } else if (field === 'completed') {
      taskDateStr = getLocalDateStringFromISO(task.completedAt, timezone);
    }

    const isComparison = operator === '<' || operator === '<=' || operator === '>' || operator === '>=';

    if (isComparison) {
      if (taskDateStr === null) return false;
      if (operator === '<') return taskDateStr < value;
      if (operator === '<=') return taskDateStr <= value;
      if (operator === '>') return taskDateStr > value;
      if (operator === '>=') return taskDateStr >= value;
      return false;
    }

    // Exact shortcuts or direct matching
    if (value === 'never') return taskDateStr === null;
    if (value === 'any') return taskDateStr !== null;

    if (taskDateStr === null) return false;

    if (value === 'today') return taskDateStr === datesInfo.todayStr;
    if (value === 'tomorrow') return taskDateStr === datesInfo.tomorrowStr;
    if (value === 'yesterday') return taskDateStr === datesInfo.yesterdayStr;
    if (value === 'this-week') {
      return taskDateStr >= datesInfo.thisWeekStartStr && taskDateStr <= datesInfo.thisWeekEndStr;
    }
    if (value === 'next-week') {
      return taskDateStr >= datesInfo.nextWeekStartStr && taskDateStr <= datesInfo.nextWeekEndStr;
    }
    if (value === 'this-month') {
      return taskDateStr >= datesInfo.thisMonthStartStr && taskDateStr <= datesInfo.thisMonthEndStr;
    }
    if (value === 'next-month') {
      return taskDateStr >= datesInfo.nextMonthStartStr && taskDateStr <= datesInfo.nextMonthEndStr;
    }
    if (value === 'overdue') {
      if (field !== 'due') return false;
      return taskDateStr < datesInfo.todayStr && !task.isCompleted;
    }

    // Plain date literal
    return taskDateStr === value;
  }

  // Date windows (dueWithin, addedWithin, completedWithin, createdWithin, updatedWithin)
  if (field.endsWith('Within')) {
    let taskDateStr: string | null = null;
    if (field === 'dueWithin') {
      taskDateStr = task.dueDate || null;
    } else if (field === 'addedWithin' || field === 'createdWithin') {
      taskDateStr = getLocalDateStringFromISO(task.createdAt, timezone);
    } else if (field === 'updatedWithin') {
      taskDateStr = getLocalDateStringFromISO(task.updatedAt, timezone);
    } else if (field === 'completedWithin') {
      taskDateStr = getLocalDateStringFromISO(task.completedAt, timezone);
    }

    if (taskDateStr === null) return false;

    const parsedWindow = parseRelativeWindow(value);
    if (!parsedWindow) return false;

    const { qty, unit } = parsedWindow;

    if (field === 'dueWithin') {
      // Future window: today <= taskDate <= today + window
      const startStr = datesInfo.todayStr;
      const endMidday = addOffset(datesInfo.midday, qty, unit);
      const endStr = getLocalDateString(endMidday, timezone);
      return taskDateStr >= startStr && taskDateStr <= endStr;
    } else {
      // Past window: today - window <= taskDate <= today
      const startMidday = addOffset(datesInfo.midday, -qty, unit);
      const startStr = getLocalDateString(startMidday, timezone);
      const endStr = datesInfo.todayStr;
      return taskDateStr >= startStr && taskDateStr <= endStr;
    }
  }

  return false;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getLocalDateString(date: Date, timezone: string): string {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((p) => p.type === 'year')!.value;
  const month = parts.find((p) => p.type === 'month')!.value;
  const day = parts.find((p) => p.type === 'day')!.value;
  return `${year}-${month}-${day}`;
}

function getLocalMidday(now: Date, timezone: string): Date {
  const dateStr = getLocalDateString(now, timezone);
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

function getLocalDateStringFromISO(
  isoStr: string | null | undefined,
  timezone: string
): string | null {
  if (!isoStr) return null;
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return null;
    return getLocalDateString(d, timezone);
  } catch {
    return null;
  }
}

function addOffset(midday: Date, qty: number, unit: string): Date {
  const result = new Date(midday.getTime());
  const lowerUnit = unit.toLowerCase();
  if (lowerUnit.startsWith('day')) {
    result.setUTCDate(result.getUTCDate() + qty);
  } else if (lowerUnit.startsWith('week')) {
    result.setUTCDate(result.getUTCDate() + qty * 7);
  } else if (lowerUnit.startsWith('month')) {
    result.setUTCMonth(result.getUTCMonth() + qty);
  }
  return result;
}

function parseRelativeWindow(value: string) {
  const match = value.match(/^(\d+)\s+(day|days|week|weeks|month|months)(?:\s+of\s+today)?$/i);
  if (!match) return null;
  return {
    qty: parseInt(match[1], 10),
    unit: match[2].toLowerCase(),
  };
}

function hasUrl(task: Task): boolean {
  const urlPattern = /https?:\/\/[^\s]+/i;
  if (urlPattern.test(task.description || '')) return true;
  return (task.notes || []).some((n) => urlPattern.test(n.body));
}

function containsText(task: Task, query: string): boolean {
  const q = query.toLowerCase();
  if (task.title.toLowerCase().includes(q)) return true;
  if ((task.description || '').toLowerCase().includes(q)) return true;
  if ((task.notes || []).some((n) => n.body.toLowerCase().includes(q))) return true;
  return false;
}

function queriesSubtasks(node: QueryNode): boolean {
  if (node.type === 'and' || node.type === 'or') {
    return node.children.some(queriesSubtasks);
  }
  if (node.type === 'not') {
    return queriesSubtasks(node.child);
  }
  return (
    node.field === 'parent' ||
    (node.field === 'is' && node.value === 'subtask') ||
    (node.field === 'has' && node.value === 'subtasks')
  );
}
