import { RRule } from 'rrule';
import { addDays } from 'date-fns';

/**
 * Normalise an RRULE string: strip the "RRULE:" prefix if present.
 */
export function normaliseRRule(raw: string): string {
  return raw.replace(/^RRULE:/i, '').trim();
}

/**
 * Validate that a string is a parseable RRULE.
 */
export function isValidRRule(raw: string): boolean {
  try {
    RRule.fromString(normaliseRRule(raw));
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the next occurrence after a given date, optionally starting from dtstart.
 * Returns null if the recurrence has ended.
 */
export function getNextOccurrence(rruleString: string, after: Date, dtstart?: Date): Date | null {
  try {
    const normalised = normaliseRRule(rruleString);
    const options = RRule.parseString(normalised);
    if (dtstart) {
      options.dtstart = dtstart;
    }
    const rule = new RRule(options);
    const next = rule.after(after, false);
    return next ?? null;
  } catch {
    try {
      const rule = RRule.fromString(normaliseRRule(rruleString));
      return rule.after(after, false) ?? null;
    } catch {
      return null;
    }
  }
}

/**
 * Given a completed task's due date and RRULE, compute the next due date.
 * Falls back to today+1 if the RRULE produces nothing useful.
 */
export function computeNextDueDate(rruleString: string, completedDueDate?: string | null): string {
  const afterDate = completedDueDate ? new Date(completedDueDate) : new Date();
  const next = getNextOccurrence(rruleString, afterDate, afterDate);
  if (next) {
    return next.toISOString().slice(0, 10); // YYYY-MM-DD
  }
  // Fallback: tomorrow
  return addDays(new Date(), 1).toISOString().slice(0, 10);
}

/**
 * Human-readable description of an RRULE (e.g. "every week on Monday").
 */
export function describeRRule(rruleString: string): string {
  try {
    const rule = RRule.fromString(normaliseRRule(rruleString));
    return rule.toText();
  } catch {
    return rruleString;
  }
}
