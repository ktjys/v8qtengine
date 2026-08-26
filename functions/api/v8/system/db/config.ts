import { dbClient } from '../../../../../src/db/supabaseClient';

// POST /api/v8/system/db/config
export async function onRequest(context: any) {
  try {
    let body: any = {};
    if (context.request.method === 'POST') {
      try {
        body = await context.request.json();
      } catch {}
    }

    const { url, key } = body;
    if (!url || !key) {
      return new Response(
        JSON.stringify({ success: false, error: 'Supabase URL과 Key를 모두 전달해야 합니다.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result = await dbClient.configureSupabase(url, key);
    if (!result.success) {
      return new Response(
        JSON.stringify({ success: false, error: result.error }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Supabase 데이터베이스가 성공적으로 연결되었습니다.',
        status: dbClient.getStatus(),
        tables: result.tables,
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
        error: err.message || 'Config update failed',
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
