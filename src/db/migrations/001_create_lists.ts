import type { Knex } from 'knex';

export async function up(db: Knex): Promise<void> {
  await db.schema.createTable('lists', (t) => {
    t.string('id').primary();
    t.string('name').notNullable();
    t.integer('is_smart').notNullable().defaultTo(0);
    t.text('smart_filter').nullable();
    t.integer('is_archived').notNullable().defaultTo(0);
    t.integer('sort_order').notNullable().defaultTo(0);
    t.string('created_at').notNullable();
    t.string('updated_at').notNullable();
  });
}

export async function down(db: Knex): Promise<void> {
  await db.schema.dropTableIfExists('lists');
}
