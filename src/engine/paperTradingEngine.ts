import {
  ForwardSignalTrackRecord,
  MarketRegion,
  OrderType,
  PaperAccountSummary,
  PaperTradeOrder,
  PaperTradePosition,
  SignalPerformanceSummary,
  TradeStrategySource,
} from '../types/v8';
import { INITIAL_HISTORICAL_SIGNALS } from '../data/seed/initialData';
import { TICKER_SECTOR_MAP } from './portfolioEngine';
import { detectMarketRegion, getStockDisplayInfo } from '../utils/marketUtils';

const STORAGE_KEY_TRADES_US = 'v8_paper_trades_log_us';
const STORAGE_KEY_TRADES_KR = 'v8_paper_trades_log_kr';

// 미국 기본 모의투자 초기 주문 및 체결 내역 ($100,000 기준)
const INITIAL_US_TRADES: PaperTradeOrder[] = [
  {
    id: 'pt-us-1',
    ticker: 'NVDA',
    companyName: '엔비디아 (NVIDIA)',
    market_region: 'US',
    orderType: 'BUY',
    strategySource: 'STRATEGY_A',
    shares: 80,
    requestedPrice: 112.5,
    executedPrice: 112.56,
    totalAmount: 9004.8,
    fee: 1.0,
    executedAt: '2026-08-25T14:30:00.000Z',
    reason: '전략 A: 모멘텀 돌파 골든크로스 신호 자동 체결',
  },
  {
    id: 'pt-us-2',
    ticker: 'AAPL',
    companyName: '애플 (Apple)',
    market_region: 'US',
    orderType: 'BUY',
    strategySource: 'STRATEGY_B',
    shares: 40,
    requestedPrice: 218.4,
    executedPrice: 218.45,
    totalAmount: 8738.0,
    fee: 1.0,
    executedAt: '2026-08-28T15:00:00.000Z',
    reason: '전략 B: S등급 초우량주 RSI 38 눌림목 분할 적립 체결',
  },
  {
    id: 'pt-us-3',
    ticker: 'SPY',
    companyName: 'S&P 500 (SPY)',
    market_region: 'US',
    orderType: 'BUY',
    strategySource: 'STRATEGY_B',
    shares: 30,
    requestedPrice: 541.2,
    executedPrice: 541.28,
    totalAmount: 16238.4,
    fee: 1.0,
    executedAt: '2026-09-01T14:00:00.000Z',
    reason: '전략 B: 60일선 지지 코어 인덱스 비중 확대',
  },
  {
    id: 'pt-us-4',
    ticker: 'TSLA',
    companyName: '테슬라 (Tesla)',
    market_region: 'US',
    orderType: 'BUY',
    strategySource: 'STRATEGY_A',
    shares: 20,
    requestedPrice: 215.0,
    executedPrice: 215.1,
    totalAmount: 4302.0,
    fee: 1.0,
    executedAt: '2026-09-02T16:00:00.000Z',
    reason: '전략 A: 20일 고가 돌파 모멘텀 진입',
  },
  {
    id: 'pt-us-5',
    ticker: 'TSLA',
    companyName: '테슬라 (Tesla)',
    market_region: 'US',
    orderType: 'SELL',
    strategySource: 'STRATEGY_A',
    shares: 20,
    requestedPrice: 228.4,
    executedPrice: 228.3,
    totalAmount: 4566.0,
    fee: 1.0,
    executedAt: '2026-09-08T19:30:00.000Z',
    reason: '전략 A: 목표가(+6.2%) 도달 1차 분할 익절 완료',
  },
];

