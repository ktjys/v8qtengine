import { scanService } from '../../../src/pipeline/scanService';

function sanitizeToken(token?: string | null): string | null {
  if (!token) return null;
  let clean = token.trim().replace(/^['"]|['"]$/g, '');
  if (clean.toLowerCase().startsWith('bot')) {
    clean = clean.substring(3);
  }
  return clean || null;
}

function sanitizeChatId(chatId?: string | null): string | null {
  if (!chatId) return null;
  return chatId.trim().replace(/^['"]|['"]$/g, '') || null;
}

// Helper to send message to Telegram Bot
async function sendTelegramMessage(token: string, chatId: string, text: string) {
  try {
    const cleanToken = sanitizeToken(token);
    const cleanChat = sanitizeChatId(chatId);
    if (!cleanToken || !cleanChat) {
      return { ok: false, error: 'Invalid sanitized token or chatId' };
    }

    const url = `https://api.telegram.org/bot${cleanToken}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: cleanChat,
        text,
        parse_mode: 'HTML',
      }),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

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

      if (providedToken && providedToken !== secretToken) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Unauthorized: Invalid cron secret token provided',
            timestamp: new Date().toISOString(),
          }),
          { status: 401, headers: corsHeaders }
        );
      }
    }

    // 2. Determine scan session slot
    const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000); // KST UTC+9
    const kstHour = nowKST.getUTCHours();
    const kstMinute = nowKST.getUTCMinutes();
    const kstTimeStr = `${String(kstHour).padStart(2, '0')}:${String(kstMinute).padStart(2, '0')} KST`;

    let slotName = '수동/실시간 스캔';
    if (kstHour >= 6 && kstHour <= 8) {
      slotName = '🌅 [1회차] 미국 정규장 마감 브리핑 (종가 확정)';
    } else if (kstHour >= 21 && kstHour <= 23) {
      slotName = '🌃 [2회차] 프리마켓 갭 분석 & 당일 관심종목 압축';
    } else if (kstHour >= 1 && kstHour <= 3) {
      slotName = '🌙 [3회차] 장중 급변 & 모멘텀 브레이크아웃 감시';
    }

    // 3. Execute Quant Pipeline Evaluation with Live Market Data
    let evaluations: any[] = [];
    let actionableSignals: any[] = [];

    try {
      const scanResult = await scanService.executeScan({ saveToDb: false });
      evaluations = scanResult.evaluations || [];
    } catch (scanErr) {
      console.warn('[CronScan Worker] scanService failed:', scanErr);
    }

    actionableSignals = evaluations.filter((e) => e.signal_generated);

    // 4. Send Telegram Notification if configured
    const botToken =
      url.searchParams.get('bot_token') ||
      url.searchParams.get('token') ||
      bodyData.botToken ||
      request?.headers?.get('x-telegram-token') ||
      env?.TELEGRAM_BOT_TOKEN;

    const chatId =
      url.searchParams.get('chat_id') ||
      bodyData.chatId ||
      request?.headers?.get('x-telegram-chat-id') ||
      env?.TELEGRAM_CHAT_ID;

    let telegramResult = {
      configured: Boolean(botToken && chatId),
      sent: false,
      previewOnly: !Boolean(botToken && chatId),
      target: chatId ? `${String(chatId).slice(0, 3)}****` : null,
      message: Boolean(botToken && chatId)
        ? '텔레그램 발송 준비 완료'
        : '텔레그램 봇 토큰/챗ID 미등록 (시뮬레이션 모드)',
    };

    if (botToken && chatId) {
      const cleanToken = sanitizeToken(botToken);
      const cleanChat = sanitizeChatId(chatId);

      if (cleanToken && cleanChat) {
        let reportText = `<b>📊 퀀트 의사결정 엔진 - 자동 스캔 리포트</b>\n`;
        reportText += `🕒 <b>실행 시점:</b> ${kstTimeStr} (${slotName})\n`;
        reportText += `━━━━━━━━━━━━━━━━━━━━━\n`;
        reportText += `• <b>모니터링 종목:</b> ${evaluations.length}개\n`;
        reportText += `• <b>진입 신호 포착:</b> <b>${actionableSignals.length}건</b>\n`;
        reportText += `• <b>리스크 주의 종목:</b> ${evaluations.filter((e) => e.risk?.risk_level === 'HIGH').length}개\n\n`;

        if (actionableSignals.length > 0) {
          reportText += `<b>🎯 오늘 포착된 주요 기회 종목:</b>\n`;
          actionableSignals.slice(0, 4).forEach((sig, idx) => {
            const arrow = (sig.change1d ?? 0) >= 0 ? '🔺' : '🔻';
            const changeStr = `${(sig.change1d ?? 0) >= 0 ? '+' : ''}${(sig.change1d ?? 0).toFixed(1)}%`;
            reportText += `${idx + 1}. <b>${sig.ticker}</b> (${sig.name})\n`;
            reportText += `   - 현재가: $${(sig.price ?? 0).toFixed(2)} (${arrow} ${changeStr})\n`;
            reportText += `   - 기회점수: <b>${sig.opportunity?.opportunity_score ?? 50}점</b> | 판정: <code>${sig.decision?.decision || 'BUY'}</code>\n`;
            reportText += `   - 핵심이유: ${sig.decision?.reason || '기술적 반등 및 모멘텀 지속'}\n\n`;
          });
        } else {
          reportText += `ℹ️ 현재 기준 엄격한 리스크 제약을 통과한 신규 진입 신호가 없습니다. (현금 비중 유지 권장)\n\n`;
        }

        reportText += `🔗 <a href="${url.origin}">퀀트 대시보드 바로가기</a>`;

        const sendRes = await sendTelegramMessage(cleanToken, cleanChat, reportText);
        telegramResult = {
          configured: true,
          sent: sendRes.ok,
          previewOnly: false,
          target: `${cleanChat.slice(0, 3)}****`,
          message: sendRes.ok
            ? '텔레그램 봇으로 실제 브리핑 리포트가 발송되었습니다!'
            : `텔레그램 발송 실패: ${(sendRes.data as any)?.description || sendRes.error || '인증 오류'}`,
        };
      }
    }

    const durationMs = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        slot: slotName,
        kst_time: kstTimeStr,
        duration_ms: durationMs,
        evaluated_count: evaluations.length,
        actionable_signals_count: actionableSignals.length,
        actionable_signals: actionableSignals.map((s) => ({
          ticker: s.ticker,
          name: s.name,
          decision: s.decision?.decision || 'BUY',
          opportunity_score: s.opportunity?.opportunity_score ?? 50,
          risk_level: s.risk?.risk_level || 'MODERATE',
          price: s.price ?? 0,
          change1d: s.change1d ?? 0,
          reason: s.decision?.reason || '',
        })),
        telegram_status: telegramResult,
        run_id: `CRON_${Date.now()}`,
      }),
      { status: 200, headers: corsHeaders }
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
