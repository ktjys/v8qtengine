import { dbClient } from '../../../../../src/db/supabaseClient';

// POST /api/v8/system/db/seed
export async function onRequest(context: any) {
  try {
    const result = await dbClient.seedToActiveDb();
    if (!result.success) {
      return new Response(
        JSON.stringify({ success: false, error: result.error }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const tables = await dbClient.checkTableStatus();
    return new Response(
      JSON.stringify({
        success: true,
        message: `기본 유니버스 및 시그널 데이터(${result.seededCount}개)가 주입되었습니다.`,
        seededCount: result.seededCount,
        tables,
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
        error: err.message || 'Seed failed',
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
