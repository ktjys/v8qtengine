import { evaluationRepository } from '../../../../src/db/repositories/evaluationRepository';
import { evaluationService } from '../../../../src/pipeline/evaluationService';
import { watchlistRepository } from '../../../../src/db/repositories/watchlistRepository';
import { dbClient } from '../../../../src/db/supabaseClient';

// POST /api/v8/evaluations/recalculate
export async function onRequest(context: any) {
  try {
    const watchlist = await watchlistRepository.getAll();
    const activeWatchlist = watchlist.filter((w) => w.is_active);
    const targetWatchlist = activeWatchlist.length > 0 ? activeWatchlist : watchlist;

    const results = await Promise.all(
      targetWatchlist.map(async (item) => {
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

    return new Response(
      JSON.stringify({
        success: true,
        message: `${successfulEvaluations.length}개 종목의 DB 기반 퀀트 평가가 새로고침되었습니다.`,
        count: successfulEvaluations.length,
        provider: evaluationService.getProviderName(),
        evaluations: successfulEvaluations,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || 'Recalculate failed',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}

export const onRequestPost = onRequest;
export const onRequestGet = onRequest;
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
