import { beforeEach, afterEach } from 'vitest';
import { initDb, destroyDb } from '../src/db/knex';
import { runMigrations } from '../src/db/migrate';

beforeEach(async () => {
  // Use in-memory SQLite database for tests
  initDb(':memory:');
  await runMigrations();
});

afterEach(async () => {
  await destroyDb();
});
