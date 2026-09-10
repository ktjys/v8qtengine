import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  DollarSign,
  ExternalLink,
  Flame,
  HelpCircle,
  Layers,
  Percent,
  Plus,
  RefreshCw,
  RotateCcw,
  Scale,
  Shield,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import {
  ForwardSignalTrackRecord,
  OrderType,
  PaperAccountSummary,
  PaperTradeOrder,
  PaperTradePosition,
  SignalPerformanceSummary,
  TradeStrategySource,
} from '../types/v8';
import { PaperTradingEngine } from '../engine/paperTradingEngine';
import { RiskSizingEngine } from '../engine/riskSizingEngine';
import { PositionSizingCalculator } from './PositionSizingCalculator';
import { formatStockPrice, formatChangePercent } from '../utils/formatters';

interface PaperTradingViewProps {
  onSelectTicker?: (ticker: string) => void;
}

export const PaperTradingView: React.FC<PaperTradingViewProps> = ({ onSelectTicker }) => {
  const [activeSubTab, setActiveSubTab] = useState<'positions' | 'accuracy' | 'history' | 'sizing'>('positions');
  const [accountSummary, setAccountSummary] = useState<PaperAccountSummary | null>(null);
  const [performanceSummary, setPerformanceSummary] = useState<SignalPerformanceSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Sizing Subtab State
  const [sizingTicker, setSizingTicker] = useState<string>('NVDA');
  const [sizingPrice, setSizingPrice] = useState<number>(118.6);

  // New Order Modal State
  const [isOrderModalOpen, setIsOrderModalOpen] = useState<boolean>(false);
  const [orderTicker, setOrderTicker] = useState<string>('NVDA');
  const [orderType, setOrderType] = useState<OrderType>('BUY');
  const [orderStrategy, setOrderStrategy] = useState<TradeStrategySource>('STRATEGY_A');
  const [orderShares, setOrderShares] = useState<number>(10);
  const [orderPrice, setOrderPrice] = useState<number>(118.6);
  const [orderReason, setOrderReason] = useState<string>('');
  const [orderError, setOrderError] = useState<string | null>(null);
  const [orderSuccessMsg, setOrderSuccessMsg] = useState<string | null>(null);

  // Signal Tracker filter
  const [signalStrategyFilter, setSignalStrategyFilter] = useState<'ALL' | 'STRATEGY_A' | 'STRATEGY_B'>('ALL');

  const loadData = () => {
    setIsLoading(true);
    try {
      const summary = PaperTradingEngine.getAccountSummary();
      const perf = PaperTradingEngine.getSignalPerformanceSummary();
      setAccountSummary(summary);
      setPerformanceSummary(perf);
    } catch (err) {
      console.error('[PaperTradingView] Error loading data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenOrderModal = (ticker?: string, type: OrderType = 'BUY', price?: number, strategy?: TradeStrategySource) => {
    if (ticker) setOrderTicker(ticker);
    setOrderType(type);
    if (price) setOrderPrice(price);
    if (strategy) setOrderStrategy(strategy);
    setOrderError(null);
    setOrderSuccessMsg(null);
    setIsOrderModalOpen(true);
  };

  const handleExecuteOrder = (e: React.FormEvent) => {
    e.preventDefault();
    setOrderError(null);

    const res = PaperTradingEngine.executeOrder({
      ticker: orderTicker.trim().toUpperCase(),
      orderType,
      shares: Number(orderShares),
      price: Number(orderPrice),
      strategySource: orderStrategy,
      reason: orderReason.trim() || undefined,
    });

    if (!res.success) {
      setOrderError(res.error || '주문 체결에 실패했습니다.');
      return;
    }

    setOrderSuccessMsg(`주문이 성공적으로 체결되었습니다: ${orderTicker} ${orderShares}주 @ $${orderPrice}`);
    loadData();
    setTimeout(() => {
      setIsOrderModalOpen(false);
      setOrderSuccessMsg(null);
    }, 1200);
  };

  const handleResetAccount = () => {
    if (confirm('가상 계좌를 초기 상태($100,000)로 리셋하시겠습니까? 모든 체결 내역이 초기화됩니다.')) {
      PaperTradingEngine.resetAccount(100000);
      loadData();
    }
  };

  const filteredSignalRecords = useMemo(() => {
    if (!performanceSummary) return [];
    if (signalStrategyFilter === 'ALL') return performanceSummary.records;
    return performanceSummary.records.filter((r) => r.strategyType === signalStrategyFilter);
  }, [performanceSummary, signalStrategyFilter]);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 1. Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900/80 border border-slate-800 p-5 rounded-2xl">
        <div className="flex items-start space-x-3.5">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 mt-1">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                가상 모의투자 & 시그널 적중률 추적기
              </h1>
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                Phase 3 실시간 검증
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              신호 발생 시 원클릭 가상 매매 체결, 실시간 포지션/손익 추적, T+5/T+20일 사후 성과 및 승률(Hit Ratio) 자동 채점
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5 self-end sm:self-auto">
          <button
            id="paper-new-order-btn"
            onClick={() => handleOpenOrderModal()}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs sm:text-sm font-bold transition-all active:scale-95 shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>신규 주문</span>
          </button>
          <button
            id="paper-reset-btn"
            onClick={handleResetAccount}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs sm:text-sm font-medium border border-slate-700 transition-all active:scale-95"
            title="계좌 잔고 리셋 ($100,000)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">리셋</span>
          </button>
          <button
            id="paper-refresh-btn"
            onClick={loadData}
            disabled={isLoading}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all active:scale-95"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. Paper Account Summary Metric Cards */}
      {accountSummary && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* Total Equity */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>총 가상 순자산</span>
              <DollarSign className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-white">
              ${accountSummary.totalEquity.toLocaleString()}
            </div>
            <div
              className={`text-xs font-semibold font-mono mt-1 flex items-center space-x-1 ${
                accountSummary.totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {accountSummary.totalPnL >= 0 ? (
                <ArrowUpRight className="w-3.5 h-3.5" />
              ) : (
                <ArrowDownRight className="w-3.5 h-3.5" />
              )}
              <span>
                {accountSummary.totalPnL >= 0 ? '+' : ''}
                ${accountSummary.totalPnL.toLocaleString()} ({accountSummary.totalReturnPct}%)
              </span>
            </div>
          </div>

          {/* Cash Balance */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>가상 예수금 (Cash)</span>
              <Activity className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-white">
              ${accountSummary.cashBalance.toLocaleString()}
            </div>
            <div className="text-xs text-slate-500 font-mono mt-1">
              비중: {Math.round((accountSummary.cashBalance / accountSummary.totalEquity) * 100)}%
            </div>
          </div>

          {/* Stock Evaluation Value */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>보유 주식 평가금</span>
              <BarChart3 className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-white">
              ${accountSummary.portfolioValue.toLocaleString()}
            </div>
            <div className="text-xs text-slate-500 font-mono mt-1">
              {accountSummary.positions.length}개 포지션 운용 중
            </div>
          </div>

          {/* Unrealized PnL */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>평가 손익 (Unrealized)</span>
              <Percent className="w-4 h-4 text-amber-400" />
            </div>
            <div
              className={`text-xl sm:text-2xl font-bold font-mono ${
                accountSummary.unrealizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {accountSummary.unrealizedPnL >= 0 ? '+' : ''}$
              {accountSummary.unrealizedPnL.toLocaleString()}
            </div>
            <div className="text-xs text-slate-400 font-mono mt-1">
              실현 손익: ${accountSummary.realizedPnL.toLocaleString()}
            </div>
          </div>

          {/* Win Rate */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-sm col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>매매 승률 (Win Rate)</span>
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-cyan-300">
              {accountSummary.winRate}%
            </div>
            <div className="text-xs text-slate-400 font-mono mt-1">
              {accountSummary.winningTrades}승 {accountSummary.losingTrades}패 (총 {accountSummary.totalTrades}회 매도)
            </div>
          </div>
        </div>
      )}

      {/* 3. Sub-Navigation Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveSubTab('positions')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all ${
            activeSubTab === 'positions'
              ? 'bg-slate-800 text-cyan-400 border border-slate-700 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>보유 포지션 ({accountSummary?.positions.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('accuracy')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all ${
            activeSubTab === 'accuracy'
              ? 'bg-slate-800 text-cyan-400 border border-slate-700 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>시그널 적중률 추적기 ({performanceSummary?.totalSignals || 0})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('history')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all ${
            activeSubTab === 'history'
              ? 'bg-slate-800 text-cyan-400 border border-slate-700 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>주문 체결 이력 ({accountSummary?.tradeHistory.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('sizing')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all ${
            activeSubTab === 'sizing'
              ? 'bg-slate-800 text-cyan-400 border border-slate-700 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Scale className="w-4 h-4 text-cyan-400" />
          <span>ATR 포지션 사이징 계산기</span>
        </button>
      </div>

      {/* 4. Tab Contents */}

      {/* SUBTAB 1: Active Positions */}
      {activeSubTab === 'positions' && (
        <div className="space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Layers className="w-5 h-5 text-cyan-400" />
                <h2 className="text-base sm:text-lg font-bold text-white">현재 보유 가상 포지션</h2>
              </div>
              <span className="text-xs text-slate-400">
                실시간 단가 및 평가손익 계산 완료
              </span>
            </div>

            {accountSummary && accountSummary.positions.length > 0 ? (
              <div className="border border-slate-800 rounded-xl overflow-hidden overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 font-medium">
                      <th className="py-3 px-4">종목 (Ticker)</th>
                      <th className="py-3 px-4">전략 태그</th>
                      <th className="py-3 px-4">보유 수량</th>
                      <th className="py-3 px-4">평균 매입 단가</th>
                      <th className="py-3 px-4">현재가</th>
                      <th className="py-3 px-4">평가 손익 (수익률)</th>
                      <th className="py-3 px-4">총 평가금액</th>
                      <th className="py-3 px-4 text-center">빠른 매매</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                    {accountSummary.positions.map((pos) => {
                      const isProfit = pos.unrealizedPnL >= 0;
                      return (
                        <tr key={pos.ticker} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => onSelectTicker?.(pos.ticker)}
                                className="font-bold font-mono text-cyan-400 hover:text-cyan-300 hover:underline flex items-center space-x-1"
                              >
                                <span>{pos.ticker}</span>
                                <ExternalLink className="w-3 h-3 opacity-60" />
                              </button>
                              <span className="text-xs text-slate-400 truncate max-w-[120px]">
                                {pos.companyName}
                              </span>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                                pos.strategySource === 'STRATEGY_A'
                                  ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                                  : pos.strategySource === 'STRATEGY_B'
                                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                  : 'bg-slate-800 text-slate-300 border-slate-700'
                              }`}
                            >
                              {pos.strategySource === 'STRATEGY_A'
                                ? '전략 A (모멘텀)'
                                : pos.strategySource === 'STRATEGY_B'
                                ? '전략 B (눌림적립)'
                                : '수동 체결'}
                            </span>
                          </td>

                          <td className="py-3 px-4 font-mono font-semibold text-white">
                            {pos.shares}주
                          </td>

                          <td className="py-3 px-4 font-mono text-slate-300">
                            ${pos.avgCostBasis.toFixed(2)}
                          </td>

                          <td className="py-3 px-4 font-mono font-bold text-white">
                            ${pos.currentPrice.toFixed(2)}
                          </td>

                          <td className="py-3 px-4 font-mono font-bold">
                            <div className={isProfit ? 'text-emerald-400' : 'text-rose-400'}>
                              {isProfit ? '+' : ''}${pos.unrealizedPnL.toLocaleString()}
                            </div>
                            <div className={`text-xs ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                              ({isProfit ? '+' : ''}{pos.unrealizedPnLPct}%)
                            </div>
                          </td>

                          <td className="py-3 px-4 font-mono font-bold text-white">
                            ${pos.marketValue.toLocaleString()}
                          </td>

                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center space-x-1.5">
                              <button
                                onClick={() => handleOpenOrderModal(pos.ticker, 'BUY', pos.currentPrice, pos.strategySource)}
                                className="px-2.5 py-1 text-xs rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 font-medium transition-all"
                              >
                                추가 매수
                              </button>
                              <button
                                onClick={() => handleOpenOrderModal(pos.ticker, 'SELL', pos.currentPrice, pos.strategySource)}
                                className="px-2.5 py-1 text-xs rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 font-medium transition-all"
                              >
                                매도
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500">
                현재 보유 중인 포지션이 없습니다. 상단의 '신규 주문' 버튼을 눌러 모의투자를 시작해보세요!
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 2: Signal Accuracy & Forward Track Record */}
      {activeSubTab === 'accuracy' && performanceSummary && (
        <div className="space-y-6">
          {/* Accuracy Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm">
              <div className="text-xs text-slate-400 font-medium mb-1">전체 시그널 승률 (Hit Ratio)</div>
              <div className="flex items-baseline space-x-2">
                <span className="text-3xl font-bold font-mono text-cyan-400">
                  {performanceSummary.winRatePct}%
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  ({performanceSummary.winCount}승 / {performanceSummary.totalSignals}건)
                </span>
              </div>
              <div className="mt-2 text-xs text-slate-400">
                평균 시그널 수익률: <b className="text-emerald-400 font-mono">+{performanceSummary.avgReturnPct}%</b>
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm">
              <div className="text-xs text-cyan-300 font-medium mb-1">전략 A (모멘텀 돌파) 적중률</div>
              <div className="flex items-baseline space-x-2">
                <span className="text-3xl font-bold font-mono text-cyan-300">
                  {performanceSummary.strategyA.winRatePct}%
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  ({performanceSummary.strategyA.total}건 추적)
                </span>
              </div>
              <div className="mt-2 text-xs text-slate-400">
                전략 A 평균 수익: <b className="text-cyan-400 font-mono">+{performanceSummary.strategyA.avgReturnPct}%</b>
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm">
              <div className="text-xs text-amber-300 font-medium mb-1">전략 B (우량주 눌림적립) 적중률</div>
              <div className="flex items-baseline space-x-2">
                <span className="text-3xl font-bold font-mono text-amber-300">
                  {performanceSummary.strategyB.winRatePct}%
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  ({performanceSummary.strategyB.total}건 추적)
                </span>
              </div>
              <div className="mt-2 text-xs text-slate-400">
                전략 B 평균 수익: <b className="text-amber-400 font-mono">+{performanceSummary.strategyB.avgReturnPct}%</b>
              </div>
            </div>
          </div>

          {/* Detailed Track Table */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white">
                  시그널 발생 후 사후 성과(MFE / MAE / T+N 수익률) 추적 리스트
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  알림 시점 기준 현재 수익률과 도달 최고 수익(MFE), 최대 낙폭(MAE)을 자동 추적하여 실효성을 검증합니다.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-400">전략 필터:</span>
                <div className="flex items-center space-x-1">
                  {(['ALL', 'STRATEGY_A', 'STRATEGY_B'] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setSignalStrategyFilter(filter)}
                      className={`px-2.5 py-1 text-xs rounded-lg border font-medium transition-all ${
                        signalStrategyFilter === filter
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-bold'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      {filter === 'ALL' ? '전체' : filter === 'STRATEGY_A' ? '전략 A' : '전략 B'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="border border-slate-800 rounded-xl overflow-hidden overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 font-medium">
                    <th className="py-3 px-4">종목</th>
                    <th className="py-3 px-4">전략 구분</th>
                    <th className="py-3 px-4">신호일자 / 신호가</th>
                    <th className="py-3 px-4">현재가</th>
                    <th className="py-3 px-4">현재 수익률</th>
                    <th className="py-3 px-4">최고수익 (MFE)</th>
                    <th className="py-3 px-4">최대낙폭 (MAE)</th>
                    <th className="py-3 px-4">T+5 / T+10</th>
                    <th className="py-3 px-4 text-center">결과 판정</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-900/40 font-mono">
                  {filteredSignalRecords.map((rec) => {
                    const isWin = rec.hitStatus === 'WIN';
                    return (
                      <tr key={rec.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-sans">
                          <button
                            onClick={() => onSelectTicker?.(rec.ticker)}
                            className="font-bold text-cyan-400 hover:underline flex items-center space-x-1"
                          >
                            <span>{rec.ticker}</span>
                            <ExternalLink className="w-3 h-3 opacity-60" />
                          </button>
                          <div className="text-[10px] text-slate-500">{rec.companyName}</div>
                        </td>

                        <td className="py-3 px-4 font-sans">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              rec.strategyType === 'STRATEGY_A'
                                ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                                : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                            }`}
                          >
                            {rec.strategyType === 'STRATEGY_A' ? '🚀 전략 A' : '💎 전략 B'}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <div className="text-white">${rec.signalPrice.toFixed(2)}</div>
                          <div className="text-[10px] text-slate-500 font-sans">{rec.signalDate}</div>
                        </td>

                        <td className="py-3 px-4 font-bold text-white">
                          ${rec.currentPrice.toFixed(2)}
                        </td>

                        <td className="py-3 px-4 font-bold">
                          <span className={rec.currentReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                            {rec.currentReturnPct >= 0 ? '+' : ''}{rec.currentReturnPct}%
                          </span>
                        </td>

                        <td className="py-3 px-4 text-emerald-400 font-semibold">
                          +{rec.mfePct}%
                        </td>

                        <td className="py-3 px-4 text-rose-400 font-semibold">
                          {rec.maePct}%
                        </td>

                        <td className="py-3 px-4 text-slate-300 text-xs">
                          <div>T+5: {rec.returnT5 !== undefined ? `${rec.returnT5 >= 0 ? '+' : ''}${rec.returnT5}%` : '-'}</div>
                          <div>T+10: {rec.returnT10 !== undefined ? `${rec.returnT10 >= 0 ? '+' : ''}${rec.returnT10}%` : '-'}</div>
                        </td>

                        <td className="py-3 px-4 text-center font-sans">
                          <span
                            className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                              isWin
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            }`}
                          >
                            {isWin ? '🎯 WIN' : '🛑 LOSS'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 3: Trade History */}
      {activeSubTab === 'history' && accountSummary && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-cyan-400" />
              <h2 className="text-base sm:text-lg font-bold text-white">가상 주문 체결 이력</h2>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              총 {accountSummary.tradeHistory.length}건의 체결 기록
            </span>
          </div>

          <div className="border border-slate-800 rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm border-collapse font-mono">
              <thead>
                <tr className="bg-slate-950 text-slate-400 font-sans font-medium">
                  <th className="py-3 px-4">체결 시각</th>
                  <th className="py-3 px-4">종목</th>
                  <th className="py-3 px-4">주문 유형</th>
                  <th className="py-3 px-4">체결 수량</th>
                  <th className="py-3 px-4">체결 가격</th>
                  <th className="py-3 px-4">총 체결 금액</th>
                  <th className="py-3 px-4 font-sans">체결 사유 및 전략</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                {accountSummary.tradeHistory.map((order) => {
                  const isBuy = order.orderType === 'BUY';
                  return (
                    <tr key={order.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 text-slate-400 text-xs font-sans">
                        {new Date(order.executedAt).toLocaleString()}
                      </td>

                      <td className="py-3 px-4 font-bold text-cyan-400 font-sans">
                        {order.ticker}
                      </td>

                      <td className="py-3 px-4 font-sans">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-bold border ${
                            isBuy
                              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                              : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          }`}
                        >
                          {isBuy ? '매수 (BUY)' : '매도 (SELL)'}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-bold text-white">
                        {order.shares}주
                      </td>

                      <td className="py-3 px-4 text-slate-200">
                        ${order.executedPrice.toFixed(2)}
                      </td>

                      <td className="py-3 px-4 font-bold text-white">
                        ${order.totalAmount.toLocaleString()}
                      </td>

                      <td className="py-3 px-4 text-xs text-slate-400 font-sans truncate max-w-[280px]">
                        {order.reason || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 4: ATR Dynamic Sizing Calculator */}
      {activeSubTab === 'sizing' && (
        <div className="space-y-6">
          {/* Ticker Selector Bar */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <Scale className="w-5 h-5 text-cyan-400" />
              <span className="text-sm font-bold text-white">종목별 ATR 리스크 & 포지션 사이징:</span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { t: 'NVDA', p: 118.6 },
                { t: 'TSLA', p: 228.4 },
                { t: 'AAPL', p: 224.8 },
                { t: 'MSFT', p: 428.1 },
                { t: 'AMZN', p: 186.4 },
                { t: 'GOOGL', p: 178.5 },
                { t: 'META', p: 514.2 },
                { t: 'AMD', p: 142.3 },
                { t: 'SPY', p: 548.2 },
                { t: 'QQQ', p: 476.5 },
              ].map((item) => (
                <button
                  key={item.t}
                  type="button"
                  onClick={() => {
                    setSizingTicker(item.t);
                    setSizingPrice(item.p);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border transition-all ${
                    sizingTicker === item.t
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-sm'
                      : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {item.t} (${item.p})
                </button>
              ))}
            </div>
          </div>

          <PositionSizingCalculator
            key={sizingTicker}
            ticker={sizingTicker}
            currentPrice={sizingPrice}
            initialAccountEquity={accountSummary?.totalEquity || 100000}
            onOrderExecuted={loadData}
          />
        </div>
      )}

      {/* 5. New Order Modal */}
      {isOrderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-2xl relative space-y-4">
            <button
              onClick={() => setIsOrderModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-2.5 border-b border-slate-800 pb-3">
              <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">가상 모의투자 주문 제출</h3>
                <p className="text-xs text-slate-400">실시간 시장가 가상 체결 시뮬레이션</p>
              </div>
            </div>

            {orderError && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{orderError}</span>
              </div>
            )}

            {orderSuccessMsg && (
              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{orderSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleExecuteOrder} className="space-y-4">
              {/* Order Type Buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setOrderType('BUY')}
                  className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                    orderType === 'BUY'
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  매수 (BUY)
                </button>
                <button
                  type="button"
                  onClick={() => setOrderType('SELL')}
                  className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                    orderType === 'SELL'
                      ? 'bg-rose-500 text-white border-rose-400 shadow-md'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  매도 (SELL)
                </button>
              </div>

              {/* Ticker & Strategy */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-400 block mb-1">종목 코드 (Ticker)</label>
                  <input
                    type="text"
                    value={orderTicker}
                    onChange={(e) => setOrderTicker(e.target.value.toUpperCase())}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm font-mono font-bold text-white focus:outline-none focus:border-cyan-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-400 block mb-1">전략 태그</label>
                  <select
                    value={orderStrategy}
                    onChange={(e) => setOrderStrategy(e.target.value as TradeStrategySource)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="STRATEGY_A">전략 A (모멘텀 돌파)</option>
                    <option value="STRATEGY_B">전략 B (우량주 눌림적립)</option>
                    <option value="MANUAL">수동 매매</option>
                  </select>
                </div>
              </div>

              {/* Shares & Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-slate-400">주문 수량</label>
                    <button
                      type="button"
                      onClick={() => {
                        const profile = RiskSizingEngine.calculateATRRiskProfile(orderTicker, orderPrice, 'STANDARD');
                        const res = RiskSizingEngine.calculatePositionSize({
                          ticker: orderTicker,
                          entryPrice: orderPrice,
                          stopLossPrice: profile.stopLossPrice,
                          accountEquity: accountSummary?.totalEquity || 100000,
                          riskTolerancePct: 1.0,
                        });
                        setOrderShares(res.recommendedShares);
                      }}
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center space-x-1 font-medium"
                      title="14일 ATR 기반 1% 계좌 위험 수량 자동 계산"
                    >
                      <Scale className="w-3 h-3" />
                      <span>ATR 1% 계산</span>
                    </button>
                  </div>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={orderShares}
                    onChange={(e) => setOrderShares(Math.max(1, Number(e.target.value)))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm font-mono font-bold text-white focus:outline-none focus:border-cyan-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-400 block mb-1">주문 단가 ($ Price)</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={orderPrice}
                    onChange={(e) => setOrderPrice(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm font-mono font-bold text-white focus:outline-none focus:border-cyan-500"
                    required
                  />
                </div>
              </div>

              {/* Estimated Total Calculation */}
              <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 space-y-1 text-xs">
                <div className="flex justify-between text-slate-400 font-mono">
                  <span>예상 체결 금액:</span>
                  <span className="font-bold text-white">
                    ${(orderShares * orderPrice).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400 font-mono">
                  <span>보유 가능 예수금:</span>
                  <span className="text-emerald-400">
                    ${accountSummary?.cashBalance.toLocaleString() || 0}
                  </span>
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1">매매 메모 (선택)</label>
                <input
                  type="text"
                  placeholder="예: 20일 돌파 신호 확인 후 1차 진입"
                  value={orderReason}
                  onChange={(e) => setOrderReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsOrderModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 ${
                    orderType === 'BUY'
                      ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
                      : 'bg-rose-500 hover:bg-rose-400 text-white'
                  }`}
                >
                  {orderType === 'BUY' ? '가상 매수 실행' : '가상 매도 실행'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
