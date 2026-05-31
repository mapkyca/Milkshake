import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { importRTM } from '../src/services/ImportService';
import { getTasks } from '../src/services/TaskService';
import { getLists } from '../src/services/ListService';

const SAMPLE_EXPORT_PATH = path.resolve(process.cwd(), 'scratch', 'rtm_sample.json');

describe('ImportService', () => {
  beforeEach(() => {
    // Create scratch directory and seed a sample export file
    fs.mkdirSync(path.dirname(SAMPLE_EXPORT_PATH), { recursive: true });
    const sample = {
      lists: [
        {
          id: 'rtm_list_1',
          name: 'Personal Tasks',
          taskseries: [
            {
              id: 'rtm_series_1',
              name: 'Buy groceries',
              tags: 'shopping, household',
              notes: [
                {
                  id: 'rtm_note_1',
                  title: 'Store options',
                  $t: 'Check local market or Sainsbury\'s.',
                }
              ],
              task: [
                {
                  id: 'rtm_task_1',
                  due: '2026-06-15T00:00:00Z',
                  completed: '',
                  priority: '1',
                }
              ]
            },
            {
              id: 'rtm_series_2',
              name: 'Old completed task',
              task: [
                {
                  id: 'rtm_task_2',
                  completed: '2026-05-01T12:00:00Z',
                  priority: 'N',
                }
              ]
            }
          ]
        }
      ]
    };
    fs.writeFileSync(SAMPLE_EXPORT_PATH, JSON.stringify(sample), 'utf-8');
  });

  afterEach(() => {
    try {
      fs.unlinkSync(SAMPLE_EXPORT_PATH);
    } catch {}
  });

  it('should import lists, tasks, tags, and notes successfully', async () => {
    const summary = await importRTM(SAMPLE_EXPORT_PATH, { dryRun: false });

    expect(summary.errors).toHaveLength(0);
    expect(summary.listsImported).toBe(1);
    expect(summary.tasksImported).toBe(2);
    expect(summary.notesImported).toBe(1);
    expect(summary.dryRun).toBe(false);

    const lists = await getLists();
    expect(lists.some((l) => l.name === 'Personal Tasks')).toBe(true);

    const tasks = await getTasks({ completed: false });
    const buyGroceries = tasks.find((t) => t.title === 'Buy groceries');
    expect(buyGroceries).toBeDefined();
    expect(buyGroceries!.dueDate).toBe('2026-06-15');
    expect(buyGroceries!.priority).toBe(1);
    expect(buyGroceries!.tags).toEqual(expect.arrayContaining(['shopping', 'household']));
  });

  it('should skip completed tasks if openOnly option is passed', async () => {
    const summary = await importRTM(SAMPLE_EXPORT_PATH, { dryRun: false, openOnly: true });

    expect(summary.tasksImported).toBe(1);
    expect(summary.tasksSkipped).toBe(1); // the completed one
  });

  it('should rollback transaction and perform no changes if dryRun option is passed', async () => {
    const summary = await importRTM(SAMPLE_EXPORT_PATH, { dryRun: true });

    expect(summary.tasksImported).toBe(2);
    expect(summary.dryRun).toBe(true);

    // Verify nothing got saved to DB
    const lists = await getLists();
    expect(lists).toHaveLength(0);
  });
});
