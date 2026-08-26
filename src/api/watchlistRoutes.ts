import { Router } from 'express';
import { watchlistRepository } from '../db/repositories/watchlistRepository';
import { evaluationService } from '../pipeline/evaluationService';
import { evaluationRepository } from '../db/repositories/evaluationRepository';

export const watchlistRouter = Router();

// GET /api/v8/watchlist
watchlistRouter.get('/', async (req, res) => {
  try {
    const list = await watchlistRepository.getAll();
    res.json({ success: true, watchlist: list });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// POST /api/v8/watchlist
watchlistRouter.post('/', async (req, res) => {
  try {
    const { ticker, name, memo } = req.body;
    if (!ticker) {
      return res.status(400).json({ error: 'Ticker is required' });
    }
    const cleanTicker = ticker.toUpperCase().trim();
    // 새 종목은 항상 is_active: true로 생성
    const item = await watchlistRepository.add({ ticker: cleanTicker, name, memo, is_active: true });

    // Evaluate the new item and save to DB
    try {
      const evalResult = await evaluationService.evaluateTicker(cleanTicker);
      const allEvals = await evaluationRepository.getAll();
      const filtered = allEvals.filter((e) => e.ticker !== cleanTicker);
      filtered.push(evalResult);
      await evaluationRepository.saveAll(filtered);
    } catch (evalErr) {
      console.warn(`[WatchlistRouter] Could not evaluate added ticker ${cleanTicker}:`, (evalErr as Error).message);
    }

    res.json({ success: true, item });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// PATCH /api/v8/watchlist/:ticker
watchlistRouter.patch('/:ticker', async (req, res) => {
  try {
    const ticker = req.params.ticker.toUpperCase();
    const { is_active, memo } = req.body;
    const updated = await watchlistRepository.update(ticker, { is_active, memo });
    if (!updated) {
      return res.status(404).json({ error: 'Ticker not found' });
    }
    res.json({ success: true, item: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// DELETE /api/v8/watchlist/:ticker
watchlistRouter.delete('/:ticker', async (req, res) => {
  try {
    const ticker = req.params.ticker.toUpperCase();
    await watchlistRepository.remove(ticker);
    res.json({ success: true, message: `Removed ${ticker}` });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});
