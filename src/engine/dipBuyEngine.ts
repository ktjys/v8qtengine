import {
  AssetClassification,
  BlueChipSuitability,
  BlueChipTier,
  DipBuyEvaluation,
  DipTiming,
  DipTimingSignal,
} from '../types/v8';
import { RawMarketIndicators } from './opportunityEngine';
import { RawRiskInputs } from './riskEngine';
import { RawYahooMetadata } from './classificationEngine';
import { DIP_BUY_CONFIG } from '../config/engineConstants';

const BROAD_MARKET_TICKERS = ['VOO', 'SPY', 'IVV', 'VTI', 'VT', 'QQQ', 'QQQM', 'SCHD', 'VUG', 'VYM', 'DIA', 'IWM'] as const;
const SECTOR_ETF_TICKERS = ['SMH', 'SOXX', 'XLE', 'XLK', 'XLF', 'XLV', 'SCHG'] as const;
const MEGACAP_QUALITY_EQUITIES = [
  'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'NVDA', 'META', 'BRK-A', 'BRK-B',
  'JNJ', 'V', 'MA', 'LLY', 'UNH', 'PG', 'JPM', 'HD', 'COST', 'KO', 'PEP'
] as const;

/**
 * 전략 B: 우량대형주 적합도 (Blue-Chip Suitability) 산출
 *
 * 평가 요소:
 * 1. 대표 지수/ETF 지위 (30점)
 * 2. 시가총액 체급 (25점)
 * 3. 펀더멘털 건전성/해자/현금흐름 (25점)
 * 4. 하방 안정성 및 저변동성 (20점)
 */
