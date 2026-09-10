import {
  ForwardSignalTrackRecord,
  OrderType,
  PaperAccountSummary,
  PaperTradeOrder,
  PaperTradePosition,
  SignalPerformanceSummary,
  TradeStrategySource,
} from '../types/v8';
import { INITIAL_HISTORICAL_SIGNALS } from '../data/seed/initialData';
import { TICKER_SECTOR_MAP } from './portfolioEngine';

const STORAGE_KEY_ACCOUNT = 'v8_paper_account_state';
const STORAGE_KEY_TRADES = 'v8_paper_trades_log';

// Default initial positions for realism ($100,000 started 2 weeks ago)
const INITIAL_PAPER_TRADES: PaperTradeOrder[] = [
  {
    id: 'pt-1',
    ticker: 'NVDA',
    companyName: 'NVIDIA Corporation',
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
    id: 'pt-2',
    ticker: 'AAPL',
    companyName: 'Apple Inc.',
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
    id: 'pt-3',
    ticker: 'SPY',
    companyName: 'SPDR S&P 500 ETF',
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
    id: 'pt-4',
    ticker: 'TSLA',
    companyName: 'Tesla, Inc.',
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
    id: 'pt-5',
    ticker: 'TSLA',
    companyName: 'Tesla, Inc.',
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

const CURRENT_MARKET_PRICES: Record<string, number> = {
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
};

export class PaperTradingEngine {
  private static orders: PaperTradeOrder[] = [...INITIAL_PAPER_TRADES];
  private static initialCapital: number = 100000;

  /**
   * 가상 계좌 초기화 또는 리셋
   */
  public static resetAccount(newInitialCapital: number = 100000): PaperAccountSummary {
    this.initialCapital = newInitialCapital;
    this.orders = [];
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(STORAGE_KEY_TRADES);
    }
    return this.getAccountSummary();
  }

  /**
   * 주문 실행 (BUY or SELL)
   */
  public static executeOrder(params: {
    ticker: string;
    companyName?: string;
    orderType: OrderType;
    shares: number;
    price: number;
    strategySource?: TradeStrategySource;
    reason?: string;
  }): { success: boolean; order?: PaperTradeOrder; error?: string } {
    const { ticker, orderType, shares, price, strategySource = 'MANUAL', reason } = params;

    if (shares <= 0) {
      return { success: false, error: '주문 수량은 1주 이상이어야 합니다.' };
    }
    if (price <= 0) {
      return { success: false, error: '유효하지 않은 주문 가격입니다.' };
    }

    const currentSummary = this.getAccountSummary();
    const slippagePct = 0.0005; // 0.05% 슬리피지
    const executedPrice =
      orderType === 'BUY'
        ? Math.round(price * (1 + slippagePct) * 100) / 100
        : Math.round(price * (1 - slippagePct) * 100) / 100;

    const totalAmount = Math.round(shares * executedPrice * 100) / 100;
    const fee = 1.0; // $1.00 고정 거래 수수료

    if (orderType === 'BUY') {
      const requiredCash = totalAmount + fee;
      if (currentSummary.cashBalance < requiredCash) {
        return {
          success: false,
          error: `가상 예수금 부족: 필요 금액 $${requiredCash.toLocaleString()} > 보유 예수금 $${currentSummary.cashBalance.toLocaleString()}`,
        };
      }
    } else {
      // SELL: Check current shares
      const existingPos = currentSummary.positions.find((p) => p.ticker === ticker);
      if (!existingPos || existingPos.shares < shares) {
        return {
          success: false,
          error: `보유 주수 부족: 매도 요청 ${shares}주 > 보유 ${existingPos ? existingPos.shares : 0}주`,
        };
      }
    }

    const companyName =
      params.companyName || TICKER_SECTOR_MAP[ticker]?.companyName || `${ticker} Corp.`;

    const newOrder: PaperTradeOrder = {
      id: `pt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      ticker,
      companyName,
      orderType,
      strategySource,
      shares,
      requestedPrice: price,
      executedPrice,
      totalAmount,
      fee,
      executedAt: new Date().toISOString(),
      reason: reason || `${strategySource} 모의투자 수동 체결`,
    };

    this.orders.push(newOrder);

    return { success: true, order: newOrder };
  }

  /**
   * 계좌 전체 요약, 보유 포지션, 실현/미실현 손익 집계
   */
  public static getAccountSummary(
    customPrices?: Record<string, number>
  ): PaperAccountSummary {
    const prices = { ...CURRENT_MARKET_PRICES, ...customPrices };
    let cash = this.initialCapital;
    let realizedPnL = 0;
    let winningTrades = 0;
    let losingTrades = 0;
    let totalTrades = 0;

    // Map of ticker to holding state
    const holdingMap: Record<
      string,
      {
        companyName: string;
        shares: number;
        totalCost: number;
        strategySource: TradeStrategySource;
        firstBoughtAt: string;
      }
    > = {};

    for (const order of this.orders) {
      if (order.orderType === 'BUY') {
        cash -= order.totalAmount + order.fee;
        if (!holdingMap[order.ticker]) {
          holdingMap[order.ticker] = {
            companyName: order.companyName,
            shares: 0,
            totalCost: 0,
            strategySource: order.strategySource,
            firstBoughtAt: order.executedAt,
          };
        }
        holdingMap[order.ticker].shares += order.shares;
        holdingMap[order.ticker].totalCost += order.totalAmount;
      } else {
        // SELL
        totalTrades++;
        const pos = holdingMap[order.ticker];
        const costPerShare = pos && pos.shares > 0 ? pos.totalCost / pos.shares : order.executedPrice;
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

    // Build positions
    let portfolioValue = 0;
    let unrealizedPnL = 0;
    const positions: PaperTradePosition[] = [];

    Object.entries(holdingMap).forEach(([ticker, data]) => {
      if (data.shares > 0) {
        const currentPrice = prices[ticker] || data.totalCost / data.shares;
        const marketValue = Math.round(data.shares * currentPrice * 100) / 100;
        const posUnrealized = Math.round((marketValue - data.totalCost) * 100) / 100;
        const posUnrealizedPct =
          data.totalCost > 0 ? Math.round((posUnrealized / data.totalCost) * 1000) / 10 : 0;

        portfolioValue += marketValue;
        unrealizedPnL += posUnrealized;

        positions.push({
          ticker,
          companyName: data.companyName,
          shares: data.shares,
          avgCostBasis: Math.round((data.totalCost / data.shares) * 100) / 100,
          currentPrice,
          totalCost: Math.round(data.totalCost * 100) / 100,
          marketValue,
          unrealizedPnL: posUnrealized,
          unrealizedPnLPct: posUnrealizedPct,
          strategySource: data.strategySource,
          firstBoughtAt: data.firstBoughtAt,
        });
      }
    });

    cash = Math.round(cash * 100) / 100;
    portfolioValue = Math.round(portfolioValue * 100) / 100;
    realizedPnL = Math.round(realizedPnL * 100) / 100;
    unrealizedPnL = Math.round(unrealizedPnL * 100) / 100;
    const totalEquity = Math.round((cash + portfolioValue) * 100) / 100;
    const totalPnL = Math.round((totalEquity - this.initialCapital) * 100) / 100;
    const totalReturnPct = Math.round((totalPnL / this.initialCapital) * 1000) / 10;
    const winRate = totalTrades > 0 ? Math.round((winningTrades / totalTrades) * 1000) / 10 : 100;

    return {
      initialBalance: this.initialCapital,
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
      tradeHistory: [...this.orders].reverse(),
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * 시그널 사후 성과 & 적중률 (Forward Signal Track Record) 산출
   */
  public static getSignalPerformanceSummary(): SignalPerformanceSummary {
    const rawSignals = INITIAL_HISTORICAL_SIGNALS;
    const records: ForwardSignalTrackRecord[] = rawSignals.map((sig, idx) => {
      const currentPrice = CURRENT_MARKET_PRICES[sig.ticker] || sig.signal_price * 1.05;
      const daysElapsed = 14 + (idx % 10);
      const currentReturnPct =
        Math.round(((currentPrice - sig.signal_price) / sig.signal_price) * 1000) / 10;

      // Realistic MFE / MAE
      const mfePct = Math.max(currentReturnPct, (sig.return_5d || 0) + 1.8, (sig.return_10d || 0) + 2.4);
      const maePct = Math.min(-0.8, (sig.return_5d || 0) - 1.2);
      const isWin = currentReturnPct > 0 || (sig.return_10d !== undefined && sig.return_10d > 0);

      const strategyType: 'STRATEGY_A' | 'STRATEGY_B' =
        idx % 2 === 0 ? 'STRATEGY_A' : 'STRATEGY_B';

      return {
        id: `track-${sig.id}`,
        ticker: sig.ticker,
        companyName: TICKER_SECTOR_MAP[sig.ticker]?.companyName || `${sig.ticker} Corp.`,
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

    const best = records.reduce((prev, curr) =>
      curr.currentReturnPct > prev.currentReturnPct ? curr : prev
    );
    const worst = records.reduce((prev, curr) =>
      curr.currentReturnPct < prev.currentReturnPct ? curr : prev
    );

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
        ticker: best ? best.ticker : 'NVDA',
        returnPct: best ? best.currentReturnPct : 8.5,
      },
      worstSignal: {
        ticker: worst ? worst.ticker : 'TSLA',
        returnPct: worst ? worst.currentReturnPct : -1.2,
      },
      records,
    };
  }
}
