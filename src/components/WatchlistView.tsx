import React, { useState, useMemo, useEffect } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownUp,
  Check,
  CheckCircle2,
  ChevronDown,
  Database,
  Filter,
  Info,
  LineChart,
  Loader2,
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
  MarketRegion,
  RiskLevel,
  StrategyType,
} from '../types/v8';
import { formatStockPrice, formatChangePercent } from '../utils/formatters';
import { detectMarketRegion, getStockDisplayInfo } from '../utils/marketUtils';
import {
  STOCK_MASTER_DATABASE,
  StockInfo,
  resolveSingleQuery,
  searchStockMaster,
} from '../utils/stockSearchService';
import { StockDisplayBadge } from './StockDisplayBadge';
import { SortableHeader } from './SortableHeader';
import { MAX_WATCHLIST_CAPACITY_PER_MARKET, getWatchlistCapacityErrorMessage } from '../constants/limits';
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
  activeMarket?: MarketRegion;
  onOpenDbHealthModal?: () => void;
}

export const WatchlistView: React.FC<WatchlistViewProps> = ({
  evaluations,
  activeMarket = 'US',
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
  onOpenDbHealthModal,
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
  const [searchModalQuery, setSearchModalQuery] = useState('');
  const [addModeTab, setAddModeTab] = useState<'search' | 'batch'>('search');
  const [liveApiResults, setLiveApiResults] = useState<StockInfo[]>([]);
  const [isSearchingLive, setIsSearchingLive] = useState(false);

  useEffect(() => {
    const query = searchModalQuery.trim();
    if (!query) {
      setLiveApiResults([]);
      setIsSearchingLive(false);
      return;
    }

    setIsSearchingLive(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v8/watchlist/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.results)) {
            setLiveApiResults(data.results);
          }
        }
      } catch {
        // Ignore network errors gracefully
      } finally {
        setIsSearchingLive(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchModalQuery]);

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
    // Enhanced Search: matches ticker, English name, Korean display name, subcode, aliases, and strategy
    if (searchTerm.trim()) {
      const searchClean = searchTerm.toLowerCase().replace(/[\s\-_.]/g, '');
      const tickerClean = (item.ticker || '').toLowerCase().replace(/[\s\-_.]/g, '');
      const rawNameClean = (item.name || '').toLowerCase().replace(/[\s\-_.]/g, '');
      const displayInfo = getStockDisplayInfo(item.ticker, item.name);
      const primaryClean = (displayInfo.primaryName || '').toLowerCase().replace(/[\s\-_.]/g, '');
      const subCodeClean = (displayInfo.subCode || '').toLowerCase().replace(/[\s\-_.]/g, '');

      const masterStock = STOCK_MASTER_DATABASE.find(
        (s) =>
          s.ticker.toUpperCase() === item.ticker.toUpperCase() ||
          s.ticker.replace(/\.(KS|KQ)$/i, '').toUpperCase() === item.ticker.toUpperCase()
      );
      const aliasMatches = masterStock?.aliases?.some((a) =>
        a.toLowerCase().replace(/[\s\-_.]/g, '').includes(searchClean)
      );

      const matchSearch =
        tickerClean.includes(searchClean) ||
        rawNameClean.includes(searchClean) ||
        primaryClean.includes(searchClean) ||
        subCodeClean.includes(searchClean) ||
        Boolean(aliasMatches) ||
        (item.classification?.strategy_type || '').toLowerCase().includes(searchClean);

      if (!matchSearch) return false;
    }

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

  const marketCounts = useMemo(() => {
    const counts = { US: 0, KR: 0 } as Record<MarketRegion, number>;
    for (const item of evaluations || []) {
      const market = item.market_region || detectMarketRegion(item.ticker);
      counts[market]++;
    }
    return counts;
  }, [evaluations]);

  const currentMarketCount = marketCounts[activeMarket] || 0;
  const isCapacityReached = currentMarketCount >= MAX_WATCHLIST_CAPACITY_PER_MARKET;
  const remainingSlots = Math.max(0, MAX_WATCHLIST_CAPACITY_PER_MARKET - currentMarketCount);
  const capacityPercent = Math.min(100, Math.round((currentMarketCount / MAX_WATCHLIST_CAPACITY_PER_MARKET) * 100));
  const totalCount = (evaluations || []).length;

  const existingTickerSet = useMemo(() => {
    return new Set((evaluations || []).map((e) => e.ticker.toUpperCase()));
  }, [evaluations]);

  const modalSearchResults = useMemo(() => {
    const q = searchModalQuery.trim();
    if (!q) {
      return searchStockMaster('', 12).filter((s) => s.market === activeMarket);
    }
    const local = searchStockMaster(q, 12);
    const seen = new Set(local.map((s) => s.ticker.toUpperCase()));
    const combined = [...local];
    for (const item of liveApiResults) {
      const key = item.ticker.toUpperCase();
      if (!seen.has(key)) {
        seen.add(key);
        combined.push(item);
      }
    }
    return combined.slice(0, 16);
  }, [searchModalQuery, activeMarket, liveApiResults]);

  const directCandidate = useMemo(() => {
    const q = searchModalQuery.trim();
    if (!q) return null;
    const res = resolveSingleQuery(q);
    const isAlreadyAdded = res.resolved && existingTickerSet.has(res.ticker.toUpperCase());
    return {
      query: q,
      resolved: res.resolved,
      ticker: res.ticker,
      name: res.name || getStockDisplayInfo(res.ticker).primaryName || res.ticker,
      market: res.market,
      isAlreadyAdded,
    };
  }, [searchModalQuery, existingTickerSet]);

  const emptySearchMasterMatches = useMemo(() => {
    if (!searchTerm.trim() || filtered.length > 0) return [];
    const matches = searchStockMaster(searchTerm.trim(), 4);
    return matches.map((m) => ({
      ...m,
      isAlreadyAdded: existingTickerSet.has(m.ticker.toUpperCase()),
    }));
  }, [searchTerm, filtered.length, existingTickerSet]);

  const handleAddDirectStock = (stockTicker: string, stockName?: string) => {
    const clean = stockTicker.toUpperCase().trim();
    const market = detectMarketRegion(clean);
    const marketRemainingSlots = Math.max(0, MAX_WATCHLIST_CAPACITY_PER_MARKET - (marketCounts[market] || 0));
    if (marketRemainingSlots <= 0) {
      alert(getWatchlistCapacityErrorMessage(market));
      return;
    }
    if (existingTickerSet.has(clean)) {
      alert(`'${stockName || clean}'은(는) 이미 워치리스트에 등록되어 있습니다.`);
      return;
    }
    const finalName = stockName || getStockDisplayInfo(clean).primaryName || clean;
    onAddTicker(clean, finalName, newMemo.trim() || '실시간 검색 추가');
    setSearchModalQuery('');
    setShowAddModal(false);
  };

  // Real-time multi-ticker & Korean stock name input parser & validator
  const parsedTickers = useMemo(() => {
    if (!newTicker.trim()) {
      return {
        valid: [] as Array<{ ticker: string; name: string }>,
        invalid: [] as string[],
        alreadyExists: [] as Array<{ ticker: string; name: string }>,
      };
    }
    const TICKER_REGEX = /^([A-Z]{1,6}([.-][A-Z]{1,3})?|[0-9]{6}(\.(KS|KQ))?)$/;
    const trimmed = newTicker.trim();

    let tokens: string[] = [];
    if (trimmed.includes(',')) {
      tokens = trimmed.split(',').map((t) => t.trim()).filter(Boolean);
    } else {
      const singleRes = resolveSingleQuery(trimmed);
      if (singleRes.resolved) {
        tokens = [trimmed];
      } else {
        tokens = trimmed.split(/[\s\n\r/]+/).map((t) => t.trim()).filter(Boolean);
      }
    }

    const valid: Array<{ ticker: string; name: string }> = [];
    const invalid: string[] = [];
    const alreadyExists: Array<{ ticker: string; name: string }> = [];
    const seenTickers = new Set<string>();

    for (const rawToken of tokens) {
      const resolved = resolveSingleQuery(rawToken);
      let targetTicker = resolved.resolved ? resolved.ticker : rawToken.toUpperCase().trim();
      if (/^[0-9]{6}$/.test(targetTicker)) {
        targetTicker = `${targetTicker}.KS`;
      }
      const displayName = resolved.name || getStockDisplayInfo(targetTicker).primaryName || targetTicker;

      if (!resolved.resolved && !TICKER_REGEX.test(targetTicker)) {
        invalid.push(rawToken);
      } else if (seenTickers.has(targetTicker)) {
        continue;
      } else {
        seenTickers.add(targetTicker);
        if (existingTickerSet.has(targetTicker)) {
          alreadyExists.push({ ticker: targetTicker, name: displayName });
        } else {
          valid.push({ ticker: targetTicker, name: displayName });
        }
      }
    }

    return { valid, invalid, alreadyExists };
  }, [newTicker, evaluations, existingTickerSet]);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicker.trim()) return;

    if (parsedTickers.valid.length === 0) {
      if (parsedTickers.alreadyExists.length > 0) {
        alert('입력하신 종목이 이미 워치리스트에 모두 등록되어 있습니다.');
      } else if (parsedTickers.invalid.length > 0) {
        alert(`유효하지 않은 종목 형식입니다: ${parsedTickers.invalid.join(', ')}\n(종목명 예: LG에너지솔루션, 현대차, 에코프로 또는 티커 심볼 005930.KS, AAPL 등을 입력해주세요)`);
      }
      return;
    }

    const tickersByMarket = new Map<MarketRegion, typeof parsedTickers.valid>();
    for (const v of parsedTickers.valid) {
      const market = detectMarketRegion(v.ticker);
      if (!tickersByMarket.has(market)) {
        tickersByMarket.set(market, []);
      }
      tickersByMarket.get(market)!.push(v);
    }

    let hasCapacityError = false;
    for (const [market, marketTickers] of tickersByMarket) {
      const marketRemainingSlots = Math.max(0, MAX_WATCHLIST_CAPACITY_PER_MARKET - (marketCounts[market] || 0));
      if (marketTickers.length > marketRemainingSlots) {
        alert(getWatchlistCapacityErrorMessage(market));
        hasCapacityError = true;
        break;
      }
    }

    if (hasCapacityError) return;

    // Call onAddTicker with the comma-separated list of valid tickers
    const tickersToAdd = parsedTickers.valid.map((v) => v.ticker).join(',');
    const primaryName = newName.trim() || (parsedTickers.valid.length === 1 ? parsedTickers.valid[0].name : '');
    onAddTicker(tickersToAdd, primaryName, newMemo.trim());
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
                    : currentMarketCount >= 25
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    : 'bg-slate-800/90 text-slate-300 border-slate-700'
                }`}
                title="실시간 주가 수집 및 4대 팩터 스캔 엔진의 성능을 최적으로 유지하기 위해 제공되는 관심종목 관리 슬롯입니다. (시장별 독립 30개 제한)"
              >
                <span className="text-[11px] text-slate-400 font-sans">등록 슬롯:</span>
                <span className="font-bold text-cyan-400">{currentMarketCount}</span>
                <span className="text-slate-500">/</span>
                <span className="text-slate-400">{MAX_WATCHLIST_CAPACITY_PER_MARKET}개</span>
                <span className="border-l border-slate-700 pl-1.5 ml-0.5 text-[11px] font-sans">
                  {isCapacityReached ? (
                    <span className="text-rose-400 font-semibold">가득 참</span>
                  ) : (
                    <span className="text-emerald-400 font-medium">+{remainingSlots}개 가능</span>
                  )}
                </span>
                <span className="border-l border-slate-700 pl-1.5 ml-0.5 text-[11px] font-sans text-slate-500 hidden sm:inline">
                  (전체: {totalCount}개 · US: {marketCounts.US || 0}개 · KR: {marketCounts.KR || 0}개)
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              관심종목에 등록된 전종목에 대해 4대 팩터(기술/모멘텀/펀더멘털/밸류)와 독립 리스크를 실시간 산출합니다.
              <span className="text-slate-500 ml-1 hidden sm:inline">
                (시장별 최대 {MAX_WATCHLIST_CAPACITY_PER_MARKET}개 슬롯 · {activeMarket} 잔여 {remainingSlots}개 · 전체 {totalCount}개)
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
              {onOpenDbHealthModal && (
                <button
                  onClick={onOpenDbHealthModal}
                  className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-slate-300 border border-slate-700 hover:border-slate-600 text-xs font-semibold shadow-sm transition-all active:scale-95 whitespace-nowrap"
                  title="Supabase DB 테이블 상태 및 DDL 마이그레이션 스크립트를 확인합니다."
                >
                  <Database className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="hidden sm:inline">DB 헬스체크</span>
                  <span className="sm:hidden">DB체크</span>
                </button>
              )}

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
                    ? `현재 시장(${activeMarket}) 워치리스트 등록 한도(${MAX_WATCHLIST_CAPACITY_PER_MARKET}개)에 도달했습니다. 추가하려면 기존 종목을 삭제하세요.`
                    : `워치리스트에 새 종목 추가 (${activeMarket} 시장: 현재 ${currentMarketCount}/${MAX_WATCHLIST_CAPACITY_PER_MARKET}개 슬롯 사용 중, ${remainingSlots}개 추가 가능)`
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
            {sorted.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-xs space-y-3">
                <p>
                  {evaluations.length === 0 ? '워치리스트가 비어 있습니다. 상단에서 종목을 추가해주세요.' : '검색/필터 조건에 일치하는 종목이 없습니다.'}
                </p>
                {emptySearchMasterMatches.length > 0 && (
                  <div className="space-y-2 text-left pt-2">
                    <p className="text-[11px] text-cyan-400 font-semibold text-center">
                      💡 마스터 종목에서 일치 종목을 찾았습니다:
                    </p>
                    <div className="space-y-1.5">
                      {emptySearchMasterMatches.map((m) => (
                        <div
                          key={m.ticker}
                          className="flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs"
                        >
                          <div className="min-w-0 pr-2">
                            <div className="font-bold text-slate-100 truncate">{m.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              <span className="text-cyan-400">{m.ticker}</span> · {m.exchange || m.market}
                            </div>
                          </div>
                          {m.isAlreadyAdded ? (
                            <span className="px-2 py-1 rounded bg-slate-800 text-slate-400 text-[10px] font-semibold">
                              등록됨
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleAddDirectStock(m.ticker, m.name)}
                              className="px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-[11px] shrink-0"
                            >
                              + 추가
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {evaluations.length === 0 && (
                  <p className="text-xs text-slate-500 pt-2">
                    {activeMarket === 'KR' ? '국내 추천 종목(LG에너지솔루션, 삼성전자, SK하이닉스 등)' : '미국 추천 종목(AAPL, NVDA, TSLA 등)'}을 추가해보세요. (시장별 최대 {MAX_WATCHLIST_CAPACITY_PER_MARKET}개)
                  </p>
                )}
              </div>
            ) : (
              sorted.map((item, idx) => {
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
                        <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
                          <StockDisplayBadge
                            ticker={item.ticker}
                            name={item.name}
                            showSubCode={true}
                            primaryClassName="font-bold text-slate-100 text-sm"
                          />
                          <span className="uppercase text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-medium">
                            {item.classification?.asset_type || 'EQUITY'}
                          </span>
                          {item.classification.classification_source === 'manual' && (
                            <span className="px-1 py-0.2 text-[8px] rounded bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/30">
                              MANUAL
                            </span>
                          )}
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
            })
          )}
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
                    <span>종목명 (코드)</span>
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
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-slate-400 font-sans">
                    <div className="max-w-md mx-auto space-y-3">
                      <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto border border-cyan-500/20">
                        <Plus className="w-5 h-5" />
                      </div>
                      <div className="font-semibold text-slate-200 text-sm">
                        {evaluations.length === 0
                          ? `${activeMarket === 'KR' ? '국내 주식(KOSPI/KOSDAQ)' : '미국 주식(NYSE/NASDAQ)'} 워치리스트가 비어 있습니다.`
                          : '검색/필터 조건에 일치하는 종목이 없습니다.'}
                      </div>
                      <p className="text-xs text-slate-500">
                        {evaluations.length === 0
                          ? `상단의 [+ 종목 추가] 버튼을 누르고 ${activeMarket === 'KR' ? '국내 추천 종목(LG에너지솔루션, 삼성전자, SK하이닉스 등)' : '미국 추천 종목(AAPL, NVDA, TSLA 등)'}을 바로 추가해보세요. (시장별 최대 ${MAX_WATCHLIST_CAPACITY_PER_MARKET}개)`
                          : '필터 조건을 변경하거나 검색어를 지워보세요.'}
                      </p>

                      {/* Instant quick-add suggestions if search term matches master stock DB */}
                      {emptySearchMasterMatches.length > 0 && (
                        <div className="pt-3 text-left space-y-2 max-w-lg mx-auto">
                          <p className="text-[11px] text-cyan-400 font-semibold text-center flex items-center justify-center gap-1">
                            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                            <span>마스터 종목 데이터베이스에서 &apos;{searchTerm}&apos; 일치 종목을 찾았습니다:</span>
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {emptySearchMasterMatches.map((m) => (
                              <div
                                key={m.ticker}
                                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-cyan-500/40 transition-all text-xs"
                              >
                                <div className="min-w-0 pr-2">
                                  <div className="font-bold text-slate-100 truncate">{m.name}</div>
                                  <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5">
                                    <span className="text-cyan-400 font-semibold">{m.ticker}</span>
                                    <span>· {m.exchange || m.market}</span>
                                    {m.sector && <span className="truncate">· {m.sector}</span>}
                                  </div>
                                </div>
                                {m.isAlreadyAdded ? (
                                  <span className="px-2 py-1 rounded bg-slate-800 text-slate-400 text-[10px] font-semibold shrink-0">
                                    등록됨
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleAddDirectStock(m.ticker, m.name)}
                                    className="px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-[11px] shadow-sm shadow-cyan-600/30 transition-all active:scale-95 shrink-0 flex items-center gap-1"
                                  >
                                    <Plus className="w-3 h-3" />
                                    <span>+ 추가</span>
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {evaluations.length === 0 && (
                        <button
                          onClick={() => setShowAddModal(true)}
                          className="mt-2 inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-md transition-all active:scale-95"
                        >
                          <Plus className="w-4 h-4" />
                          <span>{activeMarket === 'KR' ? '국내 종목 추가하기' : '미국 종목 추가하기'}</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                sorted.map((item, idx) => {
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
                          <div className="flex items-center space-x-1.5">
                            <StockDisplayBadge
                              ticker={item.ticker}
                              name={item.name}
                              showSubCode={true}
                              primaryClassName="font-bold text-slate-100 text-sm group-hover:text-cyan-400 transition-colors"
                            />
                            {item.classification.classification_source === 'manual' && (
                              <span className="px-1.5 py-0.2 text-[9px] rounded bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/30">
                                MANUAL
                              </span>
                            )}
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
              })
            )}
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
                      : currentMarketCount >= 25
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                  }`}
                >
                  {activeMarket} 슬롯: {currentMarketCount} / {MAX_WATCHLIST_CAPACITY_PER_MARKET}개 ({isCapacityReached ? '가득 참' : `${remainingSlots}개 가능`})
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
                    {activeMarket}장 워치리스트 등록 슬롯({MAX_WATCHLIST_CAPACITY_PER_MARKET}개)이 모두 찼습니다.
                  </p>
                  <p className="text-[11px] text-rose-300/90 mt-0.5 leading-relaxed">
                    실시간 스캔 속도 및 Yahoo Finance API 안정성을 유지하기 위해 시장별로 최대 {MAX_WATCHLIST_CAPACITY_PER_MARKET}개까지 관리됩니다. 새 종목을 등록하시려면 기존 종목을 삭제해 주세요.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-2.5 bg-slate-950/60 border border-slate-800/80 rounded-xl flex items-center justify-between text-xs text-slate-400">
                <span>{activeMarket}장 등록 가능 슬롯: <b className="text-cyan-400 font-mono">{remainingSlots}개</b> 남음</span>
                <div className="w-28 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      currentMarketCount >= 25 ? 'bg-amber-400' : 'bg-cyan-500'
                    }`}
                    style={{ width: `${capacityPercent}%` }}
                  />
                </div>
              </div>
            )}

            {/* Mode Tabs */}
            <div className="flex items-center space-x-1.5 p-1 bg-slate-950 border border-slate-800 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setAddModeTab('search')}
                className={`flex-1 py-2 px-3 rounded-lg font-semibold transition-all flex items-center justify-center space-x-1.5 ${
                  addModeTab === 'search'
                    ? 'bg-cyan-600 text-white shadow-sm shadow-cyan-600/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Search className="w-3.5 h-3.5" />
                <span>종목명 검색으로 즉시 추가 (추천)</span>
              </button>
              <button
                type="button"
                onClick={() => setAddModeTab('batch')}
                className={`flex-1 py-2 px-3 rounded-lg font-semibold transition-all flex items-center justify-center space-x-1.5 ${
                  addModeTab === 'batch'
                    ? 'bg-cyan-600 text-white shadow-sm shadow-cyan-600/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>✏️ 직접 입력 / 일괄 등록</span>
              </button>
            </div>

            {/* TAB 1: Real-time Stock Name Search & Instant Add */}
            {addModeTab === 'search' && (
              <div className="space-y-3.5 text-xs">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-slate-300 font-semibold">
                      종목명 / 티커 / 종목코드 검색
                    </label>
                    <div className="flex items-center space-x-1.5 text-[11px] text-cyan-400 font-medium">
                      {isSearchingLive && (
                        <span className="flex items-center gap-1 text-slate-400 font-mono text-[10px]">
                          <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
                          <span>실시간 검색 중...</span>
                        </span>
                      )}
                      <span>초성·약칭·코드 100% 지원</span>
                    </div>
                  </div>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="예: 삼전, 엔솔, 한화에어로, 알테오젠, 삼양식품, 005930, PLTR, ARM, TSLA..."
                      value={searchModalQuery}
                      onChange={(e) => setSearchModalQuery(e.target.value)}
                      disabled={isCapacityReached}
                      autoFocus
                      className="w-full pl-9 pr-8 py-2.5 bg-slate-950 border border-slate-700 hover:border-slate-600 focus:border-cyan-500 rounded-xl text-slate-100 placeholder-slate-500 text-xs focus:outline-none transition-all shadow-inner disabled:opacity-50"
                    />
                    {searchModalQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchModalQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-0.5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium px-1">
                  <span>
                    {searchModalQuery.trim()
                      ? `검색 결과 (${modalSearchResults.length}건)`
                      : `${activeMarket === 'KR' ? '🇰🇷 국내 대표 인기 종목' : '🇺🇸 미국 대표 인기 종목'} (원클릭 추가)`}
                  </span>
                  <span className="text-[10px] text-cyan-400">+ 담기 클릭 시 즉시 평가 및 추가</span>
                </div>

                {/* Direct Match Quick Card if candidate resolved and not first in results */}
                {directCandidate && directCandidate.resolved && searchModalQuery.trim() && (
                  <div className="p-2.5 bg-cyan-950/30 border border-cyan-500/30 rounded-xl flex items-center justify-between">
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-100">
                        <span className="text-cyan-400 font-mono">[{directCandidate.ticker}]</span>
                        <span className="truncate">{directCandidate.name}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        {directCandidate.market === 'KR' ? '국내 주식' : '미국 주식'} · 즉시 등록 가능
                      </span>
                    </div>
                    {directCandidate.isAlreadyAdded ? (
                      <span className="px-2 py-1 text-[10px] font-semibold text-slate-400 bg-slate-800 rounded-lg shrink-0">
                        이미 등록됨
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAddDirectStock(directCandidate.ticker, directCandidate.name)}
                        disabled={isCapacityReached}
                        className="px-2.5 py-1 text-[11px] font-bold bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg shadow-sm shrink-0 transition-all flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>즉시 추가</span>
                      </button>
                    )}
                  </div>
                )}

                <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-800/40">
                  {modalSearchResults.length === 0 ? (
                    <div className="py-6 text-center space-y-3">
                      <p className="text-slate-400 text-xs">
                        마스터 목록에서 &apos;{searchModalQuery}&apos;의 일치 항목을 찾지 못했습니다.
                      </p>
                      <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl text-left space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-bold text-slate-100 text-xs">{searchModalQuery}</span>
                            <span className="text-[10px] text-slate-400 block mt-0.5">
                              입력하신 티커/이름으로 직접 워치리스트에 등록하시겠습니까?
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAddDirectStock(searchModalQuery, searchModalQuery)}
                            disabled={isCapacityReached}
                            className="px-3 py-1.5 text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg shadow-sm"
                          >
                            + 직접 등록
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-500 border-t border-slate-800/60 pt-2 leading-relaxed">
                          💡 <b>전 종목 지원 안내</b>: 한국 상장 종목은 <b>6자리 종목코드</b>(예: 005930, 012450) 또는 .KS/.KQ, 미국 상장 종목은 <b>표준 티커</b>(예: AAPL, PLTR, ARM)를 입력하시면 <b>한국/미국의 모든 정상 상장 종목</b>이 100% 등록 및 실시간 분석됩니다.
                        </p>
                      </div>
                    </div>
                  ) : (
                    modalSearchResults.map((stock) => {
                      const isAlreadyAdded = existingTickerSet.has(stock.ticker.toUpperCase());
                      return (
                        <div
                          key={stock.ticker}
                          className="flex items-center justify-between pt-2 pb-1.5 px-2 rounded-xl hover:bg-slate-800/50 transition-colors"
                        >
                          <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                                stock.market === 'KR'
                                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              }`}
                            >
                              {stock.exchange || stock.market}
                            </span>
                            <div className="min-w-0 truncate">
                              <div className="font-bold text-slate-100 text-xs truncate">
                                {stock.name}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5">
                                <span className="text-cyan-400 font-semibold">{stock.ticker}</span>
                                {stock.sector && <span className="truncate">· {stock.sector}</span>}
                              </div>
                            </div>
                          </div>

                          {isAlreadyAdded ? (
                            <span className="px-2.5 py-1 text-[11px] font-semibold text-slate-400 bg-slate-800/80 rounded-lg flex items-center gap-1 shrink-0">
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span>등록됨</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleAddDirectStock(stock.ticker, stock.name)}
                              disabled={isCapacityReached}
                              className="px-3 py-1.5 text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 active:scale-95 text-white rounded-lg shadow-sm shadow-cyan-600/30 transition-all flex items-center gap-1 shrink-0 disabled:opacity-50"
                            >
                              <Plus className="w-3 h-3" />
                              <span>+ 담기</span>
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">관찰 메모 (선택)</label>
                  <textarea
                    placeholder="관찰 목적 및 전략 메모..."
                    value={newMemo}
                    onChange={(e) => setNewMemo(e.target.value)}
                    disabled={isCapacityReached}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 h-14 resize-none focus:outline-none focus:border-cyan-500 disabled:opacity-50 text-xs"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-medium transition-colors"
                  >
                    닫기
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: Direct Input / Multi-Ticker Batch Form */}
            {addModeTab === 'batch' && (
              <form onSubmit={handleCreateSubmit} className="space-y-3.5 text-xs">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-slate-300 font-semibold">
                      종목명 또는 티커 심볼 *
                    </label>
                    <span className="text-[11px] text-cyan-400 font-medium">
                      한글 종목명 또는 티커 (콤마로 다수 동시 입력 가능)
                    </span>
                  </div>
                  <textarea
                    id="watchlist-new-ticker-input"
                    placeholder={
                      activeMarket === 'KR'
                        ? '예: LG에너지솔루션, 현대차, 에코프로 또는 005930, 000660 (콤마로 구분하여 입력)'
                        : '예: NVDA, AAPL, Tesla, Microsoft, SPY, QQQ (콤마로 구분하여 입력)'
                    }
                    value={newTicker}
                    onChange={(e) => setNewTicker(e.target.value)}
                    disabled={isCapacityReached}
                    rows={2}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed resize-none"
                    required
                  />

                  {/* Recommended Ticker Examples Chips */}
                  <div className="mt-2.5 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-slate-300">
                        {activeMarket === 'KR' ? '🇰🇷 국내 추천 예시 종목 (클릭 시 자동 추가):' : '🇺🇸 미국 추천 예시 종목 (클릭 시 자동 추가):'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (activeMarket === 'KR') {
                            setNewTicker('LG에너지솔루션, 005930.KS, 000660.KS, 현대차, NAVER');
                          } else {
                            setNewTicker('NVDA, AAPL, MSFT, TSLA, SPY');
                          }
                        }}
                        className="text-cyan-400 hover:text-cyan-300 text-[10px] font-semibold underline decoration-dotted"
                      >
                        {activeMarket === 'KR' ? '+ 국내 대표 5선 일괄 담기' : '+ 미국 대표 5선 일괄 담기'}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {activeMarket === 'KR' ? (
                        [
                          { ticker: '373220.KS', name: 'LG에너지솔루션' },
                          { ticker: '005930.KS', name: '삼성전자' },
                          { ticker: '000660.KS', name: 'SK하이닉스' },
                          { ticker: '005380.KS', name: '현대차' },
                          { ticker: '069500.KS', name: 'KODEX 200' },
                          { ticker: '035420.KS', name: 'NAVER' },
                          { ticker: '000270.KS', name: '기아' },
                          { ticker: '247540.KQ', name: '에코프로비엠' },
                        ].map((item) => (
                          <button
                            key={item.ticker}
                            type="button"
                            onClick={() => {
                              setNewTicker((prev) => {
                                const trimmed = prev.trim();
                                if (!trimmed) {
                                  setNewName(item.name);
                                  return item.name;
                                }
                                const list = trimmed.split(/[,\s]+/).map((s) => s.trim());
                                if (list.includes(item.name) || list.includes(item.ticker)) return prev;
                                return `${trimmed}, ${item.name}`;
                              });
                            }}
                            className="px-2 py-1 rounded-lg text-xs bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 border border-slate-800 hover:border-cyan-500/40 transition-all flex items-center space-x-1"
                          >
                            <span className="font-medium">{item.name}</span>
                            <span className="font-mono text-[10px] text-slate-400">({item.ticker})</span>
                          </button>
                        ))
                      ) : (
                        [
                          { ticker: 'NVDA', name: 'NVIDIA' },
                          { ticker: 'AAPL', name: 'Apple' },
                          { ticker: 'MSFT', name: 'Microsoft' },
                          { ticker: 'TSLA', name: 'Tesla' },
                          { ticker: 'SPY', name: 'S&P 500 ETF' },
                          { ticker: 'QQQ', name: 'Nasdaq 100 ETF' },
                        ].map((item) => (
                          <button
                            key={item.ticker}
                            type="button"
                            onClick={() => {
                              setNewTicker((prev) => {
                                const trimmed = prev.trim();
                                if (!trimmed) {
                                  setNewName(item.name);
                                  return item.ticker;
                                }
                                const list = trimmed.split(/[,\s]+/).map((s) => s.trim().toUpperCase());
                                if (list.includes(item.ticker)) return prev;
                                return `${trimmed}, ${item.ticker}`;
                              });
                            }}
                            className="px-2 py-1 rounded-lg text-xs bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 border border-slate-800 hover:border-cyan-500/40 transition-all flex items-center space-x-1"
                          >
                            <span className="font-mono font-bold">{item.ticker}</span>
                            <span className="text-[10px] text-slate-400">({item.name})</span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>

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
                            {parsedTickers.valid.map((item, i) => (
                              <span
                                key={item.ticker}
                                className={`px-2 py-0.5 rounded font-mono font-bold text-xs border ${
                                  i < remainingSlots
                                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                    : 'bg-rose-500/15 text-rose-300 border-rose-500/30 line-through opacity-75'
                                }`}
                              >
                                {item.name} ({item.ticker})
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
                            <span>인식되지 않은 항목 ({parsedTickers.invalid.length}개):</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {parsedTickers.invalid.map((t) => (
                              <span
                                key={t}
                                className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20 font-mono text-xs line-through"
                                title="종목명을 찾을 수 없거나 올바른 티커 형식이 아닙니다."
                              >
                                {t} (제외)
                              </span>
                            ))}
                          </div>
                          <p className="text-[10px] text-slate-400">
                            * 종목명(예: LG에너지솔루션) 또는 6자리 종목코드(예: 373220, 005930), 표준 티커(예: AAPL)를 입력해주세요.
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
                            {parsedTickers.alreadyExists.map((item) => (
                              <span
                                key={item.ticker}
                                className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono text-xs"
                              >
                                {item.name} ({item.ticker}) (기등록)
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
                    <label className="block text-slate-300 font-semibold mb-1">종목명 (단일 등록 시 직접 지정/선택)</label>
                    <input
                      id="watchlist-new-name-input"
                      type="text"
                      placeholder="예: LG에너지솔루션 (비워두면 자동 조회)"
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
            )}
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
