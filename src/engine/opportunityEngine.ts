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
import { OPPORTUNITY_CONFIG, STRATEGY_WEIGHTS } from '../config/engineConstants';

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
  return STRATEGY_WEIGHTS[strategy] || STRATEGY_WEIGHTS.general_equity;
}

export function calculateOpportunity(
  classification: AssetClassification,
  indicators: RawMarketIndicators
): OpportunityEvaluation {
  const isEtf = classification.asset_type === 'etf';
  const C = OPPORTUNITY_CONFIG;

  // 1. Technical Score (0 ~ 100)
  let techScore = C.BASE_TECH_SCORE;

  const priceAboveMa20 = indicators.price >= indicators.ma20;
  const ma20Above50 = indicators.ma20 >= indicators.ma50;
  const ma50Above200 = indicators.ma50 >= indicators.ma200;

  // MA Alignment
  if (ma20Above50 && ma50Above200) techScore += C.TECH_MA_ALIGNMENT_BULLISH;
  else if (ma20Above50 || ma50Above200) techScore += C.TECH_MA_ALIGNMENT_PARTIAL;
  else techScore += C.TECH_MA_ALIGNMENT_BEARISH;

  if (priceAboveMa20) techScore += C.TECH_PRICE_ABOVE_MA20;
  else techScore += C.TECH_PRICE_BELOW_MA20;

  // RSI Scoring (Target: healthy pullbacks 42~58 or strong momentum 55~68)
  let rsiScore = C.BASE_RSI_SCORE;
  const rsi = indicators.rsi14;
  if (rsi >= C.RSI_OPTIMAL_MIN && rsi <= C.RSI_OPTIMAL_MAX) {
    rsiScore = C.RSI_OPTIMAL_SCORE;
    techScore += C.RSI_OPTIMAL_BONUS;
  } else if (rsi >= C.RSI_DIP_MIN && rsi < C.RSI_DIP_MAX) {
    rsiScore = C.RSI_DIP_SCORE;
    techScore += C.RSI_DIP_BONUS;
  } else if (rsi > C.RSI_STRONG_UPTREND_MIN && rsi <= C.RSI_STRONG_UPTREND_MAX) {
    rsiScore = C.RSI_STRONG_UPTREND_SCORE;
    techScore += C.RSI_STRONG_UPTREND_BONUS;
  } else if (rsi > C.RSI_OVERBOUGHT_MIN) {
    rsiScore = C.RSI_OVERBOUGHT_SCORE;
    techScore += C.RSI_OVERBOUGHT_PENALTY;
  } else {
    rsiScore = C.RSI_OVERSOLD_BEARISH_SCORE;
    techScore += C.RSI_OVERSOLD_BEARISH_PENALTY;
  }

  // Drawdown scoring: Moderate pullback (-4% to -12%) gives ideal risk/reward
  const dd = indicators.drawdownFromHigh;
  let ddScore = C.BASE_DD_SCORE;
  if (dd >= C.DD_NEAR_HIGHS_MAX) {
    ddScore = C.DD_NEAR_HIGHS_SCORE;
    techScore += C.DD_NEAR_HIGHS_BONUS;
  } else if (dd >= C.DD_HEALTHY_PULLBACK_MAX) {
    ddScore = C.DD_HEALTHY_PULLBACK_SCORE;
    techScore += C.DD_HEALTHY_PULLBACK_BONUS;
  } else if (dd >= C.DD_MODERATE_CORRECTION_MAX) {
    ddScore = C.DD_MODERATE_CORRECTION_SCORE;
  } else {
    ddScore = C.DD_DEEP_CRASH_SCORE;
    techScore += C.DD_DEEP_CRASH_PENALTY;
  }

  if (indicators.macdHistogramPositive) techScore += C.TECH_MACD_HISTOGRAM_POSITIVE;

  const finalTechScore = Math.max(C.MIN_FINAL_SCORE, Math.min(C.MAX_FINAL_SCORE, Math.round(techScore)));

  // 2. Momentum Score (0 ~ 100)
  let momScore = C.BASE_MOM_SCORE;
  const ret1M = indicators.return1M;
  const ret3M = indicators.return3M;
  const ret6M = indicators.return6M;
  const rs = indicators.relativeStrengthVsSpy;

  // 1M / 3M / 6M Returns
  if (ret1M > C.MOM_1M_STRONG) momScore += C.MOM_1M_STRONG_BONUS;
  else if (ret1M > 0) momScore += C.MOM_1M_POSITIVE_BONUS;
  else if (ret1M < -C.MOM_1M_STRONG) momScore += C.MOM_1M_NEGATIVE_PENALTY;

  if (ret3M > C.MOM_3M_STRONG) momScore += C.MOM_3M_STRONG_BONUS;
  else if (ret3M > C.MOM_3M_POSITIVE) momScore += C.MOM_3M_POSITIVE_BONUS;
  else if (ret3M < -C.MOM_3M_POSITIVE) momScore += C.MOM_3M_NEGATIVE_PENALTY;

  if (ret6M > C.MOM_6M_STRONG) momScore += C.MOM_6M_STRONG_BONUS;
  else if (ret6M > C.MOM_6M_POSITIVE) momScore += C.MOM_6M_POSITIVE_BONUS;

  // Relative Strength vs SPY
  if (rs > C.RS_STRONG) momScore += C.RS_STRONG_BONUS;
  else if (rs > C.RS_POSITIVE) momScore += C.RS_POSITIVE_BONUS;
  else if (rs < C.RS_WEAK) momScore += C.RS_WEAK_PENALTY;

  const finalMomScore = Math.max(C.MIN_FINAL_SCORE, Math.min(C.MAX_FINAL_SCORE, Math.round(momScore)));

  // 3. Fundamental Score (0 ~ 100 or null for ETFs)
  let finalFundScore: number | null = null;
  if (!isEtf) {
    let fundScore = C.BASE_FUND_SCORE;
    const revG = indicators.revenueGrowthYoy ?? 0.10;
    const epsG = indicators.earningsGrowthYoy ?? 0.10;
    const opM = indicators.operatingMargin ?? 0.15;
    const fcfM = indicators.freeCashFlowMargin ?? 0.12;

    if (revG > C.FUND_REV_GROWTH_VERY_HIGH) fundScore += C.FUND_REV_GROWTH_VERY_HIGH_BONUS;
    else if (revG > C.FUND_REV_GROWTH_HIGH) fundScore += C.FUND_REV_GROWTH_HIGH_BONUS;
    else if (revG > C.FUND_REV_GROWTH_POSITIVE) fundScore += C.FUND_REV_GROWTH_POSITIVE_BONUS;
    else if (revG < 0) fundScore += C.FUND_REV_GROWTH_NEGATIVE_PENALTY;

    if (epsG > C.FUND_EPS_GROWTH_VERY_HIGH) fundScore += C.FUND_EPS_GROWTH_VERY_HIGH_BONUS;
    else if (epsG > C.FUND_EPS_GROWTH_HIGH) fundScore += C.FUND_EPS_GROWTH_HIGH_BONUS;
    else if (epsG < 0) fundScore += C.FUND_EPS_GROWTH_NEGATIVE_PENALTY;

    if (opM > C.FUND_OP_MARGIN_EXCELLENT) fundScore += C.FUND_OP_MARGIN_EXCELLENT_BONUS;
    else if (opM > C.FUND_OP_MARGIN_GOOD) fundScore += C.FUND_OP_MARGIN_GOOD_BONUS;
    else if (opM < C.FUND_OP_MARGIN_POOR) fundScore += C.FUND_OP_MARGIN_POOR_PENALTY;

    if (fcfM > C.FUND_FCF_MARGIN_EXCELLENT) fundScore += C.FUND_FCF_MARGIN_EXCELLENT_BONUS;

    finalFundScore = Math.max(C.MIN_FINAL_SCORE, Math.min(C.MAX_FINAL_SCORE, Math.round(fundScore)));
  }

  // 4. Valuation Score (0 ~ 100)
  let finalValScore: number = C.BASE_VAL_SCORE;
  if (isEtf) {
    const pe = indicators.forwardPe ?? indicators.trailingPe ?? 22;
    if (pe < C.ETF_VAL_PE_CHEAP) finalValScore = C.ETF_VAL_PE_CHEAP_SCORE;
    else if (pe < C.ETF_VAL_PE_FAIR) finalValScore = C.ETF_VAL_PE_FAIR_SCORE;
    else if (pe < C.ETF_VAL_PE_RICH) finalValScore = C.ETF_VAL_PE_RICH_SCORE;
    else finalValScore = C.ETF_VAL_PE_EXPENSIVE_SCORE;
  } else {
    let valScore = C.BASE_VAL_SCORE;
    const fwdPe = indicators.forwardPe ?? indicators.trailingPe ?? 30;
    const peg = indicators.pegRatio ?? (fwdPe / Math.max(C.MIN_EARNINGS_GROWTH_FOR_PEG * 100, (indicators.earningsGrowthYoy ?? C.DEFAULT_EARNINGS_GROWTH_FOR_PEG) * 100));

    if (peg < C.EQUITY_VAL_PEG_CHEAP) valScore += C.EQUITY_VAL_PEG_CHEAP_BONUS;
    else if (peg < C.EQUITY_VAL_PEG_FAIR) valScore += C.EQUITY_VAL_PEG_FAIR_BONUS;
    else if (peg > C.EQUITY_VAL_PEG_EXPENSIVE) valScore += C.EQUITY_VAL_PEG_EXPENSIVE_PENALTY;

    if (fwdPe < C.EQUITY_VAL_FWD_PE_CHEAP) valScore += C.EQUITY_VAL_FWD_PE_CHEAP_BONUS;
    else if (fwdPe > C.EQUITY_VAL_FWD_PE_EXPENSIVE) valScore += C.EQUITY_VAL_FWD_PE_EXPENSIVE_PENALTY;

    finalValScore = Math.max(C.MIN_FINAL_SCORE, Math.min(C.MAX_VAL_SCORE, Math.round(valScore)));
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

  const finalOppScore = Math.max(C.MIN_FINAL_SCORE, Math.min(C.MAX_FINAL_SCORE, Math.round(totalScore)));

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
