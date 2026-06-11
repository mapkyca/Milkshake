import { describe, it, expect } from 'vitest';
import { tokenize } from '../src/services/slql/tokenizer';
import { parse } from '../src/services/slql/parser';
import { normalize } from '../src/services/slql/normalizer';
import { validate } from '../src/services/slql/validator';
import { evaluate } from '../src/services/slql/evaluator';
import { evaluateSLQL, ParseError, TokenizeError, ValidationError } from '../src/services/slql';
import { translateRTMFilter } from '../src/services/ImportService';
import type { Task, List } from '../src/types';
import type { EvaluationContext } from '../src/services/slql/types';

// ─── Test fixtures ────────────────────────────────────────────────────────────

const CTX_LONDON: EvaluationContext = {
  now: new Date('2026-06-11T12:00:00Z'),
  timezone: 'Europe/London',
  startOfWeek: 'monday',
};

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    listId: 'list-1',
    title: 'Test task',
    priority: 0,
    isCompleted: false,
    isArchived: false,
    createdAt: '2026-06-01T10:00:00Z',
    updatedAt: '2026-06-01T10:00:00Z',
    tags: [],
    ...overrides,
  };
}

function makeList(overrides: Partial<List> = {}): List {
  return {
    id: 'list-1',
    name: 'Inbox',
    isSmart: false,
    isArchived: false,
    sortOrder: 0,
    isEnabled: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ─── Tokenizer tests ──────────────────────────────────────────────────────────

describe('Tokenizer', () => {
  it('should tokenize simple field:value', () => {
    const tokens = tokenize('tag:finance');
    expect(tokens.map(t => t.type)).toEqual(['VALUE', 'COLON', 'VALUE', 'EOF']);
    expect(tokens[0].value).toBe('tag');
    expect(tokens[2].value).toBe('finance');
  });

  it('should tokenize quoted strings', () => {
    const tokens = tokenize('tag:"house admin"');
    expect(tokens[2].type).toBe('VALUE');
    expect(tokens[2].value).toBe('house admin');
  });

  it('should tokenize reserved word AND as AND token', () => {
    const tokens = tokenize('tag:a and tag:b');
    const types = tokens.map(t => t.type);
    expect(types).toContain('AND');
  });

  it('should tokenize reserved word OR as OR token', () => {
    const tokens = tokenize('tag:a or tag:b');
    const types = tokens.map(t => t.type);
    expect(types).toContain('OR');
  });

  it('should tokenize reserved word NOT as NOT token', () => {
    const tokens = tokenize('not tag:someday');
    expect(tokens[0].type).toBe('NOT');
  });

  it('should tokenize case-insensitive reserved words', () => {
    const tokens = tokenize('tag:a AND tag:b OR tag:c NOT tag:d');
    const types = tokens.map(t => t.type);
    expect(types).toContain('AND');
    expect(types).toContain('OR');
    expect(types).toContain('NOT');
  });

  it('should tokenize comparison operators', () => {
    const tokens = tokenize('priority<=2');
    const types = tokens.map(t => t.type);
    expect(types).toContain('LESS_EQUALS');
  });

  it('should tokenize all comparison operators', () => {
    expect(tokenize('due<2026-01-01').map(t => t.type)).toContain('LESS');
    expect(tokenize('due<=2026-01-01').map(t => t.type)).toContain('LESS_EQUALS');
    expect(tokenize('due>2026-01-01').map(t => t.type)).toContain('GREATER');
    expect(tokenize('due>=2026-01-01').map(t => t.type)).toContain('GREATER_EQUALS');
    expect(tokenize('due=2026-01-01').map(t => t.type)).toContain('EQUALS');
  });

  it('should handle reserved words as quoted values', () => {
    const tokens = tokenize('tag:"not"');
    expect(tokens[2].type).toBe('VALUE');
    expect(tokens[2].value).toBe('not');
  });

  it('should provide line and column in tokens', () => {
    const tokens = tokenize('tag:finance');
    expect(tokens[0].line).toBe(1);
    expect(tokens[0].column).toBe(1);
  });

  it('should throw on unclosed quote', () => {
    expect(() => tokenize('tag:"unclosed')).toThrow(TokenizeError);
  });
});

// ─── Parser tests ─────────────────────────────────────────────────────────────

describe('Parser', () => {
  it('should parse simple field:value term', () => {
    const ast = parse(tokenize('tag:finance'));
    expect(ast.type).toBe('term');
    if (ast.type === 'term') {
      expect(ast.field).toBe('tag');
      expect(ast.operator).toBe(':');
      expect(ast.value).toBe('finance');
    }
  });

  it('should parse explicit AND', () => {
    const ast = parse(tokenize('tag:finance and due:today'));
    expect(ast.type).toBe('and');
  });

  it('should parse implicit AND (adjacent terms)', () => {
    const ast = parse(tokenize('tag:finance due:today'));
    expect(ast.type).toBe('and');
  });

  it('should parse OR', () => {
    const ast = parse(tokenize('tag:finance or tag:tax'));
    expect(ast.type).toBe('or');
  });

  it('should parse NOT', () => {
    const ast = parse(tokenize('not tag:someday'));
    expect(ast.type).toBe('not');
  });

  it('should parse parentheses grouping', () => {
    const ast = parse(tokenize('status:incomplete and (tag:finance or tag:tax)'));
    expect(ast.type).toBe('and');
    if (ast.type === 'and') {
      expect(ast.children[1].type).toBe('or');
    }
  });

  it('should respect operator precedence: NOT > AND > OR', () => {
    const ast = parse(tokenize('not tag:someday and due:today or priority:1'));
    // Expected: ((not tag:someday) and due:today) or priority:1
    expect(ast.type).toBe('or');
    if (ast.type === 'or') {
      expect(ast.children[0].type).toBe('and');
      if (ast.children[0].type === 'and') {
        expect(ast.children[0].children[0].type).toBe('not');
      }
    }
  });

  it('should parse bare text as field-less term', () => {
    const ast = parse(tokenize('insurance'));
    expect(ast.type).toBe('term');
    if (ast.type === 'term') {
      expect(ast.field).toBe('');
      expect(ast.value).toBe('insurance');
    }
  });

  it('should parse comparison operator terms', () => {
    const ast = parse(tokenize('priority<=2'));
    expect(ast.type).toBe('term');
    if (ast.type === 'term') {
      expect(ast.field).toBe('priority');
      expect(ast.operator).toBe('<=');
      expect(ast.value).toBe('2');
    }
  });

  it('should throw on unbalanced parenthesis', () => {
    expect(() => parse(tokenize('tag:finance and (due:today'))).toThrow(ParseError);
  });

  it('should throw on empty query', () => {
    expect(() => parse(tokenize(''))).toThrow(ParseError);
  });
});

// ─── Normalizer tests ─────────────────────────────────────────────────────────

describe('Normalizer', () => {
  it('should normalize hasTag to tag', () => {
    const ast = parse(tokenize('hasTag:finance'));
    const norm = normalize(ast);
    expect(norm.type).toBe('and');
    if (norm.type === 'and') {
      const tagTerm = norm.children.find(c => c.type === 'term' && c.field === 'tag');
      expect(tagTerm).toBeDefined();
    }
  });

  it('should normalize dueBefore to due<', () => {
    const ast = parse(tokenize('dueBefore:2026-06-17'));
    const norm = normalize(ast);
    if (norm.type === 'and') {
      const dueTerm = norm.children.find(c => c.type === 'term' && c.field === 'due');
      expect(dueTerm).toBeDefined();
      if (dueTerm?.type === 'term') expect(dueTerm.operator).toBe('<');
    }
  });

  it('should normalize dueAfter to due>', () => {
    const ast = parse(tokenize('dueAfter:2026-06-17'));
    const norm = normalize(ast);
    if (norm.type === 'and') {
      const dueTerm = norm.children.find(c => c.type === 'term' && c.field === 'due');
      if (dueTerm?.type === 'term') expect(dueTerm.operator).toBe('>');
    }
  });

  it('should normalize dueOn to due=', () => {
    const ast = parse(tokenize('dueOn:2026-06-17'));
    const norm = normalize(ast);
    if (norm.type === 'and') {
      const dueTerm = norm.children.find(c => c.type === 'term' && c.field === 'due');
      if (dueTerm?.type === 'term') expect(dueTerm.operator).toBe('=');
    }
  });

  it('should normalize bare text to text field', () => {
    const ast = parse(tokenize('insurance'));
    const norm = normalize(ast);
    if (norm.type === 'and') {
      const textTerm = norm.children.find(c => c.type === 'term' && c.field === 'text');
      expect(textTerm).toBeDefined();
    }
  });

  it('should normalize is:repeating to repeat:any', () => {
    const ast = parse(tokenize('is:repeating'));
    const norm = normalize(ast);
    if (norm.type === 'and') {
      const repeatTerm = norm.children.find(c => c.type === 'term' && c.field === 'repeat');
      expect(repeatTerm).toBeDefined();
      if (repeatTerm?.type === 'term') expect(repeatTerm.value).toBe('any');
    }
  });

  it('should inject status:incomplete by default', () => {
    const ast = parse(tokenize('tag:finance'));
    const norm = normalize(ast);
    expect(norm.type).toBe('and');
    if (norm.type === 'and') {
      const statusTerm = norm.children.find(
        c => c.type === 'term' && c.field === 'status'
      );
      expect(statusTerm).toBeDefined();
      if (statusTerm?.type === 'term') expect(statusTerm.value).toBe('incomplete');
    }
  });

  it('should NOT inject status if status is explicit', () => {
    const ast = parse(tokenize('status:any and tag:finance'));
    const norm = normalize(ast);
    if (norm.type === 'and') {
      const statusTerms = norm.children.filter(
        c => c.type === 'term' && c.field === 'status'
      );
      expect(statusTerms).toHaveLength(1);
    }
  });

  it('should inject status:completed when completedWithin is used', () => {
    const ast = parse(tokenize('completedWithin:"7 days"'));
    const norm = normalize(ast);
    if (norm.type === 'and') {
      const statusTerm = norm.children.find(
        c => c.type === 'term' && c.field === 'status'
      );
      expect(statusTerm).toBeDefined();
      if (statusTerm?.type === 'term') expect(statusTerm.value).toBe('completed');
    }
  });
});

// ─── Validator tests ──────────────────────────────────────────────────────────

describe('Validator', () => {
  it('should accept valid status fields', () => {
    expect(() => validate(normalize(parse(tokenize('status:incomplete'))))).not.toThrow();
    expect(() => validate(normalize(parse(tokenize('status:completed'))))).not.toThrow();
    expect(() => validate(normalize(parse(tokenize('status:any'))))).not.toThrow();
  });

  it('should reject invalid status value', () => {
    expect(() => validate(normalize(parse(tokenize('status:open'))))).toThrow(ValidationError);
  });

  it('should accept valid priority values', () => {
    for (const p of ['1', '2', '3', 'none', 'any']) {
      expect(() => validate(normalize(parse(tokenize(`priority:${p}`))))).not.toThrow();
    }
  });

  it('should reject invalid priority value', () => {
    expect(() => validate(normalize(parse(tokenize('priority:urgent'))))).toThrow(ValidationError);
    expect(() => {}).not.toThrow();
  });

  it('should produce actionable error for priority:urgent', () => {
    try {
      validate(normalize(parse(tokenize('priority:urgent'))));
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.message).toMatch(/Invalid priority "urgent"/);
      expect(err.message).toMatch(/Expected 1, 2, 3, none, or any/);
    }
  });

  it('should reject unknown field', () => {
    try {
      validate(normalize(parse(tokenize('frobnicate:yes'))));
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.message).toMatch(/Unknown smart-list field "frobnicate"/);
    }
  });

  it('should accept valid date shortcuts', () => {
    const shortcuts = ['today', 'tomorrow', 'yesterday', 'this-week', 'next-week', 'this-month', 'next-month', 'overdue', 'never', 'any'];
    for (const s of shortcuts) {
      expect(() => validate(normalize(parse(tokenize(`due:${s}`))))).not.toThrow();
    }
  });

  it('should accept valid date literals', () => {
    expect(() => validate(normalize(parse(tokenize('due:2026-06-17'))))).not.toThrow();
    expect(() => validate(normalize(parse(tokenize('due<2026-06-17'))))).not.toThrow();
    expect(() => validate(normalize(parse(tokenize('due<=2026-06-17'))))).not.toThrow();
    expect(() => validate(normalize(parse(tokenize('due>2026-06-17'))))).not.toThrow();
    expect(() => validate(normalize(parse(tokenize('due>=2026-06-17'))))).not.toThrow();
  });

  it('should reject invalid date value', () => {
    expect(() => validate(normalize(parse(tokenize('due:baddate'))))).toThrow(ValidationError);
  });

  it('should reject comparison operator with non-date value', () => {
    expect(() => validate(normalize(parse(tokenize('due<today'))))).toThrow(ValidationError);
  });

  it('should accept valid dueWithin expressions', () => {
    const windows = ['"1 day"', '"7 days"', '"1 week"', '"1 month"', '"1 day of today"', '"2 weeks of today"'];
    for (const w of windows) {
      expect(() => validate(normalize(parse(tokenize(`dueWithin:${w}`))))).not.toThrow();
    }
  });

  it('should reject invalid dueWithin value', () => {
    expect(() => validate(normalize(parse(tokenize('dueWithin:"5 years"'))))).toThrow(ValidationError);
  });

  it('should accept valid repeat values', () => {
    expect(() => validate(normalize(parse(tokenize('repeat:any'))))).not.toThrow();
    expect(() => validate(normalize(parse(tokenize('repeat:none'))))).not.toThrow();
  });

  it('should reject invalid repeat value', () => {
    expect(() => validate(normalize(parse(tokenize('repeat:monthly'))))).toThrow(ValidationError);
  });
});

