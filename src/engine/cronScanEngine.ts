import { evaluationRepository } from '../db/repositories/evaluationRepository';
import { scanRunRepository } from '../db/repositories/scanRunRepository';
import { alertHistoryRepository } from '../db/repositories/alertHistoryRepository';
import { signalRepository } from '../db/repositories/signalRepository';
import { watchlistRepository } from '../db/repositories/watchlistRepository';
import { scanService } from '../pipeline/scanService';
import { telegramNotifier, escapeTelegramHtml } from '../notification/telegramNotifier';
import { createSignalSnapshot } from './signalEngine';
import { ensureDipEvaluation } from './dipBuyEngine';
import { MacroEarningsEngine } from './macroEarningsEngine';
import { PortfolioEngine } from './portfolioEngine';
import { FullTickerEvaluation, ScanRunLog, AlertNotificationLog } from '../types/v8';

// In-memory cache of the latest cron scan execution (useful for async status polling)
let lastCronScanResult: CronScanResult | null = null;

export function getLastCronScanResult(): CronScanResult | null {
  return lastCronScanResult;
}

export interface CronScanOptions {
  botToken?: string | null;
  chatId?: string | null;
  triggeredBy?: string;
  sourceUrl?: string;
}

export interface CronScanResult {
  success: boolean;
  timestamp: string;
  slot: string;
  kst_time: string;
  duration_ms: number;
  evaluated_count: number;
  actionable_signals_count: number;
  actionable_signals: Array<{
    ticker: string;
    name: string;
    decision: string;
    opportunity_score: number;
    risk_level: string;
    price: number;
    change1d: number;
    reason: string;
  }>;
  telegram_status: {
    configured: boolean;
    sent: boolean;
    previewOnly?: boolean;
    target?: string | null;
    message: string;
  };
  run_id: string;
  error?: string;
}

