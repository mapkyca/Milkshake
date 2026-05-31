import { Command } from 'commander';
import { addDays, format, parseISO } from 'date-fns';
import { initDb, destroyDb } from '../db/knex';
import { getLists, createList } from '../services/ListService';
import { createTask, getTasks, getTask, completeTask } from '../services/TaskService';
import { importRTM } from '../services/ImportService';
import { syncDailyNote, readCompletionsFromNote } from '../services/ObsidianService';
import type { Priority } from '../types';

const program = new Command();

program
  .name('task')
  .description('Local-first task manager CLI')
  .version('0.1.0');

// Helper to handle async command lifecycle and ensure DB is closed
function makeAction(action: (...args: any[]) => Promise<void>) {
  return async (...args: any[]) => {
    try {
      initDb();
      await action(...args);
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exitCode = 1;
    } finally {
      await destroyDb();
    }
  };
}

function parseDueDate(dueOpt?: string): string | undefined {
  if (!dueOpt) return undefined;
  const lower = dueOpt.toLowerCase().trim();
  if (lower === 'today') {
    return format(new Date(), 'yyyy-MM-dd');
  }
  if (lower === 'tomorrow') {
    return format(addDays(new Date(), 1), 'yyyy-MM-dd');
  }
  // Try to parse YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(lower)) {
    return lower;
  }
  // Best effort JS parse
  try {
    const d = new Date(lower);
    if (!isNaN(d.getTime())) {
      return format(d, 'yyyy-MM-dd');
    }
  } catch {}
  return undefined;
}

// ─── task add ────────────────────────────────────────────────────────────────
program
  .command('add <title>')
  .description('Add a new task')
  .option('-l, --list <name>', 'List name', 'Inbox')
  .option('-d, --due <date>', 'Due date (e.g. "today", "tomorrow", "YYYY-MM-DD")')
  .option('-p, --priority <level>', 'Priority (1 = high, 2 = medium, 3 = low)', '0')
  .option('-t, --tag <tags...>', 'Tags for the task')
  .action(
    makeAction(async (title, options) => {
      const lists = await getLists();
      let list = lists.find((l) => l.name.toLowerCase() === options.list.toLowerCase());

      if (!list) {
        // Auto-create list if it doesn't exist
        list = await createList({ name: options.list });
        console.log(`Created new list: ${list.name}`);
      }

      const priority = parseInt(options.priority, 10) as Priority;
      const dueDate = parseDueDate(options.due);

      const task = await createTask({
        listId: list.id,
        title,
        priority,
        dueDate,
        tags: options.tag,
      });

      console.log(`Task created successfully!`);
      console.log(`ID:       ${task.id}`);
      console.log(`Title:    ${task.title}`);
      console.log(`List:     ${list.name}`);
      if (task.dueDate) console.log(`Due:      ${task.dueDate}`);
      if (task.priority > 0) console.log(`Priority: P${task.priority}`);
      if (task.tags.length > 0) console.log(`Tags:     ${task.tags.join(', ')}`);
    })
  );

// ─── task list ───────────────────────────────────────────────────────────────
program
  .command('list')
  .description('List tasks')
  .option('--today', 'Show tasks due today or overdue')
  .option('--upcoming', 'Show tasks due in next 7 days')
  .option('-l, --list <name>', 'Filter by list name')
  .option('-t, --tag <tag>', 'Filter by tag')
  .option('--completed', 'Show completed tasks instead of incomplete')
  .action(
    makeAction(async (options) => {
      const filters: any = {};
      filters.completed = options.completed ? true : false;

      if (options.today) filters.today = true;
      if (options.upcoming) filters.upcoming = true;

      if (options.list) {
        const lists = await getLists();
        const list = lists.find((l) => l.name.toLowerCase() === options.list.toLowerCase());
        if (!list) {
          console.error(`List not found: ${options.list}`);
          return;
        }
        filters.listId = list.id;
      }

      if (options.tag) {
        filters.tags = [options.tag];
      }

      const tasks = await getTasks(filters);

      if (tasks.length === 0) {
        console.log('No tasks found.');
        return;
      }

      console.log(''.padEnd(80, '-'));
      console.log(
        `${'ID'.padEnd(38)} | ${'Title'.padEnd(20)} | ${'Due'.padEnd(10)} | ${'Pri'.padEnd(3)} | ${'Tags'}`
      );
      console.log(''.padEnd(80, '-'));

      for (const t of tasks) {
        const priStr = t.priority > 0 ? `P${t.priority}` : '-';
        const tagsStr = t.tags.join(', ') || '-';
        const dueStr = t.dueDate || '-';
        console.log(
          `${t.id.padEnd(38)} | ${t.title.substring(0, 20).padEnd(20)} | ${dueStr.padEnd(10)} | ${priStr.padEnd(3)} | ${tagsStr}`
        );
      }
      console.log(''.padEnd(80, '-'));
    })
  );

