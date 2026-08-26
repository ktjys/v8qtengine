// Cloudflare Pages Functions: GET/POST /api/health
export async function onRequest(context: any) {
  return new Response(
    JSON.stringify({
      status: 'ok',
      timestamp: new Date().toISOString(),
      runtime: 'Cloudflare Pages Functions (Edge V8)',
      app: 'QUANT DECISION ENGINE v8',
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}
