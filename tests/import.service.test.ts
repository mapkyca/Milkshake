import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { importRTM } from '../src/services/ImportService';
import { getTasks } from '../src/services/TaskService';
import { getLists } from '../src/services/ListService';

const SAMPLE_EXPORT_PATH = path.resolve(process.cwd(), 'scratch', 'rtm_sample.json');

/** Build a realistic RTM flat-export sample matching the actual schema. */
function buildSample() {
  return {
    config: { username: 'testuser' },
    lists: [
      { id: 'list_1', name: 'Personal Tasks', date_created: 1000000000000 },
      { id: 'list_2', name: 'Work', date_created: 1000000000000 },
    ],
    tasks: [
      {
        id: 'task_1',
        series_id: 'series_1',
        list_id: 'list_1',
        name: 'Buy groceries',
        priority: 'P1',
        date_created: 1000000000000,
        date_modified: 1000000000000,
        date_due: 1781481600000, // 2026-06-15
        tags: ['shopping', 'household'],
      },
      {
        id: 'task_2',
        series_id: 'series_2',
        list_id: 'list_1',
        name: 'Old completed task',
        priority: 'PN',
        date_created: 1000000000000,
        date_modified: 1000000000000,
        date_completed: 1000000000000,
        tags: [],
      },
    ],
    notes: [
      {
        id: 'note_1',
        series_id: 'series_1', // Attached to "Buy groceries" task
        date_created: 1000000000000,
        date_modified: 1000000000000,
        title: '',
        content: "Check local market or Sainsbury's.",
      },
    ],
    smart_lists: [],
  };
}

describe('ImportService', () => {
  beforeEach(() => {
    fs.mkdirSync(path.dirname(SAMPLE_EXPORT_PATH), { recursive: true });
    fs.writeFileSync(SAMPLE_EXPORT_PATH, JSON.stringify(buildSample()), 'utf-8');
  });

  afterEach(() => {
    try { fs.unlinkSync(SAMPLE_EXPORT_PATH); } catch {}
  });

  it('should import lists, tasks, tags, and notes successfully', async () => {
    const summary = await importRTM(SAMPLE_EXPORT_PATH, { dryRun: false });

    expect(summary.errors).toHaveLength(0);
    expect(summary.listsImported).toBe(2);
    expect(summary.tasksImported).toBe(2);
    expect(summary.notesImported).toBe(1);
    expect(summary.dryRun).toBe(false);

    const lists = await getLists();
    expect(lists.some((l) => l.name === 'Personal Tasks')).toBe(true);

    const allTasks = await getTasks({ completed: false });
    const buyGroceries = allTasks.find((t) => t.title === 'Buy groceries');
    expect(buyGroceries).toBeDefined();
    expect(buyGroceries!.dueDate).toBe('2026-06-15');
    expect(buyGroceries!.priority).toBe(1);
    expect(buyGroceries!.tags).toEqual(expect.arrayContaining(['shopping', 'household']));
  });

  it('should skip completed tasks if openOnly option is passed', async () => {
    const summary = await importRTM(SAMPLE_EXPORT_PATH, { dryRun: false, openOnly: true });
    expect(summary.tasksImported).toBe(1); // only the incomplete one
    expect(summary.tasksSkipped).toBe(1);  // the completed one
  });

  it('should rollback transaction and perform no changes if dryRun is true', async () => {
    const summary = await importRTM(SAMPLE_EXPORT_PATH, { dryRun: true });

    expect(summary.tasksImported).toBe(2);
    expect(summary.dryRun).toBe(true);

    // Nothing persisted
    const lists = await getLists();
    expect(lists).toHaveLength(0);
  });

  it('should be idempotent when run twice', async () => {
    await importRTM(SAMPLE_EXPORT_PATH, { dryRun: false });
    const summary2 = await importRTM(SAMPLE_EXPORT_PATH, { dryRun: false });

    expect(summary2.errors).toHaveLength(0);
    expect(summary2.tasksImported).toBe(0);
    expect(summary2.tasksSkipped).toBe(2);
    expect(summary2.listsSkipped).toBe(2);
  });
});
