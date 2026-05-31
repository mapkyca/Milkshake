import { Router } from 'express';
import { syncDailyNote, readCompletionsFromNote } from '../../services/ObsidianService';
import { completeTask, uncompleteTask, getTask } from '../../services/TaskService';

const router = Router();

// POST trigger Obsidian sync
router.post('/obsidian', async (req, res, next) => {
  try {
    const { dateStr } = req.body; // expected format: YYYY-MM-DD
    const date = dateStr ? new Date(dateStr) : new Date();

    if (isNaN(date.getTime())) {
      res.status(400).json({ error: 'Invalid date format' });
      return;
    }

    // 1. Read completed task IDs from the daily note
    const completedIds = readCompletionsFromNote(date);

    // 2. Mark them completed in our database
    const completedTasks = [];
    for (const id of completedIds) {
      try {
        const task = await getTask(id);
        if (!task.isCompleted) {
          const result = await completeTask(id);
          completedTasks.push(result.task);
        }
      } catch (err) {
        // Task might not exist or already completed
      }
    }

    // 3. Write back the refreshed list of today's tasks into the daily note
    const syncRes = await syncDailyNote(date);

    res.json({
      data: {
        ...syncRes,
        completedTasksDetected: completedIds.length,
        completedTasksUpdated: completedTasks.map((t) => t.id),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
