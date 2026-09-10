import {
  CorrelationPair,
  DynamicStrategySplit,
  MacroMarketRegime,
  MarketRegimeType,
  MarketSector,
  PortfolioPosition,
  PortfolioRebalanceState,
  SectorExposure,
} from '../types/v8';
import { MacroEarningsEngine } from './macroEarningsEngine';

export interface SectorMeta {
  sector: MarketSector;
  maxCapPct: number;
}

export const TICKER_SECTOR_MAP: Record<string, { companyName: string; sector: MarketSector; defaultStrategy: 'STRATEGY_A' | 'STRATEGY_B' | 'CORE_INDEX' }> = {
  NVDA: { companyName: 'NVIDIA Corporation', sector: 'Semiconductors', defaultStrategy: 'STRATEGY_A' },
  AMD: { companyName: 'Advanced Micro Devices', sector: 'Semiconductors', defaultStrategy: 'STRATEGY_A' },
  AAPL: { companyName: 'Apple Inc.', sector: 'Technology', defaultStrategy: 'STRATEGY_B' },
  MSFT: { companyName: 'Microsoft Corporation', sector: 'Technology', defaultStrategy: 'STRATEGY_B' },
  AMZN: { companyName: 'Amazon.com, Inc.', sector: 'Consumer Discretionary', defaultStrategy: 'STRATEGY_B' },
  TSLA: { companyName: 'Tesla, Inc.', sector: 'Consumer Discretionary', defaultStrategy: 'STRATEGY_A' },
  GOOGL: { companyName: 'Alphabet Inc.', sector: 'Communication Services', defaultStrategy: 'STRATEGY_B' },
  META: { companyName: 'Meta Platforms, Inc.', sector: 'Communication Services', defaultStrategy: 'STRATEGY_A' },
  NFLX: { companyName: 'Netflix, Inc.', sector: 'Communication Services', defaultStrategy: 'STRATEGY_A' },
  SPY: { companyName: 'SPDR S&P 500 ETF', sector: 'Broad Market Index ETF', defaultStrategy: 'CORE_INDEX' },
  QQQ: { companyName: 'Invesco QQQ Trust', sector: 'Broad Market Index ETF', defaultStrategy: 'CORE_INDEX' },
};

export const SECTOR_CAPS: Record<MarketSector, number> = {
  'Technology': 35,
  'Semiconductors': 30,
  'Consumer Discretionary': 25,
  'Communication Services': 25,
  'Broad Market Index ETF': 50,
  'Cash & Equivalents': 100,
};

// Universe tickers for Correlation Matrix
export const UNIVERSE_TICKERS = ['SPY', 'QQQ', 'NVDA', 'AAPL', 'MSFT', 'AMZN', 'TSLA', 'GOOGL', 'META', 'AMD'];

// Authoritative 60-Day Return Correlation Matrix
const BASE_CORRELATION_MATRIX: number[][] = [
  // SPY   QQQ   NVDA  AAPL  MSFT  AMZN  TSLA  GOOGL META  AMD
  [1.00, 0.94, 0.72, 0.81, 0.85, 0.79, 0.52, 0.82, 0.75, 0.68], // SPY
  [0.94, 1.00, 0.82, 0.86, 0.89, 0.84, 0.58, 0.86, 0.81, 0.79], // QQQ
  [0.72, 0.82, 1.00, 0.63, 0.74, 0.69, 0.55, 0.68, 0.71, 0.85], // NVDA
  [0.81, 0.86, 0.63, 1.00, 0.77, 0.71, 0.46, 0.75, 0.69, 0.61], // AAPL
  [0.85, 0.89, 0.74, 0.77, 1.00, 0.78, 0.51, 0.84, 0.76, 0.72], // MSFT
  [0.79, 0.84, 0.69, 0.71, 0.78, 1.00, 0.54, 0.77, 0.74, 0.66], // AMZN
  [0.52, 0.58, 0.55, 0.46, 0.51, 0.54, 1.00, 0.49, 0.50, 0.53], // TSLA
  [0.82, 0.86, 0.68, 0.75, 0.84, 0.77, 0.49, 1.00, 0.80, 0.67], // GOOGL
  [0.75, 0.81, 0.71, 0.69, 0.76, 0.74, 0.50, 0.80, 1.00, 0.70], // META
  [0.68, 0.79, 0.85, 0.61, 0.72, 0.66, 0.53, 0.67, 0.70, 1.00], // AMD
];

