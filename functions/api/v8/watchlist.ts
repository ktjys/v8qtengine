import { watchlistRepository } from '../../../src/db/repositories/watchlistRepository';
import { assetRepository } from '../../../src/db/repositories/assetRepository';
import { evaluationService } from '../../../src/pipeline/evaluationService';
import { evaluationRepository } from '../../../src/db/repositories/evaluationRepository';
import { dbClient } from '../../../src/db/supabaseClient';
import { runV8PipelineOnSeedData } from '../../../src/data/seed/initialData';

// GET, POST, DELETE /api/v8/watchlist
export async function onRequest(context: any) {
  const { request } = context || {};
  const method = request?.method || 'GET';

  try {
    if (method === 'POST') {
      let body: any = {};
      try {
        if (request?.json) body = await request.json();
      } catch {}

      const cleanTicker = (body.ticker || '').toUpperCase().trim();
      if (!cleanTicker) {
        return new Response(
          JSON.stringify({ success: false, error: 'Ticker is required' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      await assetRepository.upsert({
        ticker: cleanTicker,
        name: body.name || cleanTicker,
        asset_type: 'equity',
        exchange: 'US',
        currency: 'USD',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const added = await watchlistRepository.add({
        ticker: cleanTicker,
        name: body.name || cleanTicker,
        memo: body.memo || '신규 추가 종목',
      });

      // Also auto-evaluate
      let evaluation = null;
      try {
        const override = dbClient.classifications.get(cleanTicker);
        evaluation = await evaluationService.evaluateTicker(cleanTicker, override);
        if (evaluation) {
          await evaluationRepository.saveAll([evaluation]);
        }
      } catch (evErr: any) {
        console.warn('Auto evaluation error on watchlist POST:', evErr);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `${cleanTicker} 종목이 워치리스트에 추가되었습니다.`,
          item: added,
          evaluation,
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          },
        }
      );
    }

    if (method === 'DELETE') {
      const url = new URL(request?.url || 'http://localhost');
      const ticker = url.pathname.split('/').pop()?.toUpperCase();
      if (ticker) {
        await watchlistRepository.remove(ticker);
      }
      return new Response(
        JSON.stringify({ success: true, message: `${ticker} removed` }),
        { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    // GET
    let list = await watchlistRepository.getAll();
    if (!list || list.length === 0) {
      const seedData = runV8PipelineOnSeedData();
      list = seedData.watchlist;
    }

    return new Response(
      JSON.stringify({
        success: true,
        count: list.length,
        watchlist: list,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      }
    );
  }
}

export const onRequestGet = onRequest;
export const onRequestPost = onRequest;
export const onRequestDelete = onRequest;
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
