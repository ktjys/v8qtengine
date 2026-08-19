import { Router } from 'express';
import { scanRunRepository } from '../db/repositories/scanRunRepository';

export const runRouter = Router();

// GET /api/v8/runs
runRouter.get('/', async (req, res) => {
  try {
    const runs = await scanRunRepository.getAll();
    res.json({
      success: true,
      count: runs.length,
      runs,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});
