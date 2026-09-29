import { Router } from 'express';
import { evaluationRepository } from '../db/repositories/evaluationRepository';
import { evaluationService } from '../pipeline/evaluationService';
import { watchlistRepository } from '../db/repositories/watchlistRepository';
import { assetRepository } from '../db/repositories/assetRepository';
import { dbClient } from '../db/supabaseClient';
import { dailyScoreHistoryService } from '../pipeline/dailyScoreHistoryService';
import { runV8PipelineOnSeedData } from '../data/seed/initialData';
import { createSuccessResponse, createErrorResponse } from './apiResponse';

export const evaluationRouter = Router();

// GET /api/v8/evaluations (Fast Direct DB Read)
evaluationRouter.get('/', async (req, res) => {
  try {
    const [evaluations, watchlist] = await Promise.all([
      evaluationRepository.getAll(),
      watchlistRepository.getAll(),
    ]);

    const watchlistTickerSet = new Set(watchlist.map((w) => w.ticker.toUpperCase()));
    
    // Filter evaluations strictly to registered watchlist items.
    // If watchlist is empty, returned evaluations must be empty.
    const finalEvaluations = watchlist.length === 0
      ? []
      : evaluations.filter((e) => watchlistTickerSet.has(e.ticker.toUpperCase()));

    const responseObj = createSuccessResponse(finalEvaluations, {
      count: finalEvaluations.length,
      provider: evaluationService.getProviderName(),
    });

    res.json({
      ...responseObj,
      evaluations: finalEvaluations,
    });
  } catch (err) {
    res.status(500).json(createErrorResponse((err as Error).message));
  }
});

// POST /api/v8/evaluations/recalculate (Force re-evaluation of all assets in database)
evaluationRouter.post('/recalculate', async (req, res) => {
  try {
    // Get all assets from DB (not just watchlist)
    const allAssets = await assetRepository.getAll();
    
    if (allAssets.length === 0) {
      const fallbackEvals = runV8PipelineOnSeedData().evaluations;
      return res.json({
        ...createSuccessResponse(fallbackEvals, {
          message: '기본 유니버스 퀀트 평가가 완료되었습니다.',
          count: fallbackEvals.length,
        }),
        evaluations: fallbackEvals,
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
      ...createSuccessResponse(successfulEvaluations, {
        message: `${successfulEvaluations.length}개 종목의 DB 기반 퀀트 평가가 새로고침되었습니다.`,
        count: successfulEvaluations.length,
        provider: evaluationService.getProviderName(),
      }),
      evaluations: successfulEvaluations,
    });
  } catch (err: any) {
    console.error('[EvaluationRouter] Recalculate critical error:', err);
    res.status(500).json(createErrorResponse(err.message || '평가 갱신 실패'));
  }
});

// GET /api/v8/evaluations/history/:ticker OR /:ticker/history (Daily Score & Technical Indicators History)
evaluationRouter.get('/history/:ticker', async (req, res) => {
  try {
    const ticker = req.params.ticker.toUpperCase();
    const range = (req.query.range as string) || '1y';
    const data = await dailyScoreHistoryService.getDailyScoreHistory(ticker, range);
    res.json(createSuccessResponse(data));
  } catch (err) {
    res.status(500).json(createErrorResponse((err as Error).message));
  }
});

evaluationRouter.get('/:ticker/history', async (req, res) => {
  try {
    const ticker = req.params.ticker.toUpperCase();
    const range = (req.query.range as string) || '1y';
    const data = await dailyScoreHistoryService.getDailyScoreHistory(ticker, range);
    res.json(createSuccessResponse(data));
  } catch (err) {
    res.status(500).json(createErrorResponse((err as Error).message));
  }
});

evaluationRouter.get('/:ticker', async (req, res) => {
  try {
    const ticker = req.params.ticker.toUpperCase();
    const evaluation = await evaluationService.evaluateTicker(ticker);
    res.json(createSuccessResponse(evaluation));
  } catch (err) {
    res.status(500).json(createErrorResponse((err as Error).message));
  }
});