export function calculateBlueChipSuitability(
  ticker: string,
  classification: AssetClassification,
  indicators: RawMarketIndicators,
  metadata?: RawYahooMetadata,
  riskInputs?: RawRiskInputs
): BlueChipSuitability {
  const C = DIP_BUY_CONFIG;
  const isEtf = classification.asset_type === 'etf';
  const strat = classification.strategy_type;
  const reasons: string[] = [];

  // 1. Index / ETF Status (0 ~ 30)
  let indexStatusScore = 15;

  if (isEtf) {
    if (BROAD_MARKET_TICKERS.includes(ticker as any) || strat === 'broad_market_etf' || strat === 'growth_etf' || strat === 'dividend_etf') {
      indexStatusScore = C.INDEX_STATUS_BROAD_MARKET_ETF;
      reasons.push('광범위 시장 대표 지수/우량 배당 ETF로 개별 기업 파산 위험이 원천 배제됨 (30점 만점)');
    } else if (SECTOR_ETF_TICKERS.includes(ticker as any) || strat === 'sector_etf') {
      indexStatusScore = C.INDEX_STATUS_SECTOR_ETF;
      reasons.push('주요 산업 섹터 1위 ETF로 분산투자 안정성 보유 (25점)');
    } else {
      indexStatusScore = C.INDEX_STATUS_OTHER_ETF;
      reasons.push('인컴/테마형 ETF (20점)');
    }
  } else {
    if (MEGACAP_QUALITY_EQUITIES.includes(ticker as any)) {
      indexStatusScore = C.INDEX_STATUS_MEGACAP_QUALITY;
      reasons.push('미국 증시 최상위 메가캡 독점 우량주 (28점)');
    } else if (strat === 'quality') {
      indexStatusScore = C.INDEX_STATUS_QUALITY;
      reasons.push('강력한 해자와 안정적 비즈니스 모델을 갖춘 퀄리티 우량주 (24점)');
    } else if (strat === 'established_growth') {
      indexStatusScore = C.INDEX_STATUS_ESTABLISHED_GROWTH;
      reasons.push('입증된 실적 기반의 대형 성장주 (20점)');
    } else if (strat === 'speculative') {
      indexStatusScore = C.INDEX_STATUS_SPECULATIVE;
      reasons.push('초기/투기성 자산으로 장기 물타기 시 영구 손실 위험 존재 (5점)');
    } else {
      indexStatusScore = C.INDEX_STATUS_GENERAL_EQUITY;
      reasons.push('일반 개별 보통주 (14점)');
    }
  }

  // 2. Market Cap Scale (0 ~ 25)
  let marketCapScore = 15;
  const capBillions = indicators.marketCapBillions || (metadata?.marketCap ? metadata.marketCap / 1e9 : (isEtf ? 300 : 25));

  if (isEtf) {
    marketCapScore = C.ETF_MCAP_SCORE;
  } else {
    if (capBillions >= 500) {
      marketCapScore = C.MCAP_MEGACAP_500B;
      reasons.push(`초대형 메가캡 ($${capBillions.toFixed(0)}B, 25점 만점)`);
    } else if (capBillions >= 150) {
      marketCapScore = C.MCAP_LARGE_150B;
      reasons.push(`대형 우량 시총 ($${capBillions.toFixed(0)}B, 22점)`);
    } else if (capBillions >= 60) {
      marketCapScore = C.MCAP_MID_LARGE_60B;
      reasons.push(`중대형 시총 ($${capBillions.toFixed(0)}B, 18점)`);
    } else if (capBillions >= 20) {
      marketCapScore = C.MCAP_MID_20B;
      reasons.push(`중형주 규모 ($${capBillions.toFixed(0)}B, 12점)`);
    } else {
      marketCapScore = C.MCAP_SMALL;
      reasons.push(`소형/중소형 시총 ($${capBillions.toFixed(1)}B, 4점 감점)`);
    }
  }

  // 3. Quality & Cash Flow / Moat (0 ~ 25)
  let qualityScore = 15;
  if (isEtf) {
    qualityScore = 25;
  } else {
    let subQ = C.QUALITY_BASE;
    const opMargin = indicators.operatingMargin ?? 0.15;
    const fcfMargin = indicators.freeCashFlowMargin ?? 0.12;

    if (opMargin >= C.QUALITY_OP_MARGIN_EXCELLENT) subQ += C.QUALITY_OP_MARGIN_EXCELLENT_BONUS;
    else if (opMargin >= C.QUALITY_OP_MARGIN_GOOD) subQ += C.QUALITY_OP_MARGIN_GOOD_BONUS;
    else if (opMargin > C.QUALITY_OP_MARGIN_OK) subQ += C.QUALITY_OP_MARGIN_OK_BONUS;
    else subQ += C.QUALITY_OP_MARGIN_POOR_PENALTY;

    if (fcfMargin >= C.QUALITY_FCF_MARGIN_EXCELLENT) subQ += C.QUALITY_FCF_MARGIN_EXCELLENT_BONUS;
    else if (fcfMargin >= C.QUALITY_FCF_MARGIN_GOOD) subQ += C.QUALITY_FCF_MARGIN_GOOD_BONUS;
    else if (fcfMargin > 0) subQ += C.QUALITY_FCF_MARGIN_POSITIVE_BONUS;
    else subQ += C.QUALITY_FCF_MARGIN_NEGATIVE_PENALTY;

    qualityScore = Math.max(C.QUALITY_MIN_SCORE, Math.min(C.QUALITY_MAX_SCORE, subQ));
    if (opMargin >= 0.20 && fcfMargin >= 0.15) {
      reasons.push(`압도적 영업이익률(${(opMargin * 100).toFixed(0)}%) 및 잉여현금흐름 창출력`);
    }
  }

  // 4. Stability & Low Downside Risk (0 ~ 20)
  let stabilityScore = 12;
  const beta = riskInputs?.beta ?? metadata?.beta ?? 1.0;
  const rawMaxDD = Math.abs(riskInputs?.maxDrawdown52w ?? indicators.drawdownFromHigh ?? 0.15);
  const maxDDRatio = rawMaxDD > 1.0 ? rawMaxDD / 100 : rawMaxDD;

  let subStab = C.STABILITY_BASE;
  if (beta <= C.STABILITY_BETA_VERY_LOW) subStab += C.STABILITY_BETA_VERY_LOW_BONUS;
  else if (beta <= C.STABILITY_BETA_LOW) subStab += C.STABILITY_BETA_LOW_BONUS;
  else if (beta <= C.STABILITY_BETA_MEDIUM) subStab += C.STABILITY_BETA_MEDIUM_PENALTY;
  else subStab += C.STABILITY_BETA_HIGH_PENALTY;

  if (maxDDRatio <= C.STABILITY_MDD_LOW) subStab += C.STABILITY_MDD_LOW_BONUS;
  else if (maxDDRatio <= C.STABILITY_MDD_MODERATE) subStab += C.STABILITY_MDD_MODERATE_BONUS;
  else subStab += C.STABILITY_MDD_HIGH_PENALTY;

  stabilityScore = Math.max(C.STABILITY_MIN_SCORE, Math.min(C.STABILITY_MAX_SCORE, subStab));

  // Total Suitability Score
  const totalScore = Math.round(
    Math.max(0, Math.min(100, indexStatusScore + marketCapScore + qualityScore + stabilityScore))
  );

  let tier: BlueChipTier = 'B';
  let tierLabel = '🥈 B등급 (일반대형/선별적립)';

  if (totalScore >= C.TIER_S_THRESHOLD) {
    tier = 'S';
    tierLabel = '💎 S등급 (초우량/인덱스)';
  } else if (totalScore >= C.TIER_A_THRESHOLD) {
    tier = 'A';
    tierLabel = '🥇 A등급 (대형성장우량)';
  } else if (totalScore >= C.TIER_B_THRESHOLD) {
    tier = 'B';
    tierLabel = '🥈 B등급 (일반대형/선별적립)';
  } else {
    tier = 'C';
    tierLabel = '⚠️ C등급 (추매부적합/투기주)';
  }

  return {
    score: totalScore,
    tier,
    tierLabel,
    isSuitable: totalScore >= 70,
    breakdown: {
      indexStatusScore,
      marketCapScore,
      qualityScore,
      stabilityScore,
    },
    reasons,
  };
}

