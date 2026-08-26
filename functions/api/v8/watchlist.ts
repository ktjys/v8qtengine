import { runV8PipelineOnSeedData } from '../../../src/data/seed/initialData';

// GET, POST, DELETE /api/v8/watchlist
export async function onRequest(context: any) {
  const { request } = context || {};
  const method = request?.method || 'GET';

  try {
    const { watchlist } = runV8PipelineOnSeedData();

    if (method === 'POST') {
      let body: any = {};
      try {
        if (request?.json) body = await request.json();
      } catch {}
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Saved to local/session cache',
          item: {
            ticker: (body.ticker || 'NEW').toUpperCase(),
            name: body.name || body.ticker,
            memo: body.memo || '관심 종목',
            is_active: true,
            created_at: new Date().toISOString(),
          },
        }),
        { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        count: watchlist.length,
        watchlist,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
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
