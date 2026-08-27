import React, { useState } from 'react';
import {
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
  Search,
  Send,
  Shield,
  Sliders,
  Sparkles,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import {
  AssetType,
  DecisionType,
  FullTickerEvaluation,
  RiskLevel,
  StrategyType,
} from '../types/v8';
import { formatStockPrice, formatChangePercent } from '../utils/formatters';

interface WatchlistViewProps {
  evaluations: FullTickerEvaluation[];
  onSelectTicker: (ticker: string, initialTab?: 'overview' | 'chart') => void;
  onPreviewTelegram: (ticker: string) => void;
  onAddTicker: (ticker: string, name: string, memo: string) => void;
  onDeleteTicker: (ticker: string) => void;
  onToggleActive: (ticker: string, active: boolean) => void;
  onRecalculate?: () => void;
  isRecalculating?: boolean;
}

export const WatchlistView: React.FC<WatchlistViewProps> = ({
  evaluations,
  onSelectTicker,
  onPreviewTelegram,
  onAddTicker,
  onDeleteTicker,
  onToggleActive,
  onRecalculate,
  isRecalculating = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAssetType, setFilterAssetType] = useState<string>('ALL');
  const [filterStrategy, setFilterStrategy] = useState<string>('ALL');
  const [filterRisk, setFilterRisk] = useState<string>('ALL');
  const [filterDecision, setFilterDecision] = useState<string>('ALL');
  const [signalsOnly, setSignalsOnly] = useState(false);
  const [sortField, setSortField] = useState<'opp' | 'risk' | 'ticker' | 'change'>('opp');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Add Ticker Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTicker, setNewTicker] = useState('');
  const [newName, setNewName] = useState('');
  const [newMemo, setNewMemo] = useState('');

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
    if (signalsOnly && !item.decision?.actionable) {
      return false;
    }

    return true;
  });

  // Sorting
  const sorted = [...filtered].sort((a, b) => {
    let diff = 0;
    if (sortField === 'opp') {
      diff = (a.opportunity?.opportunity_score ?? 0) - (b.opportunity?.opportunity_score ?? 0);
    } else if (sortField === 'risk') {
      diff = (a.risk?.risk_score ?? 0) - (b.risk?.risk_score ?? 0);
    } else if (sortField === 'ticker') {
      diff = (a.ticker || '').localeCompare(b.ticker || '');
    } else if (sortField === 'change') {
      diff = (a.change1d ?? 0) - (b.change1d ?? 0);
    }
    return sortOrder === 'desc' ? -diff : diff;
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicker.trim()) return;
    onAddTicker(newTicker.toUpperCase().trim(), newName.trim(), newMemo.trim());
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
      {/* 1. Header with Controls */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center space-x-2">
              <span>워치리스트 전종목 평가 매트릭스</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 font-mono">
                {evaluations.length}개 대상
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              전체 종목에 대해 4대 서브 스코어(기술/모멘텀/펀더멘털/밸류)와 독립 리스크를 동시 산출합니다.
            </p>
          </div>

          <div className="flex items-center space-x-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="티커 / 종목명 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-950/70 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            {onRecalculate && (
              <button
                onClick={onRecalculate}
                disabled={isRecalculating}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold shadow-sm transition-all active:scale-95 whitespace-nowrap disabled:opacity-50"
                title="Yahoo Finance 실시간 시세 및 4대 팩터 점수를 다시 계산합니다."
              >
                <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isRecalculating ? 'animate-spin' : ''}`} />
                <span>{isRecalculating ? '시세 갱신 중...' : '시세/평가 새로고침'}</span>
              </button>
            )}

            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md shadow-cyan-600/30 transition-all active:scale-95 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>종목 추가</span>
            </button>
          </div>
        </div>

        {/* Filters Bar */}
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
      </div>

      {/* 2. Main Matrix Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-950/70 border-b border-slate-800 text-slate-400">
                <th
                  onClick={() => {
                    setSortField('ticker');
                    setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
                  }}
                  className="py-3.5 px-4 font-semibold cursor-pointer hover:text-slate-200"
                >
                  <div className="flex items-center space-x-1">
                    <span>종목코드 / 이름</span>
                    <ArrowDownUp className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3.5 px-3 font-semibold">자산 정체성 / 전략</th>
                <th
                  onClick={() => {
                    setSortField('change');
                    setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
                  }}
                  className="py-3.5 px-3 font-semibold cursor-pointer hover:text-slate-200"
                >
                  <div className="flex items-center space-x-1">
                    <span>현재가 (1D)</span>
                    <ArrowDownUp className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => {
                    setSortField('opp');
                    setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
                  }}
                  className="py-3.5 px-4 font-semibold cursor-pointer hover:text-slate-200"
                >
                  <div className="flex items-center space-x-1">
                    <span>기회 점수 (4대 서브 스코어)</span>
                    <ArrowDownUp className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => {
                    setSortField('risk');
                    setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
                  }}
                  className="py-3.5 px-3 font-semibold cursor-pointer hover:text-slate-200"
                >
                  <div className="flex items-center space-x-1">
                    <span>독립 리스크 제약</span>
                    <ArrowDownUp className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3.5 px-3 font-semibold">최종 의사결정 (Decision)</th>
                <th className="py-3.5 px-3 font-semibold text-center">시그널</th>
                <th className="py-3.5 px-4 font-semibold text-right">진단 / 알림</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {sorted.map((item) => {
                const sub = item.opportunity.sub_scores;
                const isSignal = item.decision.actionable;

                return (
                  <tr
                    key={item.ticker}
                    onClick={() => onSelectTicker(item.ticker)}
                    className="hover:bg-slate-800/50 transition-colors cursor-pointer group"
                  >
                    {/* Ticker & Name */}
                    <td className="py-3 px-4 font-sans">
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
                    </td>

                    {/* Classification */}
                    <td className="py-3 px-3 font-sans">
                      <div className="text-slate-200 text-xs font-medium">
                        {item.classification.strategy_type}
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center space-x-1">
                        <span className="uppercase text-[9px] px-1 rounded bg-slate-800 text-slate-400">
                          {item.classification.asset_type}
                        </span>
                        <span>신뢰도 {(item.classification.confidence * 100).toFixed(0)}%</span>
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
                        Beta: {item.risk.components.beta.toFixed(2)}
                      </div>
                    </td>

                    {/* Decision */}
                    <td className="py-3 px-3 font-sans">
                      {getDecisionBadge(item.decision.decision)}
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

      {/* Add Ticker Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
                <Plus className="w-4 h-4 text-cyan-400" />
                <span>워치리스트 종목 추가</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  티커 심볼 (Ticker) *
                </label>
                <input
                  type="text"
                  placeholder="예: META, CRM, IVV, SOXX"
                  value={newTicker}
                  onChange={(e) => setNewTicker(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono uppercase focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">종목명 (선택)</label>
                <input
                  type="text"
                  placeholder="예: Meta Platforms, Inc."
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">관찰 메모</label>
                <textarea
                  placeholder="관찰 목적 및 전략 메모..."
                  value={newMemo}
                  onChange={(e) => setNewMemo(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 h-20 resize-none focus:outline-none focus:border-cyan-500"
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
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold shadow-md shadow-cyan-600/30 transition-all active:scale-95"
                >
                  워치리스트 추가 및 즉시 평가
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
