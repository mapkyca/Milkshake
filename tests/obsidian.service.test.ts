import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { syncDailyNote, readCompletionsFromNote, getDailyNotePath } from '../src/services/ObsidianService';
import { createList } from '../src/services/ListService';
import { createTask } from '../src/services/TaskService';

const VAULT_PATH = process.env.VAULT_PATH ?? path.resolve(process.cwd(), 'vault');

describe('ObsidianService', () => {
  beforeEach(() => {
    // Clear out existing vault daily notes
    try {
      fs.rmSync(path.join(VAULT_PATH, 'Daily'), { recursive: true, force: true });
    } catch {}
  });

  afterEach(() => {
    try {
      fs.rmSync(path.join(VAULT_PATH, 'Daily'), { recursive: true, force: true });
    } catch {}
  });

  it('should create a daily note and inject task block', async () => {
    const list = await createList({ name: 'Inbox' });
    const task = await createTask({
      listId: list.id,
      title: 'Obsidian test task',
      dueDate: new Date().toISOString().slice(0, 10),
    });

    const date = new Date();
    const res = await syncDailyNote(date);

    expect(res.created).toBe(true);
    expect(res.tasksWritten).toBe(1);
    expect(fs.existsSync(res.notePath)).toBe(true);

    const noteContent = fs.readFileSync(res.notePath, 'utf-8');
    expect(noteContent).toContain('<!-- task-manager:start -->');
    expect(noteContent).toContain(`- [ ] Obsidian test task 📅 ${task.dueDate} <!-- task:${task.id} -->`);
    expect(noteContent).toContain('<!-- task-manager:end -->');
  });

  it('should preserve surrounding content when updating task block', async () => {
    const list = await createList({ name: 'Inbox' });
    const task = await createTask({
      listId: list.id,
      title: 'Original task',
      dueDate: new Date().toISOString().slice(0, 10),
    });

    const date = new Date();
    const notePath = getDailyNotePath(date);
    
    // Seed note with surrounding markdown text
    const initialContent = `# Daily Note\n\nSome custom thoughts here.\n\n<!-- task-manager:start -->\n- [ ] Original task <!-- task:${task.id} -->\n<!-- task-manager:end -->\n\nMore thoughts here.`;
    const dir = path.dirname(notePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(notePath, initialContent, 'utf-8');

    // Create a new task and sync
    const task2 = await createTask({
      listId: list.id,
      title: 'New task',
      dueDate: new Date().toISOString().slice(0, 10),
    });

    await syncDailyNote(date);

    const noteContent = fs.readFileSync(notePath, 'utf-8');
    expect(noteContent).toContain('Some custom thoughts here.');
    expect(noteContent).toContain('More thoughts here.');
    expect(noteContent).toContain(`- [ ] New task 📅 ${task2.dueDate} <!-- task:${task2.id} -->`);
  });

  it('should read completions from daily note task block', async () => {
    const date = new Date();
    const notePath = getDailyNotePath(date);
    
    const noteWithCompleted = `# Daily Note\n\n<!-- task-manager:start -->\n- [x] Done task <!-- task:task_completed_123 -->\n- [ ] Pending task <!-- task:task_pending_456 -->\n<!-- task-manager:end -->`;
    const dir = path.dirname(notePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(notePath, noteWithCompleted, 'utf-8');

    const completions = readCompletionsFromNote(date);
    expect(completions).toEqual(['task_completed_123']);
  });
});
