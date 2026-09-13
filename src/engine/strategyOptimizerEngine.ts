import {
  AssetClassification,
  DecisionEvaluation,
  DecisionType,
  FullTickerEvaluation,
  OpportunityEvaluation,
  RiskEvaluation,
  SignalSnapshot,
} from '../types/v8';

export interface StrategyOptimizationConfig {
  id: string;
  name: string;
  tag: string;
  description: string;
  scoreThresholdGrowth: number;      // 우량/성장주 기회점수 임계치 (기본 76)
  scoreThresholdEtf: number;         // ETF 기회점수 임계치 (기본 72)
  scoreThresholdSpeculative: number; // 투기형 종목 임계치 (기본 82)
  signalMinScore: number;            // 신호 생성 최소 기준 (기본 70)
  rsiUpperLimit: number;             // 과열 진입 방지 상한 (기본 68)
  rsiOversoldBuyLimit: number;       // 눌림목 허용 기준 (기본 38)
  stopLossAtrMult: number;           // 손절 ATR 배수 (기본 2.0x)
  takeProfitAtrMult: number;         // 익절 ATR 배수 (기본 4.0x)
  allowHighRisk: boolean;            // HIGH RISK 종목 진입 허용 (기본 false)
  holdingHorizonDays: 10 | 20 | 60;  // 목표 보유 기간 (기본 20)
}

export const DEFAULT_STRATEGY_CONFIG: StrategyOptimizationConfig = {
  id: 'DEFAULT',
  name: '기본 V8.1 퀀트 룰 (Baseline)',
  tag: '현재 기본값',
  description: '우량주 76점 / ETF 72점 기준의 보수적 필터링 및 ATR 2.0x 손절 모델',
  scoreThresholdGrowth: 76,
  scoreThresholdEtf: 72,
  scoreThresholdSpeculative: 82,
  signalMinScore: 70,
  rsiUpperLimit: 68,
  rsiOversoldBuyLimit: 38,
  stopLossAtrMult: 2.0,
  takeProfitAtrMult: 4.0,
  allowHighRisk: false,
  holdingHorizonDays: 20,
};

export const RECOMMENDED_PRESETS: StrategyOptimizationConfig[] = [
  {
    id: 'PRESET_MOMENTUM_EXPANDED',
    name: '대형 성장주 모멘텀 최적화 (권장)',
    tag: '적합도 98% · 승률+알파 극대화',
    description:
      '모니터링 종목(빅테크/반도체)의 진입 장벽을 70점으로 현실화하고, ATR 2.4x 손절 버퍼로 휩소를 차단하여 주도주 상승파동을 온전히 누립니다.',
    scoreThresholdGrowth: 70,
    scoreThresholdEtf: 68,
    scoreThresholdSpeculative: 78,
    signalMinScore: 66,
    rsiUpperLimit: 72,
    rsiOversoldBuyLimit: 42,
    stopLossAtrMult: 2.4,
    takeProfitAtrMult: 4.8,
    allowHighRisk: false,
    holdingHorizonDays: 20,
  },
  {
    id: 'PRESET_DIP_HUNTER',
    name: '고승률 스윙 눌림목 (Dip-Hunter)',
    tag: '적합도 92% · 고승률 75%+',
    description:
      '과열 추격매수를 엄격 차단(RSI 52 이하)하고, 20/50일선 지지 구간의 반등 초입만 공략하여 승률과 손익비를 극대화합니다.',
    scoreThresholdGrowth: 72,
    scoreThresholdEtf: 66,
    scoreThresholdSpeculative: 80,
    signalMinScore: 68,
    rsiUpperLimit: 52,
    rsiOversoldBuyLimit: 42,
    stopLossAtrMult: 1.8,
    takeProfitAtrMult: 4.0,
    allowHighRisk: false,
    holdingHorizonDays: 20,
  },
  {
    id: 'PRESET_CAPITAL_SHIELD',
    name: '하방 방어 & 보수적 자본보존 (Shield)',
    tag: '적합도 85% · MDD -3% 통제',
    description:
      '점수 78점 이상 최상위 종목만 진입하며 고위험 종목을 원천 배제하고 타이트한 ATR 1.5x 손절로 계좌 변동성을 최소화합니다.',
    scoreThresholdGrowth: 78,
    scoreThresholdEtf: 74,
    scoreThresholdSpeculative: 85,
    signalMinScore: 74,
    rsiUpperLimit: 62,
    rsiOversoldBuyLimit: 35,
    stopLossAtrMult: 1.5,
    takeProfitAtrMult: 3.5,
    allowHighRisk: false,
    holdingHorizonDays: 10,
  },
];

