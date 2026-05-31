import { randomUUID } from 'crypto';
import { getDb } from '../db/knex';
import type { List, ListRow, CreateListInput, UpdateListInput } from '../types';

// ─── Mapper ──────────────────────────────────────────────────────────────────

function rowToList(row: ListRow): List {
  return {
    id: row.id,
    name: row.name,
    isSmart: row.is_smart === 1,
    smartFilter: row.smart_filter,
    isArchived: row.is_archived === 1,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── Service functions ────────────────────────────────────────────────────────

export async function getLists(): Promise<List[]> {
  const db = getDb();
  const rows = await db<ListRow>('lists')
    .where({ is_archived: 0 })
    .orderBy('sort_order', 'asc')
    .orderBy('name', 'asc');
  return rows.map(rowToList);
}

export async function getList(id: string): Promise<List> {
  const db = getDb();
  const row = await db<ListRow>('lists').where({ id }).first();
  if (!row) throw new Error(`List not found: ${id}`);
  return rowToList(row);
}

export async function createList(input: CreateListInput): Promise<List> {
  const db = getDb();
  const now = new Date().toISOString();
  const id = randomUUID();

  // Default sort_order = current max + 1
  const maxOrder = await db('lists').max('sort_order as m').first();
  const sortOrder = input.sortOrder ?? ((maxOrder?.m as number | null) ?? -1) + 1;

  await db('lists').insert({
    id,
    name: input.name.trim(),
    is_smart: 0,
    smart_filter: null,
    is_archived: 0,
    sort_order: sortOrder,
    created_at: now,
    updated_at: now,
  });

  return getList(id);
}

export async function updateList(id: string, input: UpdateListInput): Promise<List> {
  const db = getDb();
  const now = new Date().toISOString();

  const update: Record<string, unknown> = { updated_at: now };
  if (input.name !== undefined) update.name = input.name.trim();
  if (input.sortOrder !== undefined) update.sort_order = input.sortOrder;

  await db('lists').where({ id }).update(update);
  return getList(id);
}

export async function archiveList(id: string): Promise<void> {
  const db = getDb();
  await db('lists').where({ id }).update({
    is_archived: 1,
    updated_at: new Date().toISOString(),
  });
}

export async function deleteList(id: string): Promise<void> {
  const db = getDb();
  // Tasks in this list are cascade-deleted by FK constraint
  await db('lists').where({ id }).delete();
}