// ─── Evaluator tests ──────────────────────────────────────────────────────────

describe('Evaluator - Status', () => {
  it('should match incomplete task with status:incomplete', () => {
    const task = makeTask({ isCompleted: false });
    const result = evaluateSLQL('status:incomplete', [task], [makeList()], CTX_LONDON);
    expect(result).toHaveLength(1);
  });

  it('should match completed task with status:completed', () => {
    const task = makeTask({ isCompleted: true, completedAt: '2026-06-01T10:00:00Z' });
    const result = evaluateSLQL('status:completed', [task], [makeList()], CTX_LONDON);
    expect(result).toHaveLength(1);
  });

  it('should match any task with status:any', () => {
    const tasks = [makeTask(), makeTask({ id: 'task-2', isCompleted: true })];
    const result = evaluateSLQL('status:any', tasks, [makeList()], CTX_LONDON);
    expect(result).toHaveLength(2);
  });

  it('should not match completed task with status:incomplete', () => {
    const task = makeTask({ isCompleted: true });
    const result = evaluateSLQL('status:incomplete', [task], [makeList()], CTX_LONDON);
    expect(result).toHaveLength(0);
  });
});

describe('Evaluator - Priority', () => {
  it('should match priority:1', () => {
    const task = makeTask({ priority: 1 });
    expect(evaluateSLQL('status:any and priority:1', [task], [makeList()], CTX_LONDON)).toHaveLength(1);
  });

  it('should NOT match priority:1 for priority 2 task', () => {
    const task = makeTask({ priority: 2 });
    expect(evaluateSLQL('status:any and priority:1', [task], [makeList()], CTX_LONDON)).toHaveLength(0);
  });

  it('should match priority:none for no-priority task', () => {
    const task = makeTask({ priority: 0 });
    expect(evaluateSLQL('status:any and priority:none', [task], [makeList()], CTX_LONDON)).toHaveLength(1);
  });

  it('should match priority<=2 for tasks with P1 or P2', () => {
    const p1 = makeTask({ id: 't1', priority: 1 });
    const p2 = makeTask({ id: 't2', priority: 2 });
    const p3 = makeTask({ id: 't3', priority: 3 });
    const pn = makeTask({ id: 't4', priority: 0 });
    const result = evaluateSLQL('status:any and priority<=2', [p1, p2, p3, pn], [makeList()], CTX_LONDON);
    expect(result.map(t => t.id)).toEqual(expect.arrayContaining(['t1', 't2']));
    expect(result.map(t => t.id)).not.toContain('t3');
    expect(result.map(t => t.id)).not.toContain('t4');
  });

  it('should match priority:any for tasks with a set priority', () => {
    const taskWithPri = makeTask({ id: 't1', priority: 2 });
    const taskNoPri = makeTask({ id: 't2', priority: 0 });
    const result = evaluateSLQL('status:any and priority:any', [taskWithPri, taskNoPri], [makeList()], CTX_LONDON);
    expect(result.map(t => t.id)).toEqual(['t1']);
  });
});

