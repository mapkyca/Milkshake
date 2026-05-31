import type { Knex } from 'knex';

export async function up(db: Knex): Promise<void> {
  await db.schema.createTable('task_tags', (t) => {
    t.string('task_id').notNullable().references('id').inTable('tasks').onDelete('CASCADE');
    t.string('tag').notNullable();
    t.primary(['task_id', 'tag']);
    t.index('tag');
  });
}

export async function down(db: Knex): Promise<void> {
  await db.schema.dropTableIfExists('task_tags');
}