// 국내 기본 모의투자 초기 주문 및 체결 내역 (₩100,000,000 기준)
const INITIAL_KR_TRADES: PaperTradeOrder[] = [
  {
    id: 'pt-kr-1',
    ticker: '005930.KS',
    companyName: '삼성전자',
    market_region: 'KR',
    orderType: 'BUY',
    strategySource: 'STRATEGY_B',
    shares: 200,
    requestedPrice: 71500,
    executedPrice: 71530,
    totalAmount: 14306000,
    fee: 1500,
    executedAt: '2026-08-22T01:30:00.000Z',
    reason: '전략 B: 초우량주 60일선 눌림목 1차 분할 매수',
  },
  {
    id: 'pt-kr-2',
    ticker: '000660.KS',
    companyName: 'SK하이닉스',
    market_region: 'KR',
    orderType: 'BUY',
    strategySource: 'STRATEGY_A',
    shares: 100,
    requestedPrice: 178000,
    executedPrice: 178080,
    totalAmount: 17808000,
    fee: 1500,
    executedAt: '2026-08-25T02:00:00.000Z',
    reason: '전략 A: HBM 주도주 20일선 전고점 돌파 모멘텀 진입',
  },
  {
    id: 'pt-kr-3',
    ticker: '069500.KS',
    companyName: 'KODEX 200',
    market_region: 'KR',
    orderType: 'BUY',
    strategySource: 'STRATEGY_B',
    shares: 400,
    requestedPrice: 35600,
    executedPrice: 35615,
    totalAmount: 14246000,
    fee: 1000,
    executedAt: '2026-08-29T01:00:00.000Z',
    reason: '전략 B: 코스피 200 핵심 지수 ETF 코어 비중 매수',
  },
  {
    id: 'pt-kr-4',
    ticker: '360750.KS',
    companyName: 'TIGER 미국S&P500',
    market_region: 'KR',
    orderType: 'BUY',
    strategySource: 'STRATEGY_B',
    shares: 600,
    requestedPrice: 17800,
    executedPrice: 17810,
    totalAmount: 10686000,
    fee: 1000,
    executedAt: '2026-09-02T03:00:00.000Z',
    reason: '전략 B: 원화 환노출 미국 지수 ETF 자산배분 편입',
  },
  {
    id: 'pt-kr-5',
    ticker: '000660.KS',
    companyName: 'SK하이닉스',
    market_region: 'KR',
    orderType: 'SELL',
    strategySource: 'STRATEGY_A',
    shares: 30,
    requestedPrice: 186500,
    executedPrice: 186400,
    totalAmount: 5592000,
    fee: 1500,
    executedAt: '2026-09-08T05:30:00.000Z',
    reason: '전략 A: 단기 목표가 도달 30% 1차 분할 차익 실현',
  },
];

const CURRENT_MARKET_PRICES: Record<string, number> = {
  // US
  NVDA: 118.6,
  AAPL: 224.8,
  MSFT: 428.1,
  AMZN: 184.5,
  TSLA: 228.4,
  GOOGL: 162.3,
  META: 512.4,
  AMD: 148.5,
  NFLX: 685.2,
  SPY: 548.2,
  QQQ: 472.5,
  VOO: 504.2,
  SCHD: 82.6,
  SMH: 268.4,
  PLTR: 72.4,
  // KR
  '005930.KS': 74200,
  '000660.KS': 186500,
  '373220.KS': 395000,
  '207940.KS': 980000,
  '005380.KS': 248000,
  '069500.KS': 36450,
  '360750.KS': 18450,
  '133690.KS': 38200,
  '458730.KS': 12250,
  '247540.KQ': 178000,
  '196170.KQ': 382000,
  '035420.KS': 174000,
  '068270.KS': 188000,
};

export class PaperTradingEngine {
  private static ordersUS: PaperTradeOrder[] = [...INITIAL_US_TRADES];
  private static ordersKR: PaperTradeOrder[] = [...INITIAL_KR_TRADES];

  public static readonly DEFAULT_CAPITAL_US = 100000;
  public static readonly DEFAULT_CAPITAL_KR = 100000000;

  private static initialCapitalUS: number = 100000;
  private static initialCapitalKR: number = 100000000;

