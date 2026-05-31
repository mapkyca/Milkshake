import knex, { Knex } from 'knex';
import path from 'path';

let _db: Knex | null = null;

/**
 * Initialise the database connection. Call this once at startup before
 * calling getDb(). Passing ':memory:' is useful for tests.
 */
export function initDb(filename?: string): Knex {
  const dbPath =
    filename ??
    process.env.DATABASE_PATH ??
    path.resolve(process.cwd(), 'data', 'tasks.sqlite');

  _db = knex({
    client: 'better-sqlite3',
    connection: { filename: dbPath },
    useNullAsDefault: true,
    pool: { min: 1, max: 1 }, // SQLite is single-writer
  });

  return _db;
}

/**
 * Return the current database handle, initialising lazily if needed.
 */
export function getDb(): Knex {
  if (!_db) {
    return initDb();
  }
  return _db;
}

/**
 * Destroy the connection (used in tests and graceful shutdown).
 */
export async function destroyDb(): Promise<void> {
  if (_db) {
    await _db.destroy();
    _db = null;
  }
}
