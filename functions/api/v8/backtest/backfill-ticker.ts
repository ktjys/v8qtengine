import { backfillSingleTicker } from '../../../../src/engine/backfillEngine';

// POST /api/v8/backtest/backfill-ticker
export async function onRequest(context: any) {
  try {
    let body: any = {};
    if (context.request.method === 'POST') {
      try {
        body = await context.request.json();
      } catch {}
    }

    const { ticker, lookbackRange, opportunityThreshold } = body;
    if (!ticker) {
      return new Response(
        JSON.stringify({ success: false, error: 'Ticker is required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        }
      );
    }

    const tickerData = await backfillSingleTicker(ticker, {
      lookbackRange: lookbackRange || '1y',
      opportunityThreshold: opportunityThreshold ? Number(opportunityThreshold) : 70,
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: tickerData,
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
        error: err.message || 'Backfill ticker error',
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