describe('Evaluator - Tags', () => {
  it('should match task with correct tag', () => {
    const task = makeTask({ tags: ['finance', 'tax'] });
    expect(evaluateSLQL('tag:finance', [task], [makeList()], CTX_LONDON)).toHaveLength(1);
  });

  it('should be case-insensitive for tags', () => {
    const task = makeTask({ tags: ['Finance'] });
    expect(evaluateSLQL('tag:finance', [task], [makeList()], CTX_LONDON)).toHaveLength(1);
  });

  it('should NOT match task without the tag', () => {
    const task = makeTask({ tags: ['other'] });
    expect(evaluateSLQL('tag:finance', [task], [makeList()], CTX_LONDON)).toHaveLength(0);
  });

  it('should match "not tag:someday"', () => {
    const task = makeTask({ tags: ['finance'] });
    expect(evaluateSLQL('not tag:someday', [task], [makeList()], CTX_LONDON)).toHaveLength(1);
    const taskWithSomeday = makeTask({ id: 't2', tags: ['someday'] });
    const result = evaluateSLQL('not tag:someday', [task, taskWithSomeday], [makeList()], CTX_LONDON);
    expect(result.map(t => t.id)).toEqual(['task-1']);
  });
});

describe('Evaluator - List', () => {
  it('should match task in specified list (by name)', () => {
    const list = makeList({ id: 'l1', name: 'Inbox' });
    const task = makeTask({ listId: 'l1' });
    expect(evaluateSLQL('status:any and list:Inbox', [task], [list], CTX_LONDON)).toHaveLength(1);
  });

  it('should be case-insensitive for list name', () => {
    const list = makeList({ id: 'l1', name: 'Inbox' });
    const task = makeTask({ listId: 'l1' });
    expect(evaluateSLQL('status:any and list:inbox', [task], [list], CTX_LONDON)).toHaveLength(1);
  });
});

