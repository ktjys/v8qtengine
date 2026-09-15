import React, { useState, useMemo } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownUp,
  Check,
  CheckCircle2,
  ChevronDown,
  Filter,
  Info,
  LineChart,
  Plus,
  Radio,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Shield,
  Sliders,
  Sparkles,
  Trash2,
  TrendingUp,
  ShieldCheck,
  X,
  Zap,
} from 'lucide-react';
import {
  ActiveStrategyMode,
  AssetType,
  DecisionType,
  FullTickerEvaluation,
  RiskLevel,
  StrategyType,
} from '../types/v8';
import { formatStockPrice, formatChangePercent } from '../utils/formatters';
import { SortableHeader } from './SortableHeader';
import { MAX_WATCHLIST_CAPACITY, WATCHLIST_CAPACITY_ERROR_MESSAGE } from '../constants/limits';
import { DipBuyMatrix } from './DipBuyMatrix';
import { StrategyOptimizationBanner } from './StrategyOptimizationBanner';
import { StrategyOptimizationModal } from './StrategyOptimizationModal';
import {
  DEFAULT_STRATEGY_CONFIG,
  StrategyOptimizationConfig,
} from '../engine/strategyOptimizerEngine';

export type WatchlistSortField =
  | 'ticker'
  | 'name'
  | 'strategy'
  | 'asset_type'
  | 'price'
  | 'change'
  | 'opp'
  | 'tech'
  | 'mom'
  | 'risk'
  | 'decision'
  | 'signal';

interface WatchlistViewProps {
  evaluations: FullTickerEvaluation[];
  initialStrategyMode?: ActiveStrategyMode;
  onSelectTicker: (ticker: string, initialTab?: 'overview' | 'chart' | 'dip_buy') => void;
  onPreviewTelegram: (ticker: string) => void;
  onAddTicker: (ticker: string, name: string, memo: string) => void;
  onDeleteTicker: (ticker: string) => void;
  onToggleActive: (ticker: string, active: boolean) => void;
  onRecalculate?: () => void;
  isRecalculating?: boolean;
  currentConfig?: StrategyOptimizationConfig;
  onApplyConfig?: (config: StrategyOptimizationConfig) => void;
  onClearDummyTickers?: () => void;
  onClearAllWatchlist?: () => void;
  onRestoreDefaultSeed?: () => void;
}

