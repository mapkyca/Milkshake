import { Router } from 'express';
import { getLists, getList, createList, updateList, deleteList, archiveList } from '../../services/ListService';
import { getAllTasksForEvaluation } from '../../services/TaskService';
import { evaluateSLQL, tokenize, parse, normalize, validate } from '../../services/slql';
import { getDb } from '../../db/knex';
import type { ListRow } from '../../types';

const router = Router();

// GET all smart lists
router.get('/', async (req, res, next) => {
  try {
    const db = getDb();
    const rows = await db<ListRow>('lists')
      .where({ is_smart: 1, is_archived: 0 })
      .orderBy('sort_order', 'asc')
      .orderBy('name', 'asc');
    
    // map rows using rowToList equivalent logic
    const smartLists = rows.map((row) => ({
      id: row.id,
      name: row.name,
      isSmart: true,
      smartFilter: row.smart_filter,
      isArchived: row.is_archived === 1,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      normalizedAst: row.normalized_ast ? JSON.parse(row.normalized_ast) : null,
      sortSettings: row.sort_settings ? JSON.parse(row.sort_settings) : null,
      isEnabled: row.is_enabled !== 0,
      rtmId: row.rtm_id,
      rtmFilter: row.rtm_filter,
    }));

    res.json({ data: smartLists });
  } catch (err) {
    next(err);
  }
});

// GET a single smart list
router.get('/:id', async (req, res, next) => {
  try {
    const list = await getList(req.params.id);
    if (!list.isSmart) {
      res.status(400).json({ error: 'List is not a smart list' });
      return;
    }
    res.json({ data: list });
  } catch (err) {
    next(err);
  }
});

// POST create smart list
router.post('/', async (req, res, next) => {
  try {
    const { name, filter, sortSettings } = req.body;
    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'Smart list name is required' });
      return;
    }
    if (!filter || typeof filter !== 'string') {
      res.status(400).json({ error: 'Filter expression is required' });
      return;
    }

    // Validate the filter expression
    let normalizedAst: any = null;
    try {
      const tokens = tokenize(filter);
      const ast = parse(tokens);
      normalizedAst = normalize(ast);
      validate(normalizedAst);
    } catch (err: any) {
      res.status(400).json({ error: `Invalid filter expression: ${err.message}` });
      return;
    }

    const list = await createList({
      name,
      isSmart: true,
      smartFilter: filter,
      normalizedAst,
      sortSettings: sortSettings || null,
      isEnabled: true,
    });

    res.status(201).json({ data: list });
  } catch (err) {
    next(err);
  }
});

// PATCH update smart list
router.patch('/:id', async (req, res, next) => {
  try {
    const { name, filter, sortSettings, isEnabled } = req.body;
    const updateInput: any = {};

    if (name !== undefined) updateInput.name = name;
    if (isEnabled !== undefined) updateInput.isEnabled = isEnabled;
    if (sortSettings !== undefined) updateInput.sortSettings = sortSettings;

    if (filter !== undefined) {
      if (filter === null || filter === '') {
        res.status(400).json({ error: 'Filter expression cannot be empty' });
        return;
      }
      // Validate
      try {
        const tokens = tokenize(filter);
        const ast = parse(tokens);
        const normalized = normalize(ast);
        validate(normalized);
        updateInput.smartFilter = filter;
        updateInput.normalizedAst = normalized;
      } catch (err: any) {
        res.status(400).json({ error: `Invalid filter expression: ${err.message}` });
        return;
      }
    }

    const list = await updateList(req.params.id, updateInput);
    res.json({ data: list });
  } catch (err) {
    next(err);
  }
});

// DELETE delete/archive smart list
router.delete('/:id', async (req, res, next) => {
  try {
    const { archive = 'true' } = req.query;
    if (archive === 'true') {
      await archiveList(req.params.id);
    } else {
      await deleteList(req.params.id);
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// POST validate filter
router.post('/validate', async (req, res, next) => {
  try {
    const { filter } = req.body;
    if (filter === undefined || filter === null) {
      res.status(400).json({ error: 'Filter is required' });
      return;
    }

    try {
      const tokens = tokenize(filter);
      const ast = parse(tokens);
      const normalized = normalize(ast);
      validate(normalized);
      res.json({ data: { valid: true } });
    } catch (err: any) {
      res.json({
        data: {
          valid: false,
          error: err.message,
          type: err.name,
          line: err.line ?? err.token?.line ?? null,
          column: err.column ?? err.token?.column ?? null,
        },
      });
    }
  } catch (err) {
    next(err);
  }
});

// POST preview filter
router.post('/preview', async (req, res, next) => {
  try {
    const { filter, timezone = 'Europe/London', startOfWeek = 'monday', nowStr } = req.body;
    if (filter === undefined || filter === null) {
      res.status(400).json({ error: 'Filter is required' });
      return;
    }

    const now = nowStr ? new Date(nowStr) : new Date();

    try {
      const tokens = tokenize(filter);
      const ast = parse(tokens);
      const normalized = normalize(ast);
      validate(normalized);

      const allTasks = await getAllTasksForEvaluation();
      const allLists = await getLists();
      
      const matchingTasks = evaluateSLQL(filter, allTasks, allLists, {
        now,
        timezone,
        startOfWeek,
      });

      res.json({
        data: {
          valid: true,
          count: matchingTasks.length,
          tasks: matchingTasks.map((t) => ({
            id: t.id,
            title: t.title,
            dueDate: t.dueDate,
            priority: t.priority,
            isCompleted: t.isCompleted,
          })),
        },
      });
    } catch (err: any) {
      res.json({
        data: {
          valid: false,
          error: err.message,
          type: err.name,
          line: err.line ?? err.token?.line ?? null,
          column: err.column ?? err.token?.column ?? null,
        },
      });
    }
  } catch (err) {
    next(err);
  }
});

export default router;
