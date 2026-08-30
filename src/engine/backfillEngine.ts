import { OHLCVBar } from '../data/providers/types';
import { marketDataRepository } from '../db/repositories/marketDataRepository';
import { signalRepository } from '../db/repositories/signalRepository';
import { scanRunRepository } from '../db/repositories/scanRunRepository';
import { watchlistRepository } from '../db/repositories/watchlistRepository';
import { historicalDataProvider } from '../backtest/historicalDataProvider';
import { buildEvaluationInput } from '../backtest/quantStrategy';
import { evaluateV8 } from './evaluateV8';
import { SignalSnapshot, ScanRunLog } from '../types/v8';
import { fundamentalsRepository } from '../db/repositories/fundamentalsRepository';
import { classificationRepository } from '../db/repositories/classificationRepository';
import { assetRepository } from '../db/repositories/assetRepository';
import { dbClient } from '../db/supabaseClient';
import { RawYahooMetadata } from './classificationEngine';

export interface BackfillOptions {
  lookbackRange?: '6m' | '1y' | '2y';
  tickers?: string[];
  opportunityThreshold?: number;
  replaceExisting?: boolean;
}

export interface BackfillResult {
  success: boolean;
  totalTickers: number;
  totalBarsIngested: number;
  totalSignalsGenerated: number;
  completedSignals: number;
  winRate5d: number;
  winRate10d: number;
  winRate20d: number;
  avgReturn20d: number;
  dateRange: {
    start: string;
    end: string;
  };
  detailsByTicker: Record<
    string,
    {
      barsCount: number;
      signalsCount: number;
      winRate20d: number;
      avgReturn20d: number;
    }
  >;
}

export interface TickerBackfillResult {
  ticker: string;
  barsCount: number;
  signalsCount: number;
  winRate20d: number;
  avgReturn20d: number;
  signals: SignalSnapshot[];
  minDate: string;
  maxDate: string;
  source: 'yahoo' | 'stooq' | 'seed';
}

export async function initBackfill(options: BackfillOptions = {}) {
  const range = options.lookbackRange || '1y';

  // Determine tickers
  let targetTickers: string[] = [];
  if (options.tickers && options.tickers.length > 0) {
    targetTickers = options.tickers.map((t) => t.toUpperCase().trim());
  } else {
    const activeWatchlist = await watchlistRepository.getActive();
    targetTickers = activeWatchlist.map((w) => w.ticker);
  }

  if (targetTickers.length === 0) {
    targetTickers = ['NVDA', 'AAPL', 'MSFT', 'TSLA', 'SPY', 'AMD', 'AMZN', 'GOOGL', 'META', 'QQQ'];
  }

  // Fetch and save benchmark SPY bars
  const benchmarkBars = await historicalDataProvider.getHistoricalBarsForTicker('SPY', range);
  const benchIsSeed = historicalDataProvider.getHadSeedFallback();
  if (benchmarkBars.length > 0) {
    await marketDataRepository.saveBars('SPY', benchmarkBars, benchIsSeed ? 'seed' : undefined);
  }

  return {
    targetTickers,
    benchmarkBarsCount: benchmarkBars.length,
    range,
    benchmarkSource: benchIsSeed ? 'seed' : 'yahoo',
  };
}

