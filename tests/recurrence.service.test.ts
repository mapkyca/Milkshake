import { describe, it, expect } from 'vitest';
import {
  normaliseRRule,
  isValidRRule,
  getNextOccurrence,
  computeNextDueDate,
  describeRRule,
} from '../src/services/RecurrenceService';

describe('RecurrenceService', () => {
  it('should normalise RRULE string', () => {
    expect(normaliseRRule('RRULE:FREQ=DAILY')).toBe('FREQ=DAILY');
    expect(normaliseRRule('FREQ=WEEKLY')).toBe('FREQ=WEEKLY');
    expect(normaliseRRule('FREQ=EVERY 3 WEEKS')).toBe('FREQ=WEEKLY;INTERVAL=3');
    expect(normaliseRRule('EVERY 2 MONTHS')).toBe('FREQ=MONTHLY;INTERVAL=2');
    expect(normaliseRRule('EVERY 5 YEARS')).toBe('FREQ=YEARLY;INTERVAL=5');
    expect(normaliseRRule('EVERY 10 DAYS')).toBe('FREQ=DAILY;INTERVAL=10');
  });

  it('should validate RRULE', () => {
    expect(isValidRRule('FREQ=DAILY')).toBe(true);
    expect(isValidRRule('INVALID_RULE')).toBe(false);
    expect(isValidRRule('EVERY 3 WEEKS')).toBe(true);
    expect(isValidRRule('EVERY 2 MONTHS')).toBe(true);
  });

  it('should compute next occurrence', () => {
    const after = new Date('2026-05-30T12:00:00Z');
    const next = getNextOccurrence('FREQ=DAILY', after);
    expect(next).not.toBeNull();
    expect(next!.toISOString().slice(0, 10)).toBe('2026-05-31');
  });

  it('should compute next due date', () => {
    const nextDue = computeNextDueDate('FREQ=WEEKLY', '2026-05-30');
    // 2026-05-30 is Saturday, next week same day is 2026-06-06
    expect(nextDue).toBe('2026-06-06');
  });

  it('should fallback to tomorrow if rrule fails', () => {
    const nextDue = computeNextDueDate('INVALID_RULE', '2026-05-30');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(nextDue).toBe(tomorrow.toISOString().slice(0, 10));
  });

  it('should describe RRULE', () => {
    expect(describeRRule('FREQ=DAILY')).toBe('every day');
  });
});
