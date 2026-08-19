import { Router } from 'express';
import { runHistoricalReplay } from '../backtest/strategyReplay';
import { signalRepository } from '../db/repositories/signalRepository';
import { calculateBacktestMetrics } from '../engine/backtestEngine';

export const backtestRouter = Router();

// GET /api/v8/backtest/compare
backtestRouter.get('/compare', async (req, res) => {
  try {
    const startDate = (req.query.startDate as string) || '2024-01-01';
    const endDate = (req.query.endDate as string) || new Date().toISOString().split('T')[0];

    const replayResult = await runHistoricalReplay({
      startDate,
      endDate,
    });

    res.json({
      success: true,
      data: replayResult,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// POST /api/v8/backtest/replay
backtestRouter.post('/replay', async (req, res) => {
  try {
    const { startDate, endDate, tickers, opportunityThresholdV8, opportunityThresholdV7 } = req.body;
    const replayResult = await runHistoricalReplay({
      startDate: startDate || '2024-01-01',
      endDate: endDate || new Date().toISOString().split('T')[0],
      tickers,
      opportunityThresholdV8: opportunityThresholdV8 || 70,
      opportunityThresholdV7: opportunityThresholdV7 || 65,
    });

    res.json({
      success: true,
      data: replayResult,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});
