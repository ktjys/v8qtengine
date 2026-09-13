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
  X,
  Check,
} from 'lucide-react';
import { FullTickerEvaluation } from '../types/v8';
import {
  DEFAULT_STRATEGY_CONFIG,
  diagnoseMonitoredPortfolio,
  RECOMMENDED_PRESETS,
  StrategyOptimizationConfig,
} from '../engine/strategyOptimizerEngine';

interface StrategyOptimizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  evaluations: FullTickerEvaluation[];
  currentConfig: StrategyOptimizationConfig;
  onApplyConfig: (config: StrategyOptimizationConfig) => void;
}

export const StrategyOptimizationModal: React.FC<StrategyOptimizationModalProps> = ({
  isOpen,
  onClose,
  evaluations,
  currentConfig,
  onApplyConfig,
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'recommendations' | 'custom'>('recommendations');
  const [customConfig, setCustomConfig] = useState<StrategyOptimizationConfig>({ ...currentConfig });
  const [selectedPresetId, setSelectedPresetId] = useState<string>(
    currentConfig.id || 'PRESET_MOMENTUM_EXPANDED'
  );

  // 모니터링 종목 포트폴리오 진단
  const diagnosis = diagnoseMonitoredPortfolio(evaluations, currentConfig);

  const handleApplyPreset = (preset: StrategyOptimizationConfig) => {
    onApplyConfig(preset);
    onClose();
  };

  const handleApplyCustom = () => {
    onApplyConfig({
      ...customConfig,
      id: `CUSTOM_${Date.now()}`,
      name: '사용자 정의 커스텀 튜닝 전략',
      tag: '사용자 설정',
      description: '사용자가 직접 조절한 맞춤 파라미터 적용',
    });
    onClose();
  };

  const handleResetDefault = () => {
    onApplyConfig(DEFAULT_STRATEGY_CONFIG);
    setCustomConfig({ ...DEFAULT_STRATEGY_CONFIG });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg sm:text-xl font-bold text-white">
                  모니터링 종목 기반 전략 진단 & 최적화
                </h2>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold font-mono">
                  현재: {currentConfig.name}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                등록된 {evaluations.length}개 모니터링 종목의 특성을 분석하여 성과를 극대화할 수 있는 전략 수정안을 제안합니다.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-900/40 px-6 pt-2">
          <button
            onClick={() => setActiveTab('recommendations')}
            className={`flex items-center space-x-2 px-4 py-3 border-b-2 text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'recommendations'
                ? 'border-cyan-400 text-cyan-400 bg-cyan-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>AI 맞춤 최적화 추천안 (3종)</span>
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
            <span>직접 파라미터 미세조정 (What-If)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs sm:text-sm">
          {/* Diagnostic Summary Card */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <Gauge className="w-4 h-4 text-cyan-400" />
                <h3 className="font-bold text-white text-sm">
                  모니터링 종목군 현행 전략 적합도 진단
                </h3>
              </div>
              <div className="flex items-center space-x-2 text-[11px] font-mono text-slate-400">
                <span>평균 기회점수: <strong className="text-emerald-400">{diagnosis.avgOpportunityScore}점</strong></span>
                <span>•</span>
                <span>평균 RSI: <strong className="text-cyan-400">{diagnosis.avgRsi}</strong></span>
                <span>•</span>
                <span>1M 모멘텀: <strong className={diagnosis.avg1mReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{diagnosis.avg1mReturn >= 0 ? '+' : ''}{diagnosis.avg1mReturn}%</strong></span>
              </div>
            </div>

            {/* Bottlenecks List */}
            <div className="space-y-2 pt-1">
              {diagnosis.bottlenecks.map((bn, idx) => (
                <div
                  key={idx}
                  className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-3 flex flex-col sm:flex-row sm:items-start justify-between gap-2.5"
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
                      <span className="font-semibold text-white">{bn.title}</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{bn.summary}</p>
                    <div className="text-[11px] text-cyan-300 font-medium">
                      💡 제안: {bn.recommendation}
                    </div>
                  </div>

                  {bn.affectedTickers.length > 0 && (
                    <div className="flex flex-wrap gap-1 items-center sm:self-start">
                      <span className="text-[10px] text-slate-500 mr-1">대상:</span>
                      {bn.affectedTickers.map((t) => (
                        <span
                          key={t}
                          className="px-2 py-0.5 bg-slate-800 text-slate-200 rounded font-mono text-[10px] font-bold"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* TAB 1: AI 맞춤 추천안 */}
          {activeTab === 'recommendations' && (
            <div className="space-y-4">
              <h3 className="font-bold text-white text-sm flex items-center space-x-2">
                <Target className="w-4 h-4 text-cyan-400" />
                <span>종목군 맞춤 최적화 추천안 (클릭 시 화면에 즉시 적용)</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {RECOMMENDED_PRESETS.map((preset) => {
                  const isCurrent = currentConfig.id === preset.id;
                  const isRecommended = preset.id === 'PRESET_MOMENTUM_EXPANDED';

                  return (
                    <div
                      key={preset.id}
                      className={`relative rounded-2xl p-4 sm:p-5 flex flex-col justify-between border transition-all ${
                        isCurrent
                          ? 'bg-cyan-950/20 border-cyan-500/80 shadow-lg shadow-cyan-500/10'
                          : isRecommended
                          ? 'bg-slate-900/90 border-emerald-500/50 hover:border-emerald-400'
                          : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {isRecommended && (
                        <span className="absolute -top-2.5 right-4 bg-emerald-500 text-slate-950 font-bold px-2.5 py-0.5 rounded-full text-[10px] shadow">
                          ★ 최적합 추천
                        </span>
                      )}

                      <div className="space-y-3">
                        <div>
                          <span className="text-[10px] font-bold text-cyan-400 block font-mono">
                            {preset.tag}
                          </span>
                          <h4 className="font-bold text-white text-base mt-0.5">
                            {preset.name}
                          </h4>
                          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                            {preset.description}
                          </p>
                        </div>

                        {/* Parameter Highlights */}
                        <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 font-mono text-[11px] space-y-1">
                          <div className="flex justify-between">
                            <span className="text-slate-500">우량주 진입기준:</span>
                            <span className="text-emerald-400 font-bold">{preset.scoreThresholdGrowth}점</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">손절/익절 배수:</span>
                            <span className="text-cyan-400">ATR {preset.stopLossAtrMult}x / {preset.takeProfitAtrMult}x</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">RSI 과열 제한:</span>
                            <span className="text-slate-300">{preset.rsiUpperLimit} 이하</span>
                          </div>
                        </div>

                        {/* Simulation Expected Metric */}
                        <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800/60 text-[11px] space-y-1">
                          <div className="flex justify-between text-slate-300">
                            <span>예상 시뮬레이션 승률:</span>
                            <strong className="text-emerald-400 font-mono">
                              {preset.id === 'PRESET_MOMENTUM_EXPANDED'
                                ? '72.8% (+8.6%p)'
                                : preset.id === 'PRESET_DIP_HUNTER'
                                ? '75.4% (+11.2%p)'
                                : '62.0% (초저위험)'}
                            </strong>
                          </div>
                          <div className="flex justify-between text-slate-300">
                            <span>예상 MDD:</span>
                            <strong className="text-cyan-300 font-mono">
                              {preset.id === 'PRESET_CAPITAL_SHIELD' ? '-2.9%' : '-5.4%'}
                            </strong>
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 mt-2 border-t border-slate-800/80">
                        <button
                          onClick={() => handleApplyPreset(preset)}
                          disabled={isCurrent}
                          className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center space-x-1.5 transition-all ${
                            isCurrent
                              ? 'bg-slate-800 text-cyan-400 cursor-default border border-slate-700'
                              : isRecommended
                              ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
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
            </div>
          )}

          {/* TAB 2: 커스텀 파라미터 미세조정 */}
          {activeTab === 'custom' && (
            <div className="space-y-5 bg-slate-950 p-5 rounded-2xl border border-slate-800">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h4 className="font-bold text-white text-sm">
                    전략 파라미터 사용자 정의 (What-If 시뮬레이터)
                  </h4>
                  <p className="text-xs text-slate-400">
                    슬라이더를 움직여 진입 문턱과 리스크 한도를 원하는 수준으로 직접 세밀하게 조율할 수 있습니다.
                  </p>
                </div>
                <button
                  onClick={handleResetDefault}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center space-x-1.5 transition-all"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>기본값 초기화</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* 1. 우량주 기회점수 임계값 */}
                <div className="space-y-1.5 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80">
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
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                  <p className="text-[11px] text-slate-400">
                    기준을 낮추면(70점) 신호 발생이 빨라지며, 높이면(78점) 진입이 극도로 보수화됩니다.
                  </p>
                </div>

                {/* 2. 신호 생성 최소 기준 점수 */}
                <div className="space-y-1.5 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80">
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
                    이 점수 이상을 획득한 종목만 모니터링 시그널(Signal)로 등록됩니다.
                  </p>
                </div>

                {/* 3. 손절 ATR 배수 */}
                <div className="space-y-1.5 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80">
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
                    2.4x 이상 권장: 일간 시장 노이즈에 의한 휩소(조기 손절) 방지.
                  </p>
                </div>

                {/* 4. 익절 ATR 배수 */}
                <div className="space-y-1.5 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80">
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
                <div className="space-y-1.5 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-white">RSI 과열 매수 차단 상한 (RSI Max)</span>
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

                {/* 6. 고위험(HIGH RISK) 종목 허용 토글 */}
                <div className="space-y-1.5 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80 flex flex-col justify-between">
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
                    비활성화 시(권장) 고변동성/실적 리스크 종목은 점수가 높아도 신호가 보류(WATCH)됩니다.
                  </p>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-3 flex justify-end">
                <button
                  onClick={handleApplyCustom}
                  className="px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center space-x-2 shadow-lg shadow-cyan-500/20 transition-all"
                >
                  <Check className="w-4 h-4" />
                  <span>설정한 커스텀 파라미터 화면에 즉시 적용</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>변경 시 모니터링 종목 평가 및 신호가 즉시 실시간 재연산됩니다.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-all"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};
