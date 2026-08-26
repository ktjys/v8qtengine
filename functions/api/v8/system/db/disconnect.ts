import { dbClient } from '../../../../../src/db/supabaseClient';

// POST /api/v8/system/db/disconnect
export async function onRequest(context: any) {
  try {
    dbClient.disconnectSupabase();
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Supabase 연결이 해제되었으며 로컬 영속 모드로 전환되었습니다.',
        status: dbClient.getStatus(),
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
        error: err.message || 'Disconnect failed',
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
