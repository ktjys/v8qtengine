import { Router } from 'express';
import { evaluationRepository } from '../db/repositories/evaluationRepository';
import { evaluationService } from '../pipeline/evaluationService';
import { getInitialOrLatestEvaluations } from '../pipeline/v8Pipeline';

export const evaluationRouter = Router();

// GET /api/v8/evaluations
evaluationRouter.get('/', async (req, res) => {
  try {
    let evaluations = await evaluationRepository.getAll();
    if (evaluations.length === 0) {
      const initial = await getInitialOrLatestEvaluations();
      evaluations = initial.evaluations;
    }

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      count: evaluations.length,
      provider: evaluationService.getProviderName(),
      evaluations,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// GET /api/v8/evaluations/:ticker
evaluationRouter.get('/:ticker', async (req, res) => {
  try {
    const ticker = req.params.ticker.toUpperCase();
    const evaluation = await evaluationService.evaluateTicker(ticker);
    res.json({ success: true, evaluation });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});
