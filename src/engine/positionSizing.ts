import { V8Evaluation } from './evaluateV8';
import { RiskLevel } from '../types/v8';

export interface PositionSizingResult {
  /** 최종 포지션 비중 (포트폴리오 대비 %, 0~MAX_POSITION_PCT) */
  position_size_pct: number;
  /** 순수 Kelly 분수 */
  kelly_fraction: number;
  /** 적용된 fractional Kelly 배수 (안전하게 일부만 사용) */
  fractional_kelly: number;
  /** 추정 승률 (0~1) */
  win_probability: number;
  /** 승/패 배당 비율 (payoff ratio) */
  payoff_ratio: number;
  /** 리스크 레벨 기반 규모 제한 배수 (0~1) */
  risk_cap: number;
  /** 신호 신뢰도 배수 (0~1) */
  confidence_multiplier: number;
  /** 변동성 감쇠 배수 (0~1) */
  volatility_dampener: number;
}

/** 기본 Kelly 정치: 가정 배당 비율 (보수적 2:1) */
const DEFAULT_PAYOFF_RATIO = 2.0;
/** 최대 포지션 비중 (%) */
const MAX_POSITION_PCT = 10;
/** fractional Kelly 배수 (과베팅 방지) */
const FRACTIONAL_KELLY = 0.5;
/** 변동성 기준치 (연율화 기준, 감쇠 시작) */
const VOLATILITY_BASELINE = 0.30;
/** 변동성 임계값 (이상이면 0으로 감쇠) */
const VOLATILITY_CAP = 0.80;

/** 리스크 레벨별 최대 크기 배수 */
const RISK_CAP_BY_LEVEL: Record<RiskLevel, number> = {
  LOW: 1.0,
  MEDIUM: 0.5,
  HIGH: 0.0,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * 리스크 레벨 + Kelly 공식 기반 동적 포지션 사이징.
 * evaluateV8() 출력만으로 순수 계산한다 (외부 I/O 없음).
 *
 * Kelly 분수 f* = p - (1-p)/b 에서
 * - p (승률): 신호 신뢰도(decision.confidence)와 기회 점수를 보수적으로 결합
 * - b (배당): 승/패 배당 비율 (기본 2:1 가정)
 * 이후 fractional Kelly + 리스크 레벨 캡 + 변동성 감쇠를 곱해 최종 비중을 산출한다.
 */
export function calculatePositionSizing(evaluation: V8Evaluation): PositionSizingResult {
  const { decision, opportunity, risk } = evaluation;

  // 1. 승률: 신뢰도와 기회 점수를 보수적으로 결합 (0.5 쪽으로 편향)
  const opportunityProb = opportunity.opportunity_score / 100;
  const winProbability = clamp(
    decision.confidence * 0.7 + opportunityProb * 0.3,
    0,
    0.95
  );

  // 2. 배당 비율: 모멘텀 상승폭과 낙폭으로부터 추정 (개선 시 가정값 대체)
  const momentumEdge = Math.max(
    opportunity.momentum_details.return3M,
    opportunity.momentum_details.return6M,
    0
  );
  const drawdownMagnitude = Math.abs(risk.components.maxDrawdown52w);
  const payoffRatio =
    drawdownMagnitude > 0.02
      ? clamp(1 + (momentumEdge / drawdownMagnitude) * 0.5, 1, DEFAULT_PAYOFF_RATIO)
      : DEFAULT_PAYOFF_RATIO;

  // 3. Kelly 분수
  const kellyFraction = winProbability - (1 - winProbability) / payoffRatio;

  // 4. fractional Kelly + 리스크 레벨 캡
  const riskCap = RISK_CAP_BY_LEVEL[risk.risk_level] ?? 0;

  // 5. 변동성 감쇠: 높은 변동성일수록 비중 축소
  const vol = risk.components.volatility20dAnnualized / 100;
  const volatilityDampener =
    vol <= VOLATILITY_BASELINE
      ? 1
      : clamp(1 - (vol - VOLATILITY_BASELINE) / (VOLATILITY_CAP - VOLATILITY_BASELINE), 0, 1);

  const confidenceMultiplier = decision.confidence;

  const positionPct =
    MAX_POSITION_PCT *
    Math.max(0, kellyFraction) *
    FRACTIONAL_KELLY *
    riskCap *
    volatilityDampener *
    confidenceMultiplier;

  return {
    position_size_pct: Math.round(positionPct * 100) / 100,
    kelly_fraction: Math.round(kellyFraction * 1000) / 1000,
    fractional_kelly: FRACTIONAL_KELLY,
    win_probability: Math.round(winProbability * 1000) / 1000,
    payoff_ratio: Math.round(payoffRatio * 1000) / 1000,
    risk_cap: riskCap,
    confidence_multiplier: Math.round(confidenceMultiplier * 1000) / 1000,
    volatility_dampener: Math.round(volatilityDampener * 1000) / 1000,
  };
}
