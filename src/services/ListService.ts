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
    normalizedAst: row.normalized_ast ? JSON.parse(row.normalized_ast) : null,
    sortSettings: row.sort_settings ? JSON.parse(row.sort_settings) : null,
    isEnabled: row.is_enabled !== 0,
    rtmId: row.rtm_id,
    rtmFilter: row.rtm_filter,
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
    is_smart: input.isSmart ? 1 : 0,
    smart_filter: input.smartFilter ?? null,
    is_archived: 0,
    sort_order: sortOrder,
    created_at: now,
    updated_at: now,
    normalized_ast: input.normalizedAst ? JSON.stringify(input.normalizedAst) : null,
    sort_settings: input.sortSettings ? JSON.stringify(input.sortSettings) : null,
    is_enabled: input.isEnabled !== false ? 1 : 0,
    rtm_id: input.rtmId ?? null,
    rtm_filter: input.rtmFilter ?? null,
  });

  return getList(id);
}

export async function updateList(id: string, input: UpdateListInput): Promise<List> {
  const db = getDb();
  const now = new Date().toISOString();

  const update: Record<string, unknown> = { updated_at: now };
  if (input.name !== undefined) update.name = input.name.trim();
  if (input.sortOrder !== undefined) update.sort_order = input.sortOrder;
  if (input.isSmart !== undefined) update.is_smart = input.isSmart ? 1 : 0;
  if (input.smartFilter !== undefined) update.smart_filter = input.smartFilter;
  if (input.normalizedAst !== undefined) {
    update.normalized_ast = input.normalizedAst ? JSON.stringify(input.normalizedAst) : null;
  }
  if (input.sortSettings !== undefined) {
    update.sort_settings = input.sortSettings ? JSON.stringify(input.sortSettings) : null;
  }
  if (input.isEnabled !== undefined) update.is_enabled = input.isEnabled ? 1 : 0;
  if (input.isArchived !== undefined) update.is_archived = input.isArchived ? 1 : 0;

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
