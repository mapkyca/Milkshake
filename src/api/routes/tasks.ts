import { Router } from 'express';
import {
  getTasks,
  getTask,
  createTask,
  updateTask,
  completeTask,
  uncompleteTask,
  archiveTask,
  deleteTask,
  addNote,
} from '../../services/TaskService';
import type { Priority } from '../../types';

const router = Router();

// GET all tasks (with filters)
router.get('/', async (req, res, next) => {
  try {
    const { listId, today, upcoming, completed, tags, priority, parentId, search } = req.query;

    const filters: any = {};
    if (listId && typeof listId === 'string') filters.listId = listId;
    if (today === 'true') filters.today = true;
    if (upcoming === 'true') filters.upcoming = true;
    if (completed === 'true') filters.completed = true;
    if (completed === 'false') filters.completed = false;
    if (tags && typeof tags === 'string') {
      filters.tags = tags.split(',').map((t) => t.trim()).filter(Boolean);
    }
    if (priority !== undefined) {
      filters.priority = parseInt(priority as string, 10) as Priority;
    }
    if (parentId !== undefined) {
      filters.parentId = parentId === 'null' ? null : (parentId as string);
    }
    if (search && typeof search === 'string') filters.search = search;

    const tasks = await getTasks(filters);
    res.json({ data: tasks });
  } catch (err) {
    next(err);
  }
});

// GET single task
router.get('/:id', async (req, res, next) => {
  try {
    const task = await getTask(req.params.id);
    res.json({ data: task });
  } catch (err) {
    next(err);
  }
});

// POST create task
router.post('/', async (req, res, next) => {
  try {
    const { listId, parentId, title, description, priority, dueDate, rrule, tags } = req.body;
    if (!title || typeof title !== 'string') {
      res.status(400).json({ error: 'Task title is required' });
      return;
    }
    if (!listId || typeof listId !== 'string') {
      res.status(400).json({ error: 'listId is required' });
      return;
    }

    const task = await createTask({
      listId,
      parentId,
      title,
      description,
      priority,
      dueDate,
      rrule,
      tags,
    });
    res.status(201).json({ data: task });
  } catch (err) {
    next(err);
  }
});

// PATCH update task
router.patch('/:id', async (req, res, next) => {
  try {
    const { title, description, priority, dueDate, rrule, tags, listId } = req.body;
    const task = await updateTask(req.params.id, {
      title,
      description,
      priority,
      dueDate,
      rrule,
      tags,
      listId,
    });
    res.json({ data: task });
  } catch (err) {
    next(err);
  }
});

// POST complete task
router.post('/:id/complete', async (req, res, next) => {
  try {
    const result = await completeTask(req.params.id);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// POST uncomplete task
router.post('/:id/uncomplete', async (req, res, next) => {
  try {
    const task = await uncompleteTask(req.params.id);
    res.json({ data: task });
  } catch (err) {
    next(err);
  }
});

// DELETE delete/archive task
router.delete('/:id', async (req, res, next) => {
  try {
    const { archive = 'true' } = req.query;
    if (archive === 'true') {
      await archiveTask(req.params.id);
    } else {
      await deleteTask(req.params.id);
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// POST add note
router.post('/:id/notes', async (req, res, next) => {
  try {
    const { body } = req.body;
    if (!body || typeof body !== 'string') {
      res.status(400).json({ error: 'Note body is required' });
      return;
    }
    const note = await addNote(req.params.id, body);
    res.status(201).json({ data: note });
  } catch (err) {
    next(err);
  }
});

export default router;