describe('Evaluator - Due Date', () => {
  // CTX_LONDON.now = 2026-06-11 (Thursday)
  // Week starts Monday -> this week = 2026-06-08 to 2026-06-14
  // next week = 2026-06-15 to 2026-06-21

  it('should match due:today', () => {
    const task = makeTask({ dueDate: '2026-06-11' });
    expect(evaluateSLQL('status:any and due:today', [task], [makeList()], CTX_LONDON)).toHaveLength(1);
  });

  it('should NOT match due:today for other dates', () => {
    const task = makeTask({ dueDate: '2026-06-12' });
    expect(evaluateSLQL('status:any and due:today', [task], [makeList()], CTX_LONDON)).toHaveLength(0);
  });

  it('should match due:tomorrow', () => {
    const task = makeTask({ dueDate: '2026-06-12' });
    expect(evaluateSLQL('status:any and due:tomorrow', [task], [makeList()], CTX_LONDON)).toHaveLength(1);
  });

  it('should match due:yesterday', () => {
    const task = makeTask({ dueDate: '2026-06-10' });
    expect(evaluateSLQL('status:any and due:yesterday', [task], [makeList()], CTX_LONDON)).toHaveLength(1);
  });

  it('should match due:this-week for date within the current week', () => {
    const task = makeTask({ dueDate: '2026-06-09' });
    expect(evaluateSLQL('status:any and due:this-week', [task], [makeList()], CTX_LONDON)).toHaveLength(1);
  });

  it('should match due:next-week correctly', () => {
    const task = makeTask({ dueDate: '2026-06-16' });
    expect(evaluateSLQL('status:any and due:next-week', [task], [makeList()], CTX_LONDON)).toHaveLength(1);
  });

  it('should match due:never for tasks without due date', () => {
    const task = makeTask({ dueDate: null });
    expect(evaluateSLQL('status:any and due:never', [task], [makeList()], CTX_LONDON)).toHaveLength(1);
  });

  it('should match due:any for tasks with due date', () => {
    const withDue = makeTask({ id: 't1', dueDate: '2026-06-11' });
    const noDue = makeTask({ id: 't2', dueDate: null });
    const result = evaluateSLQL('status:any and due:any', [withDue, noDue], [makeList()], CTX_LONDON);
    expect(result.map(t => t.id)).toEqual(['t1']);
  });

  it('should match due:overdue for past-due incomplete tasks', () => {
    const overdueTask = makeTask({ dueDate: '2026-06-01', isCompleted: false });
    expect(evaluateSLQL('status:any and due:overdue', [overdueTask], [makeList()], CTX_LONDON)).toHaveLength(1);
  });

  it('should NOT match due:overdue for completed past-due tasks', () => {
    const doneTask = makeTask({ dueDate: '2026-06-01', isCompleted: true });
    expect(evaluateSLQL('status:any and due:overdue', [doneTask], [makeList()], CTX_LONDON)).toHaveLength(0);
  });

  it('should match due<2026-06-17 for dates before that', () => {
    const task = makeTask({ dueDate: '2026-06-11' });
    expect(evaluateSLQL('status:any and due<2026-06-17', [task], [makeList()], CTX_LONDON)).toHaveLength(1);
  });

  it('should match due>=2026-06-11 for same-day task', () => {
    const task = makeTask({ dueDate: '2026-06-11' });
    expect(evaluateSLQL('status:any and due>=2026-06-11', [task], [makeList()], CTX_LONDON)).toHaveLength(1);
  });

  it('matches due:this-week in Europe/London timezone correctly', () => {
    // 2026-06-11 is a Thursday; this week Monday->Sunday is 2026-06-08 to 2026-06-14
    const ctx = { ...CTX_LONDON, timezone: 'Europe/London' };
    const monTask = makeTask({ id: 't1', dueDate: '2026-06-08' });
    const sunTask = makeTask({ id: 't2', dueDate: '2026-06-14' });
    const outTask = makeTask({ id: 't3', dueDate: '2026-06-15' });
    const result = evaluateSLQL('status:any and due:this-week', [monTask, sunTask, outTask], [makeList()], ctx);
    expect(result.map(t => t.id)).toEqual(expect.arrayContaining(['t1', 't2']));
    expect(result.map(t => t.id)).not.toContain('t3');
  });
});