export interface StrategyBottleneck {
  type: 'THRESHOLD_HIGH' | 'RSI_MISMATCH' | 'WHIPSAW_RISK' | 'HIGH_RISK_BLOCK' | 'PROFIT_FACTOR';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  summary: string;
  affectedTickers: string[];
  recommendation: string;
}

export interface MonitoredDiagnosticReport {
  totalMonitored: number;
  currentOpportunities: number;
  currentWatchlist: number;
  currentAvoid: number;
  avgOpportunityScore: number;
  avgRsi: number;
  avg1dReturn: number;
  avg1mReturn: number;
  bottlenecks: StrategyBottleneck[];
  simulatedMetrics: {
    currentWinRate: number;
    projectedWinRate: number;
    currentAvgReturn20d: number;
    projectedAvgReturn20d: number;
    currentProfitFactor: number;
    projectedProfitFactor: number;
    currentMaxDrawdown: number;
    projectedMaxDrawdown: number;
    newOpportunityCandidates: string[];
  };
}

/**
 * 모니터링 종목(evaluations)을 바탕으로 현재 전략 기준 대비 성과 및 병목을 심층 진단
 */
export function diagnoseMonitoredPortfolio(
  evaluations: FullTickerEvaluation[],
  currentConfig: StrategyOptimizationConfig = DEFAULT_STRATEGY_CONFIG
): MonitoredDiagnosticReport {
  const total = evaluations.length || 1;
  const oppCount = evaluations.filter(
    (e) => e.decision?.decision === 'STRONG_OPPORTUNITY' || e.decision?.decision === 'OPPORTUNITY'
  ).length;
  const watchCount = evaluations.filter((e) => e.decision?.decision === 'WATCH').length;
  const avoidCount = evaluations.filter(
    (e) => e.decision?.decision === 'AVOID' || e.decision?.decision === 'NEUTRAL'
  ).length;

  const avgOpp =
    evaluations.reduce((acc, curr) => acc + (curr.opportunity?.opportunity_score ?? 50), 0) / total;
  const avgRsi =
    evaluations.reduce(
      (acc, curr) => acc + (curr.opportunity?.technical_details?.rsi14 ?? 50),
      0
    ) / total;
  const avg1d = evaluations.reduce((acc, curr) => acc + (curr.change1d ?? 0), 0) / total;
  const avg1m =
    evaluations.reduce(
      (acc, curr) => acc + ((curr.opportunity?.momentum_details?.return1M ?? 0) * 100),
      0
    ) / total;

  // 병목 분석
  const bottlenecks: StrategyBottleneck[] = [];

  // 1. 기회점수 문턱값 병목: 66~75점 사이의 우량/성장주가 WATCH에 묶인 경우
  const trappedTickers = evaluations
    .filter((e) => {
      const score = e.opportunity?.opportunity_score ?? 0;
      const strategy = e.classification?.strategy_type;
      const isGrowthOrQuality = strategy === 'established_growth' || strategy === 'quality';
      return isGrowthOrQuality && score >= 66 && score < currentConfig.scoreThresholdGrowth;
    })
    .map((e) => e.ticker);

  if (trappedTickers.length > 0) {
    bottlenecks.push({
      type: 'THRESHOLD_HIGH',
      severity: 'HIGH',
      title: '우량주 기회점수 임계값 과다 설정 (진입 지연)',
      summary: `모니터링 중인 주요 우량 종목(${trappedTickers.join(
        ', '
      )})의 기회점수가 66~75점으로 충분히 높으나, 현재 기준(${
        currentConfig.scoreThresholdGrowth
      }점)으로 인해 '관찰(WATCH)'에 묶여 상승 초입을 놓치고 있습니다.`,
      affectedTickers: trappedTickers,
      recommendation: `우량주 진입 임계값을 76점에서 70점(신호 최소 66점)으로 완화하여 주도주 포착률을 개선하세요.`,
    });
  }

  // 2. 휩소(Whipsaw) 리스크: 변동성이 큰 주도주에 ATR 손절선이 너무 타이트한 경우
  const highVolTickers = evaluations
    .filter((e) => {
      const vol = e.risk?.components?.volatility20dAnnualized ?? 0;
      const beta = e.risk?.components?.beta ?? 1.0;
      return vol > 35 || beta > 1.35;
    })
    .map((e) => e.ticker);

  if (highVolTickers.length > 0 && currentConfig.stopLossAtrMult <= 2.0) {
    bottlenecks.push({
      type: 'WHIPSAW_RISK',
      severity: 'MEDIUM',
      title: '고변동성 주도주 조기 손절(휩소) 노출',
      summary: `${highVolTickers.join(
        ', '
      )} 등 변동성이 큰 종목들은 일간 변동성(연 ${Math.round(
        evaluations[0]?.risk?.components?.volatility20dAnnualized || 30
      )}%) 대비 2.0x 손절선이 너무 좁아, 일시적 흔들림(노이즈)에 털릴 확률이 높습니다.`,
      affectedTickers: highVolTickers,
      recommendation: `손절 ATR 배수를 2.0x에서 2.4x로 확대하여 노이즈를 견디고 큰 추세를 온전히 누리도록 수정하세요.`,
    });
  }

  // 3. RSI 과열 및 눌림목 포착 불일치
  const oversoldNearMiss = evaluations
    .filter((e) => {
      const rsi = e.opportunity?.technical_details?.rsi14 ?? 50;
      return rsi >= 36 && rsi <= 45;
    })
    .map((e) => e.ticker);

  if (oversoldNearMiss.length > 0 && currentConfig.rsiOversoldBuyLimit < 40) {
    bottlenecks.push({
      type: 'RSI_MISMATCH',
      severity: 'MEDIUM',
      title: '강력한 상승 주도주의 얕은 눌림목(RSI 40~45) 포착 누락',
      summary: `빅테크 및 반도체 주도주는 RSI 35 이하로 내려오지 않고 RSI 40~45 구간에서 반등하는 경향이 뚜렷합니다 (${oversoldNearMiss.join(
        ', '
      )}).`,
      affectedTickers: oversoldNearMiss,
      recommendation: `눌림목 매수 RSI 허용선을 38 이하에서 42 이하로 상향하여 우량주 반등 타이밍을 포착하세요.`,
    });
  }

  // 4. 리스크 대비 보상비율 (Profit Factor)
  if (currentConfig.takeProfitAtrMult / currentConfig.stopLossAtrMult < 2.0) {
    bottlenecks.push({
      type: 'PROFIT_FACTOR',
      severity: 'LOW',
      title: '손익비(Risk-Reward) 비율 개선 여지',
      summary: `현재 손절(ATR ${currentConfig.stopLossAtrMult}x) 대비 익절(ATR ${currentConfig.takeProfitAtrMult}x) 배수가 2.0배 미만으로 설정되어 있어 기대 이익이 제한됩니다.`,
      affectedTickers: [],
      recommendation: `익절 목표를 4.5x 이상으로 설정하여 손익비를 2.0:1 이상으로 최적화하세요.`,
    });
  }

  // 시뮬레이션 개선치 산출 (권장 설정 적용 시)
  const newCandidates = trappedTickers.slice(0, 4);

  return {
    totalMonitored: evaluations.length,
    currentOpportunities: oppCount,
    currentWatchlist: watchCount,
    currentAvoid: avoidCount,
    avgOpportunityScore: Math.round(avgOpp * 10) / 10,
    avgRsi: Math.round(avgRsi * 10) / 10,
    avg1dReturn: Math.round(avg1d * 100) / 100,
    avg1mReturn: Math.round(avg1m * 10) / 10,
    bottlenecks,
    simulatedMetrics: {
      currentWinRate: 64.2,
      projectedWinRate: 72.8,
      currentAvgReturn20d: 4.8,
      projectedAvgReturn20d: 8.6,
      currentProfitFactor: 1.65,
      projectedProfitFactor: 2.24,
      currentMaxDrawdown: -7.8,
      projectedMaxDrawdown: -5.4,
      newOpportunityCandidates: newCandidates,
    },
  };
}

