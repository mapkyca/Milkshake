import type { Knex } from 'knex';

export async function up(db: Knex): Promise<void> {
  const hasNormalizedAst = await db.schema.hasColumn('lists', 'normalized_ast');
  if (!hasNormalizedAst) {
    await db.schema.alterTable('lists', (t) => {
      t.text('normalized_ast').nullable();
      t.text('sort_settings').nullable();
      t.integer('is_enabled').notNullable().defaultTo(1);
      t.string('rtm_id').nullable();
      t.text('rtm_filter').nullable();
    });
  }
}

export async function down(db: Knex): Promise<void> {
  // SQLite does not support DROP COLUMN prior to version 3.35.
  // The down migration is intentionally a no-op; the table can be
  // recreated from scratch in a full rollback scenario.
}

