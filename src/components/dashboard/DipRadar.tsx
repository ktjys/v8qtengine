import React, { useMemo } from 'react';
import { ShieldCheck, ChevronRight } from 'lucide-react';
import type { FullTickerEvaluation } from '../../types/v8';
import { ensureDipEvaluation } from '../../engine/dipBuyEngine';
import { StockDisplayBadge } from '../StockDisplayBadge';

interface DipRadarProps {
  evaluations: FullTickerEvaluation[];
  onSelectTicker: (ticker: string, tab?: 'overview' | 'chart' | 'dip_buy') => void;
  onNavigateToWatchlist: (mode?: 'MOMENTUM' | 'DCA_DIP') => void;
}

export const DipRadar: React.FC<DipRadarProps> = ({
  evaluations,
  onSelectTicker,
  onNavigateToWatchlist,
}) => {
  const dipItems = useMemo(() => {
    return (evaluations || [])
      .map((e) => ({ ...e, dip: ensureDipEvaluation(e) }))
      .sort((a, b) => b.dip.dip_score - a.dip.dip_score);
  }, [evaluations]);

  if (dipItems.length === 0) {
    return (
      <div className="py-8 text-center text-slate-500 text-xs font-sans bg-slate-950/40 rounded-xl border border-slate-800/80">
        {evaluations.length === 0 ? '워치리스트가 비어 있습니다. 종목을 등록해주세요.' : '현재 눌림목 매수 추천 데이터가 없습니다.'}
      </div>
    );
  }

  return (
    <div className="bg-slate-900/80 border border-emerald-500/30 rounded-2xl p-4.5 sm:p-5 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-base font-bold text-slate-100">
                전략 B: 우량대형주 적립 & 눌림목 추매 레이더
              </h3>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                22% 양도세 절세형 무매도 복리
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              망하지 않을 S/A등급 메가캡 & 지수 ETF를 매도 없이 보유하며, RSI 과매도 눌림목에서만 평단가를 낮춰 매수합니다.
            </p>
          </div>
        </div>

        <button
          onClick={() => onNavigateToWatchlist('DCA_DIP')}
          className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all active:scale-95 whitespace-nowrap self-start sm:self-auto"
        >
          <span>전략 B 전용 매트릭스 열기</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {dipItems.slice(0, 4).map((item) => {
          const d = item.dip;
          return (
            <div
              key={item.ticker}
              onClick={() => onSelectTicker(item.ticker, 'dip_buy')}
              className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-emerald-500/40 transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <StockDisplayBadge
                    ticker={item.ticker}
                    name={item.name}
                    showSubCode={true}
                    primaryClassName="font-mono font-bold text-sm text-slate-100 group-hover:text-emerald-300 transition-colors"
                  />

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded border whitespace-nowrap ml-2 ${
                      d.actionSignal === 'STRONG_DIP_BUY'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : d.actionSignal === 'MODERATE_DCA'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : d.actionSignal === 'OVERBOUGHT_WAIT'
                        ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                        : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    }`}
                  >
                    {d.signalLabel}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400">우량도 {d.suitability.score}점</span>
                  <span className="text-emerald-400 font-bold">추매점수 {d.dip_score}점</span>
                </div>

                <div className="mt-1 flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span>RSI {d.timing.rsi.toFixed(1)}</span>
                  <span className="text-rose-400">{d.timing.drawdownLabel}</span>
                </div>
              </div>

              <div className="mt-2.5 pt-2 border-t border-slate-800/80 text-[10px] text-slate-300 truncate">
                💡 {d.suggestedDcaRatio}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};