// ─── task complete ───────────────────────────────────────────────────────────
program
  .command('complete <id>')
  .description('Mark a task as complete')
  .action(
    makeAction(async (id) => {
      const { task, next } = await completeTask(id);
      console.log(`Task completed: "${task.title}"`);
      if (next) {
        console.log(`Recurring task! Spawned next occurrence: "${next.title}" due ${next.dueDate}`);
      }
    })
  );

// ─── task show ───────────────────────────────────────────────────────────────
program
  .command('show <id>')
  .description('Show full task details')
  .action(
    makeAction(async (id) => {
      const task = await getTask(id);
      const lists = await getLists();
      const list = lists.find((l) => l.id === task.listId);

      console.log(''.padEnd(60, '='));
      console.log(`Task:        ${task.title}`);
      console.log(`ID:          ${task.id}`);
      console.log(`List:        ${list ? list.name : 'Unknown'}`);
      console.log(`Status:      ${task.isCompleted ? 'Completed ✅' : 'Incomplete ⭕'}`);
      if (task.dueDate) console.log(`Due Date:    ${task.dueDate}`);
      if (task.priority > 0) console.log(`Priority:    P${task.priority}`);
      if (task.rrule) console.log(`RRule:       ${task.rrule}`);
      if (task.tags.length > 0) console.log(`Tags:        ${task.tags.join(', ')}`);
      if (task.description) {
        console.log(''.padEnd(60, '-'));
        console.log(`Description:\n${task.description}`);
      }

      if (task.notes && task.notes.length > 0) {
        console.log(''.padEnd(60, '-'));
        console.log('Notes:');
        for (const note of task.notes) {
          console.log(`- [${note.createdAt}] ${note.body}`);
        }
      }

      if (task.subtasks && task.subtasks.length > 0) {
        console.log(''.padEnd(60, '-'));
        console.log('Subtasks:');
        for (const sub of task.subtasks) {
          const subStatus = sub.isCompleted ? '[x]' : '[ ]';
          console.log(`  ${subStatus} ${sub.title} (${sub.id})`);
        }
      }
      console.log(''.padEnd(60, '='));
    })
  );

// ─── task import-rtm ─────────────────────────────────────────────────────────
program
  .command('import-rtm <file>')
  .description('Import Remember The Milk backup JSON')
  .option('--dry-run', 'Perform import checks without writing to database')
  .option('--open-only', 'Import only incomplete tasks')
  .action(
    makeAction(async (file, options) => {
      console.log(`Importing Remember The Milk export from: ${file}...`);
      const summary = await importRTM(file, {
        dryRun: options.dryRun,
        openOnly: options.openOnly,
      });

      console.log(''.padEnd(40, '='));
      console.log(`Import completed:`);
      console.log(`Lists Imported:   ${summary.listsImported}`);
      console.log(`Lists Skipped:    ${summary.listsSkipped}`);
      console.log(`Tasks Imported:   ${summary.tasksImported}`);
      console.log(`Tasks Skipped:    ${summary.tasksSkipped}`);
      console.log(`Notes Imported:   ${summary.notesImported}`);
      console.log(`Dry Run:          ${summary.dryRun ? 'Yes' : 'No'}`);
      console.log(''.padEnd(40, '='));

      if (summary.errors.length > 0) {
        console.warn('\nImport warnings/errors:');
        for (const err of summary.errors) {
          console.warn(`- ${err}`);
        }
      }
    })
  );

// ─── task sync-obsidian ───────────────────────────────────────────────────────
program
  .command('sync-obsidian')
  .description('Sync tasks with Obsidian daily notes')
  .option('-d, --date <YYYY-MM-DD>', 'Date to sync')
  .action(
    makeAction(async (options) => {
      const date = options.date ? parseISO(options.date) : new Date();
      if (isNaN(date.getTime())) {
        console.error('Invalid date format. Use YYYY-MM-DD.');
        return;
      }

      console.log(`Checking completions in daily note for ${format(date, 'yyyy-MM-dd')}...`);
      const completedIds = readCompletionsFromNote(date);

      if (completedIds.length > 0) {
        console.log(`Detected ${completedIds.length} completed tasks in note. Updating database...`);
        for (const id of completedIds) {
          try {
            const task = await getTask(id);
            if (!task.isCompleted) {
              await completeTask(id);
              console.log(`  ✓ Completed: "${task.title}"`);
            }
          } catch {}
        }
      }

      console.log(`Writing today's tasks into daily note...`);
      const syncRes = await syncDailyNote(date);
      console.log(`Daily note updated: ${syncRes.notePath}`);
      console.log(`Tasks written:      ${syncRes.tasksWritten}`);
    })
  );

program.parse(process.argv);
