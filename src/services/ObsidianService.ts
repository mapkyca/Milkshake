import fs from 'fs';
import path from 'path';
import { format } from 'date-fns';
import { getTasks } from './TaskService';
import type { Task } from '../types';

const VAULT_PATH = process.env.VAULT_PATH ?? path.resolve(process.cwd(), 'vault');

const BLOCK_START = '<!-- task-manager:start -->';
const BLOCK_END = '<!-- task-manager:end -->';

// ─── Path helpers ─────────────────────────────────────────────────────────────

export function getDailyNotePath(date: Date): string {
  const dateStr = format(date, 'yyyy-MM-dd');
  return path.join(VAULT_PATH, 'Daily', `${dateStr}.md`);
}

// ─── Block rendering ──────────────────────────────────────────────────────────

function renderTaskLine(task: Task): string {
  const check = task.isCompleted ? 'x' : ' ';
  const due = task.dueDate ? ` 📅 ${task.dueDate}` : '';
  const priority = task.priority > 0 ? ` [P${task.priority}]` : '';
  return `- [${check}] ${task.title}${priority}${due} <!-- task:${task.id} -->`;
}

function buildBlock(tasks: Task[]): string {
  const lines = tasks.map(renderTaskLine);
  return [BLOCK_START, ...lines, BLOCK_END].join('\n');
}

// ─── File read/write ──────────────────────────────────────────────────────────

function readNote(notePath: string): string | null {
  try {
    return fs.readFileSync(notePath, 'utf-8');
  } catch {
    return null;
  }
}

function writeNote(notePath: string, content: string): void {
  const dir = path.dirname(notePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(notePath, content, 'utf-8');
}

// ─── Sync ─────────────────────────────────────────────────────────────────────

export interface SyncResult {
  notePath: string;
  tasksWritten: number;
  created: boolean;
}

/**
 * Sync today's (or a given date's) tasks into the daily note.
 * Only the <!-- task-manager:start/end --> block is modified.
 * All other content in the note is preserved.
 */
export async function syncDailyNote(date: Date = new Date()): Promise<SyncResult> {
  const dateStr = format(date, 'yyyy-MM-dd');
  const notePath = getDailyNotePath(date);

  // Fetch tasks due on this date (includes overdue for today)
  const tasks = await getTasks({ today: true, completed: false });

  const block = buildBlock(tasks);
  const existing = readNote(notePath);
  let created = false;

  if (existing === null) {
    // Create a new minimal daily note
    const header = `# ${dateStr}\n\n## Tasks\n\n`;
    writeNote(notePath, header + block + '\n');
    created = true;
  } else {
    // Replace or inject the block in the existing note
    const hasBlock = existing.includes(BLOCK_START);
    let updated: string;

    if (hasBlock) {
      // Replace block between markers, preserving all surrounding content
      const startIdx = existing.indexOf(BLOCK_START);
      const endIdx = existing.indexOf(BLOCK_END);
      if (endIdx === -1) throw new Error('Malformed task-manager block: missing end marker');
      updated =
        existing.slice(0, startIdx) + block + existing.slice(endIdx + BLOCK_END.length);
    } else {
      // Append block to end of file
      updated = existing.trimEnd() + '\n\n' + block + '\n';
    }

    writeNote(notePath, updated);
  }

  return { notePath, tasksWritten: tasks.length, created };
}

/**
 * Read a daily note and return IDs of tasks checked off ([x]) inside the block.
 */
export function readCompletionsFromNote(date: Date = new Date()): string[] {
  const notePath = getDailyNotePath(date);
  const content = readNote(notePath);
  if (!content) return [];

  const startIdx = content.indexOf(BLOCK_START);
  const endIdx = content.indexOf(BLOCK_END);
  if (startIdx === -1 || endIdx === -1) return [];

  const block = content.slice(startIdx + BLOCK_START.length, endIdx);
  const completedIds: string[] = [];

  for (const line of block.split('\n')) {
    // Match: - [x] ... <!-- task:ID -->
    const match = line.match(/^- \[x\].*<!--\s*task:([a-zA-Z0-9_-]+)\s*-->/);
    if (match) completedIds.push(match[1]);
  }

  return completedIds;
}
