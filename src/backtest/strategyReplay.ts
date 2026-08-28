import { BacktestRequestConfig, StandaloneBacktestResult, SimulatedTradeSignal, EquityCurvePoint } from './backtestTypes';
import { historicalDataProvider } from './historicalDataProvider';
import { buildEvaluationInput } from './quantStrategy';
import { evaluateV8 } from '../engine/evaluateV8';
import { calculateReplayPerformance } from './performanceCalculator';
import { watchlistRepository } from '../db/repositories/watchlistRepository';

export async function runHistoricalReplay(
  config: BacktestRequestConfig
): Promise<StandaloneBacktestResult> {
  const watchlist = await watchlistRepository.getActive();
  const targetTickers = config.tickers && config.tickers.length > 0
    ? config.tickers
    : watchlist.map((w) => w.ticker);

  const benchmarkBars = await historicalDataProvider.getHistoricalBarsForTicker('SPY', '2y');
  const signals: SimulatedTradeSignal[] = [];
  const threshold = config.opportunityThreshold || 70;

  for (const ticker of targetTickers) {
    historicalDataProvider.resetSeedFallback();
    const bars = await historicalDataProvider.getHistoricalBarsForTicker(ticker, '2y');
    if (bars.length < 60) continue;

    // 2.3 Seed 폴백 데이터로는 절대 성과를 만들지 않는다 (24시간 정직한 출처)
    const isSeedData = historicalDataProvider.getHadSeedFallback();

    let lastSignalIndex = -999;

    // Start replay from index 50 (warmup) to bars.length - 1
    for (let i = 50; i < bars.length; i++) {
      const barDate = bars[i].date;
      if (config.startDate && barDate < config.startDate) continue;
      if (config.endDate && barDate > config.endDate) break;

      // 1. Strict Point-in-Time Slice
      const pitBars = historicalDataProvider.getPointInTimeSlice(bars, i);
      const pitBenchmark = benchmarkBars.length > 0
        ? historicalDataProvider.getPointInTimeSlice(benchmarkBars, Math.min(i, benchmarkBars.length - 1))
        : undefined;

      // 2. 공통 평가 엔진 evaluateV8() 직접 사용 (라이브와 동일 경로)
      if (i - lastSignalIndex >= 3) {
        const evaluation = evaluateV8(
          buildEvaluationInput(ticker, pitBars, pitBenchmark, {
            source: isSeedData ? 'seed' : 'backtest',
            isFallback: isSeedData,
          })
        );
        const isSignal = evaluation.decision.actionable && evaluation.opportunity.opportunity_score >= threshold;

        if (isSignal) {
          const outcomes = historicalDataProvider.getForwardOutcomes(bars, i);
          signals.push({
            id: `sig-${ticker}-${barDate}`,
            ticker,
            entryDate: barDate,
            entryPrice: outcomes.entryPrice,
            strategyType: evaluation.classification.strategy_type,
            riskLevel: evaluation.risk.risk_level,
            opportunityScore: evaluation.opportunity.opportunity_score,
            return5d: outcomes.return5d ?? undefined,
            return10d: outcomes.return10d ?? undefined,
            return20d: outcomes.return20d ?? undefined,
            maxAdverseExcursionTrade: outcomes.maxAdverseExcursion,
            isWin20d: outcomes.return20d !== null ? outcomes.return20d > 0 : undefined,
          });
          lastSignalIndex = i;
        }
      }
    }
  }

  // Sort signals by entryDate
  signals.sort((a, b) => a.entryDate.localeCompare(b.entryDate));

  // Compute performance summary
  const summary = calculateReplayPerformance(signals);

  // Compute simulated equity curve (cumulative signal returns)
  const equityCurve: EquityCurvePoint[] = [];
  let cumulative = 0;
  let peak = 0;

  // 실제 벤치마크 기준선: 첫 번째 벤치마크 봉 close 대비 각 신호 날짜의 close 수익률
  const benchmarkStartPrice = benchmarkBars.length > 0 ? benchmarkBars[0].close : 0;

  signals.forEach((sig) => {
    const ret = sig.return20d ?? sig.return10d ?? sig.return5d ?? 0;
    cumulative += ret;
    if (cumulative > peak) peak = cumulative;
    const dd = peak > 0 ? ((cumulative - peak) / (100 + peak)) * 100 : 0;

    // Real benchmark: from backtest start to signal date's benchmark close
    const benchBar = benchmarkBars.find((b) => b.date >= sig.entryDate);
    const benchClose = benchBar ? benchBar.close : benchmarkBars[benchmarkBars.length - 1]?.close ?? 0;
    const benchmarkReturn = benchmarkStartPrice > 0 ? ((benchClose - benchmarkStartPrice) / benchmarkStartPrice) * 100 : 0;

    equityCurve.push({
      date: sig.entryDate,
      cumulativeReturn: Math.round(cumulative * 10) / 10,
      benchmarkReturn: Math.round(benchmarkReturn * 10) / 10,
      drawdown: Math.round(dd * 10) / 10,
    });
  });

  return {
    summary,
    signals,
    equityCurve,
    startDate: config.startDate || '2024-01-01',
    endDate: config.endDate || new Date().toISOString().split('T')[0],
    testedUniverseCount: targetTickers.length,
  };
}