describe('Evaluator - Relative Date Windows', () => {
  it('should match dueWithin:"7 days"', () => {
    const task = makeTask({ dueDate: '2026-06-15' });
    expect(evaluateSLQL('status:any and dueWithin:"7 days"', [task], [makeList()], CTX_LONDON)).toHaveLength(1);
  });

  it('should NOT match dueWithin:"7 days" for task outside window', () => {
    const task = makeTask({ dueDate: '2026-06-25' });
    expect(evaluateSLQL('status:any and dueWithin:"7 days"', [task], [makeList()], CTX_LONDON)).toHaveLength(0);
  });

  it('should match completedWithin:"7 days" for recently completed task', () => {
    const task = makeTask({ isCompleted: true, completedAt: '2026-06-08T10:00:00Z' });
    expect(evaluateSLQL('status:completed and completedWithin:"7 days"', [task], [makeList()], CTX_LONDON)).toHaveLength(1);
  });

  it('should NOT match completedWithin for old completed task', () => {
    const task = makeTask({ isCompleted: true, completedAt: '2026-05-01T10:00:00Z' });
    expect(evaluateSLQL('status:completed and completedWithin:"7 days"', [task], [makeList()], CTX_LONDON)).toHaveLength(0);
  });
});

describe('Evaluator - Text Search', () => {
  it('should match text: searching title', () => {
    const task = makeTask({ title: 'Submit insurance claim' });
    expect(evaluateSLQL('text:insurance', [task], [makeList()], CTX_LONDON)).toHaveLength(1);
  });

  it('should match title: only in title', () => {
    const task = makeTask({ title: 'Important report', description: 'tax info' });
    expect(evaluateSLQL('status:any and title:report', [task], [makeList()], CTX_LONDON)).toHaveLength(1);
    expect(evaluateSLQL('status:any and title:tax', [task], [makeList()], CTX_LONDON)).toHaveLength(0);
  });

  it('should be case-insensitive for text search', () => {
    const task = makeTask({ title: 'Insurance Policy' });
    expect(evaluateSLQL('text:insurance', [task], [makeList()], CTX_LONDON)).toHaveLength(1);
  });
});

