import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Award,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  ExternalLink,
  Filter,
  Info,
  Layers,
  Search,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import { DipBuyEvaluation, FullTickerEvaluation } from '../types/v8';
import { ensureDipEvaluation } from '../engine/dipBuyEngine';
import { buildDipBuyTelegramMessage } from '../notification/templates';
import { formatStockPrice, formatChangePercent } from '../utils/formatters';
import { SortableHeader } from './SortableHeader';

export type DipSortField =
  | 'ticker'
  | 'name'
  | 'price'
  | 'change'
  | 'suitability'
  | 'timing'
  | 'dip_score'
  | 'rsi'
  | 'drawdown';

interface DipBuyMatrixProps {
  evaluations: FullTickerEvaluation[];
  searchTerm: string;
  onSelectTicker: (ticker: string, initialTab?: 'overview' | 'chart' | 'dip_buy') => void;
  onDeleteTicker: (ticker: string) => void;
}

export const DipBuyMatrix: React.FC<DipBuyMatrixProps> = ({
  evaluations,
  searchTerm,
  onSelectTicker,
  onDeleteTicker,
}) => {
  const [filterTier, setFilterTier] = useState<string>('ALL');
  const [filterSignal, setFilterSignal] = useState<string>('ALL');
  const [filterAssetType, setFilterAssetType] = useState<string>('ALL');
  const [sortField, setSortField] = useState<DipSortField>('dip_score');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [copiedTicker, setCopiedTicker] = useState<string | null>(null);

  // Memoized dip evaluations
  const itemsWithDip = useMemo(() => {
    return (evaluations || []).map((ev) => {
      const dip = ensureDipEvaluation(ev);
      return {
        ...ev,
        dip,
      };
    });
  }, [evaluations]);

  // Summary counts
  const stats = useMemo(() => {
    let sTierCount = 0;
    let aOrBetterCount = 0;
    let strongDipCount = 0;
    let moderateDcaCount = 0;
    let overboughtCount = 0;
    let ineligibleCount = 0;

    itemsWithDip.forEach((item) => {
      const d = item.dip;
      if (d.suitability.tier === 'S') sTierCount++;
      if (d.suitability.tier === 'S' || d.suitability.tier === 'A') aOrBetterCount++;
      if (d.actionSignal === 'STRONG_DIP_BUY') strongDipCount++;
      if (d.actionSignal === 'MODERATE_DCA') moderateDcaCount++;
      if (d.actionSignal === 'OVERBOUGHT_WAIT') overboughtCount++;
      if (d.actionSignal === 'INELIGIBLE_AVOID') ineligibleCount++;
    });

    return {
      sTierCount,
      aOrBetterCount,
      strongDipCount,
      moderateDcaCount,
      overboughtCount,
      ineligibleCount,
    };
  }, [itemsWithDip]);

  const handleSort = (field: DipSortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortField(field);
      setSortOrder(field === 'ticker' || field === 'name' ? 'asc' : 'desc');
    }
  };

  // Filter items
  const filtered = useMemo(() => {
    return itemsWithDip.filter((item) => {
      const d = item.dip;

      // Search
      const matchSearch =
        (item.ticker || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.name || '').toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchSearch) return false;

      // Tier filter
      if (filterTier === 'S' && d.suitability.tier !== 'S') return false;
      if (filterTier === 'A_OR_BETTER' && d.suitability.tier !== 'S' && d.suitability.tier !== 'A') {
        return false;
      }
      if (filterTier === 'B' && d.suitability.tier !== 'B') return false;
      if (filterTier === 'C' && d.suitability.tier !== 'C') return false;

      // Signal filter
      if (filterSignal === 'BUY_ONLY' && d.actionSignal !== 'STRONG_DIP_BUY' && d.actionSignal !== 'MODERATE_DCA') {
        return false;
      }
      if (filterSignal === 'STRONG_DIP_BUY' && d.actionSignal !== 'STRONG_DIP_BUY') return false;
      if (filterSignal === 'MODERATE_DCA' && d.actionSignal !== 'MODERATE_DCA') return false;
      if (filterSignal === 'OVERBOUGHT_WAIT' && d.actionSignal !== 'OVERBOUGHT_WAIT') return false;
      if (filterSignal === 'INELIGIBLE_AVOID' && d.actionSignal !== 'INELIGIBLE_AVOID') return false;

      // Asset Type
      if (filterAssetType !== 'ALL' && item.classification?.asset_type !== filterAssetType) {
        return false;
      }

      return true;
    });
  }, [itemsWithDip, searchTerm, filterTier, filterSignal, filterAssetType]);

  // Sort items
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let diff = 0;
      switch (sortField) {
        case 'ticker':
          diff = (a.ticker || '').localeCompare(b.ticker || '');
          break;
        case 'name':
          diff = (a.name || '').localeCompare(b.name || '');
          break;
        case 'price':
          diff = (a.price ?? 0) - (b.price ?? 0);
          break;
        case 'change':
          diff = (a.change1d ?? 0) - (b.change1d ?? 0);
          break;
        case 'suitability':
          diff = a.dip.suitability.score - b.dip.suitability.score;
          break;
        case 'timing':
          diff = a.dip.timing.score - b.dip.timing.score;
          break;
        case 'dip_score':
          diff = a.dip.dip_score - b.dip.dip_score;
          break;
        case 'rsi':
          diff = a.dip.timing.rsi - b.dip.timing.rsi;
          break;
        case 'drawdown':
          diff = a.dip.timing.drawdownFromHigh - b.dip.timing.drawdownFromHigh;
          break;
        default:
          diff = 0;
      }
      return sortOrder === 'desc' ? -diff : diff;
    });
  }, [filtered, sortField, sortOrder]);

  const handleCopyTelegram = (item: (typeof itemsWithDip)[0], e: React.MouseEvent) => {
    e.stopPropagation();
    const msg = buildDipBuyTelegramMessage(item.dip);
    navigator.clipboard.writeText(msg);
    setCopiedTicker(item.ticker);
    setTimeout(() => setCopiedTicker(null), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Strategy Summary KPI Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 text-xs">
        <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between text-slate-400">
            <span>💎 S등급 초우량</span>
            <span className="w-2 h-2 rounded-full bg-purple-400"></span>
          </div>
          <div className="text-xl font-bold font-mono text-purple-300 mt-1">
            {stats.sTierCount}
            <span className="text-xs text-slate-500 font-normal"> / {itemsWithDip.length}개</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">지수 ETF & 독점 메가캡</div>
        </div>

        <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between text-slate-400">
            <span>🥇 적립 적격 (S/A)</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          </div>
          <div className="text-xl font-bold font-mono text-emerald-300 mt-1">
            {stats.aOrBetterCount}
            <span className="text-xs text-slate-500 font-normal">개</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">손절 없이 모아갈 체급</div>
        </div>

        <div className="p-3 bg-slate-900/90 border border-emerald-500/30 bg-emerald-950/20 rounded-xl">
          <div className="flex items-center justify-between text-emerald-300">
            <span>🟢 적극 추매 타점</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          </div>
          <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
            {stats.strongDipCount}
            <span className="text-xs text-slate-500 font-normal">개</span>
          </div>
          <div className="text-[10px] text-emerald-300/80 mt-0.5">1.5~2배 확대 적립 권고</div>
        </div>

        <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between text-slate-400">
            <span>⏸️ 단기과열 (보류)</span>
            <span className="w-2 h-2 rounded-full bg-blue-400"></span>
          </div>
          <div className="text-xl font-bold font-mono text-blue-300 mt-1">
            {stats.overboughtCount}
            <span className="text-xs text-slate-500 font-normal">개</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">추격 매수 금지 / 대기</div>
        </div>

        <div className="p-3 bg-slate-900/90 border border-rose-500/20 bg-rose-950/10 rounded-xl col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-rose-400">
            <span>🚫 추매 부적합</span>
            <span className="w-2 h-2 rounded-full bg-rose-400"></span>
          </div>
          <div className="text-xl font-bold font-mono text-rose-300 mt-1">
            {stats.ineligibleCount}
            <span className="text-xs text-slate-500 font-normal">개</span>
          </div>
          <div className="text-[10px] text-rose-400/80 mt-0.5">C등급 고변동성/잡주</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-900/70 border border-slate-800 rounded-xl text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-slate-400 font-semibold flex items-center space-x-1 mr-1">
            <Filter className="w-3.5 h-3.5 text-emerald-400" />
            <span>체급/신호 필터:</span>
          </span>

          {/* Tier Filter */}
          <select
            value={filterTier}
            onChange={(e) => setFilterTier(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200 focus:outline-none focus:border-emerald-500 text-xs"
          >
            <option value="ALL">우량 체급: 전체 보기</option>
            <option value="S">💎 S등급 (메가캡 & 지수 ETF만)</option>
            <option value="A_OR_BETTER">🥇 A등급 이상 (적립 적격 우량주)</option>
            <option value="B">🥈 B등급 (준우량 중대형주)</option>
            <option value="C">⚠️ C등급 (고위험/추매 부적합)</option>
          </select>

          {/* Action Signal Filter */}
          <select
            value={filterSignal}
            onChange={(e) => setFilterSignal(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200 focus:outline-none focus:border-emerald-500 text-xs"
          >
            <option value="ALL">신호 판정: 전체 보기</option>
            <option value="BUY_ONLY">🟢 추매 유효 종목만 (적극+정기)</option>
            <option value="STRONG_DIP_BUY">🟢 적극 분할추매 (과매도 눌림목)</option>
            <option value="MODERATE_DCA">🟡 정기 적립추매 (적정가 유지)</option>
            <option value="OVERBOUGHT_WAIT">⏸️ 추매 보류 (단기 과열)</option>
            <option value="INELIGIBLE_AVOID">🚫 추매 부적합 (고위험주)</option>
          </select>

          {/* Asset Type */}
          <select
            value={filterAssetType}
            onChange={(e) => setFilterAssetType(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200 focus:outline-none focus:border-emerald-500 text-xs"
          >
            <option value="ALL">자산 형태: 전체</option>
            <option value="etf">지수 / 테마 ETF</option>
            <option value="equity">개별 주식</option>
          </select>
        </div>

        <div className="text-slate-400 text-xs font-mono">
          표시: <span className="text-emerald-400 font-bold">{sorted.length}</span> / {itemsWithDip.length}개 자산
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 font-sans select-none">
                <SortableHeader<DipSortField>
                  field="ticker"
                  currentField={sortField}
                  currentOrder={sortOrder}
                  onSort={handleSort}
                  className="py-3.5 px-4 font-semibold"
                >
                  <span className="text-slate-500 font-mono text-[11px] mr-1.5">No.</span>
                  <span>종목코드 / 이름</span>
                </SortableHeader>

                <SortableHeader<DipSortField>
                  field="price"
                  currentField={sortField}
                  currentOrder={sortOrder}
                  onSort={handleSort}
                  className="py-3.5 px-3 font-semibold"
                >
                  <span>현재가 (1D)</span>
                </SortableHeader>

                <SortableHeader<DipSortField>
                  field="suitability"
                  currentField={sortField}
                  currentOrder={sortOrder}
                  onSort={handleSort}
                  className="py-3.5 px-4 font-semibold"
                >
                  <span>우량대형주 적합도 (체급 검증)</span>
                </SortableHeader>

                <SortableHeader<DipSortField>
                  field="timing"
                  currentField={sortField}
                  currentOrder={sortOrder}
                  onSort={handleSort}
                  className="py-3.5 px-3 font-semibold"
                >
                  <span>현재 눌림목 타이밍 (할인율)</span>
                </SortableHeader>

                <SortableHeader<DipSortField>
                  field="dip_score"
                  currentField={sortField}
                  currentOrder={sortOrder}
                  onSort={handleSort}
                  className="py-3.5 px-3 font-semibold text-center"
                >
                  <span>종합 추매 점수</span>
                </SortableHeader>

                <th className="py-3.5 px-3 font-semibold text-slate-400 whitespace-nowrap">
                  적립·추매 권고 신호
                </th>

                <th className="py-3.5 px-4 font-semibold text-right text-slate-400 whitespace-nowrap">
                  알림 / 진단
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/60 font-mono">
              {sorted.map((item, idx) => {
                const dip = item.dip;
                const arrow = (item.change1d ?? 0) >= 0 ? '▲' : '▼';
                const changeColor =
                  (item.change1d ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400';

                return (
                  <tr
                    key={item.ticker}
                    onClick={() => onSelectTicker(item.ticker, 'dip_buy')}
                    className="hover:bg-slate-800/50 transition-colors cursor-pointer group"
                  >
                    {/* 1. Ticker & Name */}
                    <td className="py-3.5 px-4 font-sans">
                      <div className="flex items-center space-x-2.5">
                        <span className="text-[11px] font-mono font-bold text-emerald-400/90 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800/90 min-w-[28px] text-center shrink-0">
                          {idx + 1}
                        </span>

                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-mono font-bold text-sm text-slate-100 group-hover:text-emerald-300 transition-colors">
                              {item.ticker}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                                dip.suitability.tier === 'S'
                                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                                  : dip.suitability.tier === 'A'
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                  : dip.suitability.tier === 'B'
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                  : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                              }`}
                            >
                              {dip.suitability.tier}등급
                            </span>
                            {item.classification.asset_type === 'etf' && (
                              <span className="text-[9px] bg-slate-800 text-slate-400 px-1 rounded">
                                ETF
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate max-w-[140px] sm:max-w-[200px]">
                            {item.name}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* 2. Price & 1D Change */}
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <div className="font-bold text-slate-200">
                        {formatStockPrice(item.price)}
                      </div>
                      <div className={`text-[11px] font-semibold flex items-center space-x-0.5 ${changeColor}`}>
                        <span>{arrow}</span>
                        <span>{formatChangePercent(item.change1d)}</span>
                      </div>
                    </td>

                    {/* 3. Blue-Chip Suitability Score & Breakdown */}
                    <td className="py-3.5 px-4 font-sans">
                      <div className="flex items-center space-x-2 mb-1">
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${
                            dip.suitability.tier === 'S'
                              ? 'bg-purple-500/20 text-purple-200 border-purple-500/40'
                              : dip.suitability.tier === 'A'
                              ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40'
                              : dip.suitability.tier === 'B'
                              ? 'bg-amber-500/20 text-amber-200 border-amber-500/40'
                              : 'bg-rose-500/20 text-rose-200 border-rose-500/40'
                          }`}
                        >
                          {dip.suitability.tierLabel} ({dip.suitability.score}점)
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {dip.suitability.isSuitable ? '추매 적격' : '추매 부적합'}
                        </span>
                      </div>

                      {/* 4 Factor Mini Indicators */}
                      <div className="grid grid-cols-4 gap-1 text-[9px] font-mono text-slate-400 max-w-[220px]">
                        <div title={`지수/ETF 지위: ${dip.suitability.breakdown.indexStatusScore}/30점`}>
                          <div className="h-1 bg-slate-800 rounded overflow-hidden">
                            <div
                              className="h-full bg-purple-400"
                              style={{ width: `${(dip.suitability.breakdown.indexStatusScore / 30) * 100}%` }}
                            />
                          </div>
                          <span className="text-[8px] mt-0.5 block">지수 {dip.suitability.breakdown.indexStatusScore}</span>
                        </div>

                        <div title={`시가총액: ${dip.suitability.breakdown.marketCapScore}/25점`}>
                          <div className="h-1 bg-slate-800 rounded overflow-hidden">
                            <div
                              className="h-full bg-blue-400"
                              style={{ width: `${(dip.suitability.breakdown.marketCapScore / 25) * 100}%` }}
                            />
                          </div>
                          <span className="text-[8px] mt-0.5 block">시총 {dip.suitability.breakdown.marketCapScore}</span>
                        </div>

                        <div title={`해자/현금흐름: ${dip.suitability.breakdown.qualityScore}/25점`}>
                          <div className="h-1 bg-slate-800 rounded overflow-hidden">
                            <div
                              className="h-full bg-emerald-400"
                              style={{ width: `${(dip.suitability.breakdown.qualityScore / 25) * 100}%` }}
                            />
                          </div>
                          <span className="text-[8px] mt-0.5 block">해자 {dip.suitability.breakdown.qualityScore}</span>
                        </div>

                        <div title={`하방안정성: ${dip.suitability.breakdown.stabilityScore}/20점`}>
                          <div className="h-1 bg-slate-800 rounded overflow-hidden">
                            <div
                              className="h-full bg-cyan-400"
                              style={{ width: `${(dip.suitability.breakdown.stabilityScore / 20) * 100}%` }}
                            />
                          </div>
                          <span className="text-[8px] mt-0.5 block">안정 {dip.suitability.breakdown.stabilityScore}</span>
                        </div>
                      </div>
                    </td>

                    {/* 4. Dip Timing Score & Metrics */}
                    <td className="py-3.5 px-3">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`font-mono font-bold text-sm ${
                            dip.timing.score >= 70
                              ? 'text-emerald-400'
                              : dip.timing.score >= 50
                              ? 'text-amber-400'
                              : 'text-slate-400'
                          }`}
                        >
                          {dip.timing.score}점
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          (RSI {dip.timing.rsi.toFixed(1)})
                        </span>
                      </div>
                      <div className="text-[10px] text-rose-400/90 font-mono mt-0.5">
                        {dip.timing.drawdownLabel}
                      </div>
                      <div className="text-[9px] text-slate-400 truncate max-w-[170px] mt-0.5 font-sans">
                        {dip.timing.supportLevel}
                      </div>
                    </td>

                    {/* 5. Comprehensive Dip Score */}
                    <td className="py-3.5 px-3 text-center">
                      <div className="inline-flex flex-col items-center">
                        <span
                          className={`text-base font-black font-mono ${
                            dip.dip_score >= 75
                              ? 'text-emerald-400'
                              : dip.dip_score >= 55
                              ? 'text-amber-300'
                              : 'text-slate-400'
                          }`}
                        >
                          {dip.dip_score}
                        </span>
                        <div className="w-12 bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1">
                          <div
                            className={`h-full rounded-full ${
                              dip.dip_score >= 75
                                ? 'bg-emerald-400'
                                : dip.dip_score >= 55
                                ? 'bg-amber-400'
                                : 'bg-slate-500'
                            }`}
                            style={{ width: `${dip.dip_score}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* 6. Guidance Action Signal & DCA Ratio */}
                    <td className="py-3.5 px-3 font-sans">
                      <div className="flex items-center space-x-1.5">
                        <span
                          className={`px-2.5 py-1 text-xs font-bold rounded-lg border whitespace-nowrap ${
                            dip.actionSignal === 'STRONG_DIP_BUY'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : dip.actionSignal === 'MODERATE_DCA'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : dip.actionSignal === 'OVERBOUGHT_WAIT'
                              ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                              : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          }`}
                        >
                          {dip.signalLabel}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-300 font-medium mt-1 truncate max-w-[200px]">
                        {dip.suggestedDcaRatio}
                      </div>
                    </td>

                    {/* 7. Action Buttons */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={(e) => handleCopyTelegram(item, e)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-emerald-600/30 text-emerald-400 hover:text-emerald-300 transition-colors border border-emerald-500/20"
                          title="전략 B 텔레그램 알림 양식 복사"
                        >
                          {copiedTicker === item.ticker ? (
                            <Check className="w-3.5 h-3.5 text-emerald-300" />
                          ) : (
                            <Send className="w-3.5 h-3.5" />
                          )}
                        </button>

                        <button
                          onClick={() => onSelectTicker(item.ticker, 'dip_buy')}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                          title="우량대형주 적합도 & 눌림목 상세 진단"
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

      {/* Strategy Guidance Card */}
      <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs">
        <div className="space-y-1">
          <div className="font-bold text-slate-200 flex items-center space-x-1.5">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>양도소득세(22%) 절세형 무매도 장기 복리 & 눌림목 추매 전략 가이드</span>
          </div>
          <p className="text-slate-400 leading-relaxed max-w-3xl">
            미국 주식은 잦은 매매 시 수익금의 22%가 양도소득세로 원천 누수됩니다. 이 전략은 <b>망하지 않을 체급의 지수 ETF 및 메가캡 우량주(S/A등급)</b>를 매도 없이 보유하며, RSI 과매도 및 52주 고점 대비 건강한 눌림목에서만 평단가를 낮춰 매수(DCA)함으로써 복리 수익을 극대화합니다.
          </p>
        </div>

        <div className="px-3 py-2 bg-slate-950 rounded-xl border border-slate-800 shrink-0 text-[11px] text-slate-400">
          <div>💎 S등급: 지수 ETF & 메가캡 독점주</div>
          <div className="mt-0.5">🟢 적극 추매: RSI 과매도 & 지지선 도달</div>
        </div>
      </div>
    </div>
  );
};
