import {
  AssetClassification,
  DataQualityReport,
  DecisionEvaluation,
  DecisionType,
  OpportunityEvaluation,
  RiskEvaluation,
} from '../types/v8';
import { calculateOpportunity, RawMarketIndicators } from './opportunityEngine';
import { calculateRisk, RawRiskInputs } from './riskEngine';
import { makeDecision } from './decisionEngine';
import { isSignalEligible, DataProvenance } from './dataQualityGate';

/**
 * Point-in-Time 마켓 스냅샷.
 *
 * 이미 계산된 기술적/모멘텀 지표와 리스크 입력을 담는다.
 * 이 스냅샷은 '평가 시점' 기준으로 고정되어야 하며,
 * 이후 public 데이터로 변경되면 안 된다 (Phase 3 PIT 계약).
 */
export interface MarketSnapshot {
  /** 평가 시점 기준 가격 (와이어 로직에 사용할 close/quote) */
  price: number;
  change1d: number;
  /** opportunityEngine 입력용 기술/모멘텀/펀더멘털/밸류 지표 */
  indicators: RawMarketIndicators;
  /** riskEngine 입력용 리스크 입력 */
  riskInputs: RawRiskInputs;
}

/**
 * 펀더멘털 스냅샷 (선택). 시점 고정을 위해 asOf/published 정보를 함께 담는다.
 * Phase 3에서 PIT 계약으로 강화된다.
 */
export interface FundamentalSnapshot {
  hasFundamentals: boolean;
  asOfDate?: string | null;
}

/**
 * 분류 스냅샷. 평가 시점의 자산 분류를 그대로 보존한다.
 */
export type ClassificationSnapshot = AssetClassification;

export interface EvaluationInput {
  ticker: string;
  evaluationAt: Date;
  market: MarketSnapshot;
  fundamentals?: FundamentalSnapshot;
  classification: ClassificationSnapshot;
  /** 데이터 출처 및 품질. 신호 생성 게이트에 사용된다. */
  dataQuality?: DataQualityReport | null;
  provenance?: DataProvenance;
}

/**
 * evaluateV8() 의 결정적 출력.
 * 라이브(Live)와 백테스트(Backtest)가 동일하게 이 함수를 사용한다.
 */
export interface V8Evaluation {
  ticker: string;
  evaluationAt: Date;
  engineVersion: string;
  classification: ClassificationSnapshot;
  opportunity: OpportunityEvaluation;
  risk: RiskEvaluation;
  decision: DecisionEvaluation;
  /** decision.actionable && score threshold 충족 시 true (시그널 후보 여부) */
  isSignal: boolean;
}

export const ENGINE_VERSION = 'V8.1';

/**
 * 데코레이터 없이 동일 로직을 입력만으로 판단하는 순수 평가 함수.
 *
 * - 외부 I/O(Yahoo/Supabase/Seed/DB)를 하지 않는다.
 * - 동일 input → 항상 동일 output을 보장한다 (결정성).
 * - opportunityEngine / riskEngine / decisionEngine 로직을 그대로 사용한다.
 *
 * @param input 평가에 필요한 모든 스냅샷 입력
 * @returns 결정적 평가 결과
 */
export function evaluateV8(input: EvaluationInput): V8Evaluation {
  const { ticker, evaluationAt, market, classification } = input;

  // 1. Opportunity Engine (순수)
  const opportunity = calculateOpportunity(classification, market.indicators);

  // 2. Risk Engine (순수)
  const risk = calculateRisk(classification, market.riskInputs);

  // 3. Decision Engine (순수)
  const decision = makeDecision(classification, opportunity, risk);

  // 4. Data Quality Gate: 불량/폴백 데이터는 신호 후보에서 제외
  const eligible = isSignalEligible(
    input.provenance || { source: 'unknown', isFallback: false },
    input.dataQuality
  );

  // Signal 후보 = actionable && 기회 점수 >= 기본 신호 문턱(70) && 데이터 품질 게이트 통과
  // (문턱값은 호출부에서 조정 가능하도록 기본값 사용)
  const isSignal =
    eligible && decision.actionable && opportunity.opportunity_score >= 70;

  return {
    ticker,
    evaluationAt,
    engineVersion: ENGINE_VERSION,
    classification,
    opportunity,
    risk,
    decision,
    isSignal,
  };
}