export async function executeCronScan(options: CronScanOptions = {}): Promise<CronScanResult> {
  const startTime = Date.now();
  const runId = `CRON_${Date.now()}`;

  // 1. Determine KST slot
  const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const kstHour = nowKST.getUTCHours();
  const kstMinute = nowKST.getUTCMinutes();
  const kstTimeStr = `${String(kstHour).padStart(2, '0')}:${String(kstMinute).padStart(2, '0')} KST`;

  let slotName = '수동/실시간 스캔';
  if (kstHour >= 6 && kstHour <= 8) {
    slotName = '🌅 [1회차] 미국 정규장 마감 브리핑 (종가 확정)';
  } else if (kstHour >= 22 && kstHour <= 23) {
    slotName = '🌃 [2회차] 미국 정규장 개장 & 당일 기회종목 브리핑 (밤 11시)';
  }

  try {
    // 2. Execute Quant Pipeline across all active watchlist items
    let evaluations: FullTickerEvaluation[] = [];
    let actionable: FullTickerEvaluation[] = [];
    let watchlistTotalCount = 0;
    let scanError: string | undefined;

    try {
      // Execute the real scan and wait for live quotes & evaluations to be calculated and saved to DB
      const timeoutPromise = new Promise<{ evaluations: FullTickerEvaluation[]; watchlist: any[] }>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Scan exceeded 25s safety timeout'));
        }, 25000);
      });

      const scanResult = await Promise.race([
        scanService.executeScan({ saveToDb: true }),
        timeoutPromise,
      ]);

      evaluations = scanResult.evaluations || [];
      watchlistTotalCount = scanResult.watchlist?.length || evaluations.length;
    } catch (scanErr: any) {
      console.error('[CronScan] ScanService failed:', scanErr);
      scanError = scanErr?.message || 'Scan execution failed';
      // Attempt to read latest real evaluations from DB rather than fake seed prices
      try {
        const cached = await evaluationRepository.getAll();
        if (cached && cached.length > 0) {
          evaluations = cached;
          watchlistTotalCount = cached.length;
        }
      } catch (cacheErr) {
        console.warn('[CronScan] Failed to load cached evaluations from DB:', cacheErr);
      }
    }

    actionable = evaluations.filter((e) => e.signal_generated);

    // 4. Telegram Notification (Prepared and sent before database log commit)
    let telegramResult = {
      configured: false,
      sent: false,
      previewOnly: true,
      target: null as string | null,
      message: '텔레그램 봇 토큰/챗ID 미설정 (시뮬레이션 모드)',
    };

    const cfg = telegramNotifier.getConfig();
    const token = (
      options.botToken ||
      cfg.botToken ||
      process.env.TELEGRAM_BOT_TOKEN ||
      '8979603920:AAGoWWVENKOR18zAG-hJRQb0earF-qkqO3E'
    );
    const chat = (
      options.chatId ||
      cfg.chatId ||
      process.env.TELEGRAM_CHAT_ID ||
      '7774679329'
    );

    // 전략 B: 우량대형주 적립 & 눌림목 추매 평가
    const dipEvaluations = evaluations.map((e) => ensureDipEvaluation(e));
    const dipOpportunities = dipEvaluations
      .filter((d) => d.suitability.isSuitable && (d.actionSignal === 'STRONG_DIP_BUY' || d.actionSignal === 'MODERATE_DCA'))
      .sort((a, b) => b.dip_score - a.dip_score);

    // Phase 1: 매크로 시장 체제 & 실적 캘린더 가드 조회
    let macroSummaryText = '';
    let earningsRiskText = '';
    try {
      const macro = await MacroEarningsEngine.getMacroMarketRegime();
      macroSummaryText = `🌐 <b>[시장 매크로 체제: ${escapeTelegramHtml(macro.regimeLabel)}]</b>\n` +
        `• <b>VIX 공포지수:</b> ${macro.vix.level.toFixed(1)} (${macro.vix.label})\n` +
        `• <b>미국 10년물 금리:</b> ${macro.us10y.level.toFixed(2)}% | <b>달러(DXY):</b> ${macro.dxy.level.toFixed(1)}\n` +
        `• <b>운용 가이드:</b> ${escapeTelegramHtml(macro.actionableSummary)}\n\n`;

      const earningsCalendar = MacroEarningsEngine.getEarningsCalendar();
      const imminentEvents = earningsCalendar.filter((e) => e.riskStage === 'IMMINENT_DANGER');
      if (imminentEvents.length > 0) {
        earningsRiskText = `⚠️ <b>[실적 발표(Earnings) 임박 경고]</b>\n`;
        imminentEvents.slice(0, 3).forEach((ev) => {
          earningsRiskText += `• <b>${ev.ticker}</b> (${ev.companyName}): 실적 발표 <b>D-${ev.daysUntil}</b> (${ev.earningsDate})\n` +
            `  └ ${escapeTelegramHtml(ev.guardAction)}\n`;
        });
        earningsRiskText += `\n`;
      }
    } catch (macroErr) {
      console.warn('[CronScan] Macro regime fetch skipped:', macroErr);
    }

    let reportText = `<b>📊 퀀트 엔진 듀얼 전략 자동 스캔 리포트</b>\n`;
    reportText += `🕒 <b>실행 시각:</b> ${kstTimeStr} (${escapeTelegramHtml(slotName)})\n`;
    reportText += `━━━━━━━━━━━━━━━━━━━━━\n`;
    reportText += `• <b>모니터링 대상:</b> ${evaluations.length}개 자산\n`;
    reportText += `• <b>전략 A (추세돌파) 신호:</b> <b>${actionable.length}건</b>\n`;
    reportText += `• <b>전략 B (우량주 눌림추매) 신호:</b> <b>${dipOpportunities.length}건</b>\n\n`;

    if (macroSummaryText) {
      reportText += macroSummaryText;
    }

    if (earningsRiskText) {
      reportText += earningsRiskText;
    }

    // 1. 전략 A: 추세 모멘텀 섹션
    reportText += `🚀 <b>[전략 A: 상승 추세 & 모멘텀 돌파]</b>\n`;
    if (actionable.length > 0) {
      actionable.slice(0, 3).forEach((sig, idx) => {
        const arrow = (sig.change1d ?? 0) >= 0 ? '🔺' : '🔻';
        const changeStr = `${(sig.change1d ?? 0) >= 0 ? '+' : ''}${(sig.change1d ?? 0).toFixed(1)}%`;
        const safeName = escapeTelegramHtml(sig.name);
        const safeTicker = escapeTelegramHtml(sig.ticker);
        const safeDecision = escapeTelegramHtml(sig.decision?.decision || 'BUY');
        const safeReason = escapeTelegramHtml(sig.decision?.reason || '기술적 반등 및 모멘텀 지속');

        reportText += `${idx + 1}. <b>${safeTicker}</b> (${safeName})\n`;
        reportText += `   - 현재가: $${(sig.price ?? 0).toFixed(2)} (${arrow} ${changeStr})\n`;
        reportText += `   - 기회점수: <b>${sig.opportunity?.opportunity_score ?? 50}점</b> | 판정: <code>${safeDecision}</code>\n`;
        reportText += `   - 근거: ${safeReason}\n`;
      });
    } else {
      reportText += `   ℹ️ 리스크 제약을 통과한 모멘텀 돌파 신호 없음 (보수적 접근 권장)\n`;
    }
    reportText += `\n`;

    // 2. 전략 B: 우량대형주 적립 & 눌림목 추매 섹션
    reportText += `🛡️ <b>[전략 B: 우량대형주 적립 & 눌림목 추매]</b>\n`;
    if (dipOpportunities.length > 0) {
      dipOpportunities.slice(0, 3).forEach((dip, idx) => {
        const arrow = (dip.change1d ?? 0) >= 0 ? '🔺' : '🔻';
        const changeStr = `${(dip.change1d ?? 0) >= 0 ? '+' : ''}${(dip.change1d ?? 0).toFixed(1)}%`;
        const safeName = escapeTelegramHtml(dip.name);
        const safeTicker = escapeTelegramHtml(dip.ticker);

        reportText += `${idx + 1}. <b>${safeTicker}</b> (${safeName})\n`;
        reportText += `   - 현재가: $${dip.price.toFixed(2)} (${arrow} ${changeStr})\n`;
        reportText += `   - 우량적합도: <b>${dip.suitability.tierLabel}</b> (${dip.suitability.score}점)\n`;
        reportText += `   - 눌림타이밍: <b>${dip.timing.score}점</b> (RSI ${dip.timing.rsi.toFixed(1)}, ${dip.timing.drawdownLabel})\n`;
        reportText += `   - 신호: <b>${dip.signalLabel}</b> (권고: <code>${dip.suggestedDcaRatio}</code>)\n`;
      });
    } else {
      reportText += `   ℹ️ 현재 우량주 중 최적의 과매도 눌림목 구간에 도달한 종목 없음 (정기 일정 유지)\n`;
    }
    reportText += `\n`;

    // Phase 2: 포트폴리오 리밸런싱 및 섹터 쏠림 가이드
    try {
      const macro = await MacroEarningsEngine.getMacroMarketRegime();
      const portState = PortfolioEngine.calculatePortfolioState(100000, macro);
      const rebalanceTrims = portState.positions.filter((p) => p.rebalanceAction === 'TRIM');
      const rebalanceAdds = portState.positions.filter((p) => p.rebalanceAction === 'INCREASE');

      if (rebalanceTrims.length > 0 || rebalanceAdds.length > 0 || portState.maxConcentrationAlert) {
        reportText += `💼 <b>[포트폴리오 동적 자산배분 & 리밸런싱]</b>\n`;
        reportText += `• <b>배분 비율:</b> 전략 A ${portState.strategySplit.strategyA_MomentumPct}% | 전략 B ${portState.strategySplit.strategyB_DipDcaPct}% | 현금 ${portState.strategySplit.cashBufferPct}%\n`;
        if (portState.maxConcentrationAlert) {
          reportText += `• ⚠️ ${escapeTelegramHtml(portState.maxConcentrationAlert)}\n`;
        }
        if (rebalanceTrims.length > 0) {
          reportText += `• <b>비중축소(Trim):</b> ${rebalanceTrims.map((p) => `${p.ticker}(${p.recommendedSharesDelta}주)`).join(', ')}\n`;
        }
        if (rebalanceAdds.length > 0) {
          reportText += `• <b>비중확대(Add):</b> ${rebalanceAdds.map((p) => `${p.ticker}(+${p.recommendedSharesDelta}주)`).join(', ')}\n`;
        }
        reportText += `\n`;
      }
    } catch (portErr) {
      console.warn('[CronScan] Portfolio state summary skipped:', portErr);
    }

    if (options.sourceUrl) {
      const safeUrl = options.sourceUrl.replace(/[<>"']/g, '').trim();
      reportText += `🔗 <a href="${safeUrl}">퀀트 시스템 대시보드 바로가기</a>`;
    }

    if (token && chat) {
      const cleanToken = token.trim().replace(/^['"]|['"]$/g, '').replace(/^bot/i, '');
      const cleanChat = chat.trim().replace(/^['"]|['"]$/g, '');
      const maskedTarget = cleanChat ? `${cleanChat.slice(0, 3)}****` : null;

      const sendRes = await telegramNotifier.sendMessage(reportText, cleanToken, cleanChat);

      if (sendRes.success && !sendRes.previewOnly) {
        telegramResult = {
          configured: true,
          sent: true,
          previewOnly: false,
          target: maskedTarget,
          message: '텔레그램 봇으로 실제 브리핑 리포트가 발송되었습니다!',
        };
      } else if (sendRes.previewOnly) {
        telegramResult = {
          configured: false,
          sent: false,
          previewOnly: true,
          target: null,
          message: '텔레그램 미등록: 프리뷰 브리핑 완료',
        };
      } else {
        telegramResult = {
          configured: true,
          sent: false,
          previewOnly: false,
          target: maskedTarget,
          message: sendRes.error || '텔레그램 전송 실패',
        };
      }
    }

    // 5. Record the alert notification log (Audit history for both Strategy A & Strategy B)
    try {
      const allActionTickers = Array.from(
        new Set([
          ...actionable.map((e) => e.ticker),
          ...dipOpportunities.map((e) => e.ticker),
        ])
      );

      const alertDeliveryStatus = telegramResult.sent
        ? 'SENT'
        : telegramResult.previewOnly
        ? 'PREVIEW_ONLY'
        : telegramResult.configured
        ? 'FAILED'
        : 'LOCAL_LOGGED';

      const alertLog: AlertNotificationLog = {
        id: `alert-${runId}`,
        timestamp: new Date(startTime).toISOString(),
        kst_time: kstTimeStr,
        strategy_type: 'DUAL_SCAN_REPORT',
        title: `🚀 [${slotName}] 듀얼 퀀트 브리핑 (모멘텀 ${actionable.length}건 + 눌림목 ${dipOpportunities.length}건)`,
        tickers: allActionTickers,
        signals_count: actionable.length + dipOpportunities.length,
        delivery_status: alertDeliveryStatus,
        delivery_target: telegramResult.target,
        message_preview: `전략 A ${actionable.length}건, 전략 B ${dipOpportunities.length}건 포착 (${telegramResult.message})`,
        message_body: reportText,
        details: {
          strategy_a_tickers: actionable.map((e) => ({
            ticker: e.ticker,
            score: e.opportunity?.opportunity_score ?? 50,
            decision: e.decision?.decision || 'BUY',
            price: e.price ?? 0,
            change1d: e.change1d ?? 0,
          })),
          strategy_b_tickers: dipOpportunities.map((dip) => ({
            ticker: dip.ticker,
            tier: dip.suitability.tier,
            dip_score: dip.dip_score,
            rsi: Number(dip.timing.rsi.toFixed(1)),
            drawdown: dip.timing.drawdownLabel,
            suggested_action: dip.suggestedDcaRatio,
          })),
        },
      };

      await alertHistoryRepository.save(alertLog);
    } catch (alertErr) {
      console.warn('[CronScan] Failed to save alert notification log:', alertErr);
    }

    // 6. Record the scan run log (including Telegram dispatch result)
    const durationMs = Date.now() - startTime;
    const tgStatusSummary = telegramResult.sent
      ? `[텔레그램: 발송완료(${telegramResult.target})]`
      : `[텔레그램: ${telegramResult.message}]`;

    const runLog: ScanRunLog = {
      run_id: runId,
      started_at: new Date(startTime).toISOString(),
      finished_at: new Date().toISOString(),
      watchlist_count: watchlistTotalCount,
      evaluated_count: evaluations.length,
      signal_count: actionable.length,
      failure_count: scanError ? 1 : 0,
      failed_tickers: scanError ? [{ ticker: 'SCAN_SERVICE', error: scanError }] : [],
      status: scanError ? 'FAILED' : 'SUCCESS',
      error_summary: scanError
        ? `스캔 오류: ${scanError} ${tgStatusSummary}`
        : `${slotName} 무결성 스캔 완료 (${actionable.length}건 시그널 도출) ${tgStatusSummary}`,
    };

    try {
      await scanRunRepository.save(runLog);
    } catch (err) {
      console.warn('[CronScan] Failed to save scan run log:', err);
    }

    const finalResult: CronScanResult = {
      success: true,
      timestamp: new Date().toISOString(),
      slot: slotName,
      kst_time: kstTimeStr,
      duration_ms: durationMs,
      evaluated_count: evaluations.length,
      actionable_signals_count: actionable.length,
      actionable_signals: actionable.map((s) => ({
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
      run_id: runId,
    };

    lastCronScanResult = finalResult;
    return finalResult;
  } catch (err: any) {
    console.error('[executeCronScan] Error during cron scan:', err);
    const failResult: CronScanResult = {
      success: false,
      timestamp: new Date().toISOString(),
      slot: slotName,
      kst_time: kstTimeStr,
      duration_ms: Date.now() - startTime,
      evaluated_count: 0,
      actionable_signals_count: 0,
      actionable_signals: [],
      telegram_status: {
        configured: false,
        sent: false,
        message: `스캔 실행 중 예외: ${err.message}`,
      },
      run_id: runId,
      error: err.message,
    };
    lastCronScanResult = failResult;
    return failResult;
  }
}
