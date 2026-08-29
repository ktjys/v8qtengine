import {
  AssetClassification,
  FundamentalComponents,
  MomentumComponents,
  OpportunityEvaluation,
  StrategyType,
  SubScores,
  TechnicalComponents,
  ValuationComponents,
} from '../types/v8';

export interface RawMarketIndicators {
  price: number;
  ma20: number;
  ma50: number;
  ma200: number;
  rsi14: number;
  drawdownFromHigh: number; // e.g. -0.082 (-8.2%)
  macdHistogramPositive: boolean;
  return1M: number; // e.g. 0.045 (4.5%)
  return3M: number; // e.g. 0.12 (12%)
  return6M: number; // e.g. 0.25 (25%)
  relativeStrengthVsSpy: number; // e.g. 1.15
  revenueGrowthYoy?: number; // 0.35 (35%)
  earningsGrowthYoy?: number; // 0.40 (40%)
  operatingMargin?: number; // 0.28 (28%)
  freeCashFlowMargin?: number; // 0.22 (22%)
  marketCapBillions: number | null;
  trailingPe?: number;
  forwardPe?: number;
  psRatio?: number;
  pegRatio?: number;
}

export function getStrategyWeights(strategy: StrategyType) {
  switch (strategy) {
    case 'broad_market_etf':
      return { technical: 0.45, momentum: 0.45, fundamental: 0.0, valuation: 0.1 };
    case 'growth_etf':
      return { technical: 0.40, momentum: 0.45, fundamental: 0.0, valuation: 0.15 };
    case 'dividend_etf':
      return { technical: 0.35, momentum: 0.30, fundamental: 0.0, valuation: 0.35 };
    case 'income_etf':
      return { technical: 0.40, momentum: 0.30, fundamental: 0.0, valuation: 0.30 };
    case 'sector_etf':
      return { technical: 0.45, momentum: 0.45, fundamental: 0.0, valuation: 0.10 };
    case 'other_etf':
      return { technical: 0.50, momentum: 0.40, fundamental: 0.0, valuation: 0.10 };
    case 'quality':
      return { technical: 0.25, momentum: 0.25, fundamental: 0.35, valuation: 0.15 };
    case 'established_growth':
      return { technical: 0.25, momentum: 0.30, fundamental: 0.30, valuation: 0.15 };
    case 'speculative':
      return { technical: 0.35, momentum: 0.45, fundamental: 0.10, valuation: 0.10 };
    case 'general_equity':
    default:
      return { technical: 0.30, momentum: 0.30, fundamental: 0.20, valuation: 0.20 };
  }
}