describe('Evaluator - Recurrence', () => {
  it('should match repeat:any for tasks with rrule', () => {
    const task = makeTask({ rrule: 'FREQ=WEEKLY' });
    expect(evaluateSLQL('status:any and repeat:any', [task], [makeList()], CTX_LONDON)).toHaveLength(1);
  });

  it('should match repeat:none for tasks without rrule', () => {
    const task = makeTask({ rrule: null });
    expect(evaluateSLQL('status:any and repeat:none', [task], [makeList()], CTX_LONDON)).toHaveLength(1);
  });

  it('should match is:repeating (normalized to repeat:any)', () => {
    const task = makeTask({ rrule: 'FREQ=DAILY' });
    expect(evaluateSLQL('status:any and is:repeating', [task], [makeList()], CTX_LONDON)).toHaveLength(1);
  });
});

describe('Evaluator - Subtask rules', () => {
  it('should exclude subtasks by default', () => {
    const parent = makeTask({ id: 'parent', parentId: null });
    const child = makeTask({ id: 'child', parentId: 'parent' });
    const result = evaluateSLQL('status:any', [parent, child], [makeList()], CTX_LONDON);
    expect(result.map(t => t.id)).toEqual(['parent']);
  });

  it('should include subtasks when is:subtask is queried', () => {
    const parent = makeTask({ id: 'parent', parentId: null });
    const child = makeTask({ id: 'child', parentId: 'parent' });
    const result = evaluateSLQL('status:any and is:subtask', [parent, child], [makeList()], CTX_LONDON);
    expect(result.map(t => t.id)).toEqual(['child']);
  });

  it('should match parent:none for top-level tasks', () => {
    const top = makeTask({ id: 't1', parentId: null });
    const sub = makeTask({ id: 't2', parentId: 'some-parent' });
    const result = evaluateSLQL('status:any and parent:none', [top, sub], [makeList()], CTX_LONDON);
    expect(result.map(t => t.id)).toEqual(['t1']);
  });
});

