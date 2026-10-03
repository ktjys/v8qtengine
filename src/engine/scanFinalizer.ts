import { evaluationRepository } from '../db/repositories/evaluationRepository';
import { signalRepository } from '../db/repositories/signalRepository';
import { scanRunRepository } from '../db/repositories/scanRunRepository';
import { scanRunItemRepository } from '../db/repositories/scanRunItemRepository';
import { alertHistoryRepository } from '../db/repositories/alertHistoryRepository';
import { telegramNotifier, escapeTelegramHtml } from '../notification/telegramNotifier';
import { createSignalSnapshot } from './signalEngine';
import { ensureDipEvaluation } from './dipBuyEngine';
import { MacroEarningsEngine } from './macroEarningsEngine';
import { PortfolioEngine } from './portfolioEngine';
import { ExitSignalEngine } from './exitSignalEngine';
import { detectMarketRegion, formatTelegramStockName, formatStockDisplayName } from '../utils/marketUtils';
import { logger } from '../utils/logger';
import type { FullTickerEvaluation, AlertNotificationLog, SignalSnapshot } from '../types/v8';
import type { Env } from './types';

interface FinalizerOptions {
  scanRunId: string;
  market: 'US' | 'KR';
  slot: string;
  triggeredBy: string;
  sourceUrl?: string;
  botToken?: string;
  chatId?: string;
}

function getKstTimeStr(): string {
  const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return `${nowKST.getUTCFullYear()}-${String(nowKST.getUTCMonth() + 1).padStart(2, '0')}-${String(nowKST.getUTCDate()).padStart(2, '0')} ${String(nowKST.getUTCHours()).padStart(2, '0')}:${String(nowKST.getUTCMinutes()).padStart(2, '0')}:${String(nowKST.getUTCSeconds()).padStart(2, '0')} KST`;
}

function formatPrice(ticker: string, price: number): string {
  const isKr = detectMarketRegion(ticker) === 'KR';
  return isKr ? `₩${Math.round(price).toLocaleString('ko-KR')}` : `$${price.toFixed(2)}`;
}

