import type { Knex } from 'knex';

export async function up(db: Knex): Promise<void> {
  await db.schema.createTable('tasks', (t) => {
    t.string('id').primary();
    t.string('list_id').notNullable().references('id').inTable('lists').onDelete('CASCADE');
    t.string('parent_id').nullable().references('id').inTable('tasks').onDelete('SET NULL');
    t.string('series_id').nullable().index();
    t.text('title').notNullable();
    t.text('description').nullable();
    // 0=none 1=high 2=medium 3=low
    t.integer('priority').notNullable().defaultTo(0);
    // Stored as YYYY-MM-DD string for simple date comparisons
    t.string('due_date').nullable().index();
    // RFC 5545 RRULE string (without the RRULE: prefix)
    t.text('rrule').nullable();
    t.integer('is_completed').notNullable().defaultTo(0).index();
    t.integer('is_archived').notNullable().defaultTo(0);
    t.string('completed_at').nullable();
    t.string('created_at').notNullable();
    t.string('updated_at').notNullable();
  });
}

export async function down(db: Knex): Promise<void> {
  await db.schema.dropTableIfExists('tasks');
}
