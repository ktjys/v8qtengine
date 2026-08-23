import { Router } from 'express';
import { signalRepository } from '../db/repositories/signalRepository';
import { updateSignalOutcomes } from '../jobs/signalOutcomeUpdater';

export const signalRouter = Router();

// GET /api/v8/signals (and /api/quant/signals)
signalRouter.get('/', async (req, res) => {
  try {
    const signals = await signalRepository.getAll();
    res.json({
      success: true,
      count: signals.length,
      signals,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// POST /api/v8/signals/update-outcomes
signalRouter.post('/update-outcomes', async (req, res) => {
  try {
    const result = await updateSignalOutcomes();
    const signals = await signalRepository.getAll();
    res.json({
      success: true,
      updated_count: result.updatedCount,
      signals,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});
