import {
  AssetClassification,
  RiskComponents,
  RiskEvaluation,
  RiskLevel,
} from '../types/v8';

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
  let riskScore = 30; // Baseline
  const reasons: string[] = [];

  const beta = inputs.beta ?? 1.0;
  const vol20 = inputs.volatility20dAnnualized;
  const mdd = inputs.maxDrawdown52w;
  const isSpeculative = classification.strategy_type === 'speculative';

  // 1. Beta Constraint
  if (beta > 2.0) {
    riskScore += 24;
    reasons.push(`초고베타(Beta ${beta.toFixed(2)})로 시장 충격 시 하방 변동성 극대화`);
  } else if (beta > 1.4) {
    riskScore += 12;
    reasons.push(`고베타(Beta ${beta.toFixed(2)}) 시장 대비 민감한 주가 변동`);
  } else if (beta < 0.8) {
    riskScore -= 8;
  }

  // 2. Volatility Constraint (Annualized)
  if (vol20 > 0.60) {
    riskScore += 26;
    reasons.push(`20일 연환산 변동성 ${(vol20 * 100).toFixed(1)}%로 극단적 가격 흔들림`);
  } else if (vol20 > 0.40) {
    riskScore += 16;
    reasons.push(`단기 변동성 ${(vol20 * 100).toFixed(1)}%로 경계 필요`);
  } else if (vol20 < 0.18) {
    riskScore -= 6;
  }

  // 3. 52-Week Max Drawdown
  if (mdd < -0.40) {
    riskScore += 18;
    reasons.push(`52주 고점 대비 ${(mdd * 100).toFixed(1)}% 낙폭으로 추세 손상 위험`);
  } else if (mdd < -0.25) {
    riskScore += 10;
    reasons.push(`중기 낙폭 ${(mdd * 100).toFixed(1)}%로 반등 지지선 확인 필요`);
  }

  // 4. Asset Strategy Penalty
  if (isSpeculative) {
    riskScore += 20;
    reasons.push(`투기/고변동성(Speculative) 자산군으로 기본 리스크 가산 적용`);
  }

  // 5. Technical Instability (Price below 200MA or RSI extreme)
  let technicalInstabilityScore = 20;
  if (inputs.priceBelowMa200) {
    riskScore += 12;
    technicalInstabilityScore += 30;
    reasons.push(`200일 장기 이동평균선 하회로 장기 하락 추세 위험`);
  }
  if (inputs.rsi14 > 75) {
    riskScore += 8;
    technicalInstabilityScore += 20;
    reasons.push(`RSI 14 (${inputs.rsi14.toFixed(1)}) 과매수 영역 진입`);
  }

  // 6. Data Uncertainty
  let dataUncertaintyScore = 10;
  if (inputs.missingDataPoints && inputs.missingDataPoints > 0) {
    riskScore += inputs.missingDataPoints * 5;
    dataUncertaintyScore += 30;
    reasons.push(`재무/가격 데이터 일부 누락으로 인한 불확실성 패널티`);
  }

  const finalRiskScore = Math.max(10, Math.min(99, Math.round(riskScore)));

  // Determine Level: LOW (< 42), MEDIUM (42 ~ 64), HIGH (>= 65)
  let risk_level: RiskLevel = 'LOW';
  if (finalRiskScore >= 65) {
    risk_level = 'HIGH';
  } else if (finalRiskScore >= 42) {
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
