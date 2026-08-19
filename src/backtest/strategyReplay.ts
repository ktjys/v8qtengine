import { BacktestRequestConfig, ReplayComparisonResult, SimulatedTradeSignal } from './backtestTypes';
import { historicalDataProvider } from './historicalDataProvider';
import { evaluateV7Strategy } from './v7Strategy';
import { evaluateV8Strategy } from './v8Strategy';
import { calculateReplayPerformance } from './performanceCalculator';
import { watchlistRepository } from '../db/repositories/watchlistRepository';

export async function runHistoricalReplay(
  config: BacktestRequestConfig
): Promise<ReplayComparisonResult> {
  const watchlist = await watchlistRepository.getActive();
  const targetTickers = config.tickers && config.tickers.length > 0
    ? config.tickers
    : watchlist.map((w) => w.ticker);

  const benchmarkBars = await historicalDataProvider.getHistoricalBarsForTicker('SPY', '2y');

  const signalsV8: SimulatedTradeSignal[] = [];
  const signalsV7: SimulatedTradeSignal[] = [];

  const thresholdV8 = config.opportunityThresholdV8 || 70;
  const thresholdV7 = config.opportunityThresholdV7 || 65;

  for (const ticker of targetTickers) {
    const bars = await historicalDataProvider.getHistoricalBarsForTicker(ticker, '2y');
    if (bars.length < 60) continue;

    let lastV8SignalIndex = -999;
    let lastV7SignalIndex = -999;

    // Start replay from index 50 (to have enough indicator warmup) up to bars.length - 1
    for (let i = 50; i < bars.length; i++) {
      const barDate = bars[i].date;
      if (config.startDate && barDate < config.startDate) continue;
      if (config.endDate && barDate > config.endDate) break;

      // 1. Strict Point-in-Time Slice
      const pitBars = historicalDataProvider.getPointInTimeSlice(bars, i);
      const pitBenchmark = benchmarkBars.length > 0
        ? historicalDataProvider.getPointInTimeSlice(benchmarkBars, Math.min(i, benchmarkBars.length - 1))
        : undefined;

      // 2. Evaluate V8
      if (i - lastV8SignalIndex >= 3) {
        const v8Eval = evaluateV8Strategy(ticker, pitBars, pitBenchmark, thresholdV8);
        if (v8Eval.isSignal) {
          const outcomes = historicalDataProvider.getForwardOutcomes(bars, i);
          signalsV8.push({
            id: `v8-${ticker}-${barDate}`,
            ticker,
            entryDate: barDate,
            entryPrice: outcomes.entryPrice,
            strategyVersion: 'V8.0',
            strategyType: v8Eval.strategyType,
            riskLevel: v8Eval.riskLevel,
            opportunityScore: v8Eval.opportunityScore,
            return5d: outcomes.return5d ?? undefined,
            return10d: outcomes.return10d ?? undefined,
            return20d: outcomes.return20d ?? undefined,
            maxDrawdownTrade: outcomes.maxDrawdown,
            isWin20d: outcomes.return20d !== null ? outcomes.return20d > 0 : undefined,
          });
          lastV8SignalIndex = i;
        }
      }

      // 3. Evaluate V7
      if (i - lastV7SignalIndex >= 3) {
        const v7Eval = evaluateV7Strategy(pitBars, thresholdV7);
        if (v7Eval.isSignal) {
          const outcomes = historicalDataProvider.getForwardOutcomes(bars, i);
          signalsV7.push({
            id: `v7-${ticker}-${barDate}`,
            ticker,
            entryDate: barDate,
            entryPrice: outcomes.entryPrice,
            strategyVersion: 'V7.0',
            strategyType: 'general_equity',
            riskLevel: 'MEDIUM',
            opportunityScore: v7Eval.score,
            return5d: outcomes.return5d ?? undefined,
            return10d: outcomes.return10d ?? undefined,
            return20d: outcomes.return20d ?? undefined,
            maxDrawdownTrade: outcomes.maxDrawdown,
            isWin20d: outcomes.return20d !== null ? outcomes.return20d > 0 : undefined,
          });
          lastV7SignalIndex = i;
        }
      }
    }
  }

  const v8Summary = calculateReplayPerformance(signalsV8, 'V8.0');
  const v7Summary = calculateReplayPerformance(signalsV7, 'V7.0');

  const improvement = {
    winRateDiff20d: Math.round((v8Summary.win_rate_20d - v7Summary.win_rate_20d) * 10) / 10,
    avgReturnDiff20d: Math.round((v8Summary.avg_return_20d - v7Summary.avg_return_20d) * 10) / 10,
    maxDrawdownReduction: Math.round((v7Summary.max_drawdown - v8Summary.max_drawdown) * 10) / 10,
    profitFactorDiff: Math.round((v8Summary.profit_factor - v7Summary.profit_factor) * 100) / 100,
  };

  return {
    v8: v8Summary,
    v7: v7Summary,
    signalsV8,
    signalsV7,
    improvement,
    startDate: config.startDate || '2024-01-01',
    endDate: config.endDate || new Date().toISOString().split('T')[0],
    testedUniverseCount: targetTickers.length,
  };
}
