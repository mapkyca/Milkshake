import { getDb } from './knex';
import * as m001 from './migrations/001_create_lists';
import * as m002 from './migrations/002_create_tasks';
import * as m003 from './migrations/003_create_task_tags';
import * as m004 from './migrations/004_create_task_notes';
import * as m005 from './migrations/005_create_import_records';
import * as m006 from './migrations/006_add_smart_list_fields_to_lists';

interface Migration {
  name: string;
  up: (db: ReturnType<typeof getDb>) => Promise<void>;
}

const MIGRATIONS: Migration[] = [
  { name: '001_create_lists', up: m001.up },
  { name: '002_create_tasks', up: m002.up },
  { name: '003_create_task_tags', up: m003.up },
  { name: '004_create_task_notes', up: m004.up },
  { name: '005_create_import_records', up: m005.up },
  { name: '006_add_smart_list_fields_to_lists', up: m006.up },
];

export async function runMigrations(): Promise<void> {
  const db = getDb();

  // Bootstrap the migration tracking table
  const hasTable = await db.schema.hasTable('_migrations');
  if (!hasTable) {
    await db.schema.createTable('_migrations', (t) => {
      t.string('name').primary();
      t.string('run_at').notNullable();
    });
  }

  for (const { name, up } of MIGRATIONS) {
    const exists = await db('_migrations').where({ name }).first();
    if (!exists) {
      console.log(`  ↳ applying migration: ${name}`);
      await up(db);
      await db('_migrations').insert({ name, run_at: new Date().toISOString() });
    }
  }
}
