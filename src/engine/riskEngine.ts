import {
  AssetClassification,
  RiskComponents,
  RiskEvaluation,
  RiskLevel,
} from '../types/v8';
import { RISK_CONFIG } from '../config/engineConstants';

export interface RawRiskInputs {
  beta: number;
  volatility20dAnnualized: number; // e.g. 0.28 (28%)
  volatility60dAnnualized?: number; // e.g. 0.32
  maxDrawdown52w: number; // e.g. -0.22 (-22%)
  rsi14: number;
  priceBelowMa200: boolean;
  missingDataPoints?: number;
}

export function calculateRisk(
  classification: AssetClassification,
  inputs: RawRiskInputs
): RiskEvaluation {
  const C = RISK_CONFIG;
  let riskScore = C.BASE_RISK_SCORE; // Baseline
  const reasons: string[] = [];

  const beta = inputs.beta ?? 1.0;
  const vol20 = inputs.volatility20dAnnualized;
  const mdd = inputs.maxDrawdown52w;
  const isSpeculative = classification.strategy_type === 'speculative';

  // 1. Beta Constraint
  if (beta > C.BETA_EXTREME) {
    riskScore += C.BETA_EXTREME_PENALTY;
    reasons.push(`초고베타(Beta ${beta.toFixed(2)})로 시장 충격 시 하방 변동성 극대화`);
  } else if (beta > C.BETA_HIGH) {
    riskScore += C.BETA_HIGH_PENALTY;
    reasons.push(`고베타(Beta ${beta.toFixed(2)}) 시장 대비 민감한 주가 변동`);
  } else if (beta < C.BETA_LOW) {
    riskScore += C.BETA_LOW_BONUS;
  }

  // 2. Volatility Constraint (Annualized)
  if (vol20 > C.VOL_EXTREME) {
    riskScore += C.VOL_EXTREME_PENALTY;
    reasons.push(`20일 연환산 변동성 ${(vol20 * 100).toFixed(1)}%로 극단적 가격 흔들림`);
  } else if (vol20 > C.VOL_HIGH) {
    riskScore += C.VOL_HIGH_PENALTY;
    reasons.push(`단기 변동성 ${(vol20 * 100).toFixed(1)}%로 경계 필요`);
  } else if (vol20 < C.VOL_LOW) {
    riskScore += C.VOL_LOW_BONUS;
  }

  // 3. 52-Week Max Drawdown
  if (mdd < C.MDD_SEVERE) {
    riskScore += C.MDD_SEVERE_PENALTY;
    reasons.push(`52주 고점 대비 ${(mdd * 100).toFixed(1)}% 낙폭으로 추세 손상 위험`);
  } else if (mdd < C.MDD_MODERATE) {
    riskScore += C.MDD_MODERATE_PENALTY;
    reasons.push(`중기 낙폭 ${(mdd * 100).toFixed(1)}%로 반등 지지선 확인 필요`);
  }

  // 4. Asset Strategy Penalty
  if (isSpeculative) {
    riskScore += C.SPECULATIVE_PENALTY;
    reasons.push(`투기/고변동성(Speculative) 자산군으로 기본 리스크 가산 적용`);
  }

  // 5. Technical Instability (Price below 200MA or RSI extreme)
  let technicalInstabilityScore = C.TECH_INSTABILITY_BASE;
  if (inputs.priceBelowMa200) {
    riskScore += C.PRICE_BELOW_MA200_PENALTY;
    technicalInstabilityScore += C.PRICE_BELOW_MA200_INSTABILITY_BONUS;
    reasons.push(`200일 장기 이동평균선 하회로 장기 하락 추세 위험`);
  }
  if (inputs.rsi14 > C.RSI_OVERBOUGHT_THRESHOLD) {
    riskScore += C.RSI_OVERBOUGHT_PENALTY;
    technicalInstabilityScore += C.RSI_OVERBOUGHT_INSTABILITY_BONUS;
    reasons.push(`RSI 14 (${inputs.rsi14.toFixed(1)}) 과매수 영역 진입`);
  }

  // 6. Data Uncertainty
  let dataUncertaintyScore = C.DATA_UNCERTAINTY_BASE;
  if (inputs.missingDataPoints && inputs.missingDataPoints > 0) {
    riskScore += inputs.missingDataPoints * C.MISSING_DATA_POINT_PENALTY;
    dataUncertaintyScore += C.MISSING_DATA_UNCERTAINTY_BONUS;
    reasons.push(`재무/가격 데이터 일부 누락으로 인한 불확실성 패널티`);
  }

  const finalRiskScore = Math.max(C.MIN_RISK_SCORE, Math.min(C.MAX_RISK_SCORE, Math.round(riskScore)));

  // Determine Level: LOW (< 42), MEDIUM (42 ~ 64), HIGH (>= 65)
  let risk_level: RiskLevel = 'LOW';
  if (finalRiskScore >= C.RISK_LEVEL_HIGH_THRESHOLD) {
    risk_level = 'HIGH';
  } else if (finalRiskScore >= C.RISK_LEVEL_MEDIUM_THRESHOLD) {
    risk_level = 'MEDIUM';
  } else {
    risk_level = 'LOW';
  }

  if (reasons.length === 0) {
    reasons.push('변동성 및 베타가 안정적이며 기술적 지지선 유지 중');
  }

  const components: RiskComponents = {
    beta: Math.round(beta * 100) / 100,
    volatility20dAnnualized: Math.round(vol20 * 1000) / 10,
    maxDrawdown52w: Math.round(mdd * 1000) / 10,
    isSpeculative,
    technicalInstabilityScore,
    dataUncertaintyScore,
  };

  return {
    risk_score: finalRiskScore,
    risk_level,
    components,
    risk_reasons: reasons,
  };
}