export const WatchlistView: React.FC<WatchlistViewProps> = ({
  evaluations,
  initialStrategyMode = 'MOMENTUM',
  onSelectTicker,
  onPreviewTelegram,
  onAddTicker,
  onDeleteTicker,
  onToggleActive,
  onRecalculate,
  isRecalculating = false,
  currentConfig = DEFAULT_STRATEGY_CONFIG,
  onApplyConfig,
  onClearDummyTickers,
  onClearAllWatchlist,
  onRestoreDefaultSeed,
}) => {
  const [strategyMode, setStrategyMode] = useState<ActiveStrategyMode>(initialStrategyMode);
  const [isOptimizerModalOpen, setIsOptimizerModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAssetType, setFilterAssetType] = useState<string>('ALL');
  const [filterStrategy, setFilterStrategy] = useState<string>('ALL');
  const [filterRisk, setFilterRisk] = useState<string>('ALL');
  const [filterDecision, setFilterDecision] = useState<string>('ALL');
  const [signalsOnly, setSignalsOnly] = useState(false);
  const [sortField, setSortField] = useState<WatchlistSortField>('opp');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Add Ticker Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTicker, setNewTicker] = useState('');
  const [newName, setNewName] = useState('');
  const [newMemo, setNewMemo] = useState('');

  const handleSort = (field: WatchlistSortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortField(field);
      setSortOrder(
        field === 'ticker' || field === 'name' || field === 'strategy' || field === 'asset_type'
          ? 'asc'
          : 'desc'
      );
    }
  };

  // Filtering
  const filtered = (evaluations || []).filter((item) => {
    if (!item) return false;
    // Search
    const matchSearch =
      (item.ticker || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.classification?.strategy_type || '').toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchSearch) return false;

    // Asset Type
    if (filterAssetType !== 'ALL' && item.classification?.asset_type !== filterAssetType) {
      return false;
    }

    // Strategy
    if (filterStrategy !== 'ALL' && item.classification?.strategy_type !== filterStrategy) {
      return false;
    }

    // Risk Level
    if (filterRisk !== 'ALL' && item.risk?.risk_level !== filterRisk) {
      return false;
    }

    // Decision
    if (filterDecision !== 'ALL' && item.decision?.decision !== filterDecision) {
      return false;
    }

    // Signals Only
    if (signalsOnly && !item.signal_generated) {
      return false;
    }

    return true;
  });

  const decisionRank: Record<string, number> = {
    STRONG_OPPORTUNITY: 4,
    OPPORTUNITY: 3,
    WATCH: 2,
    PASS: 1,
  };

  // Sorting
  const sorted = [...filtered].sort((a, b) => {
    let diff = 0;
    switch (sortField) {
      case 'ticker':
        diff = (a.ticker || '').localeCompare(b.ticker || '');
        break;
      case 'name':
        diff = (a.name || '').localeCompare(b.name || '');
        break;
      case 'strategy':
        diff = (a.classification?.strategy_type || '').localeCompare(b.classification?.strategy_type || '');
        break;
      case 'asset_type':
        diff = (a.classification?.asset_type || '').localeCompare(b.classification?.asset_type || '');
        break;
      case 'price':
        diff = (a.price ?? 0) - (b.price ?? 0);
        break;
      case 'change':
        diff = (a.change1d ?? 0) - (b.change1d ?? 0);
        break;
      case 'opp':
        diff = (a.opportunity?.opportunity_score ?? 0) - (b.opportunity?.opportunity_score ?? 0);
        break;
      case 'tech':
        diff = (a.opportunity?.sub_scores?.technical_score ?? 0) - (b.opportunity?.sub_scores?.technical_score ?? 0);
        break;
      case 'mom':
        diff = (a.opportunity?.sub_scores?.momentum_score ?? 0) - (b.opportunity?.sub_scores?.momentum_score ?? 0);
        break;
      case 'risk':
        diff = (a.risk?.risk_score ?? 0) - (b.risk?.risk_score ?? 0);
        break;
      case 'decision': {
        const rankA = decisionRank[a.decision?.decision || ''] || 0;
        const rankB = decisionRank[b.decision?.decision || ''] || 0;
        diff = rankA - rankB;
        break;
      }
      case 'signal': {
        const sigA = a.signal_generated ? 1 : 0;
        const sigB = b.signal_generated ? 1 : 0;
        diff = sigA - sigB;
        break;
      }
      default:
        diff = 0;
    }
    return sortOrder === 'desc' ? -diff : diff;
  });

  const currentCount = (evaluations || []).length;
  const isCapacityReached = currentCount >= MAX_WATCHLIST_CAPACITY;
  const remainingSlots = Math.max(0, MAX_WATCHLIST_CAPACITY - currentCount);
  const capacityPercent = Math.min(100, Math.round((currentCount / MAX_WATCHLIST_CAPACITY) * 100));

  // Real-time multi-ticker input parser & validator
  const parsedTickers = useMemo(() => {
    if (!newTicker.trim()) {
      return { valid: [], invalid: [], alreadyExists: [] };
    }
    const TICKER_REGEX = /^[A-Z]{1,6}([.-][A-Z]{1,3})?$/;
    const tokens: string[] = newTicker
      .split(/[,\s\n\r/]+/)
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean);
    const unique: string[] = Array.from(new Set<string>(tokens));

    const existingSet = new Set((evaluations || []).map((e) => e.ticker.toUpperCase()));
    const valid: string[] = [];
    const invalid: string[] = [];
    const alreadyExists: string[] = [];

    for (const token of unique) {
      if (!TICKER_REGEX.test(token)) {
        invalid.push(token);
      } else if (existingSet.has(token)) {
        alreadyExists.push(token);
      } else {
        valid.push(token);
      }
    }

    return { valid, invalid, alreadyExists };
  }, [newTicker, evaluations]);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicker.trim()) return;

    if (parsedTickers.valid.length === 0) {
      if (parsedTickers.alreadyExists.length > 0) {
        alert('입력하신 종목이 이미 워치리스트에 모두 등록되어 있습니다.');
      } else if (parsedTickers.invalid.length > 0) {
        alert(`유효하지 않은 티커 형식입니다: ${parsedTickers.invalid.join(', ')}\n(예: AAPL, NVDA, TSLA와 같은 영문 티커 심볼을 콤마로 구분하여 입력해주세요)`);
      }
      return;
    }

    if (remainingSlots <= 0) {
      alert(WATCHLIST_CAPACITY_ERROR_MESSAGE);
      return;
    }

    // Call onAddTicker with the comma-separated list of valid tickers
    onAddTicker(parsedTickers.valid.join(','), newName.trim(), newMemo.trim());
    setNewTicker('');
    setNewName('');
    setNewMemo('');
    setShowAddModal(false);
  };

  const getDecisionBadge = (decision: DecisionType) => {
    switch (decision) {
      case 'STRONG_OPPORTUNITY':
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center space-x-1 whitespace-nowrap">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>강력한 기회 (STRONG)</span>
          </span>
        );
      case 'OPPORTUNITY':
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center space-x-1 whitespace-nowrap">
            <Check className="w-3.5 h-3.5 text-cyan-400" />
            <span>기회 (OPPORTUNITY)</span>
          </span>
        );
      case 'WATCH':
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center space-x-1 whitespace-nowrap">
            <span>관찰 (WATCH)</span>
          </span>
        );
      case 'NEUTRAL':
        return (
          <span className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-800 text-slate-400 border border-slate-700 whitespace-nowrap">
            <span>중립 (NEUTRAL)</span>
          </span>
        );
      case 'AVOID':
      default:
        return (
          <span className="px-2.5 py-1 text-xs font-medium rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 whitespace-nowrap">
            <span>진입 회피 (AVOID)</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 0. Strategy Optimization Banner */}
      <StrategyOptimizationBanner
        evaluations={evaluations}
        currentConfig={currentConfig}
        onOpenModal={() => setIsOptimizerModalOpen(true)}
        onApplyConfig={onApplyConfig || (() => {})}
      />

      {/* 1. Header with Controls */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="w-full lg:w-auto">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-slate-100">
                워치리스트 전종목 평가 매트릭스
              </h2>
              {/* Watchlist Slot Badge */}
              <div
                className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono border ${
                  isCapacityReached
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                    : currentCount >= 25
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    : 'bg-slate-800/90 text-slate-300 border-slate-700'
                }`}
                title="실시간 주가 수집 및 4대 팩터 스캔 엔진의 성능을 최적으로 유지하기 위해 제공되는 관심종목 관리 슬롯입니다."
              >
                <span className="text-[11px] text-slate-400 font-sans">등록 슬롯:</span>
                <span className="font-bold text-cyan-400">{currentCount}</span>
                <span className="text-slate-500">/</span>
                <span className="text-slate-400">{MAX_WATCHLIST_CAPACITY}개</span>
                <span className="border-l border-slate-700 pl-1.5 ml-0.5 text-[11px] font-sans">
                  {isCapacityReached ? (
                    <span className="text-rose-400 font-semibold">가득 참</span>
                  ) : (
                    <span className="text-emerald-400 font-medium">+{remainingSlots}개 가능</span>
                  )}
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              관심종목에 등록된 전종목에 대해 4대 팩터(기술/모멘텀/펀더멘털/밸류)와 독립 리스크를 실시간 산출합니다.
              <span className="text-slate-500 ml-1 hidden sm:inline">
                (최대 {MAX_WATCHLIST_CAPACITY}개 슬롯 · 잔여 {remainingSlots}개)
              </span>
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="티커 / 종목명 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-950/70 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {onRestoreDefaultSeed && (
                <button
                  onClick={() => {
                    if (confirm('기본 대표 종목(AAPL, NVDA, TSLA, MSFT, VOO 등 18개)을 워치리스트에 복원하시겠습니까?\n(현재 등록된 종목은 그대로 유지되며 기본 종목들이 함께 채워집니다)')) {
                      onRestoreDefaultSeed();
                    }
                  }}
                  className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-slate-300 border border-slate-700 hover:border-slate-600 text-xs font-semibold shadow-sm transition-all active:scale-95 whitespace-nowrap"
                  title="초기 기본 18개 대표 우량주 및 지수 ETF 유니버스를 복원합니다."
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">기본 종목 복원</span>
                  <span className="sm:hidden">기본 복원</span>
                </button>
              )}

              {onRecalculate && (
                <button
                  onClick={onRecalculate}
                  disabled={isRecalculating}
                  className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold shadow-sm transition-all active:scale-95 whitespace-nowrap disabled:opacity-50"
                  title="Yahoo Finance 실시간 시세 및 4대 팩터 점수를 다시 계산합니다."
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isRecalculating ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">{isRecalculating ? '시세 갱신 중...' : '시세/평가 새로고침'}</span>
                  <span className="sm:hidden">{isRecalculating ? '갱신 중...' : '새로고침'}</span>
                </button>
              )}

              <button
                id="watchlist-add-ticker-btn"
                onClick={() => setShowAddModal(true)}
                className={`flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-md transition-all active:scale-95 whitespace-nowrap ${
                  isCapacityReached
                    ? 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-750'
                    : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-600/30'
                }`}
                title={
                  isCapacityReached
                    ? `워치리스트 등록 한도(${MAX_WATCHLIST_CAPACITY}개)에 도달했습니다. 추가하려면 기존 종목을 삭제하세요.`
                    : `워치리스트에 새 종목 추가 (현재 ${currentCount}/${MAX_WATCHLIST_CAPACITY}개 슬롯 사용 중, ${remainingSlots}개 추가 가능)`
                }
              >
                <Plus className="w-3.5 h-3.5" />
                <span>종목 추가</span>
                <span className="text-[10px] opacity-90 font-mono px-1.5 py-0.5 rounded bg-black/25">
                  {isCapacityReached ? '가득 참' : `${remainingSlots}자리`}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Dual Strategy Mode Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-800/80">
          <div className="grid grid-cols-1 sm:grid-cols-2 p-1 bg-slate-950/80 rounded-xl border border-slate-800 w-full sm:w-fit gap-1">
            <button
              id="strategy-tab-momentum"
              onClick={() => setStrategyMode('MOMENTUM')}
              className={`flex items-center justify-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                strategyMode === 'MOMENTUM'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>전략 A: 모멘텀 돌파 추세추종</span>
            </button>
            <button
              id="strategy-tab-dipbuy"
              onClick={() => setStrategyMode('DCA_DIP')}
              className={`flex items-center justify-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                strategyMode === 'DCA_DIP'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>전략 B: 우량대형주 적립 & 눌림목 (DCA)</span>
            </button>
          </div>

          <div className="text-xs text-slate-400 font-sans">
            {strategyMode === 'MOMENTUM' ? (
              <span className="flex items-center space-x-1.5 text-cyan-400">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>상승 모멘텀 돌파 진입 신호 모니터링 모드</span>
              </span>
            ) : (
              <span className="flex items-center space-x-1.5 text-emerald-400">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>22% 양도세 절세형 무매도 장기 적립 & 과매도 추매 모드</span>
              </span>
            )}
          </div>
        </div>

        {/* Momentum Filters Bar (Only in MOMENTUM mode) */}
        {strategyMode === 'MOMENTUM' && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80 text-xs">
            <div className="flex items-center space-x-1 text-slate-400 font-medium mr-1">
              <Filter className="w-3.5 h-3.5" />
              <span>필터:</span>
            </div>

            {/* Asset Type */}
            <select
              value={filterAssetType}
              onChange={(e) => setFilterAssetType(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-300 focus:outline-none focus:border-cyan-500"
            >
              <option value="ALL">자산 분류 (전체)</option>
              <option value="etf">ETF</option>
              <option value="equity">개별주 (Equity)</option>
            </select>

            {/* Strategy */}
            <select
              value={filterStrategy}
              onChange={(e) => setFilterStrategy(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-300 focus:outline-none focus:border-cyan-500"
            >
              <option value="ALL">전략 (전체)</option>
              <option value="broad_market_etf">Broad Market ETF</option>
              <option value="growth_etf">Growth ETF</option>
              <option value="dividend_etf">Dividend ETF</option>
              <option value="sector_etf">Sector ETF</option>
              <option value="income_etf">Income ETF</option>
              <option value="quality">Quality (우량주)</option>
              <option value="established_growth">Established Growth (대형성장)</option>
              <option value="speculative">Speculative (투기/고변동)</option>
            </select>

            {/* Risk Level */}
            <select
              value={filterRisk}
              onChange={(e) => setFilterRisk(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-300 focus:outline-none focus:border-cyan-500"
            >
              <option value="ALL">리스크 레벨 (전체)</option>
              <option value="LOW">LOW Risk</option>
              <option value="MEDIUM">MEDIUM Risk</option>
              <option value="HIGH">HIGH Risk</option>
            </select>

            {/* Decision */}
            <select
              value={filterDecision}
              onChange={(e) => setFilterDecision(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-300 focus:outline-none focus:border-cyan-500"
            >
              <option value="ALL">의사결정 (전체)</option>
              <option value="STRONG_OPPORTUNITY">STRONG OPPORTUNITY</option>
              <option value="OPPORTUNITY">OPPORTUNITY</option>
              <option value="WATCH">WATCH</option>
              <option value="NEUTRAL">NEUTRAL</option>
              <option value="AVOID">AVOID</option>
            </select>

            {/* Signals Only Toggle */}
            <button
              onClick={() => setSignalsOnly(!signalsOnly)}
              className={`px-2.5 py-1 rounded-lg border transition-all flex items-center space-x-1.5 ${
                signalsOnly
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-semibold'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>신호 발생 종목만 보기</span>
            </button>

            {(filterAssetType !== 'ALL' ||
              filterStrategy !== 'ALL' ||
              filterRisk !== 'ALL' ||
              filterDecision !== 'ALL' ||
              signalsOnly ||
              searchTerm) && (
              <button
                onClick={() => {
                  setFilterAssetType('ALL');
                  setFilterStrategy('ALL');
                  setFilterRisk('ALL');
                  setFilterDecision('ALL');
                  setSignalsOnly(false);
                  setSearchTerm('');
                }}
                className="text-cyan-400 hover:underline text-xs ml-auto"
              >
                필터 초기화
              </button>
            )}
          </div>
        )}
      </div>

      {/* 2. Main Content based on Active Strategy Mode */}
      {strategyMode === 'DCA_DIP' ? (
        <DipBuyMatrix
          evaluations={evaluations}
          searchTerm={searchTerm}
          onSelectTicker={onSelectTicker}
          onDeleteTicker={onDeleteTicker}
        />
      ) : (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          {/* Mobile Card View (Optimized for small screens) */}
          <div className="block md:hidden divide-y divide-slate-800/60 font-sans">
            {sorted.map((item, idx) => {
              const sub = item.opportunity.sub_scores;
              const isSignal = item.signal_generated;

              return (
                <div
                  key={item.ticker}
                  onClick={() => onSelectTicker(item.ticker)}
                  className="p-4 space-y-3 hover:bg-slate-800/40 transition-colors cursor-pointer active:bg-slate-800/60"
                >
                  {/* Top row: Rank, Ticker, Name & Price */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <span className="text-[11px] font-mono font-bold text-cyan-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 min-w-[26px] text-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-bold text-slate-100 text-sm font-mono">
                            {item.ticker}
                          </span>
                          <span className="uppercase text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-medium">
                            {item.classification?.asset_type || 'EQUITY'}
                          </span>
                          {item.classification.classification_source === 'manual' && (
                            <span className="px-1 py-0.2 text-[8px] rounded bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/30">
                              MANUAL
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 truncate max-w-[180px]">
                          {item.name}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-bold font-mono text-slate-100 text-sm">
                        {formatStockPrice(item.price, item.ticker)}
                      </div>
                      <div
                        className={`text-xs font-semibold font-mono ${
                          item.change1d >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {formatChangePercent(item.change1d)}
                      </div>
                    </div>
                  </div>

                  {/* Badges row: Decision, Signal, Risk */}
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    {getDecisionBadge(item.decision.decision)}
                    {isSignal && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                        신호 활성
                      </span>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                        item.risk.risk_level === 'LOW'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : item.risk.risk_level === 'MEDIUM'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      리스크 {item.risk.risk_level} ({item.risk.risk_score}pt)
                    </span>
                  </div>

                  {/* Opportunity Score & Factor Bars */}
                  <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">기회 점수 (Opportunity)</span>
                      <div className="font-mono">
                        <span className="text-sm font-bold text-cyan-400">
                          {item.opportunity.opportunity_score}
                        </span>
                        <span className="text-[10px] text-slate-500"> / 100</span>
                      </div>
                    </div>
                    {/* Score Bar */}
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-cyan-500 h-full rounded-full transition-all"
                        style={{ width: `${item.opportunity.opportunity_score}%` }}
                      />
                    </div>
                    {/* 4 factors */}
                    <div className="grid grid-cols-4 gap-1 pt-1 text-[10px] text-slate-400 font-mono">
                      <div className="text-center bg-slate-900/80 py-0.5 rounded">
                        <span className="text-slate-500 block text-[8px]">기술</span>
                        <span className="text-blue-300 font-bold">{sub.technical_score}</span>
                      </div>
                      <div className="text-center bg-slate-900/80 py-0.5 rounded">
                        <span className="text-slate-500 block text-[8px]">모멘텀</span>
                        <span className="text-cyan-300 font-bold">{sub.momentum_score}</span>
                      </div>
                      <div className="text-center bg-slate-900/80 py-0.5 rounded">
                        <span className="text-slate-500 block text-[8px]">펀더</span>
                        <span className="text-emerald-300 font-bold">{sub.fundamental_score ?? '-'}</span>
                      </div>
                      <div className="text-center bg-slate-900/80 py-0.5 rounded">
                        <span className="text-slate-500 block text-[8px]">밸류</span>
                        <span className="text-amber-300 font-bold">{sub.valuation_score ?? '-'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div
                    className="flex items-center justify-end space-x-2 pt-1 border-t border-slate-800/50"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => onSelectTicker(item.ticker, 'chart')}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-cyan-600/30 text-cyan-400 text-xs font-semibold flex items-center space-x-1"
                    >
                      <LineChart className="w-3.5 h-3.5" />
                      <span>차트</span>
                    </button>
                    <button
                      onClick={() => onPreviewTelegram(item.ticker)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-cyan-600 text-slate-300 hover:text-white text-xs font-semibold flex items-center space-x-1"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>텔레그램</span>
                    </button>
                    <button
                      onClick={() => onDeleteTicker(item.ticker)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-600/80 text-rose-400 hover:text-white text-xs font-semibold flex items-center space-x-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>삭제</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table View (Hidden on mobile) */}
          <div className="hidden md:block overflow-x-auto w-full">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-950/70 border-b border-slate-800 text-slate-400">
                  <SortableHeader<WatchlistSortField>
                    field="ticker"
                    currentField={sortField}
                    currentOrder={sortOrder}
                    onSort={handleSort}
                    className="py-3.5 px-4 font-semibold"
                  >
                    <span className="text-slate-400 font-mono text-[11px] mr-1.5">No.</span>
                    <span>종목코드 / 이름</span>
                  </SortableHeader>

                <SortableHeader<WatchlistSortField>
                  field="strategy"
                  currentField={sortField}
                  currentOrder={sortOrder}
                  onSort={handleSort}
                  className="py-3.5 px-3 font-semibold"
                >
                  <span>자산 정체성 / 전략</span>
                </SortableHeader>

                <SortableHeader<WatchlistSortField>
                  field="change"
                  currentField={sortField}
                  currentOrder={sortOrder}
                  onSort={handleSort}
                  className="py-3.5 px-3 font-semibold"
                >
                  <span>현재가 (1D)</span>
                </SortableHeader>

                <SortableHeader<WatchlistSortField>
                  field="opp"
                  currentField={sortField}
                  currentOrder={sortOrder}
                  onSort={handleSort}
                  className="py-3.5 px-4 font-semibold"
                >
                  <span>기회 점수 (4대 서브 스코어)</span>
                </SortableHeader>

                <SortableHeader<WatchlistSortField>
                  field="risk"
                  currentField={sortField}
                  currentOrder={sortOrder}
                  onSort={handleSort}
                  className="py-3.5 px-3 font-semibold"
                >
                  <span>독립 리스크 제약</span>
                </SortableHeader>

                <SortableHeader<WatchlistSortField>
                  field="decision"
                  currentField={sortField}
                  currentOrder={sortOrder}
                  onSort={handleSort}
                  className="py-3.5 px-3 font-semibold"
                >
                  <span>최종 의사결정 (Decision)</span>
                </SortableHeader>

                <SortableHeader<WatchlistSortField>
                  field="signal"
                  currentField={sortField}
                  currentOrder={sortOrder}
                  onSort={handleSort}
                  align="center"
                  className="py-3.5 px-3 font-semibold text-center"
                >
                  <span>시그널</span>
                </SortableHeader>

                <th className="py-3.5 px-4 font-semibold text-right text-slate-400 whitespace-nowrap">
                  진단 / 알림
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {sorted.map((item, idx) => {
                const sub = item.opportunity.sub_scores;
                const isSignal = item.signal_generated;

                return (
                  <tr
                    key={item.ticker}
                    onClick={() => onSelectTicker(item.ticker)}
                    className="hover:bg-slate-800/50 transition-colors cursor-pointer group"
                  >
                    {/* Ticker & Name with Index Number */}
                    <td className="py-3 px-4 font-sans">
                      <div className="flex items-center space-x-2.5">
                        <span className="text-[11px] font-mono font-bold text-cyan-400/90 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800/90 min-w-[28px] text-center shrink-0">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-100 text-sm font-mono group-hover:text-cyan-400 transition-colors">
                              {item.ticker}
                            </span>
                            {item.classification.classification_source === 'manual' && (
                              <span className="px-1.5 py-0.2 text-[9px] rounded bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/30">
                                MANUAL
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate max-w-[140px]">
                            {item.name}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Classification */}
                    <td className="py-3 px-3 font-sans">
                      <div className="text-slate-200 text-xs font-medium">
                        {item.classification.strategy_type}
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center space-x-1">
                        <span className="uppercase text-[9px] px-1 rounded bg-slate-800 text-slate-400">
                          {item.classification?.asset_type || 'EQUITY'}
                        </span>
                        <span>신뢰도 {typeof item.classification?.confidence === 'number' ? (item.classification.confidence * 100).toFixed(0) : '80'}%</span>
                      </div>
                    </td>

                    {/* Price */}
                    <td className="py-3 px-3 text-slate-200 font-mono">
                      <div className="font-semibold text-slate-100">{formatStockPrice(item.price, item.ticker)}</div>
                      <div
                        className={`text-[10px] font-semibold ${
                          item.change1d >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {formatChangePercent(item.change1d)}
                      </div>
                    </td>

                    {/* Opportunity Score + Mini Component Bars */}
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-sm font-bold text-cyan-400 font-mono">
                          {item.opportunity.opportunity_score}
                        </span>
                        <span className="text-[10px] text-slate-400">/ 100</span>
                      </div>
                      {/* 4-Component Mini Bars */}
                      <div className="grid grid-cols-4 gap-1 text-[9px] text-slate-400 font-mono">
                        <div title={`Technical: ${sub.technical_score}pt`}>
                          <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className="h-full bg-blue-400"
                              style={{ width: `${sub.technical_score}%` }}
                            ></div>
                          </div>
                          <span className="text-[8px]">T {sub.technical_score}</span>
                        </div>
                        <div title={`Momentum: ${sub.momentum_score}pt`}>
                          <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className="h-full bg-cyan-400"
                              style={{ width: `${sub.momentum_score}%` }}
                            ></div>
                          </div>
                          <span className="text-[8px]">M {sub.momentum_score}</span>
                        </div>
                        <div
                          title={
                            sub.fundamental_score !== null
                              ? `Fundamental: ${sub.fundamental_score}pt`
                              : 'Fundamental: N/A (ETF)'
                          }
                        >
                          <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className="h-full bg-emerald-400"
                              style={{ width: `${sub.fundamental_score ?? 0}%` }}
                            ></div>
                          </div>
                          <span className="text-[8px]">
                            {sub.fundamental_score !== null ? `F ${sub.fundamental_score}` : 'F -'}
                          </span>
                        </div>
                        <div title={`Valuation: ${sub.valuation_score ?? 50}pt`}>
                          <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className="h-full bg-amber-400"
                              style={{ width: `${sub.valuation_score ?? 50}%` }}
                            ></div>
                          </div>
                          <span className="text-[8px]">V {sub.valuation_score ?? '-'}</span>
                        </div>
                      </div>
                    </td>

                    {/* Risk Level & Score */}
                    <td className="py-3 px-3">
                      <div className="flex items-center space-x-1.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.risk.risk_level === 'LOW'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : item.risk.risk_level === 'MEDIUM'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {item.risk.risk_level}
                        </span>
                        <span className="text-slate-400 text-xs font-mono">
                          {item.risk.risk_score}pt
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Beta: {typeof item.risk?.components?.beta === 'number' ? item.risk.components.beta.toFixed(2) : '1.00'}
                      </div>
                    </td>

                    {/* Decision */}
                    <td className="py-3 px-3 font-sans">
                      <div className="flex flex-col gap-1 items-start">
                        {getDecisionBadge(item.decision.decision)}
                        {item.decision.reason?.includes('[최적화 전략]') && (
                          <span className="text-[10px] text-cyan-400 font-mono font-semibold flex items-center gap-0.5">
                            <Sparkles className="w-2.5 h-2.5" />
                            <span>최적화 룰 반영</span>
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Signal Indicator */}
                    <td className="py-3 px-3 text-center font-sans">
                      {isSignal ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                          신호 활성
                        </span>
                      ) : (
                        <span className="text-slate-500 text-xs">-</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div
                        className="flex items-center justify-end space-x-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => onSelectTicker(item.ticker, 'chart')}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-cyan-600/30 text-cyan-400 hover:text-cyan-200 transition-colors"
                          title="일별 점수 및 기술 지표 차트 열기"
                        >
                          <LineChart className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onPreviewTelegram(item.ticker)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-cyan-600 text-slate-300 hover:text-white transition-colors"
                          title="Telegram 알림 서식 미리보기"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onSelectTicker(item.ticker)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                          title="상세 진단 (Debug)"
                        >
                          <Info className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteTicker(item.ticker)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-600/80 text-slate-400 hover:text-white transition-colors"
                          title="워치리스트에서 삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Add Ticker Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
                <Plus className="w-4 h-4 text-cyan-400" />
                <span>워치리스트 종목 추가</span>
              </h3>
              <div className="flex items-center space-x-2">
                <span
                  className={`text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full border ${
                    isCapacityReached
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                      : currentCount >= 25
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                  }`}
                >
                  슬롯: {currentCount} / {MAX_WATCHLIST_CAPACITY}개 ({isCapacityReached ? '가득 참' : `${remainingSlots}개 가능`})
                </span>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Capacity Status */}
            {isCapacityReached ? (
              <div className="p-3 bg-rose-500/10 border border-rose-500/25 rounded-xl flex items-start space-x-2.5 text-rose-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <div>
                  <p className="font-semibold text-rose-200">
                    워치리스트 등록 슬롯({MAX_WATCHLIST_CAPACITY}개)이 모두 찼습니다.
                  </p>
                  <p className="text-[11px] text-rose-300/90 mt-0.5 leading-relaxed">
                    실시간 스캔 속도 및 Yahoo Finance API 안정성을 유지하기 위해 워치리스트는 최대 {MAX_WATCHLIST_CAPACITY}개까지 관리됩니다. 새 종목을 등록하시려면 기존 종목을 삭제해 주세요.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-2.5 bg-slate-950/60 border border-slate-800/80 rounded-xl flex items-center justify-between text-xs text-slate-400">
                <span>등록 가능 슬롯: <b className="text-cyan-400 font-mono">{remainingSlots}개</b> 남음</span>
                <div className="w-28 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      currentCount >= 25 ? 'bg-amber-400' : 'bg-cyan-500'
                    }`}
                    style={{ width: `${capacityPercent}%` }}
                  />
                </div>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-3.5 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-300 font-semibold">
                    티커 심볼 (Ticker) *
                  </label>
                  <span className="text-[11px] text-cyan-400 font-medium">
                    콤마(,)로 여러 개 동시 입력 가능
                  </span>
                </div>
                <textarea
                  id="watchlist-new-ticker-input"
                  placeholder="예: AAPL, MSFT, NVDA, TSLA, VOO (쉼표로 구분하여 여러 종목을 한 번에 입력)"
                  value={newTicker}
                  onChange={(e) => setNewTicker(e.target.value)}
                  disabled={isCapacityReached}
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono uppercase focus:outline-none focus:border-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed resize-none"
                  required
                />

                {/* Real-time Ticker Parsing Preview */}
                {newTicker.trim() && (
                  <div className="mt-2 p-2.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2">
                    {/* Valid parsed tickers */}
                    {parsedTickers.valid.length > 0 && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-emerald-400 font-semibold flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            <span>추가 예정 유효 종목 ({parsedTickers.valid.length}개):</span>
                          </span>
                          {parsedTickers.valid.length > remainingSlots && (
                            <span className="text-rose-400 font-semibold">
                              슬롯 초과! 상위 {remainingSlots}개만 추가됨
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {parsedTickers.valid.map((t, i) => (
                            <span
                              key={t}
                              className={`px-2 py-0.5 rounded font-mono font-bold text-xs border ${
                                i < remainingSlots
                                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                  : 'bg-rose-500/15 text-rose-300 border-rose-500/30 line-through opacity-75'
                              }`}
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Invalid / excluded tickers */}
                    {parsedTickers.invalid.length > 0 && (
                      <div className="space-y-1 pt-1 border-t border-slate-800/80">
                        <div className="text-[11px] text-rose-400 font-semibold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          <span>형식 오류로 제외되는 항목 ({parsedTickers.invalid.length}개):</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {parsedTickers.invalid.map((t) => (
                            <span
                              key={t}
                              className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20 font-mono text-xs line-through"
                              title="1~6자의 올바른 영문 티커 심볼이 아닙니다."
                            >
                              {t} (제외)
                            </span>
                          ))}
                        </div>
                        <p className="text-[10px] text-slate-400">
                          * 특수문자나 한글, 긴 단어는 배제되며 올바른 티커만 등록됩니다.
                        </p>
                      </div>
                    )}

                    {/* Already in watchlist */}
                    {parsedTickers.alreadyExists.length > 0 && (
                      <div className="space-y-1 pt-1 border-t border-slate-800/80">
                        <div className="text-[11px] text-slate-400 font-medium">
                          이미 등록되어 있는 종목 ({parsedTickers.alreadyExists.length}개):
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {parsedTickers.alreadyExists.map((t) => (
                            <span
                              key={t}
                              className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono text-xs"
                            >
                              {t} (기등록)
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {parsedTickers.valid.length <= 1 && (
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">종목명 (단일 등록 시 선택)</label>
                  <input
                    id="watchlist-new-name-input"
                    type="text"
                    placeholder="예: Meta Platforms, Inc. (비워두면 자동 조회)"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    disabled={isCapacityReached}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
              )}

              <div>
                <label className="block text-slate-300 font-semibold mb-1">관찰 메모 (선택)</label>
                <textarea
                  id="watchlist-new-memo-input"
                  placeholder="관찰 목적 및 전략 메모..."
                  value={newMemo}
                  onChange={(e) => setNewMemo(e.target.value)}
                  disabled={isCapacityReached}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 h-16 resize-none focus:outline-none focus:border-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-medium transition-colors"
                >
                  취소
                </button>
                <button
                  id="watchlist-submit-ticker-btn"
                  type="submit"
                  disabled={isCapacityReached || (newTicker.trim().length > 0 && parsedTickers.valid.length === 0)}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold shadow-md shadow-cyan-600/30 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center space-x-1.5"
                >
                  {isCapacityReached ? (
                    '한도 초과 (추가 불가)'
                  ) : parsedTickers.valid.length > 1 ? (
                    <span>유효 종목 {parsedTickers.valid.length}개 일괄 등록 및 평가</span>
                  ) : (
                    <span>워치리스트 추가 및 즉시 평가</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Strategy Optimization & Diagnostics Modal */}
      <StrategyOptimizationModal
        isOpen={isOptimizerModalOpen}
        onClose={() => setIsOptimizerModalOpen(false)}
        evaluations={evaluations}
        currentConfig={currentConfig}
        onApplyConfig={onApplyConfig || (() => {})}
      />
    </div>
  );
};
