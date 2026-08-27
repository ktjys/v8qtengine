// POST /api/v8/telegram/test-broadcast
export async function onRequestPost(context: any) {
  const { request, env = {} } = context || {};

  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {}

    let botToken = (env?.TELEGRAM_BOT_TOKEN || body.botToken || '').trim().replace(/^['"]|['"]$/g, '');
    let chatId = (env?.TELEGRAM_CHAT_ID || body.chatId || '').trim().replace(/^['"]|['"]$/g, '');

    if (botToken.toLowerCase().startsWith('bot')) {
      botToken = botToken.substring(3);
    }

    const previewMode = !botToken || !chatId;

    const testMessage = `<b>🚨 [퀀트 엔진] 텔레그램 테스트 알림</b>\n` +
      `🕒 발송 시각: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} KST\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `✅ <b>연동 상태:</b> 정상 동작 중\n` +
      `📈 <b>샘플 티커:</b> NVDA (NVIDIA Corp)\n` +
      `💡 <b>기회 점수:</b> 84점 (OPPORTUNITY)\n` +
      `🛡️ <b>리스크 등급:</b> LOW (안전 영역)\n` +
      `🎯 <b>결론:</b> 기술적 반등 및 모멘텀 지속에 따른 분할 매수 적합\n\n` +
      `자동 스캔(하루 3회: 06:30, 22:00, 02:00 KST) 시 위와 같은 양식으로 신호가 발송됩니다.`;

    if (previewMode) {
      return new Response(
        JSON.stringify({
          success: true,
          previewOnly: true,
          message: '텔레그램 환경변수(TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID)가 Cloudflare Pages에 미등록되어 프리뷰 모드로 시뮬레이션되었습니다.',
          previewText: testMessage,
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: testMessage,
        parse_mode: 'HTML',
      }),
    });

    const data = await res.json().catch(() => ({}));
    const desc = data.description || '';

    let friendlyMessage = res.ok
      ? '텔레그램 봇으로 실제 테스트 메시지가 발송되었습니다!'
      : `텔레그램 발송 실패: ${desc || '인증 오류'}`;

    if (!res.ok) {
      if (desc.includes('chat not found')) {
        friendlyMessage = `대화방을 찾을 수 없습니다 (${desc}). 텔레그램에서 봇과 1:1 대화방을 열고 '/start' 버튼을 누른 후 다시 시도해주세요.`;
      } else if (desc.includes('bot was blocked') || desc.includes('Forbidden')) {
        friendlyMessage = `봇이 차단되었거나 시작되지 않았습니다 (${desc}). 텔레그램 봇 대화방에서 '시작(Start)' 버튼을 눌러주세요.`;
      } else if (desc.includes('Unauthorized') || desc.includes('invalid token')) {
        friendlyMessage = `봇 토큰(Bot Token)이 올바르지 않습니다 (${desc}). BotFather에서 발급받은 토큰을 다시 확인해주세요.`;
      }
    }

    return new Response(
      JSON.stringify({
        success: res.ok,
        previewOnly: false,
        telegramResponse: data,
        message: friendlyMessage,
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
      JSON.stringify({
        success: false,
        error: err.message || 'Telegram test broadcast failed',
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
