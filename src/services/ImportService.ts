import fs from 'fs';
import { randomUUID } from 'crypto';
import { getDb } from '../db/knex';
import type { ImportOptions, ImportSummary, Priority } from '../types';

interface RTMNote {
  id: string;
  title?: string;
  $t?: string;
  text?: string;
}

interface RTMTaskInstance {
  id: string;
  due?: string;
  completed?: string;
  added?: string;
  priority?: string;
}

interface RTMTaskSeries {
  id: string;
  name: string;
  created?: string;
  modified?: string;
  tags?: string[] | string;
  notes?: RTMNote[] | RTMNote;
  task?: RTMTaskInstance[] | RTMTaskInstance;
}

interface RTMList {
  id: string;
  name: string;
  taskseries?: RTMTaskSeries[] | RTMTaskSeries;
}

interface RTMExport {
  rsp?: {
    lists?: {
      list?: RTMList[];
    };
  };
  lists?: RTMList[];
}

function ensureArray<T>(val: T[] | T | undefined): T[] {
  if (val === undefined) return [];
  return Array.isArray(val) ? val : [val];
}

export async function importRTM(
  filePath: string,
  options: ImportOptions = {}
): Promise<ImportSummary> {
  const { dryRun = false, openOnly = false } = options;
  const summary: ImportSummary = {
    listsImported: 0,
    listsSkipped: 0,
    tasksImported: 0,
    tasksSkipped: 0,
    notesImported: 0,
    errors: [],
    dryRun,
  };

  let rawData: string;
  try {
    rawData = fs.readFileSync(filePath, 'utf-8');
  } catch (err: any) {
    summary.errors.push(`Failed to read file: ${err.message}`);
    return summary;
  }

  let parsed: RTMExport;
  try {
    parsed = JSON.parse(rawData);
  } catch (err: any) {
    summary.errors.push(`Failed to parse JSON: ${err.message}`);
    return summary;
  }

  let rtmLists: RTMList[] = [];
  if (parsed.lists) {
    rtmLists = parsed.lists;
  } else if (parsed.rsp?.lists?.list) {
    rtmLists = parsed.rsp.lists.list;
  } else {
    summary.errors.push('No lists found in RTM JSON export.');
    return summary;
  }

  const db = getDb();

  await db.transaction(async (trx) => {
    const listMap = new Map<string, string>();

    const existingListImports = await trx('import_records')
      .where({ source: 'rtm', entity_type: 'list' });
    for (const rec of existingListImports) {
      listMap.set(rec.external_id, rec.internal_id);
    }

    for (const rtmList of rtmLists) {
      let internalListId = listMap.get(rtmList.id);

      if (!internalListId) {
        const matchedList = await trx('lists')
          .where({ name: rtmList.name, is_archived: 0 })
          .first();

        if (matchedList) {
          internalListId = matchedList.id;
          listMap.set(rtmList.id, internalListId!);
          summary.listsSkipped++;
          if (!dryRun) {
            await trx('import_records').insert({
              id: randomUUID(),
              source: 'rtm',
              external_id: rtmList.id,
              entity_type: 'list',
              internal_id: internalListId!,
              imported_at: new Date().toISOString(),
            });
          }
        } else {
          internalListId = randomUUID();
          listMap.set(rtmList.id, internalListId!);

          if (!dryRun) {
            const maxOrderRow = await trx('lists').max('sort_order as m').first();
            const sortOrder = ((maxOrderRow?.m as number | null) ?? -1) + 1;

            await trx('lists').insert({
              id: internalListId,
              name: rtmList.name.trim(),
              is_smart: 0,
              smart_filter: null,
              is_archived: 0,
              sort_order: sortOrder,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });

            await trx('import_records').insert({
              id: randomUUID(),
              source: 'rtm',
              external_id: rtmList.id,
              entity_type: 'list',
              internal_id: internalListId,
              imported_at: new Date().toISOString(),
            });
          }
          summary.listsImported++;
        }
      } else {
        summary.listsSkipped++;
      }

      const taskseriesList = ensureArray(rtmList.taskseries);

      for (const series of taskseriesList) {
        const taskInstances = ensureArray(series.task);

        for (const inst of taskInstances) {
          const isCompleted = inst.completed ? true : false;
          if (openOnly && isCompleted) {
            summary.tasksSkipped++;
            continue;
          }

          const alreadyImported = await trx('import_records')
            .where({ source: 'rtm', external_id: inst.id, entity_type: 'task' })
            .first();

          if (alreadyImported) {
            summary.tasksSkipped++;
            continue;
          }

          let priority: Priority = 0;
          if (inst.priority === '1') priority = 1;
          else if (inst.priority === '2') priority = 2;
          else if (inst.priority === '3') priority = 3;

          const dueDate = inst.due ? inst.due.slice(0, 10) : null;

          let tags: string[] = [];
          if (series.tags) {
            if (Array.isArray(series.tags)) {
              tags = series.tags;
            } else if (typeof series.tags === 'string') {
              tags = series.tags.split(',').map((t) => t.trim()).filter(Boolean);
            }
          }

          const internalTaskId = randomUUID();
          if (!dryRun) {
            try {
              const now = new Date().toISOString();
              await trx('tasks').insert({
                id: internalTaskId,
                list_id: internalListId,
                parent_id: null,
                series_id: series.id || null,
                title: (series.name || 'Untitled Task').trim(),
                description: null,
                priority,
                due_date: dueDate,
                rrule: null,
                is_completed: isCompleted ? 1 : 0,
                is_archived: 0,
                completed_at: isCompleted ? (inst.completed || now) : null,
                created_at: now,
                updated_at: now,
              });

              if (tags.length > 0) {
                await trx('task_tags').insert(
                  tags.map((tag) => ({
                    task_id: internalTaskId,
                    tag: tag.toLowerCase().trim(),
                  }))
                );
              }

              await trx('import_records').insert({
                id: randomUUID(),
                source: 'rtm',
                external_id: inst.id,
                entity_type: 'task',
                internal_id: internalTaskId,
                imported_at: new Date().toISOString(),
              });
            } catch (err: any) {
              summary.errors.push(`Failed to import task "${series.name}": ${err.message}`);
              continue;
            }
          }
          summary.tasksImported++;

          const notesList = ensureArray(series.notes);
          for (const note of notesList) {
            const noteBody = note.$t || note.text || note.title || '';
            if (!noteBody) continue;

            const noteAlreadyImported = await trx('import_records')
              .where({ source: 'rtm', external_id: note.id, entity_type: 'note' })
              .first();

            if (noteAlreadyImported) {
              continue;
            }

            if (!dryRun) {
              try {
                const now = new Date().toISOString();
                const internalNoteId = randomUUID();
                await trx('task_notes').insert({
                  id: internalNoteId,
                  task_id: internalTaskId,
                  body: noteBody.trim(),
                  created_at: now,
                  updated_at: now,
                });

                await trx('import_records').insert({
                  id: randomUUID(),
                  source: 'rtm',
                  external_id: note.id,
                  entity_type: 'note',
                  internal_id: internalNoteId,
                  imported_at: new Date().toISOString(),
                });
              } catch (err: any) {
                summary.errors.push(`Failed to import note for task "${series.name}": ${err.message}`);
                continue;
              }
            }
            summary.notesImported++;
          }
        }
      }
    }

    if (dryRun) {
      throw new Error('DRY_RUN_ROLLBACK');
    }
  }).catch((err) => {
    if (err.message !== 'DRY_RUN_ROLLBACK') {
      summary.errors.push(`Transaction error: ${err.message}`);
    }
  });

  return summary;
}