export function calculateOpportunity(
  classification: AssetClassification,
  indicators: RawMarketIndicators
): OpportunityEvaluation {
  const isEtf = classification.asset_type === 'etf';

  // 1. Technical Score (0 ~ 100)
  let techScore = 50;

  const priceAboveMa20 = indicators.price >= indicators.ma20;
  const ma20Above50 = indicators.ma20 >= indicators.ma50;
  const ma50Above200 = indicators.ma50 >= indicators.ma200;

  // MA Alignment
  if (ma20Above50 && ma50Above200) techScore += 18;
  else if (ma20Above50 || ma50Above200) techScore += 8;
  else techScore -= 12;

  if (priceAboveMa20) techScore += 10;
  else techScore -= 6;

  // RSI Scoring (Target: healthy pullbacks 42~58 or strong momentum 55~68)
  let rsiScore = 50;
  const rsi = indicators.rsi14;
  if (rsi >= 45 && rsi <= 62) {
    rsiScore = 85; // Optimal setup zone
    techScore += 12;
  } else if (rsi >= 35 && rsi < 45) {
    rsiScore = 75; // Dip buying zone
    techScore += 8;
  } else if (rsi > 62 && rsi <= 72) {
    rsiScore = 70; // Strong uptrend
    techScore += 6;
  } else if (rsi > 72) {
    rsiScore = 40; // Overbought risk
    techScore -= 10;
  } else {
    rsiScore = 35; // Severe oversold/bearish trend
    techScore -= 8;
  }

  // Drawdown scoring: Moderate pullback (-4% to -12%) gives ideal risk/reward
  const dd = indicators.drawdownFromHigh; // e.g. -0.06
  let ddScore = 50;
  if (dd >= -0.03) {
    ddScore = 70; // Near highs
    techScore += 4;
  } else if (dd >= -0.10) {
    ddScore = 88; // Healthy pullback
    techScore += 8;
  } else if (dd >= -0.20) {
    ddScore = 65; // Moderate correction
    techScore += 0;
  } else {
    ddScore = 40; // Deep crash
    techScore -= 10;
  }

  if (indicators.macdHistogramPositive) techScore += 6;

  const finalTechScore = Math.max(10, Math.min(98, Math.round(techScore)));

  // 2. Momentum Score (0 ~ 100)
  let momScore = 50;
  const ret1M = indicators.return1M;
  const ret3M = indicators.return3M;
  const ret6M = indicators.return6M;
  const rs = indicators.relativeStrengthVsSpy;

  // 1M / 3M / 6M Returns
  if (ret1M > 0.05) momScore += 12;
  else if (ret1M > 0) momScore += 5;
  else if (ret1M < -0.05) momScore -= 10;

  if (ret3M > 0.12) momScore += 15;
  else if (ret3M > 0.03) momScore += 8;
  else if (ret3M < -0.08) momScore -= 10;

  if (ret6M > 0.20) momScore += 12;
  else if (ret6M > 0.05) momScore += 6;

  // Relative Strength vs SPY
  if (rs > 1.25) momScore += 15;
  else if (rs > 1.05) momScore += 8;
  else if (rs < 0.85) momScore -= 12;

  const finalMomScore = Math.max(10, Math.min(98, Math.round(momScore)));

  // 3. Fundamental Score (0 ~ 100 or null for ETFs)
  let finalFundScore: number | null = null;
  if (!isEtf) {
    let fundScore = 50;
    const revG = indicators.revenueGrowthYoy ?? 0.10;
    const epsG = indicators.earningsGrowthYoy ?? 0.10;
    const opM = indicators.operatingMargin ?? 0.15;
    const fcfM = indicators.freeCashFlowMargin ?? 0.12;

    if (revG > 0.35) fundScore += 22;
    else if (revG > 0.18) fundScore += 14;
    else if (revG > 0.08) fundScore += 6;
    else if (revG < 0) fundScore -= 15;

    if (epsG > 0.30) fundScore += 16;
    else if (epsG > 0.12) fundScore += 8;
    else if (epsG < 0) fundScore -= 10;

    if (opM > 0.30) fundScore += 12;
    else if (opM > 0.18) fundScore += 6;
    else if (opM < 0.05) fundScore -= 10;

    if (fcfM > 0.20) fundScore += 8;

    finalFundScore = Math.max(10, Math.min(98, Math.round(fundScore)));
  }

  // 4. Valuation Score (0 ~ 100)
  let finalValScore: number = 50;
  if (isEtf) {
    // For ETFs, valuation is based on relative PE vs historical median
    const pe = indicators.forwardPe ?? indicators.trailingPe ?? 22;
    if (pe < 18) finalValScore = 80;
    else if (pe < 25) finalValScore = 65;
    else if (pe < 32) finalValScore = 52;
    else finalValScore = 40;
  } else {
    let valScore = 50;
    const fwdPe = indicators.forwardPe ?? indicators.trailingPe ?? 30;
    const peg = indicators.pegRatio ?? (fwdPe / Math.max(5, (indicators.earningsGrowthYoy ?? 0.15) * 100));

    if (peg < 1.2) valScore += 22;
    else if (peg < 1.8) valScore += 12;
    else if (peg > 3.0) valScore -= 15;

    if (fwdPe < 22) valScore += 12;
    else if (fwdPe > 50) valScore -= 12;

    finalValScore = Math.max(10, Math.min(95, Math.round(valScore)));
  }

  // Calculate Weighted Total Opportunity Score
  const weights = getStrategyWeights(classification.strategy_type);

  let totalScore = 0;
  if (isEtf || finalFundScore === null) {
    // Re-normalize weights without fundamental
    const nonFundWeight = weights.technical + weights.momentum + weights.valuation;
    const normTech = weights.technical / nonFundWeight;
    const normMom = weights.momentum / nonFundWeight;
    const normVal = weights.valuation / nonFundWeight;
    totalScore = finalTechScore * normTech + finalMomScore * normMom + finalValScore * normVal;
  } else {
    totalScore =
      finalTechScore * weights.technical +
      finalMomScore * weights.momentum +
      finalFundScore * weights.fundamental +
      finalValScore * weights.valuation;
  }

  const finalOppScore = Math.max(10, Math.min(98, Math.round(totalScore)));

  const sub_scores: SubScores = {
    technical_score: finalTechScore,
    momentum_score: finalMomScore,
    fundamental_score: finalFundScore,
    valuation_score: finalValScore,
  };

  const technical_details: TechnicalComponents = {
    maTrend: ma20Above50 && ma50Above200 ? 'BULLISH' : !ma20Above50 && !ma50Above200 ? 'BEARISH' : 'NEUTRAL',
    rsi14: indicators.rsi14,
    rsiScore,
    drawdownFromHigh: Math.round(indicators.drawdownFromHigh * 1000) / 10,
    drawdownScore: ddScore,
    ma20Above50,
    ma50Above200,
    priceAboveMa20,
    macdHistogramPositive: indicators.macdHistogramPositive,
  };

  const momentum_details: MomentumComponents = {
    return1M: Math.round(indicators.return1M * 1000) / 10,
    return3M: Math.round(indicators.return3M * 1000) / 10,
    return6M: Math.round(indicators.return6M * 1000) / 10,
    relativeStrengthVsSpy: Math.round(indicators.relativeStrengthVsSpy * 100) / 100,
    momentumScore: finalMomScore,
    trendPersistence: indicators.return1M > 0 && indicators.return3M > 0 ? 0.9 : 0.6,
  };

  const fundamental_details: FundamentalComponents = {
    revenueGrowthYoy: indicators.revenueGrowthYoy ? Math.round(indicators.revenueGrowthYoy * 1000) / 10 : null,
    earningsGrowthYoy: indicators.earningsGrowthYoy ? Math.round(indicators.earningsGrowthYoy * 1000) / 10 : null,
    operatingMargin: indicators.operatingMargin ? Math.round(indicators.operatingMargin * 1000) / 10 : null,
    freeCashFlowMargin: indicators.freeCashFlowMargin ? Math.round(indicators.freeCashFlowMargin * 1000) / 10 : null,
    marketCapBillions:
      indicators.marketCapBillions != null
        ? Math.round(indicators.marketCapBillions * 10) / 10
        : null,
    isEtf,
  };

  const valuation_details: ValuationComponents = {
    peTrailing: indicators.trailingPe ? Math.round(indicators.trailingPe * 10) / 10 : null,
    peForward: indicators.forwardPe ? Math.round(indicators.forwardPe * 10) / 10 : null,
    psRatio: indicators.psRatio ? Math.round(indicators.psRatio * 10) / 10 : null,
    evToEbitda: null,
    pegRatio: indicators.pegRatio ? Math.round(indicators.pegRatio * 100) / 100 : null,
    isEtf,
  };

  return {
    opportunity_score: finalOppScore,
    sub_scores,
    weights_used: weights,
    technical_details,
    momentum_details,
    fundamental_details,
    valuation_details,
  };
}
