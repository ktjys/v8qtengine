// GET /api/v8/telegram/status
export async function onRequestGet(context: any) {
  const { request, env = {} } = context || {};

  const url = new URL(request?.url || 'http://localhost/api/v8/telegram/status');
  const queryBotToken = url.searchParams.get('bot_token');
  const queryChatId = url.searchParams.get('chat_id');

  const botToken = env?.TELEGRAM_BOT_TOKEN || env?.V8_TELEGRAM_BOT_TOKEN || queryBotToken || '';
  const chatId = env?.TELEGRAM_CHAT_ID || env?.V8_TELEGRAM_CHAT_ID || queryChatId || '';

  const isConfigured = Boolean(botToken && chatId);

  return new Response(
    JSON.stringify({
      success: true,
      configured: isConfigured,
      botTokenConfigured: Boolean(botToken),
      chatIdConfigured: Boolean(chatId),
      targetChatIdMasked: chatId ? `${chatId.slice(0, 3)}****` : null,
      source: env?.TELEGRAM_BOT_TOKEN ? 'CLOUDFLARE_ENV' : queryBotToken ? 'QUERY_PARAM' : 'UNCONFIGURED',
      runtime: 'Cloudflare Pages Functions',
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}

export const onRequest = onRequestGet;


