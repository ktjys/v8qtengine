import { OHLCVBar } from '../data/providers/types';
import { calculateTechnicalIndicators } from '../data/indicators/technicalIndicators';
import { calculateMomentumIndicators } from '../data/indicators/momentumIndicators';
import { CalculatedFundamentalIndicators, extractFundamentalIndicators } from '../data/indicators/fundamentalIndicators';
import { classifyAsset, RawYahooMetadata } from '../engine/classificationEngine';
import { RawMarketIndicators } from '../engine/opportunityEngine';
import { RawRiskInputs } from '../engine/riskEngine';
import { MarketSnapshot, EvaluationInput, evaluateV8 } from '../engine/evaluateV8';
import { DataProvenance } from '../engine/dataQualityGate';
import { AssetClassification, DataQualityReport, DecisionType, RiskLevel, StrategyType } from '../types/v8';
import { FundamentalsRecord } from '../db/repositories/fundamentalsRepository';

export interface StrategyEvaluationResult {
  isSignal: boolean;
  opportunityScore: number;
  riskScore: number;
  riskLevel: RiskLevel;
  strategyType: StrategyType;
  decision: DecisionType;
  confidence: number;
  reason: string;
}

export interface ClassificationInputs {
  raw?: RawYahooMetadata;
  existing?: AssetClassification;
}

/**
 * 백테스트 공용 입력 빌더.
 *
 * 주어진 Point-in-Time 봉 슬라이스를 기술/모멘텀 지표로 계산하고, 자산 분류를
 * 수행한 뒤 순수 함수 `evaluateV8()`의 `EvaluationInput`을 구성한다.
 *
 * - 평가 시점(`evaluationAt`)은 반드시 PIT 슬라이스의 마지막 봉 날짜로 고정한다.
 *   (분자/분모 시점을 추론 시점으로 일치시켜 미래 참조를 방지)
 * - `provenance.isFallback`이 true(Seed 폴백)면 `evaluateV8`의 데이터 품질
 *   게이트가 해당 평가를 신호 후보에서 제외한다 → Seed로 성과를 만들지 않음.
 * - 외부 I/O(DB/Yahoo/Seed)를 하지 않는 순수 빌더다.
 */
export function buildEvaluationInput(
  ticker: string,
  barsSlice: OHLCVBar[],
  benchmarkSlice?: OHLCVBar[],
  signalThreshold?: number,
  provenance?: DataProvenance,
  dataQuality?: DataQualityReport | null,
  classification?: ClassificationInputs,
  fundamentals?: CalculatedFundamentalIndicators | FundamentalsRecord | null,
  isEtfHint?: boolean
): EvaluationInput {
  const tech = calculateTechnicalIndicators(barsSlice);
  const mom = calculateMomentumIndicators(barsSlice, benchmarkSlice);

  const lastBar = barsSlice[barsSlice.length - 1];
  const evaluationAt = lastBar?.date ? new Date(lastBar.date) : new Date();

  // Classification override가 있으면 PIT marketCap/sector/industry를 반영하되,
  // beta는 부재 시 이 PIT 슬라이스에서 계산한 모멘텀 beta로 보정한다.
  const classificationResult = classification?.raw
    ? classifyAsset(
        ticker,
        { ...classification.raw, beta: classification.raw.beta ?? mom.beta },
        classification.existing
      )
    : classifyAsset(ticker, { beta: mom.beta, marketCap: 50_000_000_000 });

  const fundInd =
    fundamentals && 'as_of_date' in fundamentals
      ? extractFundamentalIndicators({
          ticker,
          asOfDate: fundamentals.as_of_date!,
          marketCap: fundamentals.market_cap!,
          revenueGrowthYoy: fundamentals.revenue_growth,
          earningsGrowthYoy: fundamentals.eps_growth,
          operatingMargin: fundamentals.operating_margin,
          freeCashFlowMargin: fundamentals.fcf_margin,
          trailingPe: fundamentals.trailing_pe,
          forwardPe: fundamentals.forward_pe,
          psRatio: fundamentals.ps_ratio,
          pegRatio: fundamentals.peg_ratio,
          quoteType: isEtfHint ? 'ETF' : 'EQUITY',
        }, isEtfHint ?? false)
      : fundamentals
        ? (fundamentals as CalculatedFundamentalIndicators)
        : undefined;

  const indicators: RawMarketIndicators = {
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
    marketCapBillions: fundInd?.marketCapBillions ?? 50,
    revenueGrowthYoy: fundInd?.revenueGrowthYoy,
    earningsGrowthYoy: fundInd?.earningsGrowthYoy,
    operatingMargin: fundInd?.operatingMargin,
    freeCashFlowMargin: fundInd?.freeCashFlowMargin,
    trailingPe: fundInd?.trailingPe,
    forwardPe: fundInd?.forwardPe,
    psRatio: fundInd?.psRatio,
    pegRatio: fundInd?.pegRatio,
  };

  const riskInputs: RawRiskInputs = {
    beta: mom.beta,
    volatility20dAnnualized: mom.volatility20dAnnualized,
    maxDrawdown52w: tech.drawdownFromHigh,
    rsi14: tech.rsi14,
    priceBelowMa200: tech.priceBelowMa200,
    missingDataPoints: barsSlice.length < 200 ? 1 : 0,
  };

  const market: MarketSnapshot = {
    price: tech.price,
    change1d: 0,
    indicators,
    riskInputs,
  };

  return {
    ticker,
    evaluationAt,
    market,
    classification: classificationResult,
    signalThreshold,
    provenance: provenance || { source: 'backtest', isFallback: false },
    dataQuality,
  };
}

/**
 * 백테스트 호환 래퍼. `buildEvaluationInput()`으로 입력을 구성하고
 * 단일 순수 함수 `evaluateV8()`을 호출한다 (backfillEngine/v8Strategy 호환용).
 */
export function evaluateStrategy(
  ticker: string,
  barsSlice: OHLCVBar[],
  benchmarkSlice?: OHLCVBar[],
  opportunityThreshold = 70,
  provenance?: DataProvenance,
  dataQuality?: DataQualityReport | null
): StrategyEvaluationResult {
  if (barsSlice.length < 50) {
    return {
      isSignal: false,
      opportunityScore: 0,
      riskScore: 50,
      riskLevel: 'MEDIUM',
      strategyType: 'general_equity',
      decision: 'AVOID',
      confidence: 0,
      reason: 'Insufficient bars',
    };
  }

  const evaluation = evaluateV8(
    buildEvaluationInput(ticker, barsSlice, benchmarkSlice, opportunityThreshold, provenance, dataQuality)
  );

  const isSignal = evaluation.isSignal;

  return {
    isSignal,
    opportunityScore: evaluation.opportunity.opportunity_score,
    riskScore: evaluation.risk.risk_score,
    riskLevel: evaluation.risk.risk_level,
    strategyType: evaluation.classification.strategy_type,
    decision: evaluation.decision.decision,
    confidence: evaluation.decision.confidence,
    reason: evaluation.decision.reason,
  };
}
