import type { Knex } from 'knex';

export async function up(db: Knex): Promise<void> {
  await db.schema.createTable('import_records', (t) => {
    t.string('id').primary();
    t.string('source').notNullable();         // e.g. 'rtm'
    t.string('external_id').notNullable();    // original ID from external system
    t.string('entity_type').notNullable();    // 'task' | 'list' | 'note'
    t.string('internal_id').notNullable();    // our local ID
    t.string('imported_at').notNullable();
    // Prevent importing the same external entity twice
    t.unique(['source', 'external_id', 'entity_type']);
  });
}

export async function down(db: Knex): Promise<void> {
  await db.schema.dropTableIfExists('import_records');
}