async function buildTelegramReport(
  evaluations: any[],
  market: 'US' | 'KR',
  slot: string,
  kstTimeStr: string,
  targetMarket: 'US' | 'KR'
): Promise<string> {
  const marketBadge = targetMarket === 'KR' ? '🇰🇷 국내장' : targetMarket === 'US' ? '🇺🇸 미국장' : '🌐 통합';

  // Filter evaluations by target market
  const marketEvals = evaluations.filter((e) => detectMarketRegion(e.ticker) === targetMarket);

  const actionableSignals = marketEvals.filter((e: any) => e.signal_generated);
  const dipBuyOpportunities = marketEvals
    .map((e: any) => import('./dipBuyEngine').then(m => m.ensureDipEvaluation(e)))
    .filter((d: any) => d.dip_evaluation && d.dip_evaluation.suitability.tier !== 'D' && d.dip_evaluation.isActionableDip);

  let reportText = `<b>🚀 퀀트 스캐너 [${targetMarket === 'KR' ? '🇰🇷 국내장' : '🇺🇸 미국장'}] 듀얼 전략 자동 스캔 리포트</b>\n`;
  reportText += `🕒 <b>실행 시각:</b> ${getKstTimeStr()} (${slot})\n`;
  reportText += `━━━━━━━━━━━━━━━━━━━━━\n`;
  reportText += `• <b>검토 대상:</b> ${marketEvals.length}개 종목\n`;
  reportText += `• <b>전략 A (모멘텀 돌파):</b> <b>${actionableSignals.length}건</b>\n`;
  reportText += `• <b>전략 B (우량주 눌림추매):</b> <b>${dipBuyOpportunities.length}건</b>\n`;
  reportText += `• <b>고위험 종목:</b> ${marketEvals.filter((e: any) => e.risk?.risk_level === 'HIGH').length}개\n\n`;

  // Strategy A section
  reportText += `<b>🎯 전략 A: 모멘텀 & 추세돌파 포착 종목</b>\n`;
  if (actionableSignals.length > 0) {
    actionableSignals.slice(0, 5).forEach((sig: any, idx: number) => {
      const arrow = (sig.change1d ?? 0) >= 0 ? '🔺' : '🔻';
      const changeStr = `${(sig.change1d ?? 0) >= 0 ? '+' : ''}${(sig.change1d ?? 0).toFixed(1)}%`;
      const stockTitle = formatTelegramStockName(sig.ticker, sig.name);
      reportText += `${idx + 1}. ${stockTitle}\n`;
      reportText += `   - 현재가: ${formatPrice(sig.ticker, sig.price ?? 0)} (전일대비: ${arrow} ${changeStr})\n`;
      reportText += `   - 기회점수: <b>${sig.opportunity?.opportunity_score ?? 50}점</b> | 판정: <code>${sig.decision?.decision || 'BUY'}</code>\n`;
      reportText += `   - 핵심이유: ${sig.decision?.reason || '기술적 반등 및 팩터 점수 우수'}\n\n`;
    });
  } else {
    reportText += `ℹ️ 현재 엄격한 모멘텀 돌파 제약을 통과한 신규 진입 신호 없음\n\n`;
  }

  // Strategy B section
  reportText += `<b>🛡️ 전략 B: 우량대형주 & 지수ETF 분할적립/눌림목 포착</b>\n`;
  if (dipBuyOpportunities.length > 0) {
    dipBuyOpportunities.slice(0, 5).forEach((dip: any, idx: number) => {
      const evalData = dip.dip_evaluation!;
      const arrow = (dip.change1d ?? 0) >= 0 ? '🔺' : '🔻';
      const changeStr = `${(dip.change1d ?? 0) >= 0 ? '+' : ''}${(dip.change1d ?? 0).toFixed(1)}%`;
      const stockTitle = formatTelegramStockName(dip.ticker, dip.name);
      reportText += `${idx + 1}. ${stockTitle}\n`;
      reportText += `   - 현재가: ${formatPrice(dip.ticker, dip.price ?? 0)} (${arrow} ${changeStr})\n`;
      reportText += `   - 우량적합도: <b>${evalData.suitability.tierLabel}</b> (${evalData.suitability.score}점)\n`;
      reportText += `   - 눌림타이밍: <b>${evalData.timing.score}점</b> (RSI ${evalData.timing.rsi.toFixed(1)}, ${evalData.timing.drawdownLabel})\n`;
      reportText += `   - 신호: <b>${dip.signalLabel}</b> (권고: <code>${dip.suggestedDcaRatio}</code>)\n\n`;
    });
  } else {
    reportText += `   ℹ️ 현재 우량주 중 최적의 과매도 눌림목 구간에 도달한 종목 없음 (정기 일정 유지)\n\n`;
  }

  // Exit signals
  try {
    const exitEvals = await import('./exitSignalEngine').then(m => m.ExitSignalEngine.evaluateAllExits(evaluations, undefined, targetMarket));
    const actionableExits = exitEvals
      .filter((e: any) => e.isActionableSell)
      .filter((e: any) => detectMarketRegion(e.ticker) === targetMarket);

    if (actionableExits.length > 0) {
      reportText += `🚨 <b>[통합 매도 & 포지션 청산 권고]</b>\n`;
      actionableExits.slice(0, 3).forEach((exit: any, idx: number) => {
        const stockTitle = formatTelegramStockName(exit.ticker, exit.name);
        const safeHeadline = escapeTelegramHtml(exit.headline);
        const safeAction = escapeTelegramHtml(exit.recommendedAction);
        const retText = exit.returnSinceEntryPct !== undefined
          ? ` (진입대비 ${exit.returnSinceEntryPct >= 0 ? '+' : ''}${exit.returnSinceEntryPct.toFixed(1)}%)`
          : '';

        reportText += `${idx + 1}. ${stockTitle}: ${safeHeadline}${retText}\n`;
        reportText += `   └ 💡 <b>실행 권고:</b> ${safeAction}\n`;
      });
      reportText += `\n`;
    }
  } catch {}

  // Macro & Portfolio (optional)
  try {
    const macro = await import('./macroEarningsEngine').then(m => m.MacroEarningsEngine.getMacroMarketRegime());
    reportText += `🌐 <b>[시장 매크로 체제: ${escapeTelegramHtml(macro.regimeLabel)}]</b>\n`;
    reportText += `• <b>VIX 공포지수:</b> ${macro.vix.level.toFixed(1)} (${macro.vix.label})\n`;
    reportText += `• <b>미국 10년물 금리:</b> ${macro.us10y.level.toFixed(2)}% | <b>달러(DXY):</b> ${macro.dxy.level.toFixed(1)}\n`;
    reportText += `• <b>운용 가이드:</b> ${escapeTelegramHtml(macro.actionableSummary)}\n\n`;
  } catch {}

  // Portfolio rebalance
  try {
    const macro = await import('./macroEarningsEngine').then(m => m.MacroEarningsEngine.getMacroMarketRegime());
    const portRegion = targetMarket === 'KR' ? 'KR' : 'US';
    const portCapital = portRegion === 'KR' ? 100_000_000 : 100_000;
    const portState = await import('./portfolioEngine').then(m => m.PortfolioEngine.calculatePortfolioState(portCapital, macro, portRegion));
    const rebalanceTrims = portState.positions.filter((p: any) => p.rebalanceAction === 'TRIM');
    const rebalanceAdds = portState.positions.filter((p: any) => p.rebalanceAction === 'INCREASE');

    if (rebalanceTrims.length > 0 || rebalanceAdds.length > 0 || portState.maxConcentrationAlert) {
      reportText += `💼 <b>[포트폴리오 동적 자산배분 & 리밸런싱]</b>\n`;
      reportText += `• <b>배분 비율:</b> 전략 A ${portState.strategySplit.strategyA_MomentumPct}% | 전략 B ${portState.strategySplit.strategyB_DipDcaPct}% | 현금 ${portState.strategySplit.cashBufferPct}%\n`;
      if (portState.maxConcentrationAlert) {
        reportText += `• ⚠️ ${escapeTelegramHtml(portState.maxConcentrationAlert)}\n`;
      }
      if (rebalanceTrims.length > 0) {
        reportText += `• <b>비중축소(Trim):</b> ${rebalanceTrims.map((p: any) => `${formatStockDisplayName(p.ticker, p.companyName)}(${p.recommendedSharesDelta}주)`).join(', ')}\n`;
      }
      if (rebalanceAdds.length > 0) {
        reportText += `• <b>비중확대(Add):</b> ${rebalanceAdds.map((p: any) => `${formatStockDisplayName(p.ticker, p.companyName)}(+${p.recommendedSharesDelta}주)`).join(', ')}\n`;
      }
      reportText += `\n`;
    }
  } catch {}

  return reportText;
}

