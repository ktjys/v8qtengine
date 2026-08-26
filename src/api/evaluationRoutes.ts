import { Router } from 'express';
import { evaluationRepository } from '../db/repositories/evaluationRepository';
import { evaluationService } from '../pipeline/evaluationService';
import { watchlistRepository } from '../db/repositories/watchlistRepository';
import { assetRepository } from '../db/repositories/assetRepository';
import { dbClient } from '../db/supabaseClient';
import { dailyScoreHistoryService } from '../pipeline/dailyScoreHistoryService';
import { runV8PipelineOnSeedData } from '../data/seed/initialData';

export const evaluationRouter = Router();

// GET /api/v8/evaluations
evaluationRouter.get('/', async (req, res) => {
  try {
    // 1. Get ALL assets from asset table (including those added via watchlist)
    const allAssets = await assetRepository.getAll();
    const assetTickerSet = new Set(allAssets.map((a) => a.ticker.toUpperCase()));

    // 2. Get watchlist for priority (active items get fresh evaluations)
    const watchlist = await watchlistRepository.getAll();
    const watchlistTickerSet = new Set(watchlist.map((w) => w.ticker.toUpperCase()));
    const activeWatchlist = watchlist.filter((w) => w.is_active);

    // 3. Get existing evaluations
    let evaluations = await evaluationRepository.getAll();
    const evalMap = new Map(evaluations.map((e) => [e.ticker.toUpperCase(), e]));

    // 4. Refresh active watchlist tickers with fresh data
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

    // 5. Return evaluations for ALL assets (not just watchlist)
    // If an asset doesn't have evaluation yet, it will be evaluated on next request or recalculate
    const finalEvaluations: typeof evaluations = [];
    for (const [ticker, ev] of evalMap.entries()) {
      if (assetTickerSet.has(ticker)) {
        finalEvaluations.push(ev);
      }
    }

    // 6. Persist any changes
    if (hasChanges) {
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

// POST /api/v8/evaluations/recalculate (Force re-evaluation of all assets in database)
evaluationRouter.post('/recalculate', async (req, res) => {
  try {
    // Get all assets from DB (not just watchlist)
    const allAssets = await assetRepository.getAll();
    
    if (allAssets.length === 0) {
      // Seed fallback
      const seedResult = runV8PipelineOnSeedData ? runV8PipelineOnSeedData() : null;
      return res.json({
        success: true,
        message: '기본 유니버스 퀀트 평가가 완료되었습니다.',
        count: seedResult?.evaluations?.length || 0,
        evaluations: seedResult?.evaluations || [],
      });
    }

    const results = await Promise.all(
      allAssets.map(async (asset) => {
        const ticker = asset.ticker.toUpperCase();
        try {
          const override = dbClient.classifications.get(ticker);
          const ev = await evaluationService.evaluateTicker(ticker, override);
          return { success: true, ev };
        } catch (err: any) {
          console.warn(`[EvaluationRouter] Failed to evaluate ${ticker}:`, err.message);
          return { success: false, ticker, error: err.message };
        }
      })
    );

    let successfulEvaluations = results.filter((r) => r.success && r.ev).map((r) => r.ev!);
    if (successfulEvaluations.length === 0) {
      // If live evaluations failed, fallback to existing evaluations
      const existing = await evaluationRepository.getAll();
      if (existing.length > 0) {
        successfulEvaluations = existing;
      }
    } else {
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
    console.error('[EvaluationRouter] Recalculate critical error:', err);
    res.status(500).json({ success: false, error: err.message || '평가 갱신 실패' });
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
