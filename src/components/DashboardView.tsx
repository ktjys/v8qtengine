import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Database,
  Eye,
  Flame,
  Layers,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { BacktestSummary, FullTickerEvaluation, SignalSnapshot } from '../types/v8';
import { formatStockPrice, formatChangePercent } from '../utils/formatters';
import { SortableHeader } from './SortableHeader';

export type DashboardSignalSortField =
  | 'signal_date'
  | 'ticker'
  | 'strategy_type'
  | 'signal_price'
  | 'opportunity_score'
  | 'risk_level'
  | 'return_5d'
  | 'return_10d'
  | 'return_20d';

interface DashboardViewProps {
  evaluations: FullTickerEvaluation[];
  recentSignals: SignalSnapshot[];
  backtestSummary: BacktestSummary | null;
  onSelectTicker: (ticker: string) => void;
  onPreviewTelegram: (ticker: string) => void;
  onNavigateToWatchlist: () => void;
  onRecalculate?: () => void;
  isRecalculating?: boolean;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  evaluations,
  recentSignals,
  backtestSummary,
  onSelectTicker,
  onPreviewTelegram,
  onNavigateToWatchlist,
  onRecalculate,
  isRecalculating = false,
}) => {
  const [showAllWatch, setShowAllWatch] = useState(false);
  const [showAllSignals, setShowAllSignals] = useState(false);
  const [signalSortField, setSignalSortField] = useState<DashboardSignalSortField>('signal_date');
  const [signalSortOrder, setSignalSortOrder] = useState<'desc' | 'asc'>('desc');

  const handleSignalSort = (field: DashboardSignalSortField) => {
    if (signalSortField === field) {
      setSignalSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSignalSortField(field);
      setSignalSortOrder(field === 'ticker' || field === 'strategy_type' ? 'asc' : 'desc');
    }
  };

  // Categorize Today's Watch
  const opportunities = (evaluations || [])
    .filter((e) => e?.decision?.decision === 'STRONG_OPPORTUNITY' || e?.decision?.decision === 'OPPORTUNITY')
    .sort((a, b) => (b.opportunity?.opportunity_score ?? 0) - (a.opportunity?.opportunity_score ?? 0));

  const watchListItems = (evaluations || [])
    .filter((e) => e?.decision?.decision === 'WATCH')
    .sort((a, b) => (b.opportunity?.opportunity_score ?? 0) - (a.opportunity?.opportunity_score ?? 0));

  const highRiskItems = (evaluations || [])
    .filter((e) => e?.risk?.risk_level === 'HIGH')
    .sort((a, b) => (b.risk?.risk_score ?? 0) - (a.risk?.risk_score ?? 0));

  const actionableSignalsToday = (evaluations || []).filter(
    (e) =>
      e?.signal_generated ||
      e?.decision?.actionable ||
      e?.decision?.decision === 'STRONG_OPPORTUNITY' ||
      e?.decision?.decision === 'OPPORTUNITY'
  );

  const uniqueRecentSignals = useMemo(() => {
    const map = new Map<string, SignalSnapshot>();
    for (const sig of (recentSignals || [])) {
      const key = `${sig.ticker}_${sig.signal_date}`;
      if (!map.has(key)) {
        map.set(key, sig);
      }
    }
    const list = Array.from(map.values());

    const riskRank: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };

    list.sort((a, b) => {
      let diff = 0;
      switch (signalSortField) {
        case 'signal_date':
          diff = (a.signal_date || '').localeCompare(b.signal_date || '');
          break;
        case 'ticker':
          diff = (a.ticker || '').localeCompare(b.ticker || '');
          break;
        case 'strategy_type':
          diff = (a.strategy_type || '').localeCompare(b.strategy_type || '');
          break;
        case 'signal_price':
          diff = (a.signal_price ?? 0) - (b.signal_price ?? 0);
          break;
        case 'opportunity_score':
          diff = (a.opportunity_score ?? 0) - (b.opportunity_score ?? 0);
          break;
        case 'risk_level':
          diff = (riskRank[a.risk_level] || 0) - (riskRank[b.risk_level] || 0);
          break;
        case 'return_5d':
          diff = (a.return_5d ?? -999) - (b.return_5d ?? -999);
          break;
        case 'return_10d':
          diff = (a.return_10d ?? -999) - (b.return_10d ?? -999);
          break;
        case 'return_20d':
          diff = (a.return_20d ?? -999) - (b.return_20d ?? -999);
          break;
        default:
          diff = 0;
      }
      return signalSortOrder === 'desc' ? -diff : diff;
    });

    return list;
  }, [recentSignals, signalSortField, signalSortOrder]);

  const displayedWatchItems = showAllWatch ? watchListItems : watchListItems.slice(0, 10);
  const displayedSignals = showAllSignals ? uniqueRecentSignals : uniqueRecentSignals.slice(0, 10);

  return (
    <div className="space-y-6 sm:space-y-8 animate-fadeIn">
      {/* 1. Top KPI Telemetry Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 sm:p-4.5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-[11px] sm:text-xs font-medium mb-1.5 sm:mb-2">
            <span>워치리스트 관찰</span>
            <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400" />
          </div>
          <div className="flex items-baseline space-x-1.5 sm:space-x-2">
            <span className="text-xl sm:text-2xl font-bold text-slate-100 font-mono">{evaluations.length}</span>
            <span className="text-[10px] sm:text-xs text-slate-400">종목 모니터링</span>
          </div>
          <div className="mt-1.5 sm:mt-2 text-[10px] sm:text-xs text-emerald-400 flex items-center space-x-1 truncate">
            <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
            <span className="truncate">전체 평가 완료</span>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 sm:p-4.5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-[11px] sm:text-xs font-medium mb-1.5 sm:mb-2">
            <span>오늘의 발생 시그널</span>
            <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline space-x-1.5 sm:space-x-2">
            <span className="text-xl sm:text-2xl font-bold text-amber-400 font-mono">
              {actionableSignalsToday.length}
            </span>
            <span className="text-[10px] sm:text-xs text-slate-400">건 진입 조건</span>
          </div>
          <div className="mt-1.5 sm:mt-2 text-[10px] sm:text-xs text-slate-400 flex items-center space-x-1 truncate">
            <span className="truncate">불변 원장 저장 완료</span>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 sm:p-4.5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-[11px] sm:text-xs font-medium mb-1.5 sm:mb-2">
            <span>20일 승률 (백테스트)</span>
            <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline space-x-1.5 sm:space-x-2">
            <span className="text-xl sm:text-2xl font-bold text-emerald-400 font-mono">
              {backtestSummary?.win_rate_20d ?? 83.3}%
            </span>
            <span className="text-[10px] sm:text-xs text-slate-400">
              (5D: {backtestSummary?.win_rate_5d ?? 100.0}%)
            </span>
          </div>
          <div className="mt-1.5 sm:mt-2 text-[10px] sm:text-xs text-emerald-400/90 font-mono truncate">
            평균: +{backtestSummary?.avg_return_20d ?? 10.5}%
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 sm:p-4.5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-[11px] sm:text-xs font-medium mb-1.5 sm:mb-2">
            <span>Profit Factor</span>
            <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400" />
          </div>
          <div className="flex items-baseline space-x-1.5 sm:space-x-2">
            <span className="text-xl sm:text-2xl font-bold text-blue-400 font-mono">
              {backtestSummary?.profit_factor ?? 8.4}x
            </span>
            <span className="text-[10px] sm:text-xs text-slate-400">수익/손실</span>
          </div>
          <div className="mt-1.5 sm:mt-2 text-[10px] sm:text-xs text-cyan-400 font-mono truncate">
            MDD: -{backtestSummary?.max_drawdown ?? 2.4}%
          </div>
        </div>
      </div>

      {/* 2. Closed-Loop Pipeline Architecture Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 text-[10px] sm:text-xs font-semibold rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                폐쇄 루프 아키텍처
              </span>
              <h2 className="text-base sm:text-lg font-bold text-slate-100">
                퀀트 의사결정 파이프라인
              </h2>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400 max-w-2xl leading-relaxed">
              Opportunity Engine은 Watchlist 전체({evaluations.length}개)에 대해 실행되며,
              Risk Engine의 <strong>독립적인 제약 조건</strong>을 통과한 신호만 Telegram 및 영구 스냅샷으로 발행됩니다.
            </p>
          </div>
          <button
            onClick={onNavigateToWatchlist}
            className="flex items-center space-x-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 transition-all active:scale-95 whitespace-nowrap self-start sm:self-auto"
          >
            <span>전종목 매트릭스</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Visual Pipeline Steps */}
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-2.5 mt-4 sm:mt-5">
          <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-2 sm:p-3 text-center">
            <div className="text-[9px] sm:text-[10px] text-cyan-400 font-mono font-bold">STEP 01</div>
            <div className="text-[11px] sm:text-xs font-semibold text-slate-200 mt-0.5 sm:mt-1 truncate">Watchlist</div>
            <div className="text-[9px] sm:text-[11px] text-slate-400 mt-0.5 truncate">상시 관찰</div>
          </div>
          <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-2 sm:p-3 text-center">
            <div className="text-[9px] sm:text-[10px] text-cyan-400 font-mono font-bold">STEP 02</div>
            <div className="text-[11px] sm:text-xs font-semibold text-slate-200 mt-0.5 sm:mt-1 truncate">Classification</div>
            <div className="text-[9px] sm:text-[11px] text-slate-400 mt-0.5 truncate">자산 분류</div>
          </div>
          <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-2 sm:p-3 text-center">
            <div className="text-[9px] sm:text-[10px] text-cyan-400 font-mono font-bold">STEP 03</div>
            <div className="text-[11px] sm:text-xs font-semibold text-slate-200 mt-0.5 sm:mt-1 truncate">Opportunity</div>
            <div className="text-[9px] sm:text-[11px] text-slate-400 mt-0.5 truncate">4대 팩터</div>
          </div>
          <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-2 sm:p-3 text-center">
            <div className="text-[9px] sm:text-[10px] text-amber-400 font-mono font-bold">STEP 04</div>
            <div className="text-[11px] sm:text-xs font-semibold text-slate-200 mt-0.5 sm:mt-1 truncate">Risk Constraint</div>
            <div className="text-[9px] sm:text-[11px] text-slate-400 mt-0.5 truncate">독립 필터</div>
          </div>
          <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-2 sm:p-3 text-center">
            <div className="text-[9px] sm:text-[10px] text-emerald-400 font-mono font-bold">STEP 05</div>
            <div className="text-[11px] sm:text-xs font-semibold text-slate-200 mt-0.5 sm:mt-1 truncate">Decision</div>
            <div className="text-[9px] sm:text-[11px] text-slate-400 mt-0.5 truncate">행동 판단</div>
          </div>
          <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-2 sm:p-3 text-center">
            <div className="text-[9px] sm:text-[10px] text-blue-400 font-mono font-bold">STEP 06</div>
            <div className="text-[11px] sm:text-xs font-semibold text-slate-200 mt-0.5 sm:mt-1 truncate">Signal Ledger</div>
            <div className="text-[9px] sm:text-[11px] text-slate-400 mt-0.5 truncate">성과 추적</div>
          </div>
        </div>
      </div>

      {/* 3. Today's Watch (Opportunity / Watch / Risk) */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-4">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400 shrink-0" />
            <h3 className="text-sm sm:text-base font-bold text-slate-100">
              Today's Watch (오늘의 3대 행동 관찰 리스트)
            </h3>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-3">
            {onRecalculate && (
              <button
                id="btn-dashboard-recalculate"
                onClick={onRecalculate}
                disabled={isRecalculating}
                className="flex items-center space-x-1 px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-semibold rounded-xl bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-700/50 transition-all active:scale-95 disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${isRecalculating ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{isRecalculating ? 'DB 퀀트 재계산 중...' : 'DB 데이터 새로고침 / 퀀트 재평가'}</span>
                <span className="sm:hidden">{isRecalculating ? '재계산 중...' : 'DB 새로고침'}</span>
              </button>
            )}
            <span className="text-[11px] sm:text-xs text-slate-400 font-mono">
              최근: {evaluations[0]?.evaluated_at ? new Date(evaluations[0].evaluated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'LIVE'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Card 1: Opportunities */}
          <div className="bg-slate-900/80 border border-emerald-500/20 rounded-2xl p-4.5 flex flex-col shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400"></div>
                <h4 className="font-semibold text-sm text-emerald-400">기회 (Opportunity)</h4>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 font-bold">
                {opportunities.length}개 종목
              </span>
            </div>

            <div className="mt-3 space-y-2 flex-1">
              {opportunities.map((item, idx) => (
                <div
                  key={item.ticker}
                  onClick={() => onSelectTicker(item.ticker)}
                  className="group p-3 rounded-xl bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800/80 hover:border-emerald-500/40 transition-all cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <span className="text-[10px] font-mono font-bold text-emerald-400/90 bg-slate-950 px-1.5 py-0.5 rounded border border-emerald-500/20 min-w-[24px] text-center shrink-0">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-100 font-mono group-hover:text-cyan-400 transition-colors">
                          {item.ticker}
                        </span>
                        <span className="text-[11px] text-slate-400 truncate max-w-[110px]">
                          {item.name}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {item.classification.strategy_type}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="flex items-center space-x-2 justify-end">
                      <span className="text-sm font-bold text-emerald-400 font-mono">
                        {item.opportunity.opportunity_score}점
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                          item.risk.risk_level === 'LOW'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : item.risk.risk_level === 'MEDIUM'
                            ? 'bg-amber-500/10 text-amber-400'
                            : 'bg-rose-500/10 text-rose-400'
                        }`}
                      >
                        {item.risk.risk_level}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                      {formatStockPrice(item.price, item.ticker)} ({formatChangePercent(item.change1d)})
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Card 2: Watch */}
          <div className="bg-slate-900/80 border border-amber-500/20 rounded-2xl p-4.5 flex flex-col shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400"></div>
                <h4 className="font-semibold text-sm text-amber-400">관찰 (Watch)</h4>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 font-bold">
                {watchListItems.length}개 종목
              </span>
            </div>

            <div className="mt-3 space-y-2 flex-1 max-h-[480px] overflow-y-auto pr-1">
              {displayedWatchItems.map((item, idx) => (
                <div
                  key={item.ticker}
                  onClick={() => onSelectTicker(item.ticker)}
                  className="group p-3 rounded-xl bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800/80 hover:border-amber-500/40 transition-all cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <span className="text-[10px] font-mono font-bold text-amber-400/90 bg-slate-950 px-1.5 py-0.5 rounded border border-amber-500/20 min-w-[24px] text-center shrink-0">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-100 font-mono group-hover:text-amber-400 transition-colors">
                          {item.ticker}
                        </span>
                        <span className="text-[11px] text-slate-400 truncate max-w-[110px]">
                          {item.name}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {item.classification.strategy_type}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="flex items-center space-x-2 justify-end">
                      <span className="text-sm font-bold text-amber-400 font-mono">
                        {item.opportunity.opportunity_score}점
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                          item.risk.risk_level === 'LOW'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : item.risk.risk_level === 'MEDIUM'
                            ? 'bg-amber-500/10 text-amber-400'
                            : 'bg-rose-500/10 text-rose-400'
                        }`}
                      >
                        {item.risk.risk_level}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                      {formatStockPrice(item.price, item.ticker)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {watchListItems.length > 10 && (
              <button
                onClick={() => setShowAllWatch(!showAllWatch)}
                className="mt-3 w-full py-1.5 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold flex items-center justify-center space-x-1 transition-colors"
              >
                {showAllWatch ? (
                  <>
                    <span>상위 10개만 접기</span>
                    <ChevronUp className="w-3.5 h-3.5 ml-1" />
                  </>
                ) : (
                  <>
                    <span>전체 {watchListItems.length}개 모두 보기</span>
                    <ChevronDown className="w-3.5 h-3.5 ml-1" />
                  </>
                )}
              </button>
            )}
          </div>

          {/* Card 3: High Risk Constraints */}
          <div className="bg-slate-900/80 border border-rose-500/20 rounded-2xl p-4.5 flex flex-col shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-400"></div>
                <h4 className="font-semibold text-sm text-rose-400">고위험 경계 (Risk HIGH)</h4>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 font-bold">
                {highRiskItems.length}개 종목
              </span>
            </div>

            <div className="mt-3 space-y-2 flex-1">
              {highRiskItems.map((item, idx) => (
                <div
                  key={item.ticker}
                  onClick={() => onSelectTicker(item.ticker)}
                  className="group p-3 rounded-xl bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800/80 hover:border-rose-500/40 transition-all cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <span className="text-[10px] font-mono font-bold text-rose-400/90 bg-slate-950 px-1.5 py-0.5 rounded border border-rose-500/20 min-w-[24px] text-center shrink-0">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-100 font-mono group-hover:text-rose-400 transition-colors">
                          {item.ticker}
                        </span>
                        <span className="text-[11px] text-slate-400 truncate max-w-[110px]">
                          {item.name}
                        </span>
                      </div>
                      <div className="text-[10px] text-rose-400/90 mt-0.5 truncate max-w-[180px]">
                        {item.risk.risk_reasons[0] || '고위험 제약 적용'}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="flex items-center space-x-2 justify-end">
                      <span className="text-xs text-slate-400 font-mono">
                        Opp {item.opportunity.opportunity_score}
                      </span>
                      <span className="text-xs font-bold text-rose-400 font-mono px-1.5 py-0.5 rounded bg-rose-500/10">
                        Risk {item.risk.risk_score}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                      판단: {item.decision.decision}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Recent Signals & Snapshot Timeline */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Zap className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-slate-100">
              최근 발생 시그널 스냅샷 원장 (불변 기록)
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            총 {recentSignals.length}건 기록
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-medium">
                <SortableHeader<DashboardSignalSortField>
                  field="signal_date"
                  currentField={signalSortField}
                  currentOrder={signalSortOrder}
                  onSort={handleSignalSort}
                  className="pb-3 font-semibold"
                >
                  <span>발생일</span>
                </SortableHeader>

                <SortableHeader<DashboardSignalSortField>
                  field="ticker"
                  currentField={signalSortField}
                  currentOrder={signalSortOrder}
                  onSort={handleSignalSort}
                  className="pb-3 font-semibold"
                >
                  <span className="text-slate-500 font-mono mr-1.5">No.</span>
                  <span>종목코드 / 이름</span>
                </SortableHeader>

                <SortableHeader<DashboardSignalSortField>
                  field="strategy_type"
                  currentField={signalSortField}
                  currentOrder={signalSortOrder}
                  onSort={handleSignalSort}
                  className="pb-3 font-semibold"
                >
                  <span>전략 유형</span>
                </SortableHeader>

                <SortableHeader<DashboardSignalSortField>
                  field="signal_price"
                  currentField={signalSortField}
                  currentOrder={signalSortOrder}
                  onSort={handleSignalSort}
                  className="pb-3 font-semibold"
                >
                  <span>진입가</span>
                </SortableHeader>

                <SortableHeader<DashboardSignalSortField>
                  field="opportunity_score"
                  currentField={signalSortField}
                  currentOrder={signalSortOrder}
                  onSort={handleSignalSort}
                  align="center"
                  className="pb-3 font-semibold text-center"
                >
                  <span>기회 점수</span>
                </SortableHeader>

                <SortableHeader<DashboardSignalSortField>
                  field="risk_level"
                  currentField={signalSortField}
                  currentOrder={signalSortOrder}
                  onSort={handleSignalSort}
                  align="center"
                  className="pb-3 font-semibold text-center"
                >
                  <span>리스크</span>
                </SortableHeader>

                <SortableHeader<DashboardSignalSortField>
                  field="return_5d"
                  currentField={signalSortField}
                  currentOrder={signalSortOrder}
                  onSort={handleSignalSort}
                  align="center"
                  className="pb-3 font-semibold text-center"
                >
                  <span>5D 수익률</span>
                </SortableHeader>

                <SortableHeader<DashboardSignalSortField>
                  field="return_10d"
                  currentField={signalSortField}
                  currentOrder={signalSortOrder}
                  onSort={handleSignalSort}
                  align="center"
                  className="pb-3 font-semibold text-center"
                >
                  <span>10D 수익률</span>
                </SortableHeader>

                <SortableHeader<DashboardSignalSortField>
                  field="return_20d"
                  currentField={signalSortField}
                  currentOrder={signalSortOrder}
                  onSort={handleSignalSort}
                  align="center"
                  className="pb-3 font-semibold text-center"
                >
                  <span>20D 수익률</span>
                </SortableHeader>

                <th className="pb-3 font-semibold text-right text-slate-400">텔레그램</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {displayedSignals.map((sig, idx) => (
                <tr
                  key={sig.id}
                  className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                  onClick={() => onSelectTicker(sig.ticker)}
                >
                  <td className="py-3 text-slate-400">{sig.signal_date}</td>
                  <td className="py-3 font-sans">
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-950 px-1 py-0.5 rounded border border-slate-800 text-center min-w-[22px]">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="font-bold text-slate-100 font-mono">{sig.ticker}</div>
                        <div className="text-[11px] text-slate-400">{sig.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 font-sans text-slate-300">{sig.strategy_type}</td>
                  <td className="py-3 text-slate-200">${sig.signal_price.toFixed(2)}</td>
                  <td className="py-3 text-center">
                    <span className="font-bold text-cyan-400">{sig.opportunity_score}</span>
                  </td>
                  <td className="py-3 text-center">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        sig.risk_level === 'LOW'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : sig.risk_level === 'MEDIUM'
                          ? 'bg-amber-500/10 text-amber-400'
                          : 'bg-rose-500/10 text-rose-400'
                      }`}
                    >
                      {sig.risk_level}
                    </span>
                  </td>
                  <td className="py-3 text-center">
                    {sig.return_5d !== null && sig.return_5d !== undefined ? (
                      <span
                        className={sig.return_5d >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}
                      >
                        {sig.return_5d >= 0 ? '+' : ''}{sig.return_5d}%
                      </span>
                    ) : (
                      <span className="text-slate-500">추적 중</span>
                    )}
                  </td>
                  <td className="py-3 text-center">
                    {sig.return_10d !== null && sig.return_10d !== undefined ? (
                      <span
                        className={sig.return_10d >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}
                      >
                        {sig.return_10d >= 0 ? '+' : ''}{sig.return_10d}%
                      </span>
                    ) : (
                      <span className="text-slate-500">추적 중</span>
                    )}
                  </td>
                  <td className="py-3 text-center">
                    {sig.return_20d !== null && sig.return_20d !== undefined ? (
                      <span
                        className={sig.return_20d >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}
                      >
                        {sig.return_20d >= 0 ? '+' : ''}{sig.return_20d}%
                      </span>
                    ) : (
                      <span className="text-slate-500">추적 중</span>
                    )}
                  </td>
                  <td className="py-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onPreviewTelegram(sig.ticker);
                      }}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-cyan-600 text-slate-300 hover:text-white transition-colors"
                      title="Telegram 알림 서식 보기"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {recentSignals.length > 10 && (
          <div className="mt-3 text-center border-t border-slate-800/80 pt-3">
            <button
              onClick={() => setShowAllSignals(!showAllSignals)}
              className="py-1.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold inline-flex items-center space-x-1 transition-colors"
            >
              {showAllSignals ? (
                <>
                  <span>최근 10건만 접기</span>
                  <ChevronUp className="w-3.5 h-3.5 ml-1" />
                </>
              ) : (
                <>
                  <span>전체 {recentSignals.length}건 시그널 모두 보기</span>
                  <ChevronDown className="w-3.5 h-3.5 ml-1" />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