export async function backfillSingleTicker(
  ticker: string,
  options: BackfillOptions = {}
): Promise<TickerBackfillResult> {
  const range = options.lookbackRange || '1y';
  const threshold = options.opportunityThreshold || 70;
  const clean = ticker.toUpperCase().trim();

  // Get benchmark bars
  const benchmarkBars = await historicalDataProvider.getHistoricalBarsForTicker('SPY', range);

  const bars = await historicalDataProvider.getHistoricalBarsForTicker(clean, range);
  if (bars.length < 50) {
    return {
      ticker: clean,
      barsCount: bars.length,
      signalsCount: 0,
      winRate20d: 0,
      avgReturn20d: 0,
      signals: [],
      minDate: '',
      maxDate: '',
      source: 'seed',
    };
  }

  const tickerIsSeed = historicalDataProvider.getHadSeedFallback();
  await marketDataRepository.saveBars(clean, bars, tickerIsSeed ? 'seed' : undefined);

  const dbAsset = await assetRepository.findByTicker(clean);
  const currentOverride = dbClient.classifications.get(clean);
  const isEtfHint = dbAsset?.asset_type === 'etf' || currentOverride?.asset_type === 'etf';

  const fundHistory = await fundamentalsRepository.getHistoryAsOf(clean);
  let fundHistoryIdx = 0;
  const classHistory = await classificationRepository.getHistoryAsOf(clean);
  let classHistoryIdx = 0;

  let lastSignalIndex = -999;
  const tickerSignals: SignalSnapshot[] = [];
  let minDate = '9999-99-99';
  let maxDate = '0000-00-00';

  for (let i = 50; i < bars.length; i++) {
    const barDate = bars[i].date;
    if (barDate < minDate) minDate = barDate;
    if (barDate > maxDate) maxDate = barDate;

    while (classHistoryIdx + 1 < classHistory.length && classHistory[classHistoryIdx + 1].effective_date <= barDate) {
      classHistoryIdx++;
    }
    const manualOverride = classHistory[classHistoryIdx]?.effective_date <= barDate ? classHistory[classHistoryIdx] : undefined;

    const pitBars = historicalDataProvider.getPointInTimeSlice(bars, i);
    const pitBenchmark =
      benchmarkBars.length > 0
        ? benchmarkBars.filter((b) => b.date <= barDate)
        : undefined;

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
          clean,
          pitBars,
          pitBenchmark,
          threshold,
          {
            source: tickerIsSeed ? 'seed' : 'backtest',
            isFallback: tickerIsSeed,
          },
          undefined,
          { raw: classificationOverride, existing: manualOverride },
          dbFund,
          isEtfHint
        )
      );

      if (evaluation.isSignal) {
        const outcomes = historicalDataProvider.getForwardOutcomes(bars, i);

        const signalId = `sig-${clean}-${barDate}`;
        const signalItem: SignalSnapshot = {
          id: signalId,
          signal_date: barDate,
          ticker: clean,
          name: clean,
          signal_price: outcomes.entryPrice,
          strategy_type: evaluation.classification.strategy_type,
          asset_type: evaluation.classification.asset_type,
          opportunity_score: evaluation.opportunity.opportunity_score,
          risk_level: evaluation.risk.risk_level,
          risk_score: evaluation.risk.risk_score,
          decision: evaluation.decision.decision,
          signal_confidence: evaluation.decision.confidence,
          classification_confidence: evaluation.classification.confidence,
          position_size_pct: evaluation.decision.position_size_pct,
          technical_score: evaluation.opportunity.sub_scores.technical_score,
          momentum_score: evaluation.opportunity.sub_scores.momentum_score,
          fundamental_score: evaluation.opportunity.sub_scores.fundamental_score,
          valuation_score: evaluation.opportunity.sub_scores.valuation_score,
          rsi: evaluation.opportunity.technical_details.rsi14,
          drawdown: Math.abs(outcomes.maxAdverseExcursion),
          return_5d: outcomes.return5d,
          return_10d: outcomes.return10d,
          return_20d: outcomes.return20d,
          return_60d: outcomes.return60d,
          return_120d: outcomes.return120d,
          return_252d: outcomes.return252d,
          current_return: outcomes.return20d ?? outcomes.return10d ?? outcomes.return5d,
          status: outcomes.return20d !== null ? '20D_REACHED' : 'ACTIVE',
          is_closed: outcomes.return20d !== null,
          components: {
            weights: evaluation.opportunity.weights_used,
            risk_reasons: evaluation.risk.risk_reasons,
            decision_reason: evaluation.decision.reason,
          },
        };

        tickerSignals.push(signalItem);
        lastSignalIndex = i;
      }
    }
  }

  // Save signals into repository for this ticker
  if (tickerSignals.length > 0) {
    await signalRepository.saveSignals(tickerSignals);
  }

  const completedTickerSignals = tickerSignals.filter((s) => s.return_20d !== null);
  const wins = completedTickerSignals.filter((s) => (s.return_20d ?? 0) > 0).length;
  const avgRet =
    completedTickerSignals.length > 0
      ? completedTickerSignals.reduce((sum, s) => sum + (s.return_20d ?? 0), 0) /
        completedTickerSignals.length
      : 0;

  return {
    ticker: clean,
    barsCount: bars.length,
    signalsCount: tickerSignals.length,
    winRate20d:
      completedTickerSignals.length > 0
        ? Math.round((wins / completedTickerSignals.length) * 1000) / 10
        : 0,
    avgReturn20d: Math.round(avgRet * 10) / 10,
    signals: tickerSignals,
    minDate: minDate !== '9999-99-99' ? minDate : '',
    maxDate: maxDate !== '0000-00-00' ? maxDate : '',
    source: tickerIsSeed ? 'seed' : 'yahoo',
  };
}

