// GET /api/v8/system/status
export async function onRequest(context: any) {
  const { env = {} } = context || {};

  return new Response(
    JSON.stringify({
      success: true,
      status: 'HEALTHY',
      runtime: 'Cloudflare Pages Functions (Edge)',
      database: {
        type: env.SUPABASE_URL ? 'Supabase' : 'Edge Memory / Local Cache',
        connected: Boolean(env.SUPABASE_URL && env.SUPABASE_KEY),
      },
      telegram: {
        configured: Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID),
      },
      timestamp: new Date().toISOString(),
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}
