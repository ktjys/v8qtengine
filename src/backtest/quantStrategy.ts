import { OHLCVBar } from '../data/providers/types';
import { calculateTechnicalIndicators } from '../data/indicators/technicalIndicators';
import { calculateMomentumIndicators } from '../data/indicators/momentumIndicators';
import { CalculatedFundamentalIndicators } from '../data/indicators/fundamentalIndicators';
import { classifyAsset, RawYahooMetadata } from '../engine/classificationEngine';
import { RawMarketIndicators } from '../engine/opportunityEngine';
import { RawRiskInputs } from '../engine/riskEngine';
import { MarketSnapshot, EvaluationInput, evaluateV8 } from '../engine/evaluateV8';
import { DataProvenance } from '../engine/dataQualityGate';
import { AssetClassification, DataQualityReport, DecisionType, RiskLevel, StrategyType } from '../types/v8';

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

/**
 * 분류 입력 오버라이드. Daily Score History 등 풍부한 메타데이터(섹터/수동 오버라이드)를
 * 공통 `evaluateV8` 경로로 전달할 때 사용한다. 미지정 시 기본값(beta + 고정 marketCap) 사용.
 */
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
  fundamentals?: CalculatedFundamentalIndicators
): EvaluationInput {
  const tech = calculateTechnicalIndicators(barsSlice);
  const mom = calculateMomentumIndicators(barsSlice, benchmarkSlice);

  // 평가 시점 = PIT 슬라이스 마지막 봉의 날짜 (분자/분모 시점 고정)
  const lastBar = barsSlice[barsSlice.length - 1];
  const evaluationAt = lastBar?.date ? new Date(lastBar.date) : new Date();

  // 1. Classification (Point-in-Time 고정 입력). 오버라이드가 있으면 그것을 사용하고,
  //    없으면 beta + 고정 marketCap 기본값으로 분류한다.
  const classificationResult = classification?.raw
    ? classifyAsset(ticker, classification.raw, classification.existing)
    : classifyAsset(ticker, { beta: mom.beta, marketCap: 50_000_000_000 });

  // 2. Market snapshot — fundamental/valuation 입력은 Point-in-Time 오버라이드가 있으면 사용
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
    marketCapBillions: fundamentals?.marketCapBillions ?? 50,
    revenueGrowthYoy: fundamentals?.revenueGrowthYoy,
    earningsGrowthYoy: fundamentals?.earningsGrowthYoy,
    operatingMargin: fundamentals?.operatingMargin,
    freeCashFlowMargin: fundamentals?.freeCashFlowMargin,
    trailingPe: fundamentals?.trailingPe,
    forwardPe: fundamentals?.forwardPe,
    psRatio: fundamentals?.psRatio,
    pegRatio: fundamentals?.pegRatio,
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
