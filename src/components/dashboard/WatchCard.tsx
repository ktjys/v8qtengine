import React, { useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import type { FullTickerEvaluation } from '../../types/v8';
import { StockDisplayBadge } from '../StockDisplayBadge';
import { formatStockPrice, formatChangePercent } from '../../utils/formatters';

interface WatchCardProps {
  watchItems: FullTickerEvaluation[];
  onSelectTicker: (ticker: string) => void;
}

export const WatchCard: React.FC<WatchCardProps> = ({
  watchItems,
  onSelectTicker,
}) => {
  const [showAll, setShowAll] = useState(false);

  const displayedItems = showAll ? watchItems : watchItems.slice(0, 10);

  if (watchItems.length === 0) {
    return (
      <div className="py-8 text-center text-slate-500 text-xs font-sans">
        현재 관찰 조건에 해당하는 종목이 없습니다.
      </div>
    );
  }

  return (
    <div className="bg-slate-900/80 border border-amber-500/20 rounded-2xl p-4.5 flex flex-col shadow-sm">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400"></div>
          <h4 className="font-semibold text-sm text-amber-400">관찰 (Watch)</h4>
        </div>
        <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 font-bold">
          {watchItems.length}개 종목
        </span>
      </div>

      <div className="mt-3 space-y-2 flex-1 max-h-[480px] overflow-y-auto pr-1">
        {displayedItems.map((item, idx) => (
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
                <StockDisplayBadge
                  ticker={item.ticker}
                  name={item.name}
                  showSubCode={true}
                  primaryClassName="font-bold text-slate-100 group-hover:text-amber-400 transition-colors text-xs sm:text-sm"
                />
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

        {watchItems.length > 10 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="mt-3 w-full py-1.5 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold flex items-center justify-center space-x-1 transition-colors"
          >
            {showAll ? (
              <>
                <span>상위 10개만 접기</span>
                <ChevronUp className="w-3.5 h-3.5 ml-1" />
              </>
            ) : (
              <>
                <span>전체 {watchItems.length}개 모두 보기</span>
                <ChevronDown className="w-3.5 h-3.5 ml-1" />
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};