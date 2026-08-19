import { OHLCVBar } from '../data/providers/types';
import { calculateTechnicalIndicators } from '../data/indicators/technicalIndicators';
import { calculateMomentumIndicators } from '../data/indicators/momentumIndicators';
import { classifyAsset } from '../engine/classificationEngine';
import { calculateOpportunity, RawMarketIndicators } from '../engine/opportunityEngine';
import { calculateRisk, RawRiskInputs } from '../engine/riskEngine';
import { makeDecision } from '../engine/decisionEngine';
import { DecisionType, RiskLevel, StrategyType } from '../types/v8';

export interface V8EvaluationResult {
  isSignal: boolean;
  opportunityScore: number;
  riskScore: number;
  riskLevel: RiskLevel;
  strategyType: StrategyType;
  decision: DecisionType;
  confidence: number;
  reason: string;
}

export function evaluateV8Strategy(
  ticker: string,
  barsSlice: OHLCVBar[],
  benchmarkSlice?: OHLCVBar[],
  opportunityThreshold = 70
): V8EvaluationResult {
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

  // 1. Classification
  const classification = classifyAsset(ticker, {
    beta: mom.beta,
    marketCap: 50_000_000_000,
  });

  // 2. Indicators
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

  // 3. Opportunity & Risk
  const opportunity = calculateOpportunity(classification, indicators);
  const risk = calculateRisk(classification, riskInputs);

  // 4. Decision
  const decision = makeDecision(classification, opportunity, risk);

  const isSignal = decision.actionable && opportunity.opportunity_score >= opportunityThreshold;

  return {
    isSignal,
    opportunityScore: opportunity.opportunity_score,
    riskScore: risk.risk_score,
    riskLevel: risk.risk_level,
    strategyType: classification.strategy_type,
    decision: decision.decision,
    confidence: decision.confidence,
    reason: decision.reason,
  };
}
