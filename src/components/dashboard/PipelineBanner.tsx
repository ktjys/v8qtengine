import React from 'react';
import { ChevronRight, Layers, Zap, ShieldAlert, CheckCircle2, Sparkles, ArrowRight } from 'lucide-react';
import type { FullTickerEvaluation } from '../../types/v8';

interface PipelineBannerProps {
  evaluations: FullTickerEvaluation[];
  onNavigateToWatchlist: () => void;
}

export const PipelineBanner: React.FC<PipelineBannerProps> = ({
  evaluations,
  onNavigateToWatchlist,
}) => {
  return (
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
  );
};