import { OHLCVBar } from '../data/providers/types';
import { historicalDataProvider } from '../backtest/historicalDataProvider';
import { calculateTechnicalIndicators } from '../data/indicators/technicalIndicators';
import { calculateMomentumIndicators } from '../data/indicators/momentumIndicators';
import { extractFundamentalIndicators } from '../data/indicators/fundamentalIndicators';
import { classifyAsset } from '../engine/classificationEngine';
import { calculateOpportunity, RawMarketIndicators } from '../engine/opportunityEngine';
import { calculateRisk, RawRiskInputs } from '../engine/riskEngine';
import { makeDecision } from '../engine/decisionEngine';
import { dbClient } from '../db/supabaseClient';
import { fundamentalsRepository } from '../db/repositories/fundamentalsRepository';
import { assetRepository } from '../db/repositories/assetRepository';
import { DecisionType, RiskLevel, StrategyType } from '../types/v8';

export interface DailyScorePoint {
  date: string;
  price: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  changePercent: number;
  ma20: number;
  ma50: number;
  ma200: number;
  rsi14: number;
  macd: number;
  macdSignal: number;
  macdHist: number;
  drawdownFromHigh: number; // in %
  opportunityScore: number;
  technicalScore: number;
  momentumScore: number;
  fundamentalScore: number | null;
  valuationScore: number | null;
  riskScore: number;
  riskLevel: RiskLevel;
  strategyType: StrategyType;
  decision: DecisionType;
  isSignal: boolean;
  decisionReason: string;
}

export interface SymbolScoreHistorySummary {
  ticker: string;
  currentPrice: number;
  currentScore: number;
  score30dAgo: number;
  scoreChange30d: number;
  highestScoreDate: string;
  highestScore: number;
  lowestScoreDate: string;
  lowestScore: number;
  totalSignalsInPeriod: number;
  currentRsi: number;
  rsiState: 'OVERSOLD' | 'HEALTHY_BUY' | 'NEUTRAL' | 'OVERBOUGHT';
  trendState: 'STRONG_BULL' | 'BULL' | 'CORRECTION' | 'BEAR';
}

export interface SymbolScoreHistoryResult {
  ticker: string;
  range: string;
  summary: SymbolScoreHistorySummary;
  history: DailyScorePoint[];
}

