import React from 'react';
import {
  Sparkles,
  Sliders,
  TrendingUp,
  AlertCircle,
  ArrowRight,
  RotateCcw,
  CheckCircle2,
  Zap,
} from 'lucide-react';
import { FullTickerEvaluation } from '../types/v8';
import {
  DEFAULT_STRATEGY_CONFIG,
  diagnoseMonitoredPortfolio,
  RECOMMENDED_PRESETS,
  StrategyOptimizationConfig,
} from '../engine/strategyOptimizerEngine';

interface StrategyOptimizationBannerProps {
  evaluations: FullTickerEvaluation[];
  currentConfig: StrategyOptimizationConfig;
  onOpenModal: () => void;
  onApplyConfig: (config: StrategyOptimizationConfig) => void;
}

export const StrategyOptimizationBanner: React.FC<StrategyOptimizationBannerProps> = ({
  evaluations,
  currentConfig,
  onOpenModal,
  onApplyConfig,
}) => {
  const diagnosis = diagnoseMonitoredPortfolio(evaluations, currentConfig);
  const isDefault = currentConfig.id === DEFAULT_STRATEGY_CONFIG.id;
  const bestPreset = RECOMMENDED_PRESETS[0]; // 대형 성장주 모멘텀 최적화
  const dipPreset = RECOMMENDED_PRESETS[1]; // 고승률 눌림목

  const topBottleneck = diagnosis.bottlenecks[0];

  return (
    <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border border-cyan-500/30 rounded-3xl p-4 sm:p-5 shadow-lg space-y-3">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Left Section: Current Active Strategy & Diagnosis Badge */}
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="p-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Sparkles className="w-4 h-4" />
            </span>
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <span>모니터링 전략 진단 & 최적화</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-mono font-bold">
                적용 중: {currentConfig.name}
              </span>
            </h3>

            {!isDefault && (
              <button
                onClick={() => onApplyConfig(DEFAULT_STRATEGY_CONFIG)}
                className="text-[11px] text-slate-400 hover:text-slate-200 underline flex items-center space-x-1"
                title="기본 설정으로 되돌리기"
              >
                <RotateCcw className="w-3 h-3" />
                <span>기본값 복원</span>
              </button>
            )}
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            {topBottleneck ? (
              <>
                <strong className="text-amber-400">진단 발견: </strong>
                {topBottleneck.summary}
              </>
            ) : (
              '모니터링 중인 종목군에 적합한 전략 파라미터가 적용되어 있습니다.'
            )}
          </p>
        </div>

        {/* Right Section: Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Preset 1 quick apply */}
          {currentConfig.id !== bestPreset.id && (
            <button
              onClick={() => onApplyConfig(bestPreset)}
              className="px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 font-semibold transition-all flex items-center space-x-1.5 shadow-sm"
              title={bestPreset.description}
            >
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span>추천: 성장주 모멘텀 적용 (우량주 70점)</span>
            </button>
          )}

          {/* Preset 2 quick apply */}
          {currentConfig.id !== dipPreset.id && (
            <button
              onClick={() => onApplyConfig(dipPreset)}
              className="px-3.5 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/20 font-semibold transition-all flex items-center space-x-1.5"
              title={dipPreset.description}
            >
              <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
              <span>눌림목 특화 적용</span>
            </button>
          )}

          {/* Full Customizer Modal Trigger */}
          <button
            onClick={onOpenModal}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold border border-slate-700 transition-all flex items-center space-x-1.5"
          >
            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
            <span>전략 진단 & 파라미터 수정</span>
          </button>
        </div>
      </div>

      {/* Trapped Tickers / Quick Opportunity Transition Preview */}
      {diagnosis.simulatedMetrics.newOpportunityCandidates.length > 0 && isDefault && (
        <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-[11px] text-slate-400 gap-2">
          <div className="flex items-center space-x-1.5">
            <span className="text-emerald-400 font-semibold">✨ 전략 수정 시 즉시 신호 진입 가능:</span>
            {diagnosis.simulatedMetrics.newOpportunityCandidates.map((t) => (
              <span
                key={t}
                className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-mono font-bold"
              >
                {t}
              </span>
            ))}
          </div>

          <div className="text-slate-400 font-mono">
            예상 승률: <strong className="text-emerald-400">{diagnosis.simulatedMetrics.currentWinRate}% → {diagnosis.simulatedMetrics.projectedWinRate}%</strong>
          </div>
        </div>
      )}
    </div>
  );
};