// ─── Required example filter tests ───────────────────────────────────────────

describe('Required Example Smart Lists', () => {
  const cases = [
    'due:today',
    'due:overdue',
    'priority:1 and due:this-week',
    'tag:finance and status:incomplete',
    'tag:wait or tag:waiting',
    'tag:someday',
    'status:incomplete and not tag:someday and not tag:waiting and (due:any or priority<=2)',
    'due:never',
    'completedWithin:"7 days"',
    'list:"House - DIY" and dueWithin:"7 days"',
    'tag:finance status:incomplete',
  ];

  for (const filter of cases) {
    it(`should parse and validate: "${filter}"`, () => {
      expect(() => {
        const tokens = tokenize(filter);
        const ast = parse(tokens);
        const norm = normalize(ast);
        validate(norm);
      }).not.toThrow();
    });
  }
});

// ─── RTM Import Translation tests ────────────────────────────────────────────

describe('RTM Filter Translation', () => {
  it('should translate dueBefore:now to due:overdue', () => {
    const result = translateRTMFilter('dueBefore:now');
    expect(result.success).toBe(true);
    expect(result.filter).toContain('due:overdue');
  });

  it('should translate status:open to status:incomplete', () => {
    const result = translateRTMFilter('status:open');
    expect(result.success).toBe(true);
    expect(result.filter).toContain('status:incomplete');
  });

  it('should pass through valid filters unchanged', () => {
    const rtmFilters = [
      'tag:finance',
      'not tag:someday',
      'status:incomplete',
      'status:completed',
      'due:today',
      'due:tomorrow',
      'due:never',
    ];
    for (const f of rtmFilters) {
      const result = translateRTMFilter(f);
      expect(result.success).toBe(true);
    }
  });

  it('should mark unsupported RTM filter as unsuccessful', () => {
    const result = translateRTMFilter('unknownRTMField:someValue');
    expect(result.success).toBe(false);
  });

  it('should preserve original RTM filter when translation fails', () => {
    const original = 'unknownField:someValue';
    const result = translateRTMFilter(original);
    expect(result.filter).toBe(original);
  });
});