export class DailyScoreHistoryService {
  async getDailyScoreHistory(ticker: string, range = '1y'): Promise<SymbolScoreHistoryResult> {
    const cleanTicker = ticker.toUpperCase().trim();

    // 1. Fetch bars and benchmark bars
    const bars = await historicalDataProvider.getHistoricalBarsForTicker(cleanTicker, '2y');
    const benchmarkBars = await historicalDataProvider.getHistoricalBarsForTicker('SPY', '2y');

    if (!bars || bars.length < 30) {
      throw new Error(`[DailyScoreHistoryService] Insufficient market data for ticker ${cleanTicker}`);
    }

    // 2. Fetch fundamentals / metadata from DB if available
    const dbFund = await fundamentalsRepository.getLatest(cleanTicker);
    const dbAsset = await assetRepository.findByTicker(cleanTicker);
    const manualOverride = dbClient.classifications.get(cleanTicker);

    const isEtfHint = dbAsset?.asset_type === 'etf' || manualOverride?.asset_type === 'etf';
    const fundInd = extractFundamentalIndicators(
      dbFund
        ? {
            ticker: cleanTicker,
            asOfDate: dbFund.as_of_date,
            marketCap: dbFund.market_cap,
            revenueGrowthYoy: dbFund.revenue_growth,
            earningsGrowthYoy: dbFund.eps_growth,
            operatingMargin: dbFund.operating_margin,
            freeCashFlowMargin: dbFund.fcf_margin,
            trailingPe: dbFund.trailing_pe,
            forwardPe: dbFund.forward_pe,
            psRatio: dbFund.ps_ratio,
            pegRatio: dbFund.peg_ratio,
            quoteType: isEtfHint ? 'ETF' : 'EQUITY',
          }
        : undefined,
      isEtfHint
    );

    // 3. Determine start index based on range
    const now = new Date();
    let filterStartDate = '1970-01-01';
    if (range === '1m') {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 1);
      filterStartDate = d.toISOString().split('T')[0];
    } else if (range === '3m') {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 3);
      filterStartDate = d.toISOString().split('T')[0];
    } else if (range === '6m') {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 6);
      filterStartDate = d.toISOString().split('T')[0];
    } else if (range === '1y') {
      const d = new Date(now);
      d.setFullYear(d.getFullYear() - 1);
      filterStartDate = d.toISOString().split('T')[0];
    }

    // 4. Calculate day by day Point-in-Time metrics
    const allHistory: DailyScorePoint[] = [];

    // Warmup period requires at least 25 bars for indicators
    const startIndex = Math.max(25, 0);

    for (let i = startIndex; i < bars.length; i++) {
      const pitBars = bars.slice(0, i + 1);
      const pitBenchmark = benchmarkBars.length > 0 ? benchmarkBars.slice(0, Math.min(i + 1, benchmarkBars.length)) : undefined;
      const currentBar = bars[i];
      const prevBar = i > 0 ? bars[i - 1] : currentBar;

      const tech = calculateTechnicalIndicators(pitBars);
      const mom = calculateMomentumIndicators(pitBars, pitBenchmark);

      // Classification
      const classification = classifyAsset(
        cleanTicker,
        {
          quoteType: isEtfHint ? 'ETF' : 'EQUITY',
          beta: mom.beta || dbFund?.market_cap ? 1.0 : 1.0,
          marketCap: dbFund?.market_cap || 50_000_000_000,
          sector: dbAsset?.sector,
          industry: dbAsset?.industry,
        },
        manualOverride
      );

      // Raw Market Indicators
      const rawIndicators: RawMarketIndicators = {
        price: tech.price,
        ma20: tech.ma20,
        ma50: tech.ma50,
        ma200: tech.ma200,
        rsi14: tech.rsi14,
        drawdownFromHigh: tech.drawdownFromHigh,
        macdHistogramPositive: tech.macdHistogramPositive,
        return1M: mom.return1M,
        return3M: mom.return3M,
        return6M: mom.return6M,
        relativeStrengthVsSpy: mom.relativeStrengthVsSpy,
        revenueGrowthYoy: fundInd.revenueGrowthYoy,
        earningsGrowthYoy: fundInd.earningsGrowthYoy,
        operatingMargin: fundInd.operatingMargin,
        freeCashFlowMargin: fundInd.freeCashFlowMargin,
        marketCapBillions: fundInd.marketCapBillions,
        trailingPe: fundInd.trailingPe,
        forwardPe: fundInd.forwardPe,
        psRatio: fundInd.psRatio,
        pegRatio: fundInd.pegRatio,
      };

      // Raw Risk Inputs
      const rawRiskInputs: RawRiskInputs = {
        beta: mom.beta,
        volatility20dAnnualized: mom.volatility20dAnnualized,
        maxDrawdown52w: tech.drawdownFromHigh,
        rsi14: tech.rsi14,
        priceBelowMa200: tech.priceBelowMa200,
        missingDataPoints: pitBars.length < 200 ? 1 : 0,
      };

      // Engines
      const opportunity = calculateOpportunity(classification, rawIndicators);
      const risk = calculateRisk(classification, rawRiskInputs);
      const decision = makeDecision(classification, opportunity, risk);

      const changePct = prevBar.close > 0 ? ((currentBar.close - prevBar.close) / prevBar.close) * 100 : 0;
      const isSignal = decision.actionable && opportunity.opportunity_score >= 70;

      allHistory.push({
        date: currentBar.date,
        price: Math.round(currentBar.close * 100) / 100,
        open: Math.round(currentBar.open * 100) / 100,
        high: Math.round(currentBar.high * 100) / 100,
        low: Math.round(currentBar.low * 100) / 100,
        close: Math.round(currentBar.close * 100) / 100,
        volume: currentBar.volume,
        changePercent: Math.round(changePct * 100) / 100,
        ma20: Math.round(tech.ma20 * 100) / 100,
        ma50: Math.round(tech.ma50 * 100) / 100,
        ma200: Math.round(tech.ma200 * 100) / 100,
        rsi14: Math.round(tech.rsi14 * 10) / 10,
        macd: Math.round(tech.macd * 100) / 100,
        macdSignal: Math.round(tech.macdSignal * 100) / 100,
        macdHist: Math.round(tech.macdHistogram * 100) / 100,
        drawdownFromHigh: Math.round(tech.drawdownFromHigh * 1000) / 10, // e.g. -6.5%
        opportunityScore: opportunity.opportunity_score,
        technicalScore: opportunity.sub_scores.technical_score,
        momentumScore: opportunity.sub_scores.momentum_score,
        fundamentalScore: opportunity.sub_scores.fundamental_score,
        valuationScore: opportunity.sub_scores.valuation_score,
        riskScore: risk.risk_score,
        riskLevel: risk.risk_level,
        strategyType: classification.strategy_type,
        decision: decision.decision,
        isSignal,
        decisionReason: decision.reason,
      });
    }

    // Filter by selected range
    const filteredHistory = allHistory.filter((h) => h.date >= filterStartDate);
    const resultHistory = filteredHistory.length >= 10 ? filteredHistory : allHistory.slice(-30);

    // Compute Summary Insights
    const latest = resultHistory[resultHistory.length - 1];
    const index30d = Math.max(0, resultHistory.length - 22); // approx 22 trading days
    const point30d = resultHistory[index30d];

    let highest = resultHistory[0];
    let lowest = resultHistory[0];
    let signalCount = 0;

    for (const pt of resultHistory) {
      if (pt.opportunityScore > highest.opportunityScore) highest = pt;
      if (pt.opportunityScore < lowest.opportunityScore) lowest = pt;
      if (pt.isSignal) signalCount++;
    }

    let rsiState: SymbolScoreHistorySummary['rsiState'] = 'NEUTRAL';
    if (latest.rsi14 <= 35) rsiState = 'OVERSOLD';
    else if (latest.rsi14 <= 55 && latest.drawdownFromHigh <= -3) rsiState = 'HEALTHY_BUY';
    else if (latest.rsi14 >= 70) rsiState = 'OVERBOUGHT';

    let trendState: SymbolScoreHistorySummary['trendState'] = 'BEAR';
    if (latest.price >= latest.ma20 && latest.ma20 >= latest.ma50 && latest.ma50 >= latest.ma200) {
      trendState = 'STRONG_BULL';
    } else if (latest.price >= latest.ma50) {
      trendState = 'BULL';
    } else if (latest.price < latest.ma50 && latest.price >= latest.ma200) {
      trendState = 'CORRECTION';
    }

    const summary: SymbolScoreHistorySummary = {
      ticker: cleanTicker,
      currentPrice: latest.price,
      currentScore: latest.opportunityScore,
      score30dAgo: point30d.opportunityScore,
      scoreChange30d: latest.opportunityScore - point30d.opportunityScore,
      highestScoreDate: highest.date,
      highestScore: highest.opportunityScore,
      lowestScoreDate: lowest.date,
      lowestScore: lowest.opportunityScore,
      totalSignalsInPeriod: signalCount,
      currentRsi: latest.rsi14,
      rsiState,
      trendState,
    };

    return {
      ticker: cleanTicker,
      range,
      summary,
      history: resultHistory,
    };
  }
}

export const dailyScoreHistoryService = new DailyScoreHistoryService();
