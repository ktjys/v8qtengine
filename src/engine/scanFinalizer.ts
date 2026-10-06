import { evaluationRepository } from '../db/repositories/evaluationRepository';
import { scanRunRepository } from '../db/repositories/scanRunRepository';
import { alertHistoryRepository } from '../db/repositories/alertHistoryRepository';
import { telegramNotifier, escapeTelegramHtml } from '../notification/telegramNotifier';
import { ensureDipEvaluation } from './dipBuyEngine';
import { MacroEarningsEngine } from './macroEarningsEngine';
import { PortfolioEngine } from './portfolioEngine';
import { ExitSignalEngine } from './exitSignalEngine';
import { detectMarketRegion, formatTelegramStockName, formatStockDisplayName } from '../utils/marketUtils';
import { logger } from '../utils/logger';
import type { Env, ScanMarket } from './types';

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
  market: ScanMarket,
  slot: string,
  kstTimeStr: string
): Promise<string> {
  const targetMarket = market;
  const marketBadge = targetMarket === 'KR' ? '🇰🇷 국내장' : '🇺🇸 미국장';
  void marketBadge;

  const marketEvals = evaluations.filter((e: any) => detectMarketRegion(e.ticker) === targetMarket);
  const actionableSignals = marketEvals.filter((e: any) => e.signal_generated);

  const dipBuyOpportunities = marketEvals
    .map((e: any) => ensureDipEvaluation(e))
    .filter((d: any) => d.dip_evaluation && d.dip_evaluation.suitability.tier !== 'D' && d.dip_evaluation.isActionableDip);

  let reportText = `<b>🚀 퀀트 스캐너 [${targetMarket === 'KR' ? '🇰🇷 국내장' : '🇺🇸 미국장'}] 듀얼 전략 자동 스캔 리포트</b>\n`;
  reportText += `🕒 <b>실행 시각:</b> ${kstTimeStr} (${slot})\n`;
  reportText += `━━━━━━━━━━━━━━━━━━━━━\n`;
  reportText += `• <b>검토 대상:</b> ${marketEvals.length}개 종목\n`;
  reportText += `• <b>전략 A (모멘텀 돌파):</b> <b>${actionableSignals.length}건</b>\n`;
  reportText += `• <b>전략 B (우량주 눌림추매):</b> <b>${dipBuyOpportunities.length}건</b>\n`;
  reportText += `• <b>고위험 종목:</b> ${marketEvals.filter((e: any) => e.risk?.risk_level === 'HIGH').length}개\n\n`;

  reportText += `<b>🎯 전략 A: 모멘텀 & 추세돌파 포착 종목</b>\n`;
  if (actionableSignals.length > 0) {
    actionableSignals.slice(0, 5).forEach((sig: any, idx: number) => {
      const arrow = (sig.change1d ?? 0) >= 0 ? '🔺' : '🔻';
      const changeStr = `${(sig.change1d ?? 0) >= 0 ? '+' : ''}${(sig.change1d ?? 0).toFixed(1)}%`;
      reportText += `${idx + 1}. ${formatTelegramStockName(sig.ticker, sig.name)}\n`;
      reportText += `   - 현재가: ${formatPrice(sig.ticker, sig.price ?? 0)} (전일대비: ${arrow} ${changeStr})\n`;
      reportText += `   - 기회점수: <b>${sig.opportunity?.opportunity_score ?? 50}점</b> | 판정: <code>${sig.decision?.decision || 'BUY'}</code>\n`;
      reportText += `   - 핵심이유: ${sig.decision?.reason || '기술적 반등 및 팩터 점수 우수'}\n\n`;
    });
  } else {
    reportText += `ℹ️ 현재 엄격한 모멘텀 돌파 제약을 통과한 신규 진입 신호 없음\n\n`;
  }

  reportText += `<b>🛡️ 전략 B: 우량대형주 & 지수ETF 분할적립/눌림목 포착</b>\n`;
  if (dipBuyOpportunities.length > 0) {
    dipBuyOpportunities.slice(0, 5).forEach((dip: any, idx: number) => {
      const evalData = dip.dip_evaluation;
      const arrow = (dip.change1d ?? 0) >= 0 ? '🔺' : '🔻';
      const changeStr = `${(dip.change1d ?? 0) >= 0 ? '+' : ''}${(dip.change1d ?? 0).toFixed(1)}%`;
      reportText += `${idx + 1}. ${formatTelegramStockName(dip.ticker, dip.name)}\n`;
      reportText += `   - 현재가: ${formatPrice(dip.ticker, dip.price ?? 0)} (전일대비: ${arrow} ${changeStr})\n`;
      reportText += `   - 우량적합도: <b>${evalData.suitability.tierLabel}</b> (${evalData.suitability.score}점)\n`;
      reportText += `   - 눌림타이밍: <b>${evalData.timing.score}점</b> (RSI ${evalData.timing.rsi.toFixed(1)}, ${evalData.timing.drawdownLabel})\n`;
      reportText += `   - 신호: <b>${dip.signalLabel}</b> (권고: <code>${dip.suggestedDcaRatio}</code>)\n\n`;
    });
  } else {
    reportText += `   ℹ️ 현재 우량주 중 최적의 과매도 눌림목 구간에 도달한 종목 없음 (정기 일정 유지)\n\n`;
  }

  try {
    const exitEvals = await ExitSignalEngine.evaluateAllExits(evaluations, undefined, targetMarket);
    const actionableExits = exitEvals
      .filter((e: any) => e.isActionableSell)
      .filter((e: any) => detectMarketRegion(e.ticker) === targetMarket);

    if (actionableExits.length > 0) {
      reportText += `🚨 <b>[통합 매도 & 포지션 청산 권고]</b>\n`;
      actionableExits.slice(0, 3).forEach((exit: any, idx: number) => {
        const retText = exit.returnSinceEntryPct !== undefined
          ? ` (진입대비 ${exit.returnSinceEntryPct >= 0 ? '+' : ''}${exit.returnSinceEntryPct.toFixed(1)}% | ${escapeTelegramHtml(exit.entryPriceBasisLabel || '평단가 기준')})`
          : ` [기술적 추세 이탈 | 평단가 미등록]`;
        reportText += `${idx + 1}. ${formatTelegramStockName(exit.ticker, exit.name)}: ${escapeTelegramHtml(exit.headline)}${retText}\n`;
        reportText += `   └ 💡 <b>실행 권고:</b> ${escapeTelegramHtml(exit.recommendedAction)}\n`;
      });
      reportText += `\n`;
    }
  } catch (err) {
    logger.warn('Exit signal section skipped', { component: 'ScanFinalizer', error: String(err) });
  }

  try {
    const macro = await MacroEarningsEngine.getMacroMarketRegime();
    reportText += `🌐 <b>[시장 매크로 체제: ${escapeTelegramHtml(macro.regimeLabel)}]</b>\n`;
    reportText += `• <b>VIX 공포지수:</b> ${macro.vix.level.toFixed(1)} (${macro.vix.label})\n`;
    reportText += `• <b>미국 10년물 금리:</b> ${macro.us10y.level.toFixed(2)}% | <b>달러(DXY):</b> ${macro.dxy.level.toFixed(1)}\n`;
    reportText += `• <b>운용 가이드:</b> ${escapeTelegramHtml(macro.actionableSummary)}\n\n`;
  } catch (err) {
    logger.warn('Macro section skipped', { component: 'ScanFinalizer', error: String(err) });
  }

  try {
    const macro = await MacroEarningsEngine.getMacroMarketRegime();
    const portRegion = targetMarket;
    const portCapital = portRegion === 'KR' ? 100_000_000 : 100_000;
    const portState = await PortfolioEngine.calculatePortfolioState(portCapital, macro, portRegion);
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
  } catch (err) {
    logger.warn('Portfolio section skipped', { component: 'ScanFinalizer', error: String(err) });
  }

  return reportText;
}

