// GET /api/v8/telegram/status
export async function onRequestGet(context: any) {
  const { env = {} } = context || {};

  const botToken = env?.TELEGRAM_BOT_TOKEN;
  const chatId = env?.TELEGRAM_CHAT_ID;

  return new Response(
    JSON.stringify({
      success: true,
      configured: Boolean(botToken && chatId),
      botTokenConfigured: Boolean(botToken),
      chatIdConfigured: Boolean(chatId),
      targetChatIdMasked: chatId ? `${chatId.slice(0, 3)}****` : null,
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