export async function runFinalizer(
  options: {
    scanRunId: string;
    market: 'US' | 'KR';
    slot: string;
    triggeredBy: string;
    sourceUrl?: string;
    botToken?: string;
    chatId?: string;
    env: any;
  }
): Promise<void> {
  const { scanRunId, market, slot, triggeredBy, sourceUrl, botToken, chatId, env } = options;

  try {
    // Load evaluations for this market
    const allEvaluations = await evaluationRepository.getAll();
    const marketEvals = allEvaluations.filter((e: any) => {
      const region = e.ticker.endsWith('.KS') || e.ticker.endsWith('.KQ') ? 'KR' : 'US';
      return region === market;
    });

    // Check if already finalized
    const run = await import('../db/repositories/scanRunRepository').then(m => m.scanRunRepository.getById(scanRunId));
    if (!run || run.status === 'SUCCESS' || run.status === 'PARTIAL_SUCCESS' || run.status === 'FAILED') {
      console.log(`[Finalizer] Scan ${scanRunId} already finalized with status: ${run?.status}`);
      return;
    }

    // Build Telegram report
    const kstTimeStr = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) + ' KST';
    const reportText = await buildTelegramReport(
      await import('../db/repositories/evaluationRepository').then(m => m.evaluationRepository.getAll()),
      market,
      slot,
      new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) + ' KST',
      market
    );

    // Telegram Notification
    let telegramResult = {
      configured: false,
      sent: false,
      previewOnly: true,
      target: null as string | null,
      message: '텔레그램 미전송',
    };

    const cfg = await import('../notification/telegramNotifier').then(m => m.telegramNotifier.getConfig());
    const token = (options.botToken || cfg.botToken || '').trim().replace(/^['"]|['"]$/g, '').replace(/^bot/i, '');
    const chat = (options.chatId || cfg.chatId || '').trim().replace(/^['"]|['"]$/g, '');

    if (token && chat) {
      const cleanToken = token.trim().replace(/^['"]|['"]$/g, '').replace(/^bot/i, '');
      const cleanChat = chat.trim().replace(/^['"]|['"]$/g, '');
      const sendRes = await import('../notification/telegramNotifier').then(m => m.telegramNotifier.sendMessage(reportText, cleanToken, cleanChat));

      if (sendRes.success && !sendRes.previewOnly) {
        telegramResult = { configured: true, sent: true, previewOnly: false, target: `${cleanChat.slice(0, 3)}****`, message: '텔레그램 봇으로 실제 브리핑 리포트가 발송되었습니다!' };
      } else if (sendRes.previewOnly) {
        telegramResult = { configured: false, sent: false, previewOnly: true, target: null, message: '텔레그램 미등록: 프리뷰 브리핑 완료' };
      } else {
        telegramResult = { configured: true, sent: false, previewOnly: false, target: null, message: sendRes.error || '텔레그램 전송 실패' };
      }
    }

    // Save alert history
    try {
      const actionableSignals = (await import('../db/repositories/evaluationRepository').then(m => m.evaluationRepository.getAll()))
        .filter((e: any) => e.signal_generated && (e.ticker.endsWith('.KS') || e.ticker.endsWith('.KQ') ? 'KR' : 'US') === market);

      const dipOpportunities = allEvaluations
        .map((e: any) => import('./dipBuyEngine').then(m => m.ensureDipEvaluation(e)))
        .filter((d: any) => d.dip_evaluation && d.dip_evaluation.suitability.tier !== 'D' && d.dip_evaluation.isActionableDip);

      const allActionTickers = Array.from(new Set([
        ...actionableSignals.map((e: any) => e.ticker),
        ...dipOpportunities.map((d: any) => d.ticker),
      ]));

      const alertDeliveryStatus = telegramResult.sent
        ? 'SENT'
        : telegramResult.previewOnly ? 'PREVIEW_ONLY' : telegramResult.configured ? 'FAILED' : 'LOCAL_LOGGED';

      const alertLog: any = {
        id: `alert-${Date.now()}`,
        timestamp: new Date().toISOString(),
        kst_time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) + ' KST',
        strategy_type: 'DUAL_SCAN_REPORT',
        title: `🚀 [${slot}] 듀얼 퀀트 브리핑`,
        tickers: allActionTickers,
        signals_count: actionableSignals.length,
        delivery_status: alertDeliveryStatus,
        delivery_target: telegramResult.target,
        message_preview: `전략 A ${actionableSignals.length}건, 전략 B ${dipOpportunities.length}건 포착 (${telegramResult.message})`,
        message_body: reportText,
        details: {
          strategy_a_tickers: actionableSignals.map((e: any) => ({
            ticker: e.ticker,
            score: e.opportunity?.opportunity_score ?? 50,
            decision: e.decision?.decision || 'BUY',
            price: e.price ?? 0,
            change1d: e.change1d ?? 0,
          })),
        },
      };

      await import('../db/repositories/alertHistoryRepository').then(m => m.alertHistoryRepository.save(alertLog));
    } catch (alertErr) {
      console.warn('[Finalizer] Failed to save alert notification log:', alertErr);
    }

    // Update scan run as finalized
    await import('../db/repositories/scanRunRepository').then(m => m.scanRunRepository.recordChunk(
      '', // runId will be passed
      'SUCCESS',
      0, 0, 0 // These are already recorded by chunks
    ));

    // Final update to mark as completed
    try {
      await import('../db/repositories/scanRunRepository').then(m => m.scanRunRepository.save({
        run_id: '',
        status: 'SUCCESS',
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
        watchlist_count: 0,
        evaluated_count: 0,
        signal_count: 0,
        failure_count: 0,
        error_summary: `${slot} 무결성 스캔 완료`,
        market_region: market,
        chunk_size: 0,
        total_chunks: 0,
        completed_chunks: 0,
        failed_chunks: 0,
        meta: { finalized: true },
      }));
    } catch {}

  } catch (err: any) {
    console.error('[Finalizer] Error:', err);
    // Mark scan as failed
    try {
      await import('../db/repositories/scanRunRepository').then(m => m.scanRunRepository.save({
        run_id: options.scanRunId,
        status: 'FAILED',
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
        watchlist_count: 0,
        evaluated_count: 0,
        signal_count: 0,
        failure_count: 1,
        error_summary: `Finalizer error: ${err.message}`,
      }));
    } catch {}
  }
}

export { buildTelegramReport };