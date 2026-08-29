import { BacktestRequestConfig, StandaloneBacktestResult, SimulatedTradeSignal, EquityCurvePoint } from './backtestTypes';
import { historicalDataProvider } from './historicalDataProvider';
import { buildEvaluationInput } from './quantStrategy';
import { evaluateV8 } from '../engine/evaluateV8';
import { calculateReplayPerformance } from './performanceCalculator';
import { watchlistRepository } from '../db/repositories/watchlistRepository';
import { fundamentalsRepository } from '../db/repositories/fundamentalsRepository';
import { assetRepository } from '../db/repositories/assetRepository';
import { dbClient } from '../db/supabaseClient';
import { RawYahooMetadata } from '../engine/classificationEngine';

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

    const isSeedData =
      historicalDataProvider.getHadSeedFallback() || bars.some((b) => b.source === 'seed');

    const dbAsset = await assetRepository.findByTicker(ticker);
    const manualOverride = dbClient.classifications.get(ticker);
    const isEtfHint = dbAsset?.asset_type === 'etf' || manualOverride?.asset_type === 'etf';

    // PIT fundamentals를 배치로 1회 조회 후 포인터로 소비 (bar별 getAsOf N+1 방지)
    const fundHistory = await fundamentalsRepository.getHistoryAsOf(ticker);
    let fundHistoryIdx = 0;

    let lastSignalIndex = -999;

    // Start replay from index 50 (warmup) to bars.length - 1
    for (let i = 50; i < bars.length; i++) {
      const barDate = bars[i].date;
      if (config.startDate && barDate < config.startDate) continue;
      if (config.endDate && barDate > config.endDate) break;

      const pitBars = historicalDataProvider.getPointInTimeSlice(bars, i);
      const pitBenchmark = benchmarkBars.length > 0
        ? benchmarkBars.filter((b) => b.date <= barDate)
        : undefined;

      // 최신 PIT fundamentals 선택 (as_of_date <= barDate)
      while (fundHistoryIdx + 1 < fundHistory.length && fundHistory[fundHistoryIdx + 1].as_of_date <= barDate) {
        fundHistoryIdx++;
      }
      const dbFund = fundHistory[fundHistoryIdx]?.as_of_date <= barDate ? fundHistory[fundHistoryIdx] : undefined;

      const classificationOverride: RawYahooMetadata = {
        quoteType: isEtfHint ? 'ETF' : 'EQUITY',
        sector: dbAsset?.sector,
        industry: dbAsset?.industry,
        marketCap: dbFund?.market_cap,
      };

      if (i - lastSignalIndex >= 3) {
        const evaluation = evaluateV8(
          buildEvaluationInput(
            ticker,
            pitBars,
            pitBenchmark,
            threshold,
            {
              source: isSeedData ? 'seed' : 'backtest',
              isFallback: isSeedData,
            },
            undefined,
            { raw: classificationOverride, existing: manualOverride },
            dbFund,
            isEtfHint
          )
        );
        const isSignal = evaluation.isSignal;

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

  // 실제 벤치마크 기준선: 백테스트 기간(시작일)의 benchmark close를 기준으로 시작한다.
  // 전체 2년 데이터의 첫 봉을 기준으로 삼으면 기간 밖 과거 수익률이 들어가므로 시작일로 리셋.
  const backtestStart = config.startDate || (benchmarkBars.length > 0 ? benchmarkBars[0].date : '');
  const baselineBar = benchmarkBars.find((b) => b.date >= backtestStart) ?? benchmarkBars[0];
  const benchmarkStartPrice = baselineBar ? baselineBar.close : 0;
  const benchmarkStartDate = baselineBar ? baselineBar.date : '';

  signals.forEach((sig) => {
    const ret = sig.return20d ?? sig.return10d ?? sig.return5d ?? 0;
    cumulative += ret;
    if (cumulative > peak) peak = cumulative;
    const dd = peak > 0 ? ((cumulative - peak) / (100 + peak)) * 100 : 0;

    // Real benchmark: backtest 시작일부터 신호 날짜까지의 benchmark close 수익률
    const benchBar = benchmarkBars.find((b) => b.date >= sig.entryDate && b.date >= benchmarkStartDate);
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
