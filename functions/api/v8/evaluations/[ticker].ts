import { evaluationService } from '../../../../src/pipeline/evaluationService';
import { dbClient } from '../../../../src/db/supabaseClient';
import { runV8PipelineOnSeedData } from '../../../../src/data/seed/initialData';

// GET /api/v8/evaluations/:ticker
export async function onRequest(context: any) {
  try {
    const ticker = (context.params.ticker || '').toUpperCase();
    if (!ticker) {
      return new Response(
        JSON.stringify({ success: false, error: 'Ticker is required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        }
      );
    }

    try {
      const override = dbClient.classifications.get(ticker);
      const evaluation = await evaluationService.evaluateTicker(ticker, override);
      return new Response(
        JSON.stringify({
          success: true,
          evaluation,
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          },
        }
      );
    } catch (evalErr: any) {
      // Seed fallback
      const seed = runV8PipelineOnSeedData();
      const matched = seed.evaluations.find((e) => e.ticker.toUpperCase() === ticker);
      if (matched) {
        return new Response(
          JSON.stringify({ success: true, evaluation: matched, fallback: true }),
          { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
        );
      }
      throw evalErr;
    }
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Evaluation failed' }),
      {
        status: 500,
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
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