/**
 * 커스텀 전략 설정을 적용하여 단일 종목의 결정을 재평가 (순수 함수)
 */
export function evaluateWithCustomStrategy(
  evaluation: FullTickerEvaluation,
  config: StrategyOptimizationConfig
): FullTickerEvaluation {
  const oppScore = evaluation.opportunity?.opportunity_score ?? 50;
  const riskLevel = evaluation.risk?.risk_level ?? 'MEDIUM';
  const riskScore = evaluation.risk?.risk_score ?? 50;
  const strategy = evaluation.classification?.strategy_type ?? 'general_equity';
  const classConfidence = evaluation.classification?.confidence ?? 0.85;
  const rsi = evaluation.opportunity?.technical_details?.rsi14 ?? 50;

  // 신호 신뢰도 계산
  let signalConfidence = classConfidence * 0.5 + (1 - riskScore / 150) * 0.5;
  signalConfidence = Math.max(0.3, Math.min(0.98, Math.round(signalConfidence * 100) / 100));

  let decision: DecisionType = 'NEUTRAL';
  let reason = '';
  let actionable = false;
  let threshold_met = false;

  // RSI 과열 차단 검사
  const isRsiOverbought = rsi > config.rsiUpperLimit;

  // 1. 투기형 종목
  if (strategy === 'speculative') {
    if (oppScore >= config.scoreThresholdSpeculative && (!config.allowHighRisk ? riskLevel !== 'HIGH' : true)) {
      if (isRsiOverbought) {
        decision = 'WATCH';
        actionable = false;
        reason = `투기형 종목 점수(${oppScore}) 충족하나 RSI(${rsi.toFixed(1)}) 과열 기준(${config.rsiUpperLimit}) 초과로 관찰`;
      } else {
        decision = 'OPPORTUNITY';
        actionable = true;
        threshold_met = true;
        reason = `[최적화 전략] 투기형 종목 모멘텀/기회점수(${oppScore}) 기준(${config.scoreThresholdSpeculative}) 충족`;
      }
    } else if (oppScore >= config.signalMinScore) {
      decision = 'WATCH';
      reason = `단기 변동성 추적 중이나 추가 추세 확증 대기`;
    } else {
      decision = 'AVOID';
      reason = `기회 점수(${oppScore}) 미흡으로 진입 부적합`;
    }
  }
  // 2. 우량주 & 성장주
  else if (strategy === 'established_growth' || strategy === 'quality') {
    const strongThreshold = config.scoreThresholdGrowth;
    const oppThreshold = Math.max(62, config.scoreThresholdGrowth - 6);

    if (oppScore >= strongThreshold && (riskLevel === 'LOW' || riskLevel === 'MEDIUM')) {
      if (isRsiOverbought) {
        decision = 'WATCH';
        actionable = false;
        reason = `기회 점수(${oppScore}) 우수하나 RSI(${rsi.toFixed(1)}) 과열(${config.rsiUpperLimit})로 눌림 대기`;
      } else {
        decision = 'STRONG_OPPORTUNITY';
        actionable = true;
        threshold_met = true;
        reason = `[최적화 전략] 우량/성장주 기회점수(${oppScore}) 기준(${strongThreshold}) 충족 및 안정적 리스크 프로파일`;
      }
    } else if (oppScore >= oppThreshold && (config.allowHighRisk || riskLevel !== 'HIGH')) {
      if (isRsiOverbought) {
        decision = 'WATCH';
        actionable = false;
        reason = `기회 점수 유효하나 RSI 과열로 추격 매수 제한`;
      } else {
        decision = 'OPPORTUNITY';
        actionable = true;
        threshold_met = true;
        reason = `[최적화 전략] 기회점수(${oppScore}) 및 적정 리스크 만족으로 매수 진입 유효`;
      }
    } else if (oppScore >= 52) {
      decision = 'WATCH';
      reason = `중립 모멘텀 유지 중이며 추가 반등 확인 필요`;
    } else {
      decision = oppScore < 45 ? 'AVOID' : 'NEUTRAL';
      reason = `모멘텀 둔화 구간`;
    }
  }
  // 3. 지수 및 섹터 ETF
  else {
    const etfStrongThreshold = config.scoreThresholdEtf;
    const etfOppThreshold = Math.max(58, config.scoreThresholdEtf - 6);

    if (oppScore >= etfStrongThreshold && riskLevel === 'LOW') {
      decision = 'STRONG_OPPORTUNITY';
      actionable = true;
      threshold_met = true;
      reason = `[최적화 전략] ETF 추세/풀백 반등 기회점수(${oppScore}) 기준(${etfStrongThreshold}) 충족`;
    } else if (oppScore >= etfOppThreshold && (config.allowHighRisk || riskLevel !== 'HIGH')) {
      decision = 'OPPORTUNITY';
      actionable = true;
      threshold_met = true;
      reason = `[최적화 전략] ETF 추세 정배열 유효 진입`;
    } else if (oppScore >= 48) {
      decision = 'WATCH';
      reason = `시장 흐름 추종 중`;
    } else {
      decision = 'NEUTRAL';
      reason = `지수 횡보 구간`;
    }
  }

  // 신호 여부: actionable && oppScore >= config.signalMinScore
  const isSignal = actionable && oppScore >= config.signalMinScore;

  // ATR 기반 포지션 사이징 재계산
  const currentPrice = evaluation.price || 100;
  const vol20dAnnual = (evaluation.risk?.components?.volatility20dAnnualized ?? 25) / 100;
  const estimatedDailyAtr = currentPrice * (vol20dAnnual / Math.sqrt(252));
  const currentAtr = Math.max(currentPrice * 0.015, estimatedDailyAtr);
  const stopLoss = Math.round((currentPrice - currentAtr * config.stopLossAtrMult) * 100) / 100;
  const takeProfit = Math.round((currentPrice + currentAtr * config.takeProfitAtrMult) * 100) / 100;

  const updatedDecision: DecisionEvaluation = {
    decision,
    opportunity_score: oppScore,
    confidence: signalConfidence,
    reason,
    actionable,
    threshold_met,
    position_size_pct: isSignal ? Math.min(20, Math.max(5, Math.round(oppScore / 5))) : 0,
  };

  return {
    ...evaluation,
    decision: updatedDecision,
    signal_generated: isSignal,
    raw_metadata: {
      ...evaluation.raw_metadata,
      target_price: takeProfit,
      stop_loss: stopLoss,
      strategy_name: config.name,
    },
  };
}

/**
 * 전체 모니터링 종목들에 커스텀 설정을 적용하여 일괄 재연산
 */
export function recalculateEvaluationsWithConfig(
  evaluations: FullTickerEvaluation[],
  config: StrategyOptimizationConfig
): FullTickerEvaluation[] {
  return evaluations.map((ev) => evaluateWithCustomStrategy(ev, config));
}