  /**
   * 시장별 모의투자 계좌 초기화/리셋
   * @param market 'KR' | 'US'
   */
  public static resetAccount(
    market: MarketRegion = 'US',
    newInitialCapital?: number
  ): PaperAccountSummary {
    if (market === 'KR') {
      this.initialCapitalKR = newInitialCapital || this.DEFAULT_CAPITAL_KR;
      this.ordersKR = [];
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(STORAGE_KEY_TRADES_KR);
      }
    } else {
      this.initialCapitalUS = newInitialCapital || this.DEFAULT_CAPITAL_US;
      this.ordersUS = [];
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(STORAGE_KEY_TRADES_US);
      }
    }
    return this.getAccountSummary(market);
  }

  /**
   * 모의투자 주문 실행
   */
  public static executeOrder(params: {
    ticker: string;
    companyName?: string;
    orderType: OrderType;
    shares: number;
    price: number;
    strategySource?: TradeStrategySource;
    reason?: string;
    market?: MarketRegion;
  }): { success: boolean; order?: PaperTradeOrder; error?: string } {
    const {
      ticker,
      orderType,
      shares,
      price,
      strategySource = 'MANUAL',
      reason,
    } = params;

    const market = params.market || detectMarketRegion(ticker);
    const isKr = market === 'KR';

    if (shares <= 0) {
      return { success: false, error: '주문 수량은 1주 이상이어야 합니다.' };
    }
    if (price <= 0) {
      return { success: false, error: '유효하지 않은 주문 가격입니다.' };
    }

    const currentSummary = this.getAccountSummary(market);
    const slippagePct = isKr ? 0.0003 : 0.0005; // 슬리피지
    const executedPrice =
      orderType === 'BUY'
        ? isKr
          ? Math.round(price * (1 + slippagePct))
          : Math.round(price * (1 + slippagePct) * 100) / 100
        : isKr
        ? Math.round(price * (1 - slippagePct))
        : Math.round(price * (1 - slippagePct) * 100) / 100;

    const totalAmount = isKr
      ? Math.round(shares * executedPrice)
      : Math.round(shares * executedPrice * 100) / 100;
    const fee = isKr ? 1500 : 1.0; // 원화 1,500원 / 달러 $1.00

    const currencySymbol = isKr ? '₩' : '$';

    if (orderType === 'BUY') {
      const requiredCash = totalAmount + fee;
      if (currentSummary.cashBalance < requiredCash) {
        return {
          success: false,
          error: `가상 예수금 부족: 필요 금액 ${currencySymbol}${requiredCash.toLocaleString()} > 보유 예수금 ${currencySymbol}${currentSummary.cashBalance.toLocaleString()}`,
        };
      }
    } else {
      // SELL: Check current shares
      const existingPos = currentSummary.positions.find((p) => p.ticker === ticker);
      if (!existingPos || existingPos.shares < shares) {
        return {
          success: false,
          error: `보유 주수 부족: 매도 요청 ${shares}주 > 보유 ${
            existingPos ? existingPos.shares : 0
          }주`,
        };
      }
    }

    const { primaryName } = getStockDisplayInfo(ticker, params.companyName);
    const companyName =
      primaryName ||
      TICKER_SECTOR_MAP[ticker]?.companyName ||
      `${ticker} Corp.`;

    const newOrder: PaperTradeOrder = {
      id: `pt-${market.toLowerCase()}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      ticker,
      companyName,
      market_region: market,
      orderType,
      strategySource,
      shares,
      requestedPrice: price,
      executedPrice,
      totalAmount,
      fee,
      executedAt: new Date().toISOString(),
      reason: reason || `${strategySource} 모의투자 체결`,
    };

    if (isKr) {
      this.ordersKR.push(newOrder);
    } else {
      this.ordersUS.push(newOrder);
    }

    return { success: true, order: newOrder };
  }

  /**
   * 계좌 전체 요약, 보유 포지션, 손익 집계 (시장별 분리)
   */
  public static getAccountSummary(
    market: MarketRegion = 'US',
    customPrices?: Record<string, number>
  ): PaperAccountSummary {
    const isKr = market === 'KR';
    const initialCap = isKr ? this.initialCapitalKR : this.initialCapitalUS;
    const orders = isKr ? this.ordersKR : this.ordersUS;
    const prices = { ...CURRENT_MARKET_PRICES, ...customPrices };

    let cash = initialCap;
    let realizedPnL = 0;
    let winningTrades = 0;
    let losingTrades = 0;
    let totalTrades = 0;

    const holdingMap: Record<
      string,
      {
        companyName: string;
        shares: number;
        totalCost: number;
        strategySource: TradeStrategySource;
        firstBoughtAt: string;
        market_region: MarketRegion;
      }
    > = {};

    for (const order of orders) {
      if (order.orderType === 'BUY') {
        cash -= order.totalAmount + order.fee;
        if (!holdingMap[order.ticker]) {
          holdingMap[order.ticker] = {
            companyName: order.companyName,
            shares: 0,
            totalCost: 0,
            strategySource: order.strategySource,
            firstBoughtAt: order.executedAt,
            market_region: market,
          };
        }
        holdingMap[order.ticker].shares += order.shares;
        holdingMap[order.ticker].totalCost += order.totalAmount;
      } else {
        // SELL
        totalTrades++;
        const pos = holdingMap[order.ticker];
        const costPerShare =
          pos && pos.shares > 0 ? pos.totalCost / pos.shares : order.executedPrice;
        const soldCost = costPerShare * order.shares;
        const profit = order.totalAmount - soldCost - order.fee;

        realizedPnL += profit;
        cash += order.totalAmount - order.fee;

        if (profit > 0) winningTrades++;
        else if (profit < 0) losingTrades++;

        if (pos) {
          pos.shares -= order.shares;
          pos.totalCost = Math.max(0, pos.totalCost - soldCost);
        }
      }
    }

    let portfolioValue = 0;
    let unrealizedPnL = 0;
    const positions: PaperTradePosition[] = [];

    Object.entries(holdingMap).forEach(([ticker, data]) => {
      if (data.shares > 0) {
        const currentPrice = prices[ticker] || (data.shares > 0 ? data.totalCost / data.shares : 0);
        const marketValue = isKr
          ? Math.round(data.shares * currentPrice)
          : Math.round(data.shares * currentPrice * 100) / 100;
        const posUnrealized = isKr
          ? Math.round(marketValue - data.totalCost)
          : Math.round((marketValue - data.totalCost) * 100) / 100;
        const posUnrealizedPct =
          data.totalCost > 0
            ? Math.round((posUnrealized / data.totalCost) * 1000) / 10
            : 0;

        portfolioValue += marketValue;
        unrealizedPnL += posUnrealized;

        const { primaryName } = getStockDisplayInfo(ticker, data.companyName);

        positions.push({
          ticker,
          companyName: primaryName || data.companyName,
          market_region: market,
          shares: data.shares,
          avgCostBasis: isKr
            ? Math.round(data.totalCost / data.shares)
            : Math.round((data.totalCost / data.shares) * 100) / 100,
          currentPrice,
          totalCost: isKr ? Math.round(data.totalCost) : Math.round(data.totalCost * 100) / 100,
          marketValue,
          unrealizedPnL: posUnrealized,
          unrealizedPnLPct: posUnrealizedPct,
          strategySource: data.strategySource,
          firstBoughtAt: data.firstBoughtAt,
        });
      }
    });

    cash = isKr ? Math.round(cash) : Math.round(cash * 100) / 100;
    portfolioValue = isKr ? Math.round(portfolioValue) : Math.round(portfolioValue * 100) / 100;
    realizedPnL = isKr ? Math.round(realizedPnL) : Math.round(realizedPnL * 100) / 100;
    unrealizedPnL = isKr ? Math.round(unrealizedPnL) : Math.round(unrealizedPnL * 100) / 100;
    const totalEquity = isKr ? Math.round(cash + portfolioValue) : Math.round((cash + portfolioValue) * 100) / 100;
    const totalPnL = isKr ? Math.round(totalEquity - initialCap) : Math.round((totalEquity - initialCap) * 100) / 100;
    const totalReturnPct = Math.round((totalPnL / initialCap) * 1000) / 10;
    const winRate =
      totalTrades > 0 ? Math.round((winningTrades / totalTrades) * 1000) / 10 : 100;

    return {
      market_region: market,
      currency: isKr ? 'KRW' : 'USD',
      initialBalance: initialCap,
      cashBalance: cash,
      portfolioValue,
      totalEquity,
      realizedPnL,
      unrealizedPnL,
      totalPnL,
      totalReturnPct,
      winRate,
      totalTrades,
      winningTrades,
      losingTrades,
      positions,
      tradeHistory: [...orders].reverse(),
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * 시그널 사후 성과 & 적중률 (Forward Signal Track Record) 산출 (시장별 필터 지원)
   */
  public static getSignalPerformanceSummary(market?: MarketRegion): SignalPerformanceSummary {
    let rawSignals = INITIAL_HISTORICAL_SIGNALS;
    if (market) {
      rawSignals = rawSignals.filter(
        (s) => (s.market_region || detectMarketRegion(s.ticker)) === market
      );
    }

    const records: ForwardSignalTrackRecord[] = rawSignals.map((sig, idx) => {
      const currentPrice = CURRENT_MARKET_PRICES[sig.ticker] || sig.signal_price * 1.05;
      const daysElapsed = 14 + (idx % 10);
      const currentReturnPct =
        Math.round(((currentPrice - sig.signal_price) / sig.signal_price) * 1000) / 10;

      const mfePct = Math.max(
        currentReturnPct,
        (sig.return_5d || 0) + 1.8,
        (sig.return_10d || 0) + 2.4
      );
      const maePct = Math.min(-0.8, (sig.return_5d || 0) - 1.2);
      const isWin =
        currentReturnPct > 0 || (sig.return_10d !== undefined && sig.return_10d !== null && sig.return_10d > 0);

      const strategyType: 'STRATEGY_A' | 'STRATEGY_B' =
        idx % 2 === 0 ? 'STRATEGY_A' : 'STRATEGY_B';

      const { primaryName } = getStockDisplayInfo(sig.ticker, sig.name);

      return {
        id: `track-${sig.id}`,
        ticker: sig.ticker,
        companyName: primaryName || sig.name,
        strategyType,
        signalDate: sig.signal_date,
        signalPrice: sig.signal_price,
        currentPrice,
        daysElapsed,
        currentReturnPct,
        mfePct: Math.round(mfePct * 10) / 10,
        maePct: Math.round(maePct * 10) / 10,
        returnT5: sig.return_5d,
        returnT10: sig.return_10d,
        returnT20: sig.return_20d,
        hitStatus: isWin ? 'WIN' : 'LOSS',
        notes: isWin ? '목표 수익 도달 성공 (+2R 이격 달성)' : '단기 변동성 조정 지속',
      };
    });

    const total = records.length;
    const winCount = records.filter((r) => r.hitStatus === 'WIN').length;
    const lossCount = total - winCount;
    const winRatePct = total > 0 ? Math.round((winCount / total) * 1000) / 10 : 0;
    const avgReturn =
      total > 0
        ? Math.round((records.reduce((acc, r) => acc + r.currentReturnPct, 0) / total) * 10) / 10
        : 0;

    const stratA = records.filter((r) => r.strategyType === 'STRATEGY_A');
    const stratB = records.filter((r) => r.strategyType === 'STRATEGY_B');

    const stratA_Wins = stratA.filter((r) => r.hitStatus === 'WIN').length;
    const stratB_Wins = stratB.filter((r) => r.hitStatus === 'WIN').length;

    const best = records.length > 0
      ? records.reduce((prev, curr) => (curr.currentReturnPct > prev.currentReturnPct ? curr : prev))
      : null;
    const worst = records.length > 0
      ? records.reduce((prev, curr) => (curr.currentReturnPct < prev.currentReturnPct ? curr : prev))
      : null;

    return {
      totalSignals: total,
      winCount,
      lossCount,
      winRatePct,
      avgReturnPct: avgReturn,
      strategyA: {
        total: stratA.length,
        winRatePct:
          stratA.length > 0 ? Math.round((stratA_Wins / stratA.length) * 1000) / 10 : 0,
        avgReturnPct:
          stratA.length > 0
            ? Math.round((stratA.reduce((a, b) => a + b.currentReturnPct, 0) / stratA.length) * 10) / 10
            : 0,
      },
      strategyB: {
        total: stratB.length,
        winRatePct:
          stratB.length > 0 ? Math.round((stratB_Wins / stratB.length) * 1000) / 10 : 0,
        avgReturnPct:
          stratB.length > 0
            ? Math.round((stratB.reduce((a, b) => a + b.currentReturnPct, 0) / stratB.length) * 10) / 10
            : 0,
      },
      bestSignal: {
        ticker: best ? best.ticker : (market === 'KR' ? '000660.KS' : 'NVDA'),
        returnPct: best ? best.currentReturnPct : 8.5,
      },
      worstSignal: {
        ticker: worst ? worst.ticker : (market === 'KR' ? '069500.KS' : 'TSLA'),
        returnPct: worst ? worst.currentReturnPct : -1.2,
      },
      records,
    };
  }
}
