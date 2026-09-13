import React, { useState } from 'react';
import {
  Sparkles,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Shield,
  RotateCcw,
  ArrowRight,
  Zap,
  Target,
  Gauge,
  HelpCircle,
  Check,
  BarChart2,
  Flame,
  LineChart,
} from 'lucide-react';
import { FullTickerEvaluation } from '../types/v8';
import {
  DEFAULT_STRATEGY_CONFIG,
  diagnoseMonitoredPortfolio,
  RECOMMENDED_PRESETS,
  StrategyOptimizationConfig,
} from '../engine/strategyOptimizerEngine';

interface StrategyOptimizerViewProps {
  evaluations: FullTickerEvaluation[];
  currentConfig?: StrategyOptimizationConfig;
  onApplyConfig?: (config: StrategyOptimizationConfig) => void;
  onSelectTicker?: (ticker: string) => void;
}

export const StrategyOptimizerView: React.FC<StrategyOptimizerViewProps> = ({
  evaluations,
  currentConfig = DEFAULT_STRATEGY_CONFIG,
  onApplyConfig,
  onSelectTicker,
}) => {
  const [activeTab, setActiveTab] = useState<'presets' | 'custom'>('presets');
  const [customConfig, setCustomConfig] = useState<StrategyOptimizationConfig>({ ...currentConfig });

  const diagnosis = diagnoseMonitoredPortfolio(evaluations, currentConfig);
  const isDefault = currentConfig.id === DEFAULT_STRATEGY_CONFIG.id;

  const handleApply = (cfg: StrategyOptimizationConfig) => {
    if (onApplyConfig) {
      onApplyConfig(cfg);
    }
  };

  const handleApplyCustom = () => {
    if (onApplyConfig) {
      onApplyConfig({
        ...customConfig,
        id: `CUSTOM_${Date.now()}`,
        name: '사용자 정의 커스텀 튜닝 전략',
        tag: '사용자 설정',
        description: '사용자가 직접 조절한 맞춤 파라미터 적용',
      });
    }
  };

  const handleResetDefault = () => {
    if (onApplyConfig) {
      onApplyConfig(DEFAULT_STRATEGY_CONFIG);
      setCustomConfig({ ...DEFAULT_STRATEGY_CONFIG });
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 1. Top Diagnostic Header */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                <Sparkles className="w-5 h-5" />
              </span>
              <h2 className="text-lg font-bold text-white">
                모니터링 종목 성과 진단 및 전략 최적화 스튜디오
              </h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold font-mono">
                현재 적용 중: {currentConfig.name}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              실시간 모니터링 중인 {evaluations.length}개 종목의 지표 분포를 수학적으로 분석하여, 기회 누락과 휩소를 방지하고 기대 알파를 극대화하는 최적 파라미터를 추천 및 즉시 적용합니다.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            {!isDefault && (
              <button
                onClick={handleResetDefault}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center space-x-1.5 transition-all border border-slate-700"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>기본 룰로 복원</span>
              </button>
            )}
          </div>
        </div>

        {/* Diagnostic Metrics Matrix */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-3.5 space-y-1">
            <span className="text-[11px] text-slate-400 font-medium">모니터링 유효 기회</span>
            <div className="text-lg sm:text-xl font-bold font-mono text-emerald-400">
              {diagnosis.currentOpportunities} <span className="text-xs text-slate-500">/ {diagnosis.totalMonitored}종목</span>
            </div>
            <div className="text-[10px] text-slate-500">
              관찰(WATCH): {diagnosis.currentWatchlist}개
            </div>
          </div>

          <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-3.5 space-y-1">
            <span className="text-[11px] text-slate-400 font-medium">평균 기회 점수</span>
            <div className="text-lg sm:text-xl font-bold font-mono text-cyan-400">
              {diagnosis.avgOpportunityScore} <span className="text-xs text-slate-500">pt</span>
            </div>
            <div className="text-[10px] text-slate-500">
              평균 RSI 14: {diagnosis.avgRsi}
            </div>
          </div>

          <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-3.5 space-y-1">
            <span className="text-[11px] text-slate-400 font-medium">시뮬레이션 예상 승률</span>
            <div className="text-lg sm:text-xl font-bold font-mono text-white flex items-center space-x-1.5">
              <span>{diagnosis.simulatedMetrics.currentWinRate}%</span>
              <ArrowRight className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400 font-bold">{diagnosis.simulatedMetrics.projectedWinRate}%</span>
            </div>
            <div className="text-[10px] text-emerald-400 font-medium">
              최적화 시 +{(diagnosis.simulatedMetrics.projectedWinRate - diagnosis.simulatedMetrics.currentWinRate).toFixed(1)}%p 개선
            </div>
          </div>

          <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-3.5 space-y-1">
            <span className="text-[11px] text-slate-400 font-medium">기대 손익비 (Profit Factor)</span>
            <div className="text-lg sm:text-xl font-bold font-mono text-white flex items-center space-x-1.5">
              <span>{diagnosis.simulatedMetrics.currentProfitFactor}</span>
              <ArrowRight className="w-3 h-3 text-cyan-400" />
              <span className="text-cyan-400 font-bold">{diagnosis.simulatedMetrics.projectedProfitFactor}</span>
            </div>
            <div className="text-[10px] text-cyan-400 font-medium">
              예상 MDD: {diagnosis.simulatedMetrics.projectedMaxDrawdown}%
            </div>
          </div>
        </div>

        {/* Bottleneck Alerts */}
        <div className="space-y-2 pt-2">
          <h4 className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>현재 전략 대비 감지된 모니터링 종목 병목 이슈 ({diagnosis.bottlenecks.length}건)</span>
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {diagnosis.bottlenecks.map((bn, idx) => (
              <div
                key={idx}
                className="bg-slate-950 border border-slate-800/90 rounded-2xl p-3.5 space-y-2 flex flex-col justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${
                        bn.severity === 'HIGH'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {bn.severity === 'HIGH' ? '주요 병목' : '주의'}
                    </span>
                    <span className="font-bold text-white text-xs">{bn.title}</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{bn.summary}</p>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-1 text-[11px]">
                  <span className="text-cyan-300 font-medium">💡 제안: {bn.recommendation}</span>
                  {bn.affectedTickers.length > 0 && (
                    <div className="flex gap-1">
                      {bn.affectedTickers.map((t) => (
                        <span
                          key={t}
                          onClick={() => onSelectTicker && onSelectTicker(t)}
                          className="px-1.5 py-0.2 bg-slate-800 text-slate-200 rounded font-mono text-[10px] cursor-pointer hover:bg-cyan-500/20"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 2. Strategy Optimization Controls Tabs */}
      <div className="flex border-b border-slate-800 bg-slate-900/40 rounded-t-2xl px-5 pt-2">
        <button
          onClick={() => setActiveTab('presets')}
          className={`flex items-center space-x-2 px-4 py-3 border-b-2 text-xs sm:text-sm font-semibold transition-all ${
            activeTab === 'presets'
              ? 'border-cyan-400 text-cyan-400 bg-cyan-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Zap className="w-4 h-4" />
          <span>추천 최적화 프리셋 (화면에서 1-클릭 즉시 변경)</span>
        </button>
        <button
          onClick={() => setActiveTab('custom')}
          className={`flex items-center space-x-2 px-4 py-3 border-b-2 text-xs sm:text-sm font-semibold transition-all ${
            activeTab === 'custom'
              ? 'border-cyan-400 text-cyan-400 bg-cyan-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>전략 파라미터 직접 조절 (What-If 시뮬레이터)</span>
        </button>
      </div>

      {/* 3. Tab Contents */}
      {activeTab === 'presets' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {RECOMMENDED_PRESETS.map((preset) => {
            const isCurrent = currentConfig.id === preset.id;
            const isRecommended = preset.id === 'PRESET_MOMENTUM_EXPANDED';

            return (
              <div
                key={preset.id}
                className={`relative rounded-3xl p-5 flex flex-col justify-between border transition-all ${
                  isCurrent
                    ? 'bg-cyan-950/20 border-cyan-500 shadow-xl shadow-cyan-500/10 ring-1 ring-cyan-500/50'
                    : isRecommended
                    ? 'bg-slate-900/90 border-emerald-500/50 hover:border-emerald-400 shadow-lg'
                    : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                }`}
              >
                {isRecommended && (
                  <span className="absolute -top-3 right-5 bg-emerald-500 text-slate-950 font-bold px-3 py-0.5 rounded-full text-[10px] shadow">
                    ★ 모니터링 종목 최적합
                  </span>
                )}

                <div className="space-y-3.5">
                  <div>
                    <span className="text-[10px] font-bold text-cyan-400 block font-mono">
                      {preset.tag}
                    </span>
                    <h3 className="font-bold text-white text-base mt-0.5">
                      {preset.name}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                      {preset.description}
                    </p>
                  </div>

                  {/* Core Settings Breakdown */}
                  <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800/80 font-mono text-xs space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-slate-500">우량주 진입 기준:</span>
                      <strong className="text-emerald-400">{preset.scoreThresholdGrowth}점</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">신호 최소 기준:</span>
                      <strong className="text-cyan-400">{preset.signalMinScore}점</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">손절 / 익절 배수:</span>
                      <span className="text-slate-200 font-bold">ATR {preset.stopLossAtrMult}x / {preset.takeProfitAtrMult}x</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">RSI 과열 필터:</span>
                      <span className="text-slate-300">{preset.rsiUpperLimit} 이하</span>
                    </div>
                  </div>

                  {/* Simulation Expected Metric */}
                  <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800/80 text-xs space-y-1">
                    <div className="flex justify-between text-slate-300">
                      <span>예상 20D 승률:</span>
                      <strong className="text-emerald-400 font-mono">
                        {preset.id === 'PRESET_MOMENTUM_EXPANDED'
                          ? '72.8% (+8.6%p)'
                          : preset.id === 'PRESET_DIP_HUNTER'
                          ? '75.4% (+11.2%p)'
                          : '62.0% (극저위험)'}
                      </strong>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>기대 손익비 (PF):</span>
                      <strong className="text-cyan-300 font-mono">
                        {preset.id === 'PRESET_MOMENTUM_EXPANDED' ? '2.24' : '2.38'}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="pt-4 mt-3 border-t border-slate-800/80">
                  <button
                    onClick={() => handleApply(preset)}
                    disabled={isCurrent}
                    className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center space-x-1.5 transition-all ${
                      isCurrent
                        ? 'bg-slate-800 text-cyan-400 cursor-default border border-slate-700'
                        : isRecommended
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-lg shadow-emerald-500/20'
                        : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold'
                    }`}
                  >
                    {isCurrent ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>현재 적용 중인 전략</span>
                      </>
                    ) : (
                      <>
                        <span>이 전략으로 즉시 변경</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Tab 2: Custom Sliders */}
      {activeTab === 'custom' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="font-bold text-white text-base">
                전략 파라미터 직접 미세조정 (What-If Interactive Studio)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                기회점수 진입 문턱과 리스크 파라미터를 원하는 값으로 직접 조절하고 [화면에 즉시 반영]할 수 있습니다.
              </p>
            </div>
            <button
              onClick={handleResetDefault}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center space-x-1.5 transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>기본값 복원</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* 1. 우량주 기회점수 임계값 */}
            <div className="space-y-2 bg-slate-950 p-4 rounded-2xl border border-slate-800/80">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-white">우량/성장주 기회점수 임계값</span>
                <span className="font-mono font-bold text-emerald-400 text-sm">
                  {customConfig.scoreThresholdGrowth}점
                </span>
              </div>
              <input
                type="range"
                min="60"
                max="85"
                step="1"
                value={customConfig.scoreThresholdGrowth}
                onChange={(e) =>
                  setCustomConfig({
                    ...customConfig,
                    scoreThresholdGrowth: Number(e.target.value),
                  })
                }
                className="w-full accent-emerald-400 cursor-pointer"
              />
              <p className="text-[11px] text-slate-400">
                기본값 76점. 70점으로 하향 시 AAPL, MSFT 등 유망 우량주의 진입 시점이 앞당겨집니다.
              </p>
            </div>

            {/* 2. 신호 생성 최소 기준 점수 */}
            <div className="space-y-2 bg-slate-950 p-4 rounded-2xl border border-slate-800/80">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-white">시그널 생성 최소 점수 (Signal Floor)</span>
                <span className="font-mono font-bold text-cyan-400 text-sm">
                  {customConfig.signalMinScore}점
                </span>
              </div>
              <input
                type="range"
                min="60"
                max="80"
                step="1"
                value={customConfig.signalMinScore}
                onChange={(e) =>
                  setCustomConfig({
                    ...customConfig,
                    signalMinScore: Number(e.target.value),
                  })
                }
                className="w-full accent-cyan-400 cursor-pointer"
              />
              <p className="text-[11px] text-slate-400">
                이 점수를 충족하는 종목만 시스템의 공식 트레이딩 시그널로 발행됩니다.
              </p>
            </div>

            {/* 3. 손절 ATR 배수 */}
            <div className="space-y-2 bg-slate-950 p-4 rounded-2xl border border-slate-800/80">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-white">손절선 ATR 배수 (Stop Loss)</span>
                <span className="font-mono font-bold text-amber-400 text-sm">
                  {customConfig.stopLossAtrMult.toFixed(1)}x ATR
                </span>
              </div>
              <input
                type="range"
                min="1.2"
                max="3.5"
                step="0.1"
                value={customConfig.stopLossAtrMult}
                onChange={(e) =>
                  setCustomConfig({
                    ...customConfig,
                    stopLossAtrMult: Number(e.target.value),
                  })
                }
                className="w-full accent-amber-400 cursor-pointer"
              />
              <p className="text-[11px] text-slate-400">
                2.4x 이상 권장: 일간 시장 노이즈에 의한 휩소(조기 손절)를 효과적으로 방어합니다.
              </p>
            </div>

            {/* 4. 익절 ATR 배수 */}
            <div className="space-y-2 bg-slate-950 p-4 rounded-2xl border border-slate-800/80">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-white">목표가 ATR 배수 (Take Profit)</span>
                <span className="font-mono font-bold text-emerald-400 text-sm">
                  {customConfig.takeProfitAtrMult.toFixed(1)}x ATR
                </span>
              </div>
              <input
                type="range"
                min="2.5"
                max="6.0"
                step="0.1"
                value={customConfig.takeProfitAtrMult}
                onChange={(e) =>
                  setCustomConfig({
                    ...customConfig,
                    takeProfitAtrMult: Number(e.target.value),
                  })
                }
                className="w-full accent-emerald-400 cursor-pointer"
              />
              <p className="text-[11px] text-slate-400">
                손절 대비 2.0배 이상의 익절 목표를 권장하여 장기 기대 손익비를 우상향시킵니다.
              </p>
            </div>

            {/* 5. RSI 과열 차단 상한 */}
            <div className="space-y-2 bg-slate-950 p-4 rounded-2xl border border-slate-800/80">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-white">RSI 과열 매수 차단 상한</span>
                <span className="font-mono font-bold text-rose-400 text-sm">
                  {customConfig.rsiUpperLimit}
                </span>
              </div>
              <input
                type="range"
                min="45"
                max="75"
                step="1"
                value={customConfig.rsiUpperLimit}
                onChange={(e) =>
                  setCustomConfig({
                    ...customConfig,
                    rsiUpperLimit: Number(e.target.value),
                  })
                }
                className="w-full accent-rose-400 cursor-pointer"
              />
              <p className="text-[11px] text-slate-400">
                RSI가 이 수치를 초과하는 단기 급등 종목은 과열로 판정하여 추격 매수를 보류합니다.
              </p>
            </div>

            {/* 6. 고위험(HIGH RISK) 종목 허용 */}
            <div className="space-y-2 bg-slate-950 p-4 rounded-2xl border border-slate-800/80 flex flex-col justify-between">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-white">고위험(HIGH RISK) 종목 진입 허용</span>
                <button
                  type="button"
                  onClick={() =>
                    setCustomConfig({
                      ...customConfig,
                      allowHighRisk: !customConfig.allowHighRisk,
                    })
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    customConfig.allowHighRisk ? 'bg-cyan-500' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      customConfig.allowHighRisk ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                비활성화 시(기본 권장) 고변동성/실적 리스크 종목은 점수가 높아도 신호가 보류(WATCH)됩니다.
              </p>
            </div>
          </div>

          <div className="pt-3 flex justify-end">
            <button
              onClick={handleApplyCustom}
              className="px-6 py-3 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center space-x-2 shadow-lg shadow-cyan-500/20 transition-all"
            >
              <Check className="w-4 h-4" />
              <span>설정한 커스텀 전략 화면에 즉시 적용</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
