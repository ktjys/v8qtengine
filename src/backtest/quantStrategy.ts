import { OHLCVBar } from '../data/providers/types';
import { calculateTechnicalIndicators } from '../data/indicators/technicalIndicators';
import { calculateMomentumIndicators } from '../data/indicators/momentumIndicators';
import { classifyAsset } from '../engine/classificationEngine';
import { RawMarketIndicators } from '../engine/opportunityEngine';
import { RawRiskInputs } from '../engine/riskEngine';
import { evaluateV8, MarketSnapshot } from '../engine/evaluateV8';
import { DecisionType, RiskLevel, StrategyType } from '../types/v8';

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
 * 백테스트 공용 평가 코어.
 *
 * 주어진 Point-in-Time 봉 슬라이스에 대해 기술/모멘텀 지표를 계산하고,
 * 자산 분류를 수행한 뒤 순수 함수 `evaluateV8()`에 입력을 구성해 넘긴다.
 *
 * - 라이브(evaluationService)와 동일한 `evaluateV8()`을 사용하므로
 *   동일 입력에 대해 동일 출력이 보장된다 (결정성).
 * - 외부 I/O(DB/Yahoo/Seed)를 하지 않는다.
 */
export function evaluateStrategy(
  ticker: string,
  barsSlice: OHLCVBar[],
  benchmarkSlice?: OHLCVBar[],
  opportunityThreshold = 70
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

  const tech = calculateTechnicalIndicators(barsSlice);
  const mom = calculateMomentumIndicators(barsSlice, benchmarkSlice);

  // 평가 시점 = PIT 슬라이스 마지막 봉의 날짜 (분자/분모 시점 고정)
  const lastBar = barsSlice[barsSlice.length - 1];
  const evaluationAt = lastBar?.date ? new Date(lastBar.date) : new Date();

  // 1. Classification
  const classification = classifyAsset(ticker, {
    beta: mom.beta,
    marketCap: 50_000_000_000,
  });

  // 2. Market snapshot (Point-in-Time 고정 입력)
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
    marketCapBillions: 50,
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
    change1d: tech.price > 0 ? 0 : 0,
    indicators,
    riskInputs,
  };

  // 3. 단일 순수 평가 함수 사용
  const evaluation = evaluateV8({
    ticker,
    evaluationAt: new Date(0), // 백테스트는 시점 무관(순수 계산). 필요 시 slice 마지막 날짜 주입.
    market,
    classification,
  });

  const isSignal = evaluation.decision.actionable && evaluation.opportunity.opportunity_score >= opportunityThreshold;

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