/**
 * 전략 B: 현재 눌림목 타이밍 (Dip Timing Score) 산출
 *
 * 우량주가 현재 시점에서 '세일' 중인지 점수화:
 * - RSI 30~45: 최적 눌림목 가점
 * - 전고점 대비 -6% ~ -18%: 건강한 할인 구간
 * - 50일/200일선 지지력 확인
 */
export function calculateDipTiming(indicators: Partial<RawMarketIndicators>): DipTiming {
  const C = DIP_BUY_CONFIG;
  const rsi = indicators.rsi14 ?? 50;
  const rawDd = indicators.drawdownFromHigh ?? 0;
  // If positive value passed (e.g. 5.4 or 0.054), convert to negative convention
  const ddVal = rawDd > 0 ? -rawDd : rawDd;

  // Normalize to percentage between -100% and 0%
  // If input was a fraction (e.g. -0.054 for -5.4%), multiply by 100 to get -5.4%
  // If input was already a percentage (e.g. -5.4), preserve it as -5.4%
  let ddPct = 0;
  if (Math.abs(ddVal) <= 1.0 && ddVal !== 0) {
    ddPct = ddVal * 100;
  } else {
    ddPct = ddVal;
  }
  // Clamp between -99.9% and 0.0%
  ddPct = Math.max(-99.9, Math.min(0, ddPct));

  const reasons: string[] = [];

  let rsiScore = 15;
  let rsiZone: DipTiming['rsiZone'] = 'HEALTHY';

  if (rsi <= C.TIMING_RSI_DEEP_OVERSOLD) {
    rsiScore = C.TIMING_RSI_DEEP_OVERSOLD_SCORE;
    rsiZone = 'DEEP_OVERSOLD';
    reasons.push(`RSI ${rsi.toFixed(1)}: 극심한 단기 과매도 (바겐세일 구간)`);
  } else if (rsi <= C.TIMING_RSI_DIP_ZONE_MAX) {
    rsiScore = C.TIMING_RSI_DIP_ZONE_SCORE;
    rsiZone = 'DIP_ZONE';
    reasons.push(`RSI ${rsi.toFixed(1)}: 건전한 눌림목 조정 구간 (매력적 가격대)`);
  } else if (rsi <= C.TIMING_RSI_HEALTHY_MAX) {
    rsiScore = C.TIMING_RSI_HEALTHY_SCORE;
    rsiZone = 'HEALTHY';
    reasons.push(`RSI ${rsi.toFixed(1)}: 중립 안정 구간 (정기적립 적합)`);
  } else if (rsi <= C.TIMING_RSI_RISING_MAX) {
    rsiScore = C.TIMING_RSI_RISING_SCORE;
    rsiZone = 'HEALTHY';
    reasons.push(`RSI ${rsi.toFixed(1)}: 주가 상승 진행 중 (소액 적립)`);
  } else {
    rsiScore = C.TIMING_RSI_OVERBOUGHT_SCORE;
    rsiZone = 'OVERBOUGHT';
    reasons.push(`RSI ${rsi.toFixed(1)}: 단기 과열 구간 (추매 보류 권장)`);
  }

  // Drawdown from high (0 ~ 35)
  let ddScore = 10;
  let drawdownLabel = `${ddPct.toFixed(1)}%`;

  if (ddPct >= C.DD_NEAR_HIGH_MAX) {
    ddScore = C.DD_NEAR_HIGH_SCORE;
    drawdownLabel = `신고가 근접 (${ddPct.toFixed(1)}%)`;
    reasons.push('전고점 부근 거래 중 (가격 조정 대기 권고)');
  } else if (ddPct >= C.DD_SHALLOW_MAX) {
    ddScore = C.DD_SHALLOW_SCORE;
    drawdownLabel = `얕은 눌림목 (${ddPct.toFixed(1)}%)`;
    reasons.push('1차 얕은 눌림목 조정 (-5% ~ -8%)');
  } else if (ddPct >= C.DD_GOLDEN_MAX) {
    ddScore = C.DD_GOLDEN_SCORE;
    drawdownLabel = `황금 눌림목 (${ddPct.toFixed(1)}%)`;
    reasons.push('우량주 황금 눌림목 구간 (-8% ~ -18% 건강한 세일)');
  } else if (ddPct >= C.DD_DEEP_MAX) {
    ddScore = C.DD_DEEP_SCORE;
    drawdownLabel = `깊은 할인 (${ddPct.toFixed(1)}%)`;
    reasons.push('시장 충격에 따른 깊은 할인 구간 (-18% ~ -30%)');
  } else {
    ddScore = C.DD_CRASH_SCORE;
    drawdownLabel = `과도한 급락 (${ddPct.toFixed(1)}%)`;
    reasons.push('전고점 대비 -30% 초과 급락 (실적 훼손 여부 확인 필요)');
  }

  // Trend & Support Alignment (0 ~ 25)
  let supportScore = C.SUPPORT_BASE;
  let supportLevel = '200일선 상회 (장기 상승 추세 유지)';

  const price = indicators.price;
  const ma200 = indicators.ma200 || price * 0.9;
  const ma50 = indicators.ma50 || price * 0.95;

  const isAboveMa200 = price >= ma200;
  const isNearMa50 = Math.abs(price - ma50) / ma50 <= C.MA50_PROXIMITY_THRESHOLD;

  if (isAboveMa200) {
    supportScore += C.SUPPORT_ABOVE_MA200_BONUS;
    if (isNearMa50) {
      supportScore += C.SUPPORT_NEAR_MA50_BONUS;
      supportLevel = '50일 이동평균선 지지 부근 (눌림목 반등 타점)';
      reasons.push('50일선 부근에서 지지선 형성 중');
    } else {
      supportLevel = '장기 200일선 상회 유지 (장기 상승 기조 견고)';
    }
  } else {
    supportScore += C.SUPPORT_BELOW_MA200_PENALTY;
    supportLevel = '200일선 하회 (추세 둔화, 보수적 분할 접근)';
    reasons.push('200일선 하회 상태로 천천히 분할 매수 필요');
  }

  const totalTimingScore = Math.round(Math.max(0, Math.min(100, rsiScore + ddScore + supportScore)));

  return {
    score: totalTimingScore,
    rsi,
    rsiZone,
    drawdownFromHigh: ddPct,
    drawdownLabel,
    supportLevel,
    reasons,
  };
}