export async function finalizeBackfill(
  targetTickers: string[],
  range: string,
  totalBarsIngested: number,
  allSignals: SignalSnapshot[],
  detailsByTicker: BackfillResult['detailsByTicker'],
  minDate: string,
  maxDate: string
): Promise<BackfillResult> {
  const completedSignals = allSignals.filter((s) => s.return_20d !== null);
  const nCompleted = completedSignals.length || 1;

  const win5d = allSignals.filter((s) => s.return_5d !== null && (s.return_5d ?? 0) > 0).length;
  const total5d = allSignals.filter((s) => s.return_5d !== null).length || 1;

  const win10d = allSignals.filter((s) => s.return_10d !== null && (s.return_10d ?? 0) > 0).length;
  const total10d = allSignals.filter((s) => s.return_10d !== null).length || 1;

  const win20d = completedSignals.filter((s) => (s.return_20d ?? 0) > 0).length;
  const avg20d = completedSignals.reduce((sum, s) => sum + (s.return_20d ?? 0), 0) / nCompleted;

  const runLog: ScanRunLog = {
    run_id: `run-backfill-${Date.now()}`,
    status: 'SUCCESS',
    started_at: new Date().toISOString(),
    finished_at: new Date().toISOString(),
    watchlist_count: targetTickers.length,
    evaluated_count: targetTickers.length,
    signal_count: allSignals.length,
    failure_count: 0,
    failed_tickers: [],
    error_summary: `과거 ${range} 일별 백필 및 사후 수익률 인제스천 완료 (${allSignals.length}개 시그널 생성, 20D 승률 ${(win20d / nCompleted * 100).toFixed(1)}%)`,
  };

  await scanRunRepository.save(runLog);

  return {
    success: true,
    totalTickers: targetTickers.length,
    totalBarsIngested,
    totalSignalsGenerated: allSignals.length,
    completedSignals: completedSignals.length,
    winRate5d: Math.round((win5d / total5d) * 1000) / 10,
    winRate10d: Math.round((win10d / total10d) * 1000) / 10,
    winRate20d: Math.round((win20d / nCompleted) * 1000) / 10,
    avgReturn20d: Math.round(avg20d * 10) / 10,
    dateRange: {
      start: minDate && minDate !== '9999-99-99' ? minDate : '2024-01-01',
      end: maxDate && maxDate !== '0000-00-00' ? maxDate : new Date().toISOString().split('T')[0],
    },
    detailsByTicker,
  };
}

export async function runHistoricalBackfill(
  options: BackfillOptions = {}
): Promise<BackfillResult> {
  const init = await initBackfill(options);
  const range = init.range;
  const targetTickers = init.targetTickers;

  let totalBarsIngested = init.benchmarkBarsCount;
  const allSignals: SignalSnapshot[] = [];
  const detailsByTicker: BackfillResult['detailsByTicker'] = {};
  let minDate = '9999-99-99';
  let maxDate = '0000-00-00';

  for (const ticker of targetTickers) {
    try {
      const res = await backfillSingleTicker(ticker, options);
      totalBarsIngested += res.barsCount;
      allSignals.push(...res.signals);
      detailsByTicker[ticker] = {
        barsCount: res.barsCount,
        signalsCount: res.signalsCount,
        winRate20d: res.winRate20d,
        avgReturn20d: res.avgReturn20d,
      };
      if (res.minDate && res.minDate < minDate) minDate = res.minDate;
      if (res.maxDate && res.maxDate > maxDate) maxDate = res.maxDate;
    } catch (err) {
      console.warn(`[BackfillEngine] Error processing ticker ${ticker}:`, (err as Error).message);
    }
  }

  return finalizeBackfill(
    targetTickers,
    range,
    totalBarsIngested,
    allSignals,
    detailsByTicker,
    minDate,
    maxDate
  );
}
