import {
  AssetClassification,
  DecisionEvaluation,
  DecisionType,
  OpportunityEvaluation,
  RiskEvaluation,
} from '../types/v8';

export function makeDecision(
  classification: AssetClassification,
  opportunity: OpportunityEvaluation,
  risk: RiskEvaluation
): DecisionEvaluation {
  const oppScore = opportunity.opportunity_score;
  const riskLevel = risk.risk_level;
  const riskScore = risk.risk_score;
  const strategy = classification.strategy_type;
  const classConfidence = classification.confidence;

  // Signal confidence is a mixture of classification certainty and score strength
  let signalConfidence = classConfidence * 0.5 + (1 - riskScore / 150) * 0.5;
  signalConfidence = Math.max(0.3, Math.min(0.98, Math.round(signalConfidence * 100) / 100));

  let decision: DecisionType = 'NEUTRAL';
  let reason = '';
  let actionable = false;
  let threshold_met = false;

  // Decision Tree by Asset Strategy and Independent Risk Constraints
  if (strategy === 'speculative') {
    // Speculative stocks have strict threshold & require extreme opportunity
    if (oppScore >= 82 && riskLevel !== 'HIGH') {
      decision = 'OPPORTUNITY';
      actionable = true;
      threshold_met = true;
      reason = `투기형 종목이나 모멘텀/기술적 조건이 극도로 강력하고 단기 리스크가 통제됨 (점수: ${oppScore})`;
    } else if (oppScore >= 70 && riskLevel === 'HIGH') {
      decision = 'WATCH';
      actionable = false;
      threshold_met = false;
      reason = `기회 점수는 ${oppScore}점으로 높으나 고위험(HIGH RISK, 리스크점수 ${riskScore})으로 신호 진입 보류 및 관찰`;
    } else if (oppScore >= 58) {
      decision = 'WATCH';
      reason = `단기 변동성 추적 중이나 추가적인 추세 확증 대기`;
    } else {
      decision = 'AVOID';
      reason = `투기형 자산의 높은 리스크 대비 기회 점수(${oppScore}) 미흡으로 진입 부적합`;
    }
  } else if (strategy === 'established_growth' || strategy === 'quality') {
    // Established Growth & Quality Equities
    if (oppScore >= 76 && (riskLevel === 'LOW' || riskLevel === 'MEDIUM')) {
      decision = 'STRONG_OPPORTUNITY';
      actionable = true;
      threshold_met = true;
      reason = `우수한 펀더멘털 및 기술적 추세 결합, 제어 가능한 리스크(${riskLevel}) 상태의 강력한 기회`;
    } else if (oppScore >= 68 && riskLevel !== 'HIGH') {
      decision = 'OPPORTUNITY';
      actionable = true;
      threshold_met = true;
      reason = `충분한 기회 점수(${oppScore})와 안정적 리스크 프로파일 만족`;
    } else if (oppScore >= 70 && riskLevel === 'HIGH') {
      decision = 'WATCH';
      reason = `기회 점수(${oppScore})는 충분하나 단기 과열 또는 변동성 급증(HIGH RISK)으로 인한 보류`;
    } else if (oppScore >= 55) {
      decision = 'WATCH';
      reason = `중립 이상의 모멘텀 유지 중이나 주요 저항선/조정 완료 확인 필요`;
    } else {
      decision = oppScore < 45 ? 'AVOID' : 'NEUTRAL';
      reason = `모멘텀 둔화 또는 밸류에이션 부담`;
    }
  } else {
    // ETFs (broad_market_etf, dividend_etf, growth_etf, sector_etf, etc.)
    if (oppScore >= 72 && riskLevel === 'LOW') {
      decision = 'STRONG_OPPORTUNITY';
      actionable = true;
      threshold_met = true;
      reason = `지수/섹터 ETF의 낮은 리스크(LOW)와 강력한 추세/풀백 반등 모멘텀(${oppScore}점) 포착`;
    } else if (oppScore >= 64 && riskLevel !== 'HIGH') {
      decision = 'OPPORTUNITY';
      actionable = true;
      threshold_met = true;
      reason = `ETF 추세 정배열 및 모멘텀 유효로 매수/편입 관점 접근 가능`;
    } else if (oppScore >= 52) {
      decision = 'WATCH';
      reason = `시장 흐름 추종 중이며 주요 이평선 지지력 테스트 단계`;
    } else {
      decision = 'NEUTRAL';
      reason = `지수 횡보 또는 단기 모멘텀 부재 구간`;
    }
  }

  return {
    decision,
    opportunity_score: oppScore,
    confidence: signalConfidence,
    reason,
    actionable,
    threshold_met,
  };
}