// Initial Base Model Portfolio Holding Quantities ($100,000 Portfolio)
const DEFAULT_HOLDINGS: { ticker: string; shares: number; price: number }[] = [
  { ticker: 'SPY', shares: 35, price: 548.2 },   // $19,187 (19.2%)
  { ticker: 'QQQ', shares: 30, price: 472.5 },   // $14,175 (14.2%)
  { ticker: 'NVDA', shares: 120, price: 118.6 }, // $14,232 (14.2%)
  { ticker: 'AAPL', shares: 45, price: 224.8 },  // $10,116 (10.1%)
  { ticker: 'MSFT', shares: 25, price: 428.1 },  // $10,702 (10.7%)
  { ticker: 'AMZN', shares: 40, price: 184.5 },  // $7,380  (7.4%)
  { ticker: 'TSLA', shares: 25, price: 228.4 },  // $5,710  (5.7%)
  { ticker: 'GOOGL', shares: 35, price: 162.3 }, // $5,680  (5.7%)
  { ticker: 'META', shares: 10, price: 512.4 },  // $5,124  (5.1%)
];

export class PortfolioEngine {
  /**
   * 시장 매크로 체제(Risk-On/Caution/Risk-Off)에 따른 동적 전략 배분 비율 산출
   */
  public static getDynamicStrategySplit(regime: MarketRegimeType): DynamicStrategySplit {
    switch (regime) {
      case 'RISK_ON':
        return {
          strategyA_MomentumPct: 60,
          strategyB_DipDcaPct: 30,
          cashBufferPct: 10,
          regime,
          regimeName: '강세 적극 투자 국면 (Risk-On)',
          adjustmentReason: '변동성 안정 및 우호적 금리로 모멘텀 추세돌파(전략 A)에 60%를 주력 배정하고 우량주 눌림목에 30%, 최소 현금 10%를 유지합니다.',
        };
      case 'RISK_OFF':
        return {
          strategyA_MomentumPct: 15,
          strategyB_DipDcaPct: 50,
          cashBufferPct: 35,
          regime,
          regimeName: '위험 회피 방어 국면 (Risk-Off)',
          adjustmentReason: 'VIX 급등 및 긴축 압박에 따라 모멘텀 돌파 비중을 15%로 대폭 축소하고, S등급 우량주 눌림목 분할적립(전략 B) 50% 및 방어 현금 35%를 확보합니다.',
        };
      case 'NEUTRAL_CAUTION':
      default:
        return {
          strategyA_MomentumPct: 40,
          strategyB_DipDcaPct: 40,
          cashBufferPct: 20,
          regime,
          regimeName: '중립 경계 및 선별 국면 (Neutral/Caution)',
          adjustmentReason: '지수 박스권 및 변동성 경계에 대응하여 전략 A와 B를 4:4 균등 배분하고 예비 현금 버퍼를 20%로 상향합니다.',
        };
    }
  }

  /**
   * 고상관 자산 쌍(Correlation > 0.80) 추출 및 분산도 진단
   */
  public static getHighCorrelationPairs(): CorrelationPair[] {
    const pairs: CorrelationPair[] = [];
    const tickers = UNIVERSE_TICKERS;

    for (let i = 0; i < tickers.length; i++) {
      for (let j = i + 1; j < tickers.length; j++) {
        const corr = BASE_CORRELATION_MATRIX[i][j];
        let level: CorrelationPair['level'] = 'MODERATE';
        let label = '적정 분산';

        if (corr >= 0.85) {
          level = 'HIGH_CORRELATION';
          label = '동조화 과다 (동일 방향 위험)';
        } else if (corr >= 0.75) {
          level = 'HIGH_CORRELATION';
          label = '높은 상관성';
        } else if (corr < 0.55) {
          level = 'DIVERSIFIED';
          label = '우수 분산 효과';
        }

        pairs.push({
          ticker1: tickers[i],
          ticker2: tickers[j],
          correlation: corr,
          level,
          label,
        });
      }
    }

    return pairs.sort((a, b) => b.correlation - a.correlation);
  }

