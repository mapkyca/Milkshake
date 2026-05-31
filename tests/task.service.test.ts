import { describe, it, expect } from 'vitest';
import { createTask, getTask, getTasks, completeTask, addNote, updateTask } from '../src/services/TaskService';
import { createList } from '../src/services/ListService';

describe('TaskService', () => {
  it('should create and retrieve a task', async () => {
    const list = await createList({ name: 'Inbox' });
    const task = await createTask({
      listId: list.id,
      title: 'Buy Milk',
      priority: 1,
      dueDate: '2026-06-01',
      tags: ['shopping', 'dairy'],
    });

    expect(task.id).toBeDefined();
    expect(task.title).toBe('Buy Milk');
    expect(task.priority).toBe(1);
    expect(task.dueDate).toBe('2026-06-01');
    expect(task.tags).toEqual(expect.arrayContaining(['shopping', 'dairy']));

    const retrieved = await getTask(task.id);
    expect(retrieved.title).toBe('Buy Milk');
  });

  it('should update a task', async () => {
    const list = await createList({ name: 'Work' });
    const task = await createTask({
      listId: list.id,
      title: 'Fix issue',
    });

    const updated = await updateTask(task.id, {
      title: 'Fix severe issue',
      priority: 2,
    });

    expect(updated.title).toBe('Fix severe issue');
    expect(updated.priority).toBe(2);
  });

  it('should complete a task and spawn next occurrence if recurring', async () => {
    const list = await createList({ name: 'Routine' });
    const task = await createTask({
      listId: list.id,
      title: 'Daily exercise',
      dueDate: '2026-05-30',
      rrule: 'FREQ=DAILY',
    });

    const { task: completed, next } = await completeTask(task.id);
    expect(completed.isCompleted).toBe(true);
    expect(completed.completedAt).toBeDefined();

    expect(next).not.toBeNull();
    expect(next!.title).toBe('Daily exercise');
    expect(next!.dueDate).toBe('2026-05-31');
    expect(next!.rrule).toBe('FREQ=DAILY');
  });

  it('should add a note to a task', async () => {
    const list = await createList({ name: 'Inbox' });
    const task = await createTask({
      listId: list.id,
      title: 'Research remember the milk',
    });

    const note = await addNote(task.id, 'Remember to check RTM export JSON format.');
    expect(note.id).toBeDefined();
    expect(note.body).toBe('Remember to check RTM export JSON format.');

    const retrieved = await getTask(task.id);
    expect(retrieved.notes).toHaveLength(1);
    expect(retrieved.notes![0].body).toBe('Remember to check RTM export JSON format.');
  });
});