/**
 * 전략 B: 우량대형주 장기 적립 & 눌림목 추매 전략 종합 평가
 */
export function evaluateDipBuyStrategy(
  ticker: string,
  name: string,
  price: number,
  change1d: number,
  classification: AssetClassification,
  indicators: RawMarketIndicators,
  metadata?: RawYahooMetadata,
  riskInputs?: RawRiskInputs
): DipBuyEvaluation {
  const C = DIP_BUY_CONFIG;
  const suitability = calculateBlueChipSuitability(ticker, classification, indicators, metadata, riskInputs);
  const timing = calculateDipTiming(indicators);

  let actionSignal: DipTimingSignal = 'NEUTRAL_ACCUMULATE';
  let signalLabel = '정기 관망';
  let guidanceMessage = '';
  let suggestedDcaRatio = '정규 1회차 적립 (통상 비중)';
  let actionable = false;

  // If not suitable for dip buying (C grade or weak B)
  if (!suitability.isSuitable) {
    actionSignal = 'INELIGIBLE_AVOID';
    signalLabel = '🚫 추매 부적합 (고위험/잡주)';
    guidanceMessage = `${suitability.tierLabel}: 고변동성/비우량 자산으로 장기 물타기 시 영구 손실 위험이 있습니다. 추매를 피하세요.`;
    suggestedDcaRatio = '추매 절대 금지 (현금 보존)';
    actionable = false;
  } else {
    // Suitable blue-chip / index ETF
    if (timing.score >= C.STRONG_DIP_BUY_TIMING_THRESHOLD || timing.rsiZone === 'DEEP_OVERSOLD') {
      actionSignal = 'STRONG_DIP_BUY';
      signalLabel = '🟢 적극 분할추매';
      actionable = true;
      guidanceMessage = `최적의 우량주 눌림목 기회! (${timing.drawdownLabel}, RSI ${timing.rsi.toFixed(1)})`;
      suggestedDcaRatio = '평소 정기 적립액의 1.5배 ~ 2.0배 확대 매수 권고';
    } else if (timing.score >= C.MODERATE_DCA_TIMING_THRESHOLD) {
      actionSignal = 'MODERATE_DCA';
      signalLabel = '🟡 정기 적립추매';
      actionable = true;
      guidanceMessage = `안정적인 가격대 유지 중. 통상적인 정기 적립 매수에 적합합니다.`;
      suggestedDcaRatio = '정규 1회차 분할 매수 진행';
    } else if (timing.rsiZone === 'OVERBOUGHT' || timing.score < C.OVERBOUGHT_WAIT_TIMING_THRESHOLD) {
      actionSignal = 'OVERBOUGHT_WAIT';
      signalLabel = '⏸️ 추매 보류 (단기과열)';
      actionable = false;
      guidanceMessage = `단기 주가 급등 과열 구간(RSI ${timing.rsi.toFixed(1)}). 무리한 추격 매수를 멈추고 눌림 조정을 기다리세요.`;
      suggestedDcaRatio = '신규 추매 일시 중단 (현금 비축 후 대기)';
    } else {
      actionSignal = 'NEUTRAL_ACCUMULATE';
      signalLabel = '⚪ 관망/정기적립';
      actionable = false;
      guidanceMessage = `적정 주가 범위 내에서 횡보 중입니다.`;
      suggestedDcaRatio = '평소 분할 일정대로 유지';
    }
  }

  // 종합 추매 매력도 점수 (우량 적합도 40% + 타이밍 60%)
  const dipScore = suitability.isSuitable
    ? Math.round(suitability.score * C.DIP_SCORE_SUITABILITY_WEIGHT + timing.score * C.DIP_SCORE_TIMING_WEIGHT)
    : Math.round(suitability.score * C.DIP_SCORE_UNSUITABLE_SUITABILITY_WEIGHT);

  return {
    ticker,
    name,
    price,
    change1d,
    suitability,
    timing,
    dip_score: dipScore,
    actionSignal,
    signalLabel,
    actionable,
    guidanceMessage,
    suggestedDcaRatio,
  };
}

