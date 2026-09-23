import React, { useState, useMemo } from 'react';
import {
  ShieldAlert,
  Target,
  ArrowDownRight,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Trash2,
  Edit2,
  DollarSign,
  Activity,
  Flame,
  Clock,
  ChevronRight,
  Info,
  Layers,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { FullTickerEvaluation, IntegratedExitEvaluation, UserHoldPosition } from '../types/v8';
import { ExitSignalEngine } from '../engine/exitSignalEngine';
import { formatStockPrice, formatChangePercent } from '../utils/formatters';
import { detectMarketRegion, getStockDisplayInfo } from '../utils/marketUtils';
import { MarketRegion } from '../types/v8';
import { StockDisplayBadge } from './StockDisplayBadge';

interface ExitSignalDashboardViewProps {
  evaluations: FullTickerEvaluation[];
  onSelectTicker: (ticker: string) => void;
  activeMarket?: MarketRegion;
}

export const ExitSignalDashboardView: React.FC<ExitSignalDashboardViewProps> = ({
  evaluations = [],
  onSelectTicker,
  activeMarket = 'US' as MarketRegion,
}) => {
  const [positions, setPositions] = useState<UserHoldPosition[]>(() =>
    ExitSignalEngine.getUserPositions()
  );

  // New Position Form Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTicker, setNewTicker] = useState('');
  const [newName, setNewName] = useState('');
  const [newEntryPrice, setNewEntryPrice] = useState('');
  const [newShares, setNewShares] = useState('10');
  const [newTpPct, setNewTpPct] = useState('15');
  const [newSlPct, setNewSlPct] = useState('-7');
  const [newMemo, setNewMemo] = useState('');

  // Filter & Search State
  const [filterMode, setFilterMode] = useState<'ALL' | 'HOLD_ONLY' | 'SELL_ONLY'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Filter positions strictly by activeMarket
  const marketPositions = useMemo(() => {
    return positions.filter((p) => {
      const region = p.market_region || detectMarketRegion(p.ticker);
      return region === activeMarket;
    });
  }, [positions, activeMarket]);

  // Evaluate All Exits for activeMarket
  const exitEvaluations: IntegratedExitEvaluation[] = useMemo(() => {
    return ExitSignalEngine.evaluateAllExits(evaluations, marketPositions);
  }, [evaluations, marketPositions]);

  // Save changes to positions
  const handleSavePositions = (updated: UserHoldPosition[]) => {
    setPositions(updated);
    ExitSignalEngine.saveUserPositions(updated);
  };

  const handleAddPosition = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicker.trim() || !newEntryPrice) return;

    let tickerUpper = newTicker.trim().toUpperCase();
    if (activeMarket === 'KR' && /^\d{6}$/.test(tickerUpper)) {
      tickerUpper = `${tickerUpper}.KS`;
    }
    const existingEv = evaluations.find((ev) => ev.ticker.toUpperCase() === tickerUpper);

    const priceNum = parseFloat(newEntryPrice);
    const sharesNum = parseFloat(newShares) || 1;
    const tpNum = parseFloat(newTpPct) || 15;
    const slNum = parseFloat(newSlPct) || -7;

    const newPos: UserHoldPosition = {
      id: `hold_${Date.now()}`,
      ticker: tickerUpper,
      name: newName.trim() || existingEv?.name || tickerUpper,
      market_region: activeMarket,
      entryPrice: priceNum,
      shares: sharesNum,
      entryDate: new Date().toISOString().split('T')[0],
      targetTakeProfitPct: tpNum,
      stopLossPct: slNum < 0 ? slNum : -slNum,
      trailingStopPct: slNum < 0 ? slNum : -slNum,
      highestPrice: Math.max(priceNum, existingEv?.price || priceNum),
      memo: newMemo.trim(),
      created_at: new Date().toISOString(),
    };

    const updated = [newPos, ...positions.filter((p) => p.ticker !== tickerUpper)];
    handleSavePositions(updated);

    // Reset Form
    setNewTicker('');
    setNewName('');
    setNewEntryPrice('');
    setNewShares('10');
    setNewMemo('');
    setIsAddModalOpen(false);
  };

  const handleDeletePosition = (ticker: string) => {
    if (confirm(`'${ticker}' 보유 종목 등록을 해제하시겠습니까?`)) {
      const updated = positions.filter((p) => p.ticker !== ticker);
      handleSavePositions(updated);
    }
  };

  // Filtered List
  const filteredList = useMemo(() => {
    return exitEvaluations.filter((item) => {
      // Filter tab
      if (filterMode === 'HOLD_ONLY' && !item.isHoldPosition) return false;
      if (filterMode === 'SELL_ONLY' && !item.isActionableSell) return false;

      // Search term
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const tickerMatch = item.ticker.toLowerCase().includes(term);
        const nameMatch = item.name.toLowerCase().includes(term);
        // Also search Korean stock name from dictionary
        const dictName = getStockDisplayInfo(item.ticker).primaryName.toLowerCase();
        const dictMatch = dictName.includes(term);
        if (!(tickerMatch || nameMatch || dictMatch)) return false;
      }
      return true;
    });
  }, [exitEvaluations, filterMode, searchTerm]);

  // Statistics Summary
  const stats = useMemo(() => {
    const totalHolds = marketPositions.length;
    const actionableSells = exitEvaluations.filter((e) => e.isActionableSell).length;
    const holdSells = exitEvaluations.filter((e) => e.isHoldPosition && e.isActionableSell).length;
    const tpCount = exitEvaluations.filter((e) => e.primaryExitSignal === 'TAKE_PROFIT_1' || e.primaryExitSignal === 'TAKE_PROFIT_2').length;
    const slCount = exitEvaluations.filter((e) => e.primaryExitSignal === 'STOP_LOSS').length;
    const tsCount = exitEvaluations.filter((e) => e.primaryExitSignal === 'TRAILING_STOP').length;
    const techCount = exitEvaluations.filter((e) => e.primaryExitSignal === 'TREND_BREAK_50MA' || e.primaryExitSignal === 'TREND_BREAK_20MA' || e.primaryExitSignal === 'OVERBOUGHT_DIVERGENCE').length;

    return { totalHolds, actionableSells, holdSells, tpCount, slCount, tsCount, techCount };
  }, [marketPositions, exitEvaluations]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-rose-950/40 to-slate-900 p-5 sm:p-6 rounded-2xl border border-rose-500/20 shadow-xl shadow-rose-950/20">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2.5">
              <span className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                <ShieldAlert className="w-5 h-5" />
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                {activeMarket === 'KR' ? '🇰🇷 국내장 퀀트 매도 & 포지션 청산 시스템' : '🇺🇸 미국장 퀀트 매도 & 포지션 청산 시스템'}
              </h2>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                {activeMarket === 'KR' ? 'KOSPI / KOSDAQ' : 'NYSE / NASDAQ'}
              </span>
            </div>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              사서 무작정 버티는 것이 아니라, <b>목표 익절(+15%~+25%)</b>, <b>트레일링 스탑(-7%)</b>, <b>기계적 손절매(-7%)</b>, 그리고 <b>20/50일선 추세 붕괴</b> 4대 청산 규칙을 기계적으로 실시간 감시합니다.
            </p>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            <button
              id="open-add-position-btn"
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>내 보유종목 평단가 등록</span>
            </button>
          </div>
        </div>

        {/* Real-time Status Metric Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-800/80">
          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>내 등록 보유종목</span>
              <DollarSign className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-bold text-white">{stats.totalHolds}</span>
              <span className="text-xs text-slate-400">개 모니터링 중</span>
            </div>
            <div className="text-[11px] text-rose-400 font-medium mt-1">
              {stats.holdSells > 0 ? `🚨 ${stats.holdSells}건 즉시 청산/익절 권고!` : '✅ 전 종목 정상 보유선 유지'}
            </div>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>목표 익절 도달 (Take Profit)</span>
              <Target className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-bold text-emerald-400">{stats.tpCount}</span>
              <span className="text-xs text-slate-400">건 도달</span>
            </div>
            <div className="text-[11px] text-emerald-400/80 mt-1">
              +15% 이상 분할 차익실현
            </div>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>트레일링/손절 경보</span>
              <TrendingDown className="w-4 h-4 text-rose-400" />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-bold text-rose-400">{stats.tsCount + stats.slCount}</span>
              <span className="text-xs text-slate-400">건 발생</span>
            </div>
            <div className="text-[11px] text-rose-400/80 mt-1">
              자본 보호 및 수익 보존 매도
            </div>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>기술적 추세 이탈 / 과열</span>
              <Flame className="w-4 h-4 text-amber-400" />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-bold text-amber-400">{stats.techCount}</span>
              <span className="text-xs text-slate-400">건 감지</span>
            </div>
            <div className="text-[11px] text-amber-400/80 mt-1">
              20/50일선 붕괴 or RSI 75+ 과열
            </div>
          </div>
        </div>
      </div>

      {/* Control Bar: Filters & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/80 p-3 rounded-xl border border-slate-800">
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            id="filter-all-btn"
            onClick={() => setFilterMode('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              filterMode === 'ALL'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            전체 유니버스 ({exitEvaluations.length})
          </button>
          <button
            id="filter-hold-only-btn"
            onClick={() => setFilterMode('HOLD_ONLY')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              filterMode === 'HOLD_ONLY'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            내 등록 보유종목만 ({stats.totalHolds})
          </button>
          <button
            id="filter-sell-only-btn"
            onClick={() => setFilterMode('SELL_ONLY')}
            className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              filterMode === 'SELL_ONLY'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 border border-rose-500/20'
            }`}
          >
            <span>🚨 매도/청산 권고 종목만</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full bg-rose-950 text-rose-300 text-[10px]">
              {stats.actionableSells}
            </span>
          </button>
        </div>

        <div className="relative">
          <input
            type="text"
            placeholder="티커 또는 종목명 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-64 bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
          />
        </div>
      </div>

      {/* Main Table / Grid of Exit Evaluations */}
      <div className="space-y-3">
        {filteredList.length === 0 ? (
          <div className="p-12 text-center bg-slate-900/60 rounded-2xl border border-slate-800 text-slate-400">
            <ShieldAlert className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="font-semibold text-slate-200">
              {marketPositions.length === 0 && evaluations.length === 0
                ? `${activeMarket === 'KR' ? '국내장(KOSPI/KOSDAQ)' : '미국장(NYSE/NASDAQ)'} 등록 종목이 없습니다.`
                : '해당 조건의 매도 신호 또는 종목이 없습니다.'}
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              {marketPositions.length === 0 && evaluations.length === 0
                ? `${activeMarket === 'KR' ? '국내' : '미국'} 보유 종목의 평단가를 등록하거나 워치리스트에 종목을 추가하면 4대 청산 규칙(-7% 손절, +15% 익절, 트레일링 스탑, 20/50선 이탈)이 실시간 감시됩니다.`
                : '상단의 필터를 변경하거나 새로운 보유 종목을 등록해보세요.'}
            </p>
            {marketPositions.length === 0 && evaluations.length === 0 && (
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="mt-4 inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-md transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>{activeMarket === 'KR' ? '국내' : '미국'} 보유종목 평단가 등록</span>
              </button>
            )}
          </div>
        ) : (
          filteredList.map((item) => {
            const isHold = item.isHoldPosition;
            const isSell = item.isActionableSell;

            let badgeColor = 'bg-slate-800 text-slate-300 border-slate-700';
            if (item.urgency === 'CRITICAL') {
              badgeColor = 'bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse';
            } else if (item.urgency === 'HIGH') {
              badgeColor = 'bg-rose-500/20 text-rose-400 border-rose-500/30';
            } else if (item.urgency === 'MEDIUM') {
              badgeColor = 'bg-amber-500/20 text-amber-400 border-amber-500/30';
            } else if (item.urgency === 'LOW') {
              badgeColor = 'bg-blue-500/20 text-blue-400 border-blue-500/30';
            }

            return (
              <div
                key={item.ticker}
                id={`exit-card-${item.ticker}`}
                className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                  isSell
                    ? 'bg-slate-900/95 border-rose-500/40 shadow-lg shadow-rose-950/20 hover:border-rose-500'
                    : 'bg-slate-900/70 border-slate-800/90 hover:border-slate-700'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left Column: Ticker & Status */}
                  <div className="space-y-2 min-w-0 lg:w-1/3">
                    <div className="flex items-center space-x-2.5">
                      <button
                        onClick={() => onSelectTicker(item.ticker)}
                        className="text-lg font-bold text-white hover:text-cyan-400 transition-colors tracking-tight flex items-center space-x-1"
                      >
                        <StockDisplayBadge
                          ticker={item.ticker}
                          name={item.name}
                          showSubCode={true}
                          showMarketBadge={false}
                          primaryClassName="font-bold text-white"
                          subCodeClassName="text-[10px]"
                        />
                        <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                      </button>
                      <span className={`px-1 py-0.2 text-[8px] rounded font-semibold border ${
                        detectMarketRegion(item.ticker) === 'KR'
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                          : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                      }`}>
                        {detectMarketRegion(item.ticker) === 'KR' ? '🇰🇷 국내' : '🇺🇸 미국'}
                      </span>
                      <span className="text-xs text-slate-400 truncate max-w-[150px]">
                        {item.name}
                      </span>
                      {isHold && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                          내 보유종목
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-3 text-xs">
                      <span className="text-slate-300 font-medium">
                        {formatStockPrice(item.currentPrice, item.ticker)}
                      </span>
                      <span
                        className={`font-semibold ${
                          item.change1d >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {formatChangePercent(item.change1d)}
                      </span>
                      {item.returnSinceEntryPct !== undefined && (
                        <span className="text-slate-400">
                          진입(${(item.entryPrice || 0).toFixed(2)}) 대비:{' '}
                          <b
                            className={
                              item.returnSinceEntryPct >= 0
                                ? 'text-emerald-400'
                                : 'text-rose-400'
                            }
                          >
                            {item.returnSinceEntryPct >= 0 ? '+' : ''}
                            {item.returnSinceEntryPct.toFixed(1)}%
                          </b>
                        </span>
                      )}
                    </div>

                    {/* Headline Badge */}
                    <div className="flex items-center space-x-2">
                      <span
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border flex items-center space-x-1.5 ${badgeColor}`}
                      >
                        <span>{item.headline}</span>
                      </span>
                    </div>
                  </div>

                  {/* Middle Column: 4 Rules Visual Matrix */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-1">
                    {/* Rule 1: Take Profit */}
                    <div
                      className={`p-2.5 rounded-xl border text-xs ${
                        item.rules.takeProfit.triggered
                          ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                          : 'bg-slate-950/50 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold">🎯 목표 익절</span>
                        {item.rules.takeProfit.triggered && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        )}
                      </div>
                      <div className="text-[11px] font-mono leading-tight">
                        {item.rules.takeProfit.label}
                      </div>
                    </div>

                    {/* Rule 2: Trailing Stop */}
                    <div
                      className={`p-2.5 rounded-xl border text-xs ${
                        item.rules.trailingStop.triggered
                          ? 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                          : 'bg-slate-950/50 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold">🛡️ 트레일링</span>
                        {item.rules.trailingStop.triggered && (
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                        )}
                      </div>
                      <div className="text-[11px] font-mono leading-tight">
                        {item.rules.trailingStop.label}
                      </div>
                    </div>

                    {/* Rule 3: Stop Loss */}
                    <div
                      className={`p-2.5 rounded-xl border text-xs ${
                        item.rules.stopLoss.triggered
                          ? 'bg-rose-950/60 border-rose-500/60 text-rose-200'
                          : 'bg-slate-950/50 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold">🛑 기계적 손절</span>
                        {item.rules.stopLoss.triggered && (
                          <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                        )}
                      </div>
                      <div className="text-[11px] font-mono leading-tight">
                        {item.rules.stopLoss.label}
                      </div>
                    </div>

                    {/* Rule 4: Technical Breakdown */}
                    <div
                      className={`p-2.5 rounded-xl border text-xs ${
                        item.rules.technicalExit.triggered
                          ? 'bg-amber-950/40 border-amber-500/40 text-amber-300'
                          : 'bg-slate-950/50 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold">📉 지표/추세</span>
                        {item.rules.technicalExit.triggered && (
                          <Flame className="w-3.5 h-3.5 text-amber-400" />
                        )}
                      </div>
                      <div className="text-[11px] font-mono leading-tight">
                        {item.rules.technicalExit.label}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Recommendation Action & Operations */}
                  <div className="flex lg:flex-col items-center lg:items-end justify-between gap-2 lg:w-48 shrink-0">
                    <div className="text-right">
                      <p className="text-xs font-semibold text-rose-400 leading-snug">
                        {item.recommendedAction}
                      </p>
                    </div>

                    <div className="flex items-center space-x-2">
                      {isHold ? (
                        <button
                          title="보유 종목 등록 해제"
                          onClick={() => handleDeletePosition(item.ticker)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setNewTicker(item.ticker);
                            setNewName(item.name);
                            setNewEntryPrice(item.currentPrice.toFixed(2));
                            setIsAddModalOpen(true);
                          }}
                          className="px-2.5 py-1 text-xs font-semibold rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                        >
                          평단가 등록
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Sub-signals detail list (if any exit reason triggered) */}
                {item.signalsList.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-1.5">
                    {item.signalsList.map((sig, idx) => (
                      <div
                        key={idx}
                        className="flex items-start space-x-2 text-xs text-slate-300"
                      >
                        <span className="text-rose-400 font-bold shrink-0">•</span>
                        <span>
                          <b className="text-white">{sig.label}:</b> {sig.reason}{' '}
                          <span className="text-rose-400 font-medium">
                            ({sig.actionRecommendation})
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Add User Position */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <span className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  <Plus className="w-5 h-5" />
                </span>
                <h3 className="text-lg font-bold text-white">보유 종목 평단가 등록</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddPosition} className="space-y-3.5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-300">
                    종목 티커 (Symbol)
                  </label>
                  <span className="text-[10px] text-slate-500">
                    {activeMarket === 'KR' ? '국내 (KOSPI/KOSDAQ)' : '미국 (NYSE/NASDAQ)'}
                  </span>
                </div>
                <input
                  type="text"
                  required
                  placeholder={
                    activeMarket === 'KR'
                      ? '예: 005930.KS (또는 6자리 005930, 069500)'
                      : '예: NVDA, AAPL, MSFT, TSLA, SPY'
                  }
                  value={newTicker}
                  onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500 font-mono"
                />
                {/* Recommended Quick Preset Buttons */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="text-[10px] text-slate-500 self-center mr-1">추천:</span>
                  {activeMarket === 'KR' ? (
                    [
                      { ticker: '005930.KS', name: '삼성전자' },
                      { ticker: '000660.KS', name: 'SK하이닉스' },
                      { ticker: '373220.KS', name: 'LG에너지솔루션' },
                      { ticker: '005380.KS', name: '현대차' },
                      { ticker: '000270.KS', name: '기아' },
                      { ticker: '207940.KS', name: '삼성바이오로직스' },
                      { ticker: '035420.KS', name: 'NAVER' },
                      { ticker: '035720.KS', name: '카카오' },
                      { ticker: '068270.KS', name: '셀트리온' },
                      { ticker: '247540.KQ', name: '에코프로비엠' },
                      { ticker: '196170.KQ', name: '알테오젠' },
                      { ticker: '042700.KS', name: '한미반도체' },
                      { ticker: '105560.KS', name: 'KB금융' },
                      { ticker: '069500.KS', name: 'KODEX 200' },
                    ].map((item) => (
                      <button
                        key={item.ticker}
                        type="button"
                        onClick={() => {
                          setNewTicker(item.ticker);
                          setNewName(item.name);
                        }}
                        className="px-2 py-0.5 rounded text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-colors"
                      >
                        {item.name}
                      </button>
                    ))
                  ) : (
                    [
                      { ticker: 'NVDA', name: '엔비디아' },
                      { ticker: 'TSLA', name: '테슬라' },
                      { ticker: 'AAPL', name: '애플' },
                      { ticker: 'MSFT', name: '마이크로소프트' },
                      { ticker: 'GOOGL', name: '구글' },
                      { ticker: 'AMZN', name: '아마존' },
                      { ticker: 'META', name: '메타' },
                      { ticker: 'PLTR', name: '팔란티어' },
                      { ticker: 'AVGO', name: '브로드컴' },
                      { ticker: 'AMD', name: 'AMD' },
                      { ticker: 'SPY', name: 'S&P 500' },
                      { ticker: 'QQQ', name: '나스닥 100' },
                      { ticker: 'SCHD', name: '배당성장' },
                      { ticker: 'SMH', name: '반도체 ETF' },
                    ].map((item) => (
                      <button
                        key={item.ticker}
                        type="button"
                        onClick={() => {
                          setNewTicker(item.ticker);
                          setNewName(item.name);
                        }}
                        className="px-2 py-0.5 rounded text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-colors"
                      >
                        {item.name}
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  종목명 (선택)
                </label>
                <input
                  type="text"
                  placeholder={activeMarket === 'KR' ? '예: 삼성전자, SK하이닉스' : '예: 엔비디아, 애플'}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    매수 평단가 ({detectMarketRegion(newTicker) === 'KR' ? '₩' : '$'})
                  </label>
                  <input
                    type="number"
                    step={detectMarketRegion(newTicker) === 'KR' ? '1' : '0.01'}
                    required
                    placeholder={detectMarketRegion(newTicker) === 'KR' ? '예: 74000' : '예: 120.50'}
                    value={newEntryPrice}
                    onChange={(e) => setNewEntryPrice(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    보유 수량 (주)
                  </label>
                  <input
                    type="number"
                    step="1"
                    placeholder="10"
                    value={newShares}
                    onChange={(e) => setNewShares(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    목표 익절 기준 (%)
                  </label>
                  <input
                    type="number"
                    step="1"
                    placeholder="15"
                    value={newTpPct}
                    onChange={(e) => setNewTpPct(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-500 mt-0.5">기본값: +15%</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    손절/트레일링 한도 (%)
                  </label>
                  <input
                    type="number"
                    step="1"
                    placeholder="-7"
                    value={newSlPct}
                    onChange={(e) => setNewSlPct(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-500 mt-0.5">기본값: -7%</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  투자 메모 (선택)
                </label>
                <input
                  type="text"
                  placeholder="예: 20일선 눌림목 반등 매수"
                  value={newMemo}
                  onChange={(e) => setNewMemo(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-lg"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-lg shadow-md transition-all active:scale-95"
                >
                  보유종목 감시 등록
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