// ─── Boolean operator and precedence stress tests ─────────────────────────────

describe('Boolean Operators and Precedence', () => {
  it('should evaluate compound AND correctly', () => {
    const task = makeTask({ tags: ['finance'], priority: 1 });
    expect(evaluateSLQL('status:any and tag:finance and priority:1', [task], [makeList()], CTX_LONDON)).toHaveLength(1);
  });

  it('should evaluate compound OR correctly', () => {
    const financeTask = makeTask({ id: 't1', tags: ['finance'] });
    const taxTask = makeTask({ id: 't2', tags: ['tax'] });
    const otherTask = makeTask({ id: 't3', tags: ['random'] });
    const result = evaluateSLQL('status:any and (tag:finance or tag:tax)', [financeTask, taxTask, otherTask], [makeList()], CTX_LONDON);
    expect(result.map(t => t.id)).toEqual(expect.arrayContaining(['t1', 't2']));
    expect(result.map(t => t.id)).not.toContain('t3');
  });

  it('should evaluate NOT correctly in complex expressions', () => {
    const task1 = makeTask({ id: 't1', tags: ['finance'], dueDate: '2026-06-11' });
    const task2 = makeTask({ id: 't2', tags: ['someday'], dueDate: '2026-06-11' });
    const result = evaluateSLQL('status:any and not tag:someday and due:today', [task1, task2], [makeList()], CTX_LONDON);
    expect(result.map(t => t.id)).toEqual(['t1']);
  });

  it('should evaluate implicit AND (adjacent terms) the same as explicit AND', () => {
    const task = makeTask({ tags: ['finance'], isCompleted: false });
    const implicit = evaluateSLQL('tag:finance status:incomplete', [task], [makeList()], CTX_LONDON);
    const explicit = evaluateSLQL('tag:finance and status:incomplete', [task], [makeList()], CTX_LONDON);
    expect(implicit).toEqual(explicit);
  });

  it('should evaluate OR with lower precedence than AND', () => {
    // "tag:finance and due:today or priority:1" =
    //   ((tag:finance and due:today) or priority:1)
    const financeToday = makeTask({ id: 't1', tags: ['finance'], dueDate: '2026-06-11', priority: 0 });
    const highPri = makeTask({ id: 't2', tags: [], dueDate: null, priority: 1 });
    const other = makeTask({ id: 't3', tags: ['tax'], dueDate: null, priority: 0 });
    const result = evaluateSLQL(
      'status:any and (tag:finance and due:today) or priority:1',
      [financeToday, highPri, other],
      [makeList()],
      CTX_LONDON
    );
    expect(result.map(t => t.id)).toEqual(expect.arrayContaining(['t1', 't2']));
    expect(result.map(t => t.id)).not.toContain('t3');
  });
});

// ─── Added/Completed/Updated date field tests ─────────────────────────────────

describe('Evaluator - Date fields: added, completed, created, updated', () => {
  it('should match added:this-week', () => {
    const task = makeTask({ createdAt: '2026-06-09T10:00:00Z' }); // In this week
    expect(evaluateSLQL('status:any and added:this-week', [task], [makeList()], CTX_LONDON)).toHaveLength(1);
  });

  it('should match completed:today for task completed today', () => {
    const task = makeTask({ isCompleted: true, completedAt: '2026-06-11T08:00:00Z' });
    expect(evaluateSLQL('status:completed and completed:today', [task], [makeList()], CTX_LONDON)).toHaveLength(1);
  });

  it('should match completed:yesterday for task completed yesterday', () => {
    const task = makeTask({ isCompleted: true, completedAt: '2026-06-10T08:00:00Z' });
    expect(evaluateSLQL('status:completed and completed:yesterday', [task], [makeList()], CTX_LONDON)).toHaveLength(1);
  });

  it('should match updated:this-week', () => {
    const task = makeTask({ updatedAt: '2026-06-09T10:00:00Z' });
    expect(evaluateSLQL('status:any and updated:this-week', [task], [makeList()], CTX_LONDON)).toHaveLength(1);
  });
});
