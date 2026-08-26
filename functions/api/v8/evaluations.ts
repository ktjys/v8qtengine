import { evaluationRepository } from '../../../src/db/repositories/evaluationRepository';
import { watchlistRepository } from '../../../src/db/repositories/watchlistRepository';
import { evaluationService } from '../../../src/pipeline/evaluationService';
import { dbClient } from '../../../src/db/supabaseClient';
import { runV8PipelineOnSeedData } from '../../../src/data/seed/initialData';

// GET /api/v8/evaluations
export async function onRequest(context: any) {
  try {
    const watchlist = await watchlistRepository.getAll();
    const activeWatchlist = watchlist.filter((w) => w.is_active);
    const targetWatchlist = activeWatchlist.length > 0 ? activeWatchlist : watchlist;

    let existingEvaluations = await evaluationRepository.getAll();
    const evalMap = new Map(existingEvaluations.map((e) => [e.ticker.toUpperCase(), e]));

    let hasChanges = false;
    for (const item of targetWatchlist) {
      const ticker = item.ticker.toUpperCase();
      if (!evalMap.has(ticker)) {
        try {
          const override = dbClient.classifications.get(ticker);
          const newEval = await evaluationService.evaluateTicker(ticker, override);
          evalMap.set(ticker, newEval);
          hasChanges = true;
        } catch (e) {
          console.warn(`Evaluation failed for ${ticker}:`, e);
        }
      }
    }

    let finalEvaluations = Array.from(evalMap.values());
    if (finalEvaluations.length === 0) {
      const seedResult = runV8PipelineOnSeedData();
      finalEvaluations = seedResult.evaluations;
    }

    if (hasChanges && finalEvaluations.length > 0) {
      await evaluationRepository.saveAll(finalEvaluations);
    }

    return new Response(
      JSON.stringify({
        success: true,
        count: finalEvaluations.length,
        evaluations: finalEvaluations,
        provider: evaluationService.getProviderName(),
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
    const fallback = runV8PipelineOnSeedData();
    return new Response(
      JSON.stringify({
        success: true,
        count: fallback.evaluations.length,
        evaluations: fallback.evaluations,
        fallback: true,
        error: err.message,
      }),
      {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      }
    );
  }
}

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