function resolveTelegramCredentials(env: Env): { token: string; chat: string } {
  const clean = (value?: string) => (value || '').trim().replace(/^['"]|['"]$/g, '');
  const cfg = telegramNotifier.getConfig();
  return {
    token: clean(env.TELEGRAM_BOT_TOKEN || cfg.botToken).replace(/^bot/i, ''),
    chat: clean(env.TELEGRAM_CHAT_ID || cfg.chatId),
  };
}

export async function runFinalizer(options: {
  scanRunId: string;
  market: ScanMarket;
  slot: string;
  triggeredBy: string;
  sourceUrl?: string;
  env: Env;
}): Promise<void> {
  const { scanRunId, market, slot, env } = options;

  try {
    const run = await scanRunRepository.getById(scanRunId);
    if (!run) {
      logger.error('Finalizer could not load scan run', { component: 'ScanFinalizer', scanRunId });
      return;
    }

    const allEvaluations = await evaluationRepository.getAll();
    const kstTimeStr = getKstTimeStr();
    const reportText = await buildTelegramReport(allEvaluations, market, slot, kstTimeStr);

    const { token, chat } = resolveTelegramCredentials(env);
    let deliveryStatus = 'LOCAL_LOGGED';
    let deliveryTarget: string | null = null;
    let deliveryMessage = '텔레그램 미설정: 리포트 생성만 수행';

    if (token && chat) {
      const sendRes = await telegramNotifier.sendMessage(reportText, token, chat);
      if (sendRes.success && !sendRes.previewOnly) {
        deliveryStatus = 'SENT';
        deliveryTarget = `${chat.slice(0, 3)}****`;
        deliveryMessage = '텔레그램 봇으로 실제 브리핑 리포트가 발송되었습니다!';
      } else if (sendRes.previewOnly) {
        deliveryStatus = 'PREVIEW_ONLY';
        deliveryMessage = '텔레그램 미등록: 프리뷰 브리핑 완료';
      } else {
        deliveryStatus = 'FAILED';
        deliveryMessage = sendRes.error || '텔레그램 전송 실패';
      }
    }

    const marketEvals = allEvaluations.filter((e: any) => detectMarketRegion(e.ticker) === market);
    const actionableSignals = marketEvals.filter((e: any) => e.signal_generated);
    const dipOpportunities = marketEvals
      .map((e: any) => ensureDipEvaluation(e))
      .filter((d: any) => d.dip_evaluation && d.dip_evaluation.suitability.tier !== 'D' && d.dip_evaluation.isActionableDip);
    const allActionTickers = Array.from(
      new Set([
        ...actionableSignals.map((e: any) => e.ticker),
        ...dipOpportunities.map((d: any) => d.ticker),
      ])
    );

    try {
      await alertHistoryRepository.save({
        id: `alert-${scanRunId}`,
        timestamp: new Date().toISOString(),
        kst_time: kstTimeStr,
        strategy_type: 'DUAL_SCAN_REPORT',
        title: `🚀 [${slot}] 듀얼 퀀트 브리핑`,
        tickers: allActionTickers,
        signals_count: actionableSignals.length,
        delivery_status: deliveryStatus,
        delivery_target: deliveryTarget,
        message_preview: `전략 A ${actionableSignals.length}건, 전략 B ${dipOpportunities.length}건 포착 (${deliveryMessage})`,
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
      } as any);
    } catch (err) {
      logger.warn('Failed to save alert history', { component: 'ScanFinalizer', error: String(err) });
    }

    await scanRunRepository.finalizeRun(scanRunId, {
      error_summary: `${slot} 스캔 완료 | 전략A ${actionableSignals.length}건, 전략B ${dipOpportunities.length}건 | ${deliveryMessage}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Finalizer failed', { component: 'ScanFinalizer', scanRunId, error: message });
    await scanRunRepository.finalizeRun(scanRunId, {
      status: 'FAILED',
      error_summary: `Finalizer error: ${message}`,
    });
  }
}

export { buildTelegramReport };
