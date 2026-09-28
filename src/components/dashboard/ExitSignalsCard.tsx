import React, { useMemo } from 'react';
import { ShieldAlert, ArrowRight, ChevronRight } from 'lucide-react';
import type { FullTickerEvaluation } from '../../types/v8';
import { ExitSignalEngine } from '../../engine/exitSignalEngine';
import { StockDisplayBadge } from '../StockDisplayBadge';

interface ExitSignalsCardProps {
  evaluations: FullTickerEvaluation[];
  onSelectTicker: (ticker: string) => void;
  onNavigateToExit: () => void;
}

export const ExitSignalsCard: React.FC<ExitSignalsCardProps> = ({
  evaluations,
  onSelectTicker,
  onNavigateToExit,
}) => {
  const exitSignals = useMemo(() => {
    return ExitSignalEngine.evaluateAllExits(evaluations).filter((e) => e.isActionableSell);
  }, [evaluations]);

  if (exitSignals.length === 0) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-rose-950/70 via-slate-900 to-slate-950 border border-rose-500/30 rounded-2xl p-4 shadow-lg shadow-rose-950/20 flex flex-col md:flex-row md:items-center justify-between gap-3 animate-in fade-in">
      <div className="flex items-center space-x-3 min-w-0">
        <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0">
          <ShieldAlert className="w-5 h-5 animate-pulse" />
        </div>
        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-400">
              🚨 실시간 퀀트 매도/청산 신호 ({exitSignals.length}건)
            </span>
            <span className="px-2 py-0.2 rounded-full text-[10px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
              Exit Rules Active
            </span>
          </div>
          <p className="text-xs text-slate-300 truncate">
            {exitSignals.slice(0, 3).map((e) => `${e.ticker}: ${e.headline}`).join(' | ')}
            {exitSignals.length > 3 ? ` 외 ${exitSignals.length - 3}건` : ''}
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-2 shrink-0 self-end md:self-auto">
        <button
          id="dashboard-goto-exit-btn"
          onClick={onNavigateToExit}
          className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-md shadow-rose-600/30 transition-all active:scale-95"
        >
          <span>매도 & 청산 센터 이동</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};