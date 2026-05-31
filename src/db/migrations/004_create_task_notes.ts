import type { Knex } from 'knex';

export async function up(db: Knex): Promise<void> {
  await db.schema.createTable('task_notes', (t) => {
    t.string('id').primary();
    t.string('task_id').notNullable().references('id').inTable('tasks').onDelete('CASCADE');
    t.text('body').notNullable();
    t.string('created_at').notNullable();
    t.string('updated_at').notNullable();
  });
}

export async function down(db: Knex): Promise<void> {
  await db.schema.dropTableIfExists('task_notes');
}
