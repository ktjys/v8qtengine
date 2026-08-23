import { Router } from 'express';
import { evaluationRepository } from '../db/repositories/evaluationRepository';
import { evaluationService } from '../pipeline/evaluationService';
import { watchlistRepository } from '../db/repositories/watchlistRepository';
import { dbClient } from '../db/supabaseClient';
import { dailyScoreHistoryService } from '../pipeline/dailyScoreHistoryService';

export const evaluationRouter = Router();

// GET /api/v8/evaluations
evaluationRouter.get('/', async (req, res) => {
  try {
    // 1. Get current active watchlist
    const watchlist = await watchlistRepository.getAll();
    const activeWatchlist = watchlist.filter((w) => w.is_active);
    const activeTickerSet = new Set(activeWatchlist.map((w) => w.ticker.toUpperCase()));

    // 2. Get existing evaluations
    let evaluations = await evaluationRepository.getAll();
    const evalMap = new Map(evaluations.map((e) => [e.ticker.toUpperCase(), e]));

    // 3. Ensure all active tickers have fresh valuations & live quotes
    let hasChanges = false;
    const now = Date.now();

    await Promise.all(
      activeWatchlist.map(async (item) => {
        const ticker = item.ticker.toUpperCase();
        try {
          const existing = evalMap.get(ticker);
          const isSeedOrStale =
            !existing ||
            existing.data_quality?.source === 'seed' ||
            !existing.evaluated_at ||
            isNaN(new Date(existing.evaluated_at).getTime()) ||
            now - new Date(existing.evaluated_at).getTime() > 15 * 60 * 1000;

          if (isSeedOrStale) {
            const override = dbClient.classifications.get(ticker);
            const newEval = await evaluationService.evaluateTicker(ticker, override);
            evalMap.set(ticker, newEval);
            hasChanges = true;
          } else {
            const quote = await evaluationService.getLiveQuote(ticker);
            if (quote && quote.price > 0) {
              if (existing.price !== quote.price || existing.change1d !== quote.changePercent) {
                existing.price = quote.price;
                existing.change1d = quote.changePercent;
                if (quote.shortName || quote.longName) {
                  existing.name = quote.shortName || quote.longName;
                }
                hasChanges = true;
              }
            }
          }
        } catch (err) {
          console.warn(`[EvaluationRouter] Could not auto-evaluate or update ticker ${ticker}:`, (err as Error).message);
        }
      })
    );

    // 4. Filter only active watchlist tickers
    const finalEvaluations: typeof evaluations = [];
    for (const [ticker, ev] of evalMap.entries()) {
      if (activeTickerSet.has(ticker)) {
        finalEvaluations.push(ev);
      }
    }

    // 5. If new evaluations were computed or updated, persist them
    if (hasChanges || finalEvaluations.length !== evaluations.length) {
      await evaluationRepository.saveAll(finalEvaluations);
    }

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      count: finalEvaluations.length,
      provider: evaluationService.getProviderName(),
      evaluations: finalEvaluations,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// POST /api/v8/evaluations/recalculate (Force re-evaluation of all active watchlist tickers)
evaluationRouter.post('/recalculate', async (req, res) => {
  try {
    const watchlist = await watchlistRepository.getAll();
    const activeWatchlist = watchlist.filter((w) => w.is_active);
    const updatedEvaluations: typeof watchlist = [];

    const results = await Promise.all(
      activeWatchlist.map(async (item) => {
        const ticker = item.ticker.toUpperCase();
        try {
          const override = dbClient.classifications.get(ticker);
          const ev = await evaluationService.evaluateTicker(ticker, override);
          return { success: true, ev };
        } catch (err: any) {
          return { success: false, ticker, error: err.message };
        }
      })
    );

    const successfulEvaluations = results.filter((r) => r.success && r.ev).map((r) => r.ev!);
    if (successfulEvaluations.length > 0) {
      await evaluationRepository.saveAll(successfulEvaluations);
    }

    res.json({
      success: true,
      message: `${successfulEvaluations.length}개 종목의 DB 기반 퀀트 평가가 새로고침되었습니다.`,
      count: successfulEvaluations.length,
      provider: evaluationService.getProviderName(),
      evaluations: successfulEvaluations,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v8/evaluations/history/:ticker OR /:ticker/history (Daily Score & Technical Indicators History)
evaluationRouter.get('/history/:ticker', async (req, res) => {
  try {
    const ticker = req.params.ticker.toUpperCase();
    const range = (req.query.range as string) || '1y';
    const data = await dailyScoreHistoryService.getDailyScoreHistory(ticker, range);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

evaluationRouter.get('/:ticker/history', async (req, res) => {
  try {
    const ticker = req.params.ticker.toUpperCase();
    const range = (req.query.range as string) || '1y';
    const data = await dailyScoreHistoryService.getDailyScoreHistory(ticker, range);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

evaluationRouter.get('/:ticker', async (req, res) => {
  try {
    const ticker = req.params.ticker.toUpperCase();
    const evaluation = await evaluationService.evaluateTicker(ticker);
    res.json({ success: true, evaluation });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});
