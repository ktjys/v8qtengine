import { Router } from 'express';
import { scanService } from '../pipeline/scanService';
import { dbClient } from '../db/supabaseClient';
import { AssetClassification, AlertNotificationLog } from '../types/v8';
import { telegramNotifier } from '../notification/telegramNotifier';
import { ensureDipEvaluation } from '../engine/dipBuyEngine';
import { alertHistoryRepository } from '../db/repositories/alertHistoryRepository';

export const scanRouter = Router();

// POST /api/v8/scan/run
scanRouter.post('/run', async (req, res) => {
  try {
    const simulatePartialFailure = req.body.simulate_partial_failure === true;
    const providerType = req.body.provider_type as 'yahoo' | 'seed' | undefined;
    const sendTelegram = req.body.send_telegram !== false; // 기본값 true

    const manualOverrides: Record<string, AssetClassification> = {};
    for (const [k, v] of dbClient.classifications.entries()) {
      manualOverrides[k] = v;
    }

    const result = await scanService.executeScan(
      { simulatePartialFailure, providerType, saveToDb: true },
      manualOverrides
    );

    const actionableSignals = result.evaluations.filter(
      (ev) => ev.signal_generated
    );

    // Strategy B: 우량주/지수ETF 눌림목 분할적립 기회 필터링
    const dipBuyOpportunities = result.evaluations
      .map((ev) => ({ ...ev, dip_evaluation: ensureDipEvaluation(ev) }))
      .filter(
        (ev) =>
          ev.dip_evaluation?.suitability.isSuitable &&
          (ev.dip_evaluation?.actionSignal === 'STRONG_DIP_BUY' ||
            ev.dip_evaluation?.actionSignal === 'MODERATE_DCA')
      )
      .sort((a, b) => (b.dip_evaluation?.dip_score ?? 0) - (a.dip_evaluation?.dip_score ?? 0));

    // 텔레그램 알림 발송 (텔레그램 설정이 되어있는 경우)
    let telegramStatus: { sent: boolean; message: string; target?: string | null } = {
      sent: false,
      message: '텔레그램 미전송',
    };

    const customToken = (
      req.body?.botToken ||
      (req.headers['x-telegram-token'] as string) ||
      process.env.TELEGRAM_BOT_TOKEN ||
      telegramNotifier.getConfig().botToken ||
      ''
    ).trim().replace(/^['"]|['"]$/g, '').replace(/^bot/i, '');

    const customChat = (
      req.body?.chatId ||
      (req.headers['x-telegram-chat-id'] as string) ||
      process.env.TELEGRAM_CHAT_ID ||
      telegramNotifier.getConfig().chatId ||
      ''
    ).trim().replace(/^['"]|['"]$/g, '');

    const startTime = new Date();
    const kstTimeStr = new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(startTime);

    let reportText = `<b>🚀 퀀트 스캐너 실행 완료 리포트 (듀얼 전략 통합)</b>\n`;
    reportText += `🕒 <b>실행 시각:</b> ${kstTimeStr} (KST)\n`;
    reportText += `━━━━━━━━━━━━━━━━━━━━━\n`;
    reportText += `• <b>검토 대상:</b> ${result.evaluations.length}개 종목\n`;
    reportText += `• <b>전략 A (모멘텀 돌파):</b> <b>${actionableSignals.length}건</b>\n`;
    reportText += `• <b>전략 B (우량주 눌림추매):</b> <b>${dipBuyOpportunities.length}건</b>\n`;
    reportText += `• <b>고위험 종목:</b> ${result.evaluations.filter((e) => e.risk?.risk_level === 'HIGH').length}개\n\n`;

    // 1. 전략 A 섹션
    reportText += `<b>🎯 전략 A: 모멘텀 & 추세돌파 포착 종목</b>\n`;
    if (actionableSignals.length > 0) {
      actionableSignals.slice(0, 5).forEach((sig, idx) => {
        const arrow = (sig.change1d ?? 0) >= 0 ? '🔺' : '🔻';
        const changeStr = `${(sig.change1d ?? 0) >= 0 ? '+' : ''}${(sig.change1d ?? 0).toFixed(1)}%`;
        reportText += `${idx + 1}. <b>${sig.ticker}</b> (${sig.name})\n`;
        reportText += `   - 현재가: $${(sig.price ?? 0).toFixed(2)} (전일대비: ${arrow} ${changeStr})\n`;
        reportText += `   - 기회점수: <b>${sig.opportunity?.opportunity_score ?? 50}점</b> | 판정: <code>${sig.decision?.decision || 'BUY'}</code>\n`;
        reportText += `   - 핵심이유: ${sig.decision?.reason || '기술적 반등 및 팩터 점수 우수'}\n\n`;
      });
    } else {
      reportText += `ℹ️ 현재 엄격한 모멘텀 돌파 제약을 통과한 신규 진입 신호 없음\n\n`;
    }

    // 2. 전략 B 섹션
    reportText += `<b>🛡️ 전략 B: 우량대형주 & 지수ETF 분할적립/눌림목 포착</b>\n`;
    if (dipBuyOpportunities.length > 0) {
      dipBuyOpportunities.slice(0, 5).forEach((dip, idx) => {
        const evalData = dip.dip_evaluation!;
        const arrow = (dip.change1d ?? 0) >= 0 ? '🔺' : '🔻';
        const changeStr = `${(dip.change1d ?? 0) >= 0 ? '+' : ''}${(dip.change1d ?? 0).toFixed(1)}%`;
        reportText += `${idx + 1}. <b>${dip.ticker}</b> (${dip.name})\n`;
        reportText += `   - 현재가: $${(dip.price ?? 0).toFixed(2)} (${arrow} ${changeStr})\n`;
        reportText += `   - 적합도: <b>💎 ${evalData.suitability.tierLabel}</b> (${evalData.suitability.score}점)\n`;
        reportText += `   - 눌림타이밍: <b>${evalData.timing.score}점</b> (RSI ${evalData.timing.rsi.toFixed(1)}, ${evalData.timing.drawdownLabel})\n`;
        reportText += `   - 실행신호: <code>${evalData.actionSignal}</code> (${evalData.signalLabel})\n`;
        reportText += `   - <b>💡 권고 분할적립 배수:</b> <b>${evalData.suggestedDcaRatio}</b>\n\n`;
      });
    } else {
      reportText += `ℹ️ 현재 최적의 과매도 눌림목에 도달한 종목 없음 (정기 일정 유지)\n\n`;
    }

    const host = req.get('host');
    if (host) {
      reportText += `🔗 <a href="${req.protocol}://${host}">퀀트 시스템 대시보드 바로가기</a>`;
    }

    if (sendTelegram) {
      if (customToken && customChat) {
        try {
          const sendRes = await telegramNotifier.sendMessage(reportText, customToken, customChat);
          if (sendRes.success && !sendRes.previewOnly) {
            telegramStatus = {
              sent: true,
              message: '텔레그램 발송 완료',
              target: customChat ? `${customChat.slice(0, 3)}****` : null,
            };
          } else {
            telegramStatus = { sent: false, message: sendRes.error || '텔레그램 발송 실패' };
          }
        } catch (tErr) {
          console.warn('[ScanRoute] Telegram send warning:', tErr);
          telegramStatus = { sent: false, message: (tErr as Error).message };
        }
      } else {
        telegramStatus = {
          sent: false,
          message: '텔레그램 봇 토큰/챗ID 미설정 (웹 로컬 기록 저장)',
        };
      }
    }

    // Record the alert notification log (Audit trail for UI viewing)
    try {
      const allActionTickers = Array.from(
        new Set([
          ...actionableSignals.map((e) => e.ticker),
          ...dipBuyOpportunities.map((e) => e.ticker),
        ])
      );

      const alertDeliveryStatus = telegramStatus.sent
        ? 'SENT'
        : (!customToken || !customChat)
        ? 'LOCAL_LOGGED'
        : 'FAILED';

      const alertLog: AlertNotificationLog = {
        id: `alert-manual-${Date.now()}`,
        timestamp: startTime.toISOString(),
        kst_time: kstTimeStr,
        strategy_type: 'DUAL_SCAN_REPORT',
        title: `⚡ [수동 스캔] 듀얼 퀀트 브리핑 (모멘텀 ${actionableSignals.length}건 + 눌림목 ${dipBuyOpportunities.length}건)`,
        tickers: allActionTickers,
        signals_count: actionableSignals.length + dipBuyOpportunities.length,
        delivery_status: alertDeliveryStatus,
        delivery_target: telegramStatus.target || (customChat ? `${customChat.slice(0, 3)}****` : null),
        message_preview: `전략 A ${actionableSignals.length}건, 전략 B ${dipBuyOpportunities.length}건 (${telegramStatus.message})`,
        message_body: reportText,
        details: {
          strategy_a_tickers: actionableSignals.map((e) => ({
            ticker: e.ticker,
            score: e.opportunity?.opportunity_score ?? 50,
            decision: e.decision?.decision || 'BUY',
            price: e.price ?? 0,
            change1d: e.change1d ?? 0,
          })),
          strategy_b_tickers: dipBuyOpportunities.map((e) => ({
            ticker: e.ticker,
            tier: e.dip_evaluation?.suitability.tier || 'A',
            dip_score: e.dip_evaluation?.dip_score || 0,
            rsi: e.dip_evaluation?.timing.rsi || 50,
            drawdown: e.dip_evaluation?.timing.drawdownLabel || '0.0%',
            suggested_action: e.dip_evaluation?.suggestedDcaRatio || '1.0x 정기 적립',
          })),
        },
      };

      await alertHistoryRepository.save(alertLog);
    } catch (aErr) {
      console.warn('[ScanRoute] Failed to save alert log:', aErr);
    }

    res.json({
      success: true,
      scan_log: result.runLog,
      new_signals: result.newSignals,
      actionable_signals: actionableSignals,
      dip_buy_signals: dipBuyOpportunities,
      evaluations_count: result.evaluations.length,
      evaluations: result.evaluations,
      telegram_status: telegramStatus,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});