/**
 * 캐시나 이전 DB 레코드에서 dip_evaluation이 누락된 경우, 기존 평가 데이터(opportunity, risk)로부터
 * 순수 함수로 즉각 복원/계산하는 헬퍼
 */
export function ensureDipEvaluation(ev: any): DipBuyEvaluation {
  // If dip_evaluation already exists and is healthy (not corrupted by historical -540% scaling bug), return it
  if (
    ev.dip_evaluation &&
    Math.abs(ev.dip_evaluation.timing?.drawdownFromHigh ?? 0) <= 100 &&
    !ev.dip_evaluation.timing?.drawdownLabel?.includes('-540')
  ) {
    return ev.dip_evaluation;
  }

  const tech = ev.opportunity?.technical_details || {};
  const fund = ev.opportunity?.fundamental_details || {};
  const riskComp = ev.risk?.components || {};

  const rawTechDD = tech.drawdownFromHigh ?? -0.05;
  const normalizedDD = Math.abs(rawTechDD) > 1.0 ? rawTechDD / 100 : rawTechDD;

  const syntheticIndicators: RawMarketIndicators = {
    price: ev.price ?? 100,
    ma20: ev.price ?? 100,
    ma50: ev.price ?? 100,
    ma200: tech.priceAboveMa20 === false ? (ev.price ?? 100) * 1.05 : (ev.price ?? 100) * 0.92,
    rsi14: tech.rsi14 ?? 50,
    drawdownFromHigh: normalizedDD,
    macdHistogramPositive: tech.macdHistogramPositive ?? true,
    return1M: ev.opportunity?.momentum_details?.return1M ?? 0.02,
    return3M: ev.opportunity?.momentum_details?.return3M ?? 0.05,
    return6M: ev.opportunity?.momentum_details?.return6M ?? 0.1,
    relativeStrengthVsSpy: ev.opportunity?.momentum_details?.relativeStrengthVsSpy ?? 1.0,
    marketCapBillions: fund.marketCapBillions ?? 100,
    operatingMargin: fund.operatingMargin ? fund.operatingMargin / 100 : 0.20,
    freeCashFlowMargin: fund.freeCashFlowMargin ? fund.freeCashFlowMargin / 100 : 0.15,
  };

  const syntheticRisk: RawRiskInputs = {
    beta: riskComp.beta ?? 1.0,
    volatility20dAnnualized: riskComp.volatility20dAnnualized ?? 0.22,
    maxDrawdown52w: riskComp.maxDrawdown52w ?? -0.15,
    rsi14: tech.rsi14 ?? 50,
    priceBelowMa200: !tech.ma50Above200,
  };

  return evaluateDipBuyStrategy(
    ev.ticker,
    ev.name || ev.ticker,
    ev.price ?? 0,
    ev.change1d ?? 0,
    ev.classification || {
      ticker: ev.ticker,
      asset_type: 'equity',
      strategy_type: 'general_equity',
      confidence: 0.8,
      classification_source: 'auto',
      reason: '자동 복원',
      classified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    syntheticIndicators,
    ev.raw_metadata,
    syntheticRisk
  );
}

