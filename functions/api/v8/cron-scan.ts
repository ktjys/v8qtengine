import { executeCronScan } from '../../../src/engine/cronScanEngine';

// Handler for GET, POST, and OPTIONS /api/v8/cron-scan
export async function onRequest(context: any) {
  const { request, env = {} } = context || {};
  const startTime = Date.now();

  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-cron-token, x-telegram-token, x-telegram-chat-id',
  };

  if (request?.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const url = new URL(request?.url || 'http://localhost/api/v8/cron-scan');
    let bodyData: any = {};
    if (request?.method === 'POST') {
      try {
        bodyData = await request.json();
      } catch {}
    }

    // 1. Optional Secret Token Check (Supports query, header, Bearer auth)
    const secretToken = env?.CRON_SECRET_TOKEN || env?.V8_CRON_SECRET;
    if (secretToken) {
      const authHeader = request?.headers?.get('authorization') || '';
      const bearerToken = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.substring(7).trim() : null;
      const providedToken =
        url.searchParams.get('token') ||
        url.searchParams.get('secret') ||
        url.searchParams.get('key') ||
        request?.headers?.get('x-cron-token') ||
        bearerToken;

      if (!providedToken || providedToken !== secretToken) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Unauthorized: Invalid or missing cron secret token',
            timestamp: new Date().toISOString(),
          }),
          { status: 401, headers: corsHeaders }
        );
      }
    }

    // Extract telegram configs
    const botToken = (
      env?.TELEGRAM_BOT_TOKEN ||
      url.searchParams.get('bot_token') ||
      url.searchParams.get('token') ||
      bodyData.botToken ||
      bodyData.bot_token ||
      request?.headers?.get('x-telegram-token') ||
      ''
    ).trim().replace(/^['"]|['"]$/g, '').replace(/^bot/i, '');

    const chatId = (
      env?.TELEGRAM_CHAT_ID ||
      url.searchParams.get('chat_id') ||
      url.searchParams.get('chatId') ||
      bodyData.chatId ||
      bodyData.chat_id ||
      request?.headers?.get('x-telegram-chat-id') ||
      ''
    ).trim().replace(/^['"]|['"]$/g, '');

    const reqMarketRaw = (url.searchParams.get('market') || bodyData.market || '').toUpperCase().trim();
    const reqMarket = (reqMarketRaw === 'KR' || reqMarketRaw === 'US' || reqMarketRaw === 'ALL')
      ? (reqMarketRaw as 'KR' | 'US' | 'ALL')
      : undefined;

    // Check async mode
    const isAsync =
      url.searchParams.get('async') === 'true' ||
      url.searchParams.get('async') === '1' ||
      bodyData.async === true ||
      url.searchParams.get('mode') === 'async' ||
      bodyData.mode === 'async';

    if (isAsync && context?.waitUntil && typeof context.waitUntil === 'function') {
      const scanTask = executeCronScan({
        botToken: botToken || undefined,
        chatId: chatId || undefined,
        market: reqMarket,
        triggeredBy: 'PagesFunctionsCronAsync',
        sourceUrl: url.origin,
      }).catch((err) => {
        console.error('[PagesFunctionsCron] Async execution error:', err);
      });

      context.waitUntil(scanTask);

      return new Response(
        JSON.stringify({
          success: true,
          status: 'ACCEPTED',
          mode: 'async',
          message: '크론 스캔이 백그라운드 태스크로 시작되었습니다. 완료 시 텔레그램 발송 및 DB 저장이 자동 완수됩니다.',
          telegram_target: chatId ? `${chatId.slice(0, 3)}****` : null,
          timestamp: new Date().toISOString(),
        }),
        { status: 202, headers: corsHeaders }
      );
    }

    const cronResult = await executeCronScan({
      botToken: botToken || undefined,
      chatId: chatId || undefined,
      market: reqMarket,
      triggeredBy: 'PagesFunctionsCron',
      sourceUrl: url.origin,
    });

    return new Response(
      JSON.stringify({
        ...cronResult,
        duration_ms: Date.now() - startTime,
      }),
      { status: cronResult.success ? 200 : 500, headers: corsHeaders }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || 'Auto scan execution failed',
        timestamp: new Date().toISOString(),
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}

export const onRequestGet = onRequest;
export const onRequestPost = onRequest;
export const onRequestOptions = onRequest;
