import { randomUUID } from 'crypto';
import { getDb } from '../knex';

const DEFAULT_LISTS = [
  { name: 'Inbox', sort_order: 0 },
  { name: 'Personal', sort_order: 1 },
  { name: 'Work', sort_order: 2 },
];

/**
 * Seeds the default lists if they don't already exist.
 * Safe to run multiple times (idempotent).
 */
export async function seedDefaultLists(): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();

  for (const list of DEFAULT_LISTS) {
    const exists = await db('lists').where({ name: list.name }).first();
    if (!exists) {
      await db('lists').insert({
        id: randomUUID(),
        name: list.name,
        is_smart: 0,
        smart_filter: null,
        is_archived: 0,
        sort_order: list.sort_order,
        created_at: now,
        updated_at: now,
      });
    }
  }
}
