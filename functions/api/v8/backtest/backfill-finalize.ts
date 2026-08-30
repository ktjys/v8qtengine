import { finalizeBackfill } from '../../../../src/engine/backfillEngine';

// POST /api/v8/backtest/backfill-finalize
export async function onRequest(context: any) {
  try {
    let body: any = {};
    if (context.request.method === 'POST') {
      try {
        body = await context.request.json();
      } catch {}
    }

    const result = await finalizeBackfill(
      body.targetTickers || [],
      body.range || '1y',
      body.totalBarsIngested || 0,
      body.allSignals,
      body.detailsByTicker || {},
      body.minDate || '2024-01-01',
      body.maxDate || new Date().toISOString().split('T')[0]
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: `백필 요약 및 DB 동기화 완료`,
        result,
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
        error: err.message || 'Backfill finalize error',
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

export const onRequestGet = onRequest;
export const onRequestPost = onRequest;
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
