import { Router } from 'express';
import { getLists, getList, createList, updateList, deleteList, archiveList } from '../../services/ListService';
import { getTasks, getAllTasksForEvaluation } from '../../services/TaskService';
import { evaluateSLQL } from '../../services/slql';

const router = Router();

// GET all lists
router.get('/', async (req, res, next) => {
  try {
    const lists = await getLists();
    res.json({ data: lists });
  } catch (err) {
    next(err);
  }
});

// GET a single list
router.get('/:id', async (req, res, next) => {
  try {
    const list = await getList(req.params.id);
    res.json({ data: list });
  } catch (err) {
    next(err);
  }
});

// POST create list
router.post('/', async (req, res, next) => {
  try {
    const { name, sortOrder } = req.body;
    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'List name is required' });
      return;
    }
    const list = await createList({ name, sortOrder });
    res.status(201).json({ data: list });
  } catch (err) {
    next(err);
  }
});

// PATCH update list
router.patch('/:id', async (req, res, next) => {
  try {
    const { name, sortOrder } = req.body;
    const list = await updateList(req.params.id, { name, sortOrder });
    res.json({ data: list });
  } catch (err) {
    next(err);
  }
});

// DELETE delete/archive list
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

// GET tasks for a list
router.get('/:id/tasks', async (req, res, next) => {
  try {
    const list = await getList(req.params.id);
    if (list.isSmart && list.smartFilter) {
      const timezone = (req.query.timezone as string) || 'Europe/London';
      const nowStr = (req.query.now as string) || new Date().toISOString();
      const startOfWeek = (req.query.startOfWeek as 'monday' | 'sunday') || 'monday';
      const now = new Date(nowStr);

      const allTasks = await getAllTasksForEvaluation();
      const allLists = await getLists();
      const matchingTasks = evaluateSLQL(list.smartFilter, allTasks, allLists, {
        now,
        timezone,
        startOfWeek,
      });
      res.json({ data: matchingTasks });
      return;
    }

    const { completed } = req.query;
    const isCompleted = completed === 'true' ? true : completed === 'false' ? false : undefined;
    const tasks = await getTasks({
      listId: req.params.id,
      completed: isCompleted,
    });
    res.json({ data: tasks });
  } catch (err) {
    next(err);
  }
});

export default router;
