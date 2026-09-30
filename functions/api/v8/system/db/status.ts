import { dbClient } from '../../../../../src/db/supabaseClient';

// GET /api/v8/system/db/status
export async function onRequest(context: any) {
  try {
    if (!dbClient.isSupabaseConnected && context?.env) {
      const env = context.env;
      const url = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').trim();
      const key = (
        env.SUPABASE_KEY ||
        env.SUPABASE_ANON_KEY ||
        env.SUPABASE_SERVICE_ROLE_KEY ||
        env.VITE_SUPABASE_ANON_KEY ||
        ''
      ).trim();
      if (url && key) {
        await dbClient.connectFromTrustedEnv(url, key);
      }
    }
    const status = dbClient.getStatus();
    const config = dbClient.getConfig();
    const tables = await dbClient.checkTableStatus();

    return new Response(
      JSON.stringify({
        success: true,
        status,
        config,
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
        error: err.message || 'Status check failed',
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
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
