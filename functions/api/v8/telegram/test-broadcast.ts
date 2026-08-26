// POST /api/v8/telegram/test-broadcast
export async function onRequestPost(context: any) {
  const { request, env = {} } = context || {};

  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {}

    const botToken = env?.TELEGRAM_BOT_TOKEN || body.botToken;
    const chatId = env?.TELEGRAM_CHAT_ID || body.chatId;

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

    const data = await res.json();

    return new Response(
      JSON.stringify({
        success: res.ok,
        previewOnly: false,
        telegramResponse: data,
        message: res.ok
          ? '텔레그램 봇으로 실제 테스트 메시지가 발송되었습니다!'
          : `텔레그램 발송 실패: ${data.description || '인증 오류'}`,
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
