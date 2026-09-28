import React from 'react';
import { TrendingUp, BarChart3, CheckCircle2, Layers, Zap } from 'lucide-react';
import type { BacktestSummary, FullTickerEvaluation, MarketRegion } from '../../types/v8';
import { formatStockPrice, formatChangePercent } from '../../utils/formatters';

interface KPIBannerProps {
  evaluations: FullTickerEvaluation[];
  backtestSummary: BacktestSummary | null;
  activeMarket: MarketRegion;
}

export const KPIBanner: React.FC<KPIBannerProps> = ({
  evaluations,
  backtestSummary,
  activeMarket,
}) => {
  const actionableSignalsToday = evaluations.filter(
    (e) => e?.signal_generated === true
  ).length;

  const opportunities = evaluations.filter(
    (e) => e?.decision?.decision === 'STRONG_OPPORTUNITY' || e?.decision?.decision === 'OPPORTUNITY'
  ).length;

  return (
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
          <span className="text-xl sm:text-2xl font-bold text-amber-400 font-mono">{actionableSignalsToday}</span>
          <span className="text-[10px] sm:text-xs text-slate-400">건 진입 조건</span>
        </div>
        <div className="mt-1.5 sm:mt-2 text-[10px] sm:text-xs text-slate-400 flex items-center space-x-1 truncate">
          <span className="truncate">불변 원장 저장 완료</span>
        </div>
      </div>

      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 sm:p-4.5 shadow-sm">
        <div className="flex items-center justify-between text-slate-400 text-[11px] sm:text-xs font-medium mb-1.5 sm:mb-2">
          <span>20일 승률 ({activeMarket === 'KR' ? '국내 퀀트' : '미국 퀀트'})</span>
          <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
        </div>
        <div className="flex items-baseline space-x-1.5 sm:space-x-2">
          <span className="text-xl sm:text-2xl font-bold text-emerald-400 font-mono">
            {evaluations.length === 0 || !backtestSummary || backtestSummary.completed_signals === 0
              ? '-'
              : `${backtestSummary.win_rate_20d}%`}
          </span>
          {evaluations.length > 0 && backtestSummary && backtestSummary.completed_signals > 0 && (
            <span className="text-[10px] sm:text-xs text-slate-400">
              (5D: {backtestSummary.win_rate_5d}%)
            </span>
          )}
        </div>
        <div className="mt-1.5 sm:mt-2 text-[10px] sm:text-xs text-emerald-400/90 font-mono truncate">
          {evaluations.length === 0
            ? '종목 등록 필요'
            : !backtestSummary || backtestSummary.completed_signals === 0
            ? '완료 신호 대기'
            : `평균: +${backtestSummary.avg_return_20d}%`}
        </div>
      </div>

      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 sm:p-4.5 shadow-sm">
        <div className="flex items-center justify-between text-slate-400 text-[11px] sm:text-xs font-medium mb-1.5 sm:mb-2">
          <span>Profit Factor ({activeMarket === 'KR' ? '국내' : '미국'})</span>
          <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400" />
        </div>
        <div className="flex items-baseline space-x-1.5 sm:space-x-2">
          <span className="text-xl sm:text-2xl font-bold text-blue-400 font-mono">
            {evaluations.length === 0 || !backtestSummary || backtestSummary.completed_signals === 0
              ? '-'
              : `${backtestSummary.profit_factor}x`}
          </span>
          <span className="text-[10px] sm:text-xs text-slate-400">수익/손실</span>
        </div>
        <div className="mt-1.5 sm:mt-2 text-[10px] sm:text-xs text-cyan-400 font-mono truncate">
          {evaluations.length === 0
            ? '종목 등록 필요'
            : !backtestSummary || backtestSummary.completed_signals === 0
            ? 'MDD: 0.0%'
            : `MDD: -${backtestSummary.max_drawdown}%`}
        </div>
      </div>
    </div>
  );
};