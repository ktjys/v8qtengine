import React from 'react';
import {
  TrendingUp,
  Shield,
  Zap,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Info,
} from 'lucide-react';
import { RegimeAnalysisResult, RegimeMetricSummary, MarketRegimeType } from '../engine/regimeAnalysisEngine';

interface MarketRegimeAnalysisProps {
  data: RegimeAnalysisResult | null;
  isLoading?: boolean;
}

export const MarketRegimeAnalysis: React.FC<MarketRegimeAnalysisProps> = ({
  data,
  isLoading = false,
}) => {
  if (isLoading || !data) {
    return (
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 text-center text-slate-500 font-mono">
        시장 국면별 퀀트 성과 매트릭스를 분석 중입니다...
      </div>
    );
  }

  const getRegimeIcon = (regime: MarketRegimeType) => {
    switch (regime) {
      case 'BULL':
        return <TrendingUp className="w-5 h-5 text-emerald-400" />;
      case 'NEUTRAL':
        return <Layers className="w-5 h-5 text-amber-400" />;
      case 'BEAR':
        return <Shield className="w-5 h-5 text-rose-400" />;
      case 'HIGH_VOL':
        return <Flame className="w-5 h-5 text-purple-400" />;
      case 'LOW_VOL':
        return <Zap className="w-5 h-5 text-cyan-400" />;
    }
  };

  const getBadgeClass = (regime: MarketRegimeType) => {
    switch (regime) {
      case 'BULL':
        return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';
      case 'NEUTRAL':
        return 'bg-amber-500/10 text-amber-300 border-amber-500/30';
      case 'BEAR':
        return 'bg-rose-500/10 text-rose-300 border-rose-500/30';
      case 'HIGH_VOL':
        return 'bg-purple-500/10 text-purple-300 border-purple-500/30';
      case 'LOW_VOL':
        return 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Quant Macro Insight */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-cyan-950/40 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-3">
        <div className="flex items-center space-x-2">
          <span className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <Layers className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <span>시장 국면별(Market Regime) 성과 교차 분석</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono font-medium">
                평균 알파 +{data.overallAlpha}%p
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              상승 추세(Bull), 횡보 박스권(Neutral), 조정/급락(Bear), 고변동성 환경에서의 신호 적중률과 초과 수익률을 분해합니다.
            </p>
          </div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 text-xs text-slate-300 leading-relaxed font-sans">
          <div className="text-cyan-400 font-bold mb-1 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>국면별 퀀트 모델 검증 결론:</span>
          </div>
          {data.summaryCommentary}
        </div>
      </div>

      {/* 5 Regime Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {data.regimes.map((item) => {
          const isPositiveAlpha = item.alphaSpread >= 0;
          return (
            <div
              key={item.regime}
              className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4 hover:border-slate-700 transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2.5">
                    <span className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                      {getRegimeIcon(item.regime)}
                    </span>
                    <div>
                      <h3 className="text-base font-bold text-white">{item.label}</h3>
                      <div className="text-[11px] text-slate-400 font-mono">{item.nameEn}</div>
                    </div>
                  </div>
                  <span
                    className={`text-xs px-2.5 py-1 rounded-lg border font-mono font-bold ${getBadgeClass(
                      item.regime
                    )}`}
                  >
                    알파 {item.alphaSpread >= 0 ? '+' : ''}{item.alphaSpread}%p
                  </span>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed min-h-[36px]">
                  {item.description}
                </p>

                {/* Metrics 2x2 Grid */}
                <div className="grid grid-cols-2 gap-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800/60 font-mono text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 block font-sans">전략 승률 (20D)</span>
                    <span className="text-sm font-bold text-white">{item.winRate}%</span>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full mt-1 overflow-hidden">
                      <div
                        className="bg-cyan-400 h-full rounded-full"
                        style={{ width: `${Math.min(100, item.winRate)}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 block font-sans">전략 평균 수익률</span>
                    <span
                      className={`text-sm font-bold ${
                        item.avgReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {item.avgReturn >= 0 ? '+' : ''}{item.avgReturn}%
                    </span>
                    <span className="text-[10px] text-slate-500 block font-sans mt-0.5">
                      SPY {item.benchmarkReturn >= 0 ? '+' : ''}{item.benchmarkReturn}%
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-800/60">
                    <span className="text-[10px] text-slate-500 block font-sans">손익비 (PF)</span>
                    <span className="text-xs font-bold text-amber-300">{item.profitFactor}x</span>
                  </div>

                  <div className="pt-2 border-t border-slate-800/60">
                    <span className="text-[10px] text-slate-500 block font-sans">최대 손실 (Max Loss)</span>
                    <span className="text-xs font-bold text-rose-400">{item.maxTradeLoss}%</span>
                  </div>
                </div>

                {/* Dominant Strategy Tag */}
                <div className="text-xs">
                  <span className="text-slate-400 text-[11px]">우세 전략:</span>{' '}
                  <span className="font-semibold text-cyan-300">{item.dominantStrategy}</span>
                </div>
              </div>

              {/* Quant Insight Box */}
              <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 text-[11px] text-slate-300 leading-relaxed font-sans space-y-1">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Info className="w-3 h-3 text-cyan-400" />
                  <span>퀀트 알파 메커니즘</span>
                </div>
                <p>{item.keyInsight}</p>
                <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-800/60 font-mono">
                  실제 매크로 샘플: {item.marketEnvironmentSample}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Cross-Sectional Comparison Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <span>시장 국면별 종합 비교 매트릭스 (Cross-Sectional Matrix)</span>
        </h3>

        <div className="border border-slate-800 rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-mono">
            <thead>
              <tr className="bg-slate-950 text-slate-400 font-sans font-medium">
                <th className="py-3 px-4">국면 (Regime)</th>
                <th className="py-3 px-4">표본 수</th>
                <th className="py-3 px-4">전략 승률</th>
                <th className="py-3 px-4">전략 평균 수익</th>
                <th className="py-3 px-4">SPY 벤치마크</th>
                <th className="py-3 px-4 font-sans">초과 알파 (Alpha Spread)</th>
                <th className="py-3 px-4">손익비 (PF)</th>
                <th className="py-3 px-4">최대 손실</th>
                <th className="py-3 px-4 font-sans">주도 자산군</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
              {data.regimes.map((r) => {
                return (
                  <tr key={r.regime} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-sans">
                      <span className="font-bold text-white flex items-center gap-1.5">
                        {getRegimeIcon(r.regime)}
                        <span>{r.label}</span>
                      </span>
                      <span className="text-[10px] text-slate-500 block font-mono">{r.nameEn}</span>
                    </td>

                    <td className="py-3 px-4 text-slate-300">
                      {r.signalCount}건
                    </td>

                    <td className="py-3 px-4 font-bold text-white">
                      {r.winRate}%
                    </td>

                    <td className="py-3 px-4 font-bold">
                      <span className={r.avgReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {r.avgReturn >= 0 ? '+' : ''}{r.avgReturn}%
                      </span>
                    </td>

                    <td className="py-3 px-4 text-slate-400">
                      {r.benchmarkReturn >= 0 ? '+' : ''}{r.benchmarkReturn}%
                    </td>

                    <td className="py-3 px-4 font-bold">
                      <span
                        className={`px-2 py-0.5 rounded text-xs border ${
                          r.alphaSpread >= 0
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        }`}
                      >
                        {r.alphaSpread >= 0 ? '+' : ''}{r.alphaSpread}%p
                      </span>
                    </td>

                    <td className="py-3 px-4 text-amber-300 font-semibold">
                      {r.profitFactor}x
                    </td>

                    <td className="py-3 px-4 text-rose-400">
                      {r.maxTradeLoss}%
                    </td>

                    <td className="py-3 px-4 font-sans text-cyan-300 text-xs">
                      {r.dominantStrategy}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
