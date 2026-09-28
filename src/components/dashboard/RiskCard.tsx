import React from 'react';
import { ShieldAlert, AlertTriangle } from 'lucide-react';
import type { FullTickerEvaluation } from '../../types/v8';
import { StockDisplayBadge } from '../StockDisplayBadge';
import { formatStockPrice } from '../../utils/formatters';

interface RiskCardProps {
  highRiskItems: FullTickerEvaluation[];
  onSelectTicker: (ticker: string) => void;
}

export const RiskCard: React.FC<RiskCardProps> = ({
  highRiskItems,
  onSelectTicker,
}) => {
  if (highRiskItems.length === 0) {
    return (
      <div className="py-8 text-center text-slate-500 text-xs font-sans">
        현재 고위험(Risk HIGH)으로 분류된 종목이 없습니다.
      </div>
    );
  }

  return (
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
                <StockDisplayBadge
                  ticker={item.ticker}
                  name={item.name}
                  showSubCode={true}
                  primaryClassName="font-bold text-slate-100 group-hover:text-rose-400 transition-colors text-xs sm:text-sm"
                />
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
  );
};