import { initBackfill } from '../../../../src/engine/backfillEngine';

// POST /api/v8/backtest/backfill-init
export async function onRequest(context: any) {
  try {
    let body: any = {};
    if (context.request.method === 'POST') {
      try {
        body = await context.request.json();
      } catch {}
    }

    const { lookbackRange, tickers, replaceExisting } = body;
    const initData = await initBackfill({
      lookbackRange: lookbackRange || '1y',
      tickers,
      replaceExisting: replaceExisting ?? true,
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: initData,
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
        error: err.message || 'Backfill init error',
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
