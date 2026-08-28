import { dailyScoreHistoryService } from '../../../../../src/pipeline/dailyScoreHistoryService';

// GET /api/v8/evaluations/history/:ticker
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

    const url = new URL(context.request.url);
    const range = url.searchParams.get('range') || '6m';

    const data = await dailyScoreHistoryService.getDailyScoreHistory(ticker, range);

    return new Response(
      JSON.stringify({
        success: true,
        data,
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
  } catch (err: any) {
    console.error('[evaluations/history/[ticker]] Error:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || 'Failed to calculate daily score history',
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