  /**
   * 전체 포트폴리오 자산 배분 상태 및 리밸런싱 주문 가이드 생성
   */
  public static calculatePortfolioState(
    customTotalCapital?: number,
    macroRegime?: MacroMarketRegime
  ): PortfolioRebalanceState {
    const regime = macroRegime ? macroRegime.overallRegime : 'RISK_ON';
    const strategySplit = this.getDynamicStrategySplit(regime);

    // 1. Calculate holding values
    let totalInvested = 0;
    const rawPositions = DEFAULT_HOLDINGS.map((h) => {
      const meta = TICKER_SECTOR_MAP[h.ticker] || {
        companyName: h.ticker,
        sector: 'Technology' as MarketSector,
        defaultStrategy: 'STRATEGY_A' as const,
      };
      const marketValue = Math.round(h.shares * h.price * 100) / 100;
      totalInvested += marketValue;
      return {
        ...h,
        companyName: meta.companyName,
        sector: meta.sector,
        strategyAssigned: meta.defaultStrategy,
        marketValue,
      };
    });

    const totalCapital = customTotalCapital || 100000;
    const cashBalance = Math.max(0, Math.round((totalCapital - totalInvested) * 100) / 100);
    const cashWeightPct = Math.round((cashBalance / totalCapital) * 1000) / 10;

    // 2. Compute current weights & target weights based on Strategy & Quality Tier
    const targetWeights: Record<string, number> = {
      SPY: 18.0,
      QQQ: 14.0,
      NVDA: 12.0,
      AAPL: 11.0,
      MSFT: 11.0,
      AMZN: 8.0,
      TSLA: 6.0,
      GOOGL: 6.0,
      META: 4.0,
    };

    // If Risk-Off, tilt target weights toward Core Index & Quality S-tier (SPY, QQQ, AAPL, MSFT)
    if (regime === 'RISK_OFF') {
      targetWeights['SPY'] = 22.0;
      targetWeights['QQQ'] = 16.0;
      targetWeights['AAPL'] = 12.0;
      targetWeights['MSFT'] = 12.0;
      targetWeights['NVDA'] = 8.0;
      targetWeights['TSLA'] = 3.0;
      targetWeights['META'] = 2.0;
    }

    const positions: PortfolioPosition[] = rawPositions.map((pos) => {
      const currentWeightPct = Math.round((pos.marketValue / totalCapital) * 1000) / 10;
      const targetWeightPct = targetWeights[pos.ticker] || 5.0;
      const weightDeltaPct = Math.round((targetWeightPct - currentWeightPct) * 10) / 10;

      // Target cash delta
      const targetMarketValue = (totalCapital * targetWeightPct) / 100;
      const recommendedCashDelta = Math.round((targetMarketValue - pos.marketValue) * 10) / 10;
      const recommendedSharesDelta = Math.round(recommendedCashDelta / pos.price);

      let rebalanceAction: PortfolioPosition['rebalanceAction'] = 'BALANCED';
      if (recommendedCashDelta > 300) {
        rebalanceAction = 'INCREASE';
      } else if (recommendedCashDelta < -300) {
        rebalanceAction = 'TRIM';
      }

      return {
        ticker: pos.ticker,
        companyName: pos.companyName,
        sector: pos.sector,
        strategyAssigned: pos.strategyAssigned,
        shares: pos.shares,
        currentPrice: pos.price,
        marketValue: pos.marketValue,
        currentWeightPct,
        targetWeightPct,
        weightDeltaPct,
        rebalanceAction,
        recommendedSharesDelta,
        recommendedCashDelta,
      };
    });

    // 3. Sector Exposure aggregation
    const sectorMap: Record<MarketSector, { weight: number; tickers: string[] }> = {
      'Technology': { weight: 0, tickers: [] },
      'Semiconductors': { weight: 0, tickers: [] },
      'Consumer Discretionary': { weight: 0, tickers: [] },
      'Communication Services': { weight: 0, tickers: [] },
      'Broad Market Index ETF': { weight: 0, tickers: [] },
      'Cash & Equivalents': { weight: cashWeightPct, tickers: ['USD'] },
    };

    positions.forEach((p) => {
      sectorMap[p.sector].weight += p.currentWeightPct;
      sectorMap[p.sector].tickers.push(p.ticker);
    });

    let maxConcentrationAlert: string | null = null;
    const sectorExposures: SectorExposure[] = (Object.keys(sectorMap) as MarketSector[]).map((sector) => {
      const currentWeight = Math.round(sectorMap[sector].weight * 10) / 10;
      const maxCap = SECTOR_CAPS[sector];
      let status: SectorExposure['status'] = 'OPTIMAL';

      if (sector !== 'Cash & Equivalents' && currentWeight > maxCap) {
        status = 'OVERWEIGHT_BREACH';
        maxConcentrationAlert = `[섹터 쏠림 경고] ${sector} 비중이 ${currentWeight}%로 권고 상한(${maxCap}%)을 초과했습니다.`;
      } else if (sector !== 'Cash & Equivalents' && currentWeight > maxCap - 3) {
        status = 'ELEVATED';
      }

      return {
        sector,
        currentWeightPct: currentWeight,
        maxCapPct: maxCap,
        status,
        tickerCount: sectorMap[sector].tickers.length,
        tickers: sectorMap[sector].tickers,
      };
    });

    return {
      totalCapital,
      totalInvested: Math.round(totalInvested * 100) / 100,
      cashBalance,
      cashWeightPct,
      strategySplit,
      sectorExposures,
      positions,
      correlationMatrix: {
        tickers: UNIVERSE_TICKERS,
        matrix: BASE_CORRELATION_MATRIX,
      },
      highCorrelationPairs: this.getHighCorrelationPairs(),
      maxConcentrationAlert,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * 텔레그램 발송용 포트폴리오 리밸런싱 요약 텍스트 생성
   */
  public static buildRebalanceTelegramSummary(state: PortfolioRebalanceState): string {
    let msg = `💼 <b>[포트폴리오 동적 자산배분 & 리밸런싱 가이드]</b>\n`;
    msg += `• <b>총 평가 자산:</b> $${state.totalCapital.toLocaleString()} (예수금: ${state.cashWeightPct}%)\n`;
    msg += `• <b>동적 배분 모델:</b> 전략 A ${state.strategySplit.strategyA_MomentumPct}% | 전략 B ${state.strategySplit.strategyB_DipDcaPct}% | 현금 ${state.strategySplit.cashBufferPct}%\n`;
    msg += `• <b>시장 체제:</b> ${state.strategySplit.regimeName}\n\n`;

    const trims = state.positions.filter((p) => p.rebalanceAction === 'TRIM');
    const adds = state.positions.filter((p) => p.rebalanceAction === 'INCREASE');

    if (trims.length > 0) {
      msg += `🔻 <b>[비중 축소/차익실현 권고 (Trim)]</b>\n`;
      trims.slice(0, 3).forEach((p) => {
        msg += `• <b>${p.ticker}</b>: ${p.recommendedSharesDelta}주 ($${Math.abs(p.recommendedCashDelta).toLocaleString()} 회수, 비중 ${p.currentWeightPct}% → ${p.targetWeightPct}%)\n`;
      });
      msg += `\n`;
    }

    if (adds.length > 0) {
      msg += `🔺 <b>[비중 확대/눌림목 채우기 (Increase)]</b>\n`;
      adds.slice(0, 3).forEach((p) => {
        msg += `• <b>${p.ticker}</b>: +${p.recommendedSharesDelta}주 (+$${p.recommendedCashDelta.toLocaleString()} 투입, 비중 ${p.currentWeightPct}% → ${p.targetWeightPct}%)\n`;
      });
      msg += `\n`;
    }

    if (state.maxConcentrationAlert) {
      msg += `⚠️ ${state.maxConcentrationAlert}\n`;
    }

    return msg;
  }
}
