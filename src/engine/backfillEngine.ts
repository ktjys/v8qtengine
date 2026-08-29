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

export async function runHistoricalBackfill(
  options: BackfillOptions = {}
): Promise<BackfillResult> {
  const range = options.lookbackRange || '1y';
  const threshold = options.opportunityThreshold || 70;

  // 1. Determine tickers to backfill
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

  // 2. Fetch and ingest benchmark bars (SPY)
  const benchmarkBars = await historicalDataProvider.getHistoricalBarsForTicker('SPY', range);
  if (benchmarkBars.length > 0) {
    // 정직한 출처: seed 폴백이면 'seed'로 저장 (yahoo로 오표기 방지)
    const benchIsSeed = historicalDataProvider.getHadSeedFallback();
    await marketDataRepository.saveBars('SPY', benchmarkBars, benchIsSeed ? 'seed' : undefined);
  }

  let totalBarsIngested = benchmarkBars.length;
  const newSignals: SignalSnapshot[] = [];
  const detailsByTicker: BackfillResult['detailsByTicker'] = {};

  let minDate = '9999-99-99';
  let maxDate = '0000-00-00';

  // 3. Process each ticker
  for (const ticker of targetTickers) {
    try {
      const bars = await historicalDataProvider.getHistoricalBarsForTicker(ticker, range);
      if (bars.length < 50) continue;

      const tickerIsSeed = historicalDataProvider.getHadSeedFallback();
      await marketDataRepository.saveBars(ticker, bars, tickerIsSeed ? 'seed' : undefined);
      totalBarsIngested += bars.length;

      const dbAsset = await assetRepository.findByTicker(ticker);
      const currentOverride = dbClient.classifications.get(ticker);
      const isEtfHint = dbAsset?.asset_type === 'etf' || currentOverride?.asset_type === 'etf';

      // PIT fundamentals & classification을 배치로 1회 조회 후 포인터로 소비 (bar별 getAsOf N+1 방지)
      const fundHistory = await fundamentalsRepository.getHistoryAsOf(ticker);
      let fundHistoryIdx = 0;
      const classHistory = await classificationRepository.getHistoryAsOf(ticker);
      let classHistoryIdx = 0;

      let lastSignalIndex = -999;
      const tickerSignals: SignalSnapshot[] = [];

      for (let i = 50; i < bars.length; i++) {
        const barDate = bars[i].date;
        if (barDate < minDate) minDate = barDate;
        if (barDate > maxDate) maxDate = barDate;

        // PIT 수동 오버라이드: barDate 기준 유효한 분류만 적용 (미래 오버라이드 look-ahead 방지)
        while (classHistoryIdx + 1 < classHistory.length && classHistory[classHistoryIdx + 1].effective_date <= barDate) {
          classHistoryIdx++;
        }
        const manualOverride = classHistory[classHistoryIdx]?.effective_date <= barDate ? classHistory[classHistoryIdx] : undefined;

        const pitBars = historicalDataProvider.getPointInTimeSlice(bars, i);
        const pitBenchmark =
          benchmarkBars.length > 0
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

            const signalId = `sig-${ticker}-${barDate}`;
            const signalItem: SignalSnapshot = {
              id: signalId,
              signal_date: barDate,
              ticker,
              name: ticker,
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

            newSignals.push(signalItem);
            tickerSignals.push(signalItem);
            lastSignalIndex = i;
          }
        }
      }

      // Calculate ticker-specific stats
      const completedTickerSignals = tickerSignals.filter((s) => s.return_20d !== null);
      const wins = completedTickerSignals.filter((s) => (s.return_20d ?? 0) > 0).length;
      const avgRet =
        completedTickerSignals.length > 0
          ? completedTickerSignals.reduce((sum, s) => sum + (s.return_20d ?? 0), 0) /
            completedTickerSignals.length
          : 0;

      detailsByTicker[ticker] = {
        barsCount: bars.length,
        signalsCount: tickerSignals.length,
        winRate20d:
          completedTickerSignals.length > 0
            ? Math.round((wins / completedTickerSignals.length) * 1000) / 10
            : 0,
        avgReturn20d: Math.round(avgRet * 10) / 10,
      };
    } catch (err) {
      console.warn(`[BackfillEngine] Error processing ticker ${ticker}:`, (err as Error).message);
    }
  }

  // 4. Save signals into repository & database
  await signalRepository.saveSignals(newSignals);

  // 5. Compute global metrics
  const completedSignals = newSignals.filter((s) => s.return_20d !== null);
  const nCompleted = completedSignals.length || 1;

  const win5d = newSignals.filter((s) => s.return_5d !== null && (s.return_5d ?? 0) > 0).length;
  const total5d = newSignals.filter((s) => s.return_5d !== null).length || 1;

  const win10d = newSignals.filter((s) => s.return_10d !== null && (s.return_10d ?? 0) > 0).length;
  const total10d = newSignals.filter((s) => s.return_10d !== null).length || 1;

  const win20d = completedSignals.filter((s) => (s.return_20d ?? 0) > 0).length;
  const avg20d = completedSignals.reduce((sum, s) => sum + (s.return_20d ?? 0), 0) / nCompleted;

  // 6. Record scan run log for traceability
  const runLog: ScanRunLog = {
    run_id: `run-backfill-${Date.now()}`,
    status: 'SUCCESS',
    started_at: new Date().toISOString(),
    finished_at: new Date().toISOString(),
    watchlist_count: targetTickers.length,
    evaluated_count: targetTickers.length,
    signal_count: newSignals.length,
    failure_count: 0,
    failed_tickers: [],
    error_summary: `과거 ${range} 일별 백필 및 사후 수익률 인제스천 완료 (${newSignals.length}개 시그널 생성, 20D 승률 ${(win20d / nCompleted * 100).toFixed(1)}%)`,
  };

  await scanRunRepository.save(runLog);

  return {
    success: true,
    totalTickers: targetTickers.length,
    totalBarsIngested,
    totalSignalsGenerated: newSignals.length,
    completedSignals: completedSignals.length,
    winRate5d: Math.round((win5d / total5d) * 1000) / 10,
    winRate10d: Math.round((win10d / total10d) * 1000) / 10,
    winRate20d: Math.round((win20d / nCompleted) * 1000) / 10,
    avgReturn20d: Math.round(avg20d * 10) / 10,
    dateRange: {
      start: minDate !== '9999-99-99' ? minDate : '2025-01-01',
      end: maxDate !== '0000-00-00' ? maxDate : new Date().toISOString().split('T')[0],
    },
    detailsByTicker,
  };
}
