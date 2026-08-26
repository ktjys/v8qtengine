import { runV8PipelineOnSeedData, INITIAL_WATCHLIST_RAW } from '../../../src/data/seed/initialData';
import { buildSignalTelegramMessage, buildScanSummaryTelegramMessage } from '../../../src/notification/templates';

// Helper to send message to Telegram Bot
async function sendTelegramMessage(token: string, chatId: string, text: string) {
  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
    });
    const data = await res.json();
    return { ok: res.ok, data };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

// GET or POST /api/v8/cron-scan
export async function onRequest(context: any) {
  const { request, env = {} } = context || {};
  const startTime = Date.now();

  try {
    // 1. Check optional secret token protection if set in Cloudflare Environment
    const url = new URL(request?.url || 'http://localhost/api/v8/cron-scan');
    const providedToken = url.searchParams.get('token') || request?.headers?.get('x-cron-token');
    const secretToken = env?.CRON_SECRET_TOKEN || env?.V8_CRON_SECRET;

    if (secretToken && providedToken !== secretToken) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Unauthorized: Invalid or missing cron secret token',
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // 2. Determine scan session slot (Post-market, Pre-market, Intraday, or Manual)
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

    // 3. Execute Quant Pipeline Evaluation
    const scanResult = runV8PipelineOnSeedData();
    const evaluations = scanResult.evaluations || [];
    const actionableSignals = evaluations.filter((e) => e.decision?.actionable);

    // 4. Send Telegram Notification if configured
    const botToken = env?.TELEGRAM_BOT_TOKEN || url.searchParams.get('bot_token');
    const chatId = env?.TELEGRAM_CHAT_ID || url.searchParams.get('chat_id');
    let telegramResult: any = { sent: false, reason: 'Telegram credentials not configured' };

    if (botToken && chatId) {
      // Build high-level briefing text
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
          reportText += `${idx + 1}. <b>${sig.ticker}</b> (${sig.name})\n`;
          reportText += `   - 현재가: $${(sig.price ?? 0).toFixed(2)} (${arrow}${(sig.change1d ?? 0) >= 0 ? '+' : ''}${sig.change1d ?? 0}%)\n`;
          reportText += `   - 기회점수: <b>${sig.opportunity?.opportunity_score ?? 50}점</b> | 판정: <code>${sig.decision?.decision || 'HOLD'}</code>\n`;
          reportText += `   - 핵심이유: ${sig.decision?.reason || '모멘텀 지표 양호'}\n\n`;
        });
      } else {
        reportText += `ℹ️ 현재 기준 엄격한 리스크 제약을 통과한 신규 진입 신호가 없습니다. (현금 비중 유지 권장)\n\n`;
      }

      reportText += `🔗 <a href="${url.origin}">퀀트 대시보드 바로가기</a>`;

      const sendRes = await sendTelegramMessage(botToken, chatId, reportText);
      telegramResult = {
        sent: sendRes.ok,
        details: sendRes,
      };
    }

    const durationMs = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: true,
        slot: slotName,
        kst_time: kstTimeStr,
        duration_ms: durationMs,
        evaluated_count: evaluations.length,
        actionable_signals_count: actionableSignals.length,
        actionable_signals: actionableSignals.map((s) => ({
          ticker: s.ticker,
          name: s.name,
          decision: s.decision?.decision || 'HOLD',
          opportunity_score: s.opportunity?.opportunity_score ?? 50,
          risk_level: s.risk?.risk_level || 'MODERATE',
          price: s.price ?? 0,
        })),
        telegram_status: telegramResult,
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
        error: err.message || 'Auto scan execution failed',
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
export const onRequestPost = onRequest;
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-cron-token',
    },
  });
}
