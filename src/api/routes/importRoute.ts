import { Router } from 'express';
import { importRTM } from '../../services/ImportService';

const router = Router();

// POST import RTM
router.post('/rtm', async (req, res, next) => {
  try {
    const { filePath, dryRun, openOnly } = req.body;

    if (!filePath || typeof filePath !== 'string') {
      res.status(400).json({ error: 'filePath is required' });
      return;
    }

    const summary = await importRTM(filePath, {
      dryRun: dryRun === true || dryRun === 'true',
      openOnly: openOnly === true || openOnly === 'true',
    });

    res.json({ data: summary });
  } catch (err) {
    next(err);
  }
});

export default router;
