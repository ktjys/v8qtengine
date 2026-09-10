import { ATRRiskLevel, ATRRiskProfile, PositionSizingCalculation } from '../types/v8';

// Preset realistic 14-day ATR & annualized volatility mappings for core watchlist
const TICKER_VOLATILITY_DATA: Record<
  string,
  { atr14: number; annualizedVol: number; volRank: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME' }
> = {
  NVDA: { atr14: 4.85, annualizedVol: 0.48, volRank: 'HIGH' },
  TSLA: { atr14: 9.60, annualizedVol: 0.54, volRank: 'EXTREME' },
  AMD: { atr14: 5.40, annualizedVol: 0.46, volRank: 'HIGH' },
  AAPL: { atr14: 3.85, annualizedVol: 0.22, volRank: 'LOW' },
  MSFT: { atr14: 7.90, annualizedVol: 0.24, volRank: 'LOW' },
  AMZN: { atr14: 4.20, annualizedVol: 0.29, volRank: 'MEDIUM' },
  GOOGL: { atr14: 3.40, annualizedVol: 0.27, volRank: 'MEDIUM' },
  META: { atr14: 12.8, annualizedVol: 0.35, volRank: 'MEDIUM' },
  NFLX: { atr14: 16.5, annualizedVol: 0.38, volRank: 'HIGH' },
  SPY: { atr14: 5.60, annualizedVol: 0.13, volRank: 'LOW' },
  QQQ: { atr14: 6.80, annualizedVol: 0.18, volRank: 'LOW' },
  VOO: { atr14: 7.20, annualizedVol: 0.13, volRank: 'LOW' },
};

export class RiskSizingEngine {
  /**
   * 종목의 14일 ATR 변동성 기반 동적 손절/익절 프로필 산출
   */
  public static calculateATRRiskProfile(
    ticker: string,
    currentPrice: number,
    riskLevel: ATRRiskLevel = 'STANDARD'
  ): ATRRiskProfile {
    const symbol = ticker.toUpperCase();
    const volInfo = TICKER_VOLATILITY_DATA[symbol] || {
      atr14: Math.max(0.5, Math.round(currentPrice * 0.026 * 100) / 100),
      annualizedVol: 0.32,
      volRank: 'MEDIUM' as const,
    };

    const atr14 = volInfo.atr14;
    const atrPct = Math.round((atr14 / currentPrice) * 1000) / 10;

    // 손절 배수 결정
    let stopLossMultiplier: number;
    switch (riskLevel) {
      case 'AGGRESSIVE':
        stopLossMultiplier = 1.5; // 타이트한 단기 스윙 손절
        break;
      case 'CONSERVATIVE':
        stopLossMultiplier = 3.0; // 여유 있는 중기 손절 (노이즈 방지)
        break;
      case 'STANDARD':
      default:
        stopLossMultiplier = 2.0; // 퀀트 표준 권장 손절폭
        break;
    }

    const stopDistance = Math.round(atr14 * stopLossMultiplier * 100) / 100;
    const stopLossPrice = Math.max(0.01, Math.round((currentPrice - stopDistance) * 100) / 100);
    const stopLossPct = Math.round(((currentPrice - stopLossPrice) / currentPrice) * 1000) / 10;

    // 손익비 (Risk to Reward: 1차 2R, 2차 3R)
    const tp1Distance = stopDistance * 2;
    const tp2Distance = stopDistance * 3;

    const takeProfit1Price = Math.round((currentPrice + tp1Distance) * 100) / 100;
    const takeProfit1Pct = Math.round(((takeProfit1Price - currentPrice) / currentPrice) * 1000) / 10;

    const takeProfit2Price = Math.round((currentPrice + tp2Distance) * 100) / 100;
    const takeProfit2Pct = Math.round(((takeProfit2Price - currentPrice) / currentPrice) * 1000) / 10;

    // 트레일링 스탑 기본 이격 거리 (1.5x ATR)
    const trailingStopPrice = Math.round((currentPrice - atr14 * 1.5) * 100) / 100;

    return {
      ticker: symbol,
      price: currentPrice,
      atr14,
      atrPct,
      volatilityRank: volInfo.volRank,
      selectedRiskLevel: riskLevel,
      stopLossMultiplier,
      stopLossPrice,
      stopLossPct,
      takeProfit1Price,
      takeProfit1Pct,
      takeProfit2Price,
      takeProfit2Pct,
      trailingStopPrice,
      riskRewardRatio: '1 : 2.0 (1차) / 1 : 3.0 (2차)',
    };
  }

  /**
   * 계좌 위험 감수율 기반 적정 포지션 주수(Position Sizing) 역산
   */
  public static calculatePositionSize(params: {
    ticker: string;
    entryPrice: number;
    stopLossPrice: number;
    accountEquity?: number;
    riskTolerancePct?: number; // e.g. 1.0 for 1%
    maxAccountAllocationPct?: number; // e.g. 25 for 25% max position cap
  }): PositionSizingCalculation {
    const {
      ticker,
      entryPrice,
      stopLossPrice,
      accountEquity = 100000,
      riskTolerancePct = 1.0,
      maxAccountAllocationPct = 25.0,
    } = params;

    const symbol = ticker.toUpperCase();
    const riskPerShare = Math.max(0.01, Math.round((entryPrice - stopLossPrice) * 100) / 100);
    const riskAmountDollars = Math.round(accountEquity * (riskTolerancePct / 100) * 100) / 100;

    // 1주당 손실 감수액 기준 이상적 수량
    let rawShares = Math.floor(riskAmountDollars / riskPerShare);
    if (rawShares < 1) rawShares = 1;

    // 단일 종목 계좌 비중 상한선 가드 (예: 계좌의 최대 25%)
    const maxCapitalCap = accountEquity * (maxAccountAllocationPct / 100);
    const maxSharesByCapital = Math.floor(maxCapitalCap / entryPrice);

    let recommendedShares = rawShares;
    let isCappedByAccountLimit = false;
    let capWarning: string | null = null;

    if (recommendedShares > maxSharesByCapital && maxSharesByCapital > 0) {
      recommendedShares = maxSharesByCapital;
      isCappedByAccountLimit = true;
      capWarning = `단일 종목 최대 투자 한도(계좌의 ${maxAccountAllocationPct}%, $${maxCapitalCap.toLocaleString()}) 가드가 적용되어 수량이 ${rawShares}주에서 ${recommendedShares}주로 제한되었습니다.`;
    }

    const totalPositionCost = Math.round(recommendedShares * entryPrice * 100) / 100;
    const accountAllocationPct = Math.round((totalPositionCost / accountEquity) * 1000) / 10;
    const maxLossDollars = Math.round(recommendedShares * riskPerShare * 100) / 100;

    // 기대 수익금
    const expectedGain1Dollars = Math.round(recommendedShares * (riskPerShare * 2) * 100) / 100;
    const expectedGain2Dollars = Math.round(recommendedShares * (riskPerShare * 3) * 100) / 100;

    return {
      ticker: symbol,
      accountEquity,
      riskTolerancePct,
      riskAmountDollars,
      entryPrice,
      stopLossPrice,
      riskPerShare,
      recommendedShares,
      totalPositionCost,
      accountAllocationPct,
      maxLossDollars,
      expectedGain1Dollars,
      expectedGain2Dollars,
      isCappedByAccountLimit,
      capWarning,
    };
  }
}
