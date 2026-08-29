import React, { useState, useMemo } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  BarChart2,
  Check,
  CheckCircle2,
  Copy,
  Edit3,
  ExternalLink,
  Layers,
  LineChart,
  Percent,
  RotateCcw,
  Save,
  Scale,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import {
  AssetClassification,
  AssetType,
  FullTickerEvaluation,
  SignalSnapshot,
  StrategyType,
} from '../types/v8';
import { formatStockPrice, formatChangePercent } from '../utils/formatters';
import { buildSignalTelegramMessage } from '../notification/templates';
import { SymbolDailyScoreChart } from './SymbolDailyScoreChart';

interface SymbolDetailModalProps {
  evaluation: FullTickerEvaluation | null;
  historicalSignals: SignalSnapshot[];
  initialTab?: 'overview' | 'chart' | 'opportunity' | 'risk' | 'decision' | 'override' | 'signals';
  onClose: () => void;
  onSaveOverride: (
    ticker: string,
    asset_type: AssetType,
    strategy_type: StrategyType,
    confidence: number,
    reason: string
  ) => void;
  onResetOverride: (ticker: string) => void;
}

export const SymbolDetailModal: React.FC<SymbolDetailModalProps> = ({
  evaluation,
  historicalSignals,
  initialTab = 'overview',
  onClose,
  onSaveOverride,
  onResetOverride,
}) => {
  if (!evaluation) return null;

  const [activeTab, setActiveTab] = useState<'overview' | 'chart' | 'opportunity' | 'risk' | 'decision' | 'override' | 'signals'>(initialTab);
  const [copiedTelegram, setCopiedTelegram] = useState(false);

  // Manual Override Form State
  const [editAssetType, setEditAssetType] = useState<AssetType>(evaluation.classification.asset_type);
  const [editStrategy, setEditStrategy] = useState<StrategyType>(evaluation.classification.strategy_type);
  const [editConfidence, setEditConfidence] = useState<number>(evaluation.classification.confidence);
  const [editReason, setEditReason] = useState<string>(evaluation.classification.reason);

  const tickerSignals = useMemo(() => {
    const raw = (historicalSignals || []).filter((s) => s.ticker === evaluation.ticker);
    const map = new Map<string, SignalSnapshot>();
    for (const sig of raw) {
      const dateKey = sig.signal_date;
      if (!map.has(dateKey)) {
        map.set(dateKey, sig);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.signal_date.localeCompare(a.signal_date));
  }, [historicalSignals, evaluation.ticker]);
  const telegramMessage = buildSignalTelegramMessage({
    id: `temp-${evaluation.ticker}`,
    signal_date: evaluation.evaluated_at.split('T')[0],
    ticker: evaluation.ticker,
    name: evaluation.name,
    signal_price: evaluation.price,
    strategy_type: evaluation.classification.strategy_type,
    asset_type: evaluation.classification.asset_type,
    opportunity_score: evaluation.opportunity.opportunity_score,
    risk_level: evaluation.risk.risk_level,
    risk_score: evaluation.risk.risk_score,
    decision: evaluation.decision.decision,
    signal_confidence: evaluation.decision.confidence,
    classification_confidence: evaluation.classification.confidence,
    position_size_pct: evaluation.decision.position_size_pct,
    technical_score: evaluation.opportunity.sub_scores.technical_score,
    momentum_score: evaluation.opportunity.sub_scores.momentum_score,
    fundamental_score: evaluation.opportunity.sub_scores.fundamental_score,
    valuation_score: evaluation.opportunity.sub_scores.valuation_score,
    rsi: evaluation.opportunity.technical_details.rsi14,
    drawdown: evaluation.opportunity.technical_details.drawdownFromHigh,
    return_5d: null,
    return_10d: null,
    return_20d: null,
    current_return: 0,
    is_closed: false,
    components: {
      weights: evaluation.opportunity.weights_used,
      risk_reasons: evaluation.risk.risk_reasons,
      decision_reason: evaluation.decision.reason,
    },
  });

  const handleCopyTelegram = () => {
    navigator.clipboard.writeText(telegramMessage);
    setCopiedTelegram(true);
    setTimeout(() => setCopiedTelegram(false), 2000);
  };

  const handleSaveClassification = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveOverride(evaluation.ticker, editAssetType, editStrategy, editConfidence, editReason);
    setActiveTab('overview');
  };

  const opp = evaluation.opportunity;
  const risk = evaluation.risk;
  const decision = evaluation.decision;
  const classification = evaluation.classification;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-2.5 sm:p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl w-full max-w-4xl max-h-[90dvh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="p-3.5 sm:p-5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5 sm:space-x-3.5 min-w-0">
            <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center font-mono font-bold text-white text-sm sm:text-lg shadow-lg shadow-cyan-500/20 shrink-0">
              {evaluation.ticker}
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-1.5 sm:space-x-2 flex-wrap">
                <h3 className="text-base sm:text-xl font-bold text-slate-100 truncate">{evaluation.name}</h3>
                <span className="text-[11px] sm:text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono font-semibold">
                  {formatStockPrice(evaluation.price, evaluation.ticker)}
                </span>
                <span
                  className={`text-[11px] sm:text-xs font-semibold ${
                    evaluation.change1d >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {formatChangePercent(evaluation.change1d)}
                </span>
              </div>
              <div className="flex items-center space-x-1.5 sm:space-x-2 text-[10px] sm:text-xs text-slate-400 mt-0.5 sm:mt-1 truncate">
                <span className="uppercase px-1.5 py-0.5 rounded bg-slate-800/80 font-mono text-[9px] sm:text-[10px]">
                  {classification.asset_type}
                </span>
                <span>•</span>
                <span className="text-cyan-400 font-medium">{classification.strategy_type}</span>
                <span className="hidden sm:inline">•</span>
                <span className="hidden sm:inline">
                  분류: {classification.classification_source === 'manual' ? '수동(Manual)' : '자동(Auto)'}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors shrink-0 ml-2"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Diagnostic Tabs */}
        <div className="flex overflow-x-auto whitespace-nowrap border-b border-slate-800 px-3 sm:px-5 bg-slate-950/40 text-xs font-medium space-x-1 shrink-0 no-scrollbar">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-2.5 px-2.5 sm:py-3 sm:px-3.5 border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-cyan-400 text-cyan-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            종합 진단
          </button>
          <button
            onClick={() => setActiveTab('chart')}
            className={`py-2.5 px-2.5 sm:py-3 sm:px-3.5 border-b-2 transition-all whitespace-nowrap flex items-center space-x-1.5 ${
              activeTab === 'chart'
                ? 'border-cyan-400 text-cyan-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <LineChart className="w-3.5 h-3.5 text-cyan-400" />
            <span>차트 분석</span>
          </button>
          <button
            onClick={() => setActiveTab('opportunity')}
            className={`py-2.5 px-2.5 sm:py-3 sm:px-3.5 border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'opportunity'
                ? 'border-cyan-400 text-cyan-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            기회 스코어 ({opp.opportunity_score}점)
          </button>
          <button
            onClick={() => setActiveTab('risk')}
            className={`py-2.5 px-2.5 sm:py-3 sm:px-3.5 border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'risk'
                ? 'border-cyan-400 text-cyan-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            리스크 제약 ({risk.risk_level})
          </button>
          <button
            onClick={() => setActiveTab('decision')}
            className={`py-2.5 px-2.5 sm:py-3 sm:px-3.5 border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'decision'
                ? 'border-cyan-400 text-cyan-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            의사결정 ({decision.decision})
          </button>
          <button
            onClick={() => setActiveTab('signals')}
            className={`py-2.5 px-2.5 sm:py-3 sm:px-3.5 border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'signals'
                ? 'border-cyan-400 text-cyan-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            과거 시그널 ({tickerSignals.length}건)
          </button>
          <button
            onClick={() => setActiveTab('override')}
            className={`py-2.5 px-2.5 sm:py-3 sm:px-3.5 border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'override'
                ? 'border-cyan-400 text-cyan-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            수동 Override
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-3.5 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6 flex-1 text-slate-200">
          {/* TAB: DAILY SCORE & INDICATORS CHART */}
          {activeTab === 'chart' && (
            <div className="space-y-6 animate-fadeIn">
              <SymbolDailyScoreChart ticker={evaluation.ticker} />
            </div>
          )}

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-fadeIn">
              {/* Top Decision Hero */}
              <div
                className={`p-5 rounded-2xl border ${
                  decision.decision === 'STRONG_OPPORTUNITY'
                    ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-100'
                    : decision.decision === 'OPPORTUNITY'
                    ? 'bg-cyan-950/30 border-cyan-500/40 text-cyan-100'
                    : decision.decision === 'WATCH'
                    ? 'bg-amber-950/30 border-amber-500/40 text-amber-100'
                    : 'bg-slate-950 border-slate-800 text-slate-300'
                }`}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      최종 의사결정 행동 권고
                    </div>
                    <div className="text-xl font-bold mt-0.5 flex items-center space-x-2 font-mono">
                      <span>🎯 {decision.decision}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <div className="px-3 py-1 rounded-xl bg-slate-900/80 border border-slate-700 text-xs font-mono text-center">
                      <div className="text-[10px] text-slate-400">기회 점수</div>
                      <div className="text-sm font-bold text-cyan-400">{opp.opportunity_score}점</div>
                    </div>
                    <div className="px-3 py-1 rounded-xl bg-slate-900/80 border border-slate-700 text-xs font-mono text-center">
                      <div className="text-[10px] text-slate-400">리스크</div>
                      <div
                        className={`text-sm font-bold ${
                          risk.risk_level === 'LOW'
                            ? 'text-emerald-400'
                            : risk.risk_level === 'MEDIUM'
                            ? 'text-amber-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {risk.risk_level} ({risk.risk_score}pt)
                      </div>
                    </div>
                    <div className="px-3 py-1 rounded-xl bg-slate-900/80 border border-slate-700 text-xs font-mono text-center">
                      <div className="text-[10px] text-slate-400">판단 확신도</div>
                      <div className="text-sm font-bold text-purple-400">
                        {(decision.confidence * 100).toFixed(0)}%
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-xs text-slate-300 bg-slate-900/60 p-3 rounded-xl border border-slate-800/80 leading-relaxed">
                  💡 <strong>판단 근거:</strong> "{decision.reason}"
                </div>
              </div>

              {/* Quick Chart Jump Banner */}
              <div
                onClick={() => setActiveTab('chart')}
                className="cursor-pointer group p-4 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950/40 border border-slate-800 hover:border-cyan-500/50 transition-all flex items-center justify-between"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <LineChart className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-100 group-hover:text-cyan-300 transition-colors flex items-center space-x-2">
                      <span>{evaluation.ticker} 일별 점수 변동 & 가격·RSI 지표 차트</span>
                      <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-mono">
                        NEW
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      과거 1년/6개월간 기회 점수 추이, 이동평균선 배열(MA20/50/200), RSI 오실레이터를 한눈에 확인하세요
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-1 text-xs font-semibold text-cyan-400 group-hover:translate-x-1 transition-transform">
                  <span>차트 열기</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>

              {/* 4 Score Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5">
                  <div className="text-[11px] text-slate-400 font-medium">기술적 상태 (Tech)</div>
                  <div className="text-xl font-bold text-blue-400 font-mono mt-1">
                    {opp.sub_scores.technical_score}pt
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    RSI {opp.technical_details.rsi14.toFixed(1)} / 고점대비 {opp.technical_details.drawdownFromHigh}%
                  </div>
                </div>

                <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5">
                  <div className="text-[11px] text-slate-400 font-medium">가격 모멘텀 (Mom)</div>
                  <div className="text-xl font-bold text-cyan-400 font-mono mt-1">
                    {opp.sub_scores.momentum_score}pt
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    1M: +{opp.momentum_details.return1M}% / RS: {opp.momentum_details.relativeStrengthVsSpy}x
                  </div>
                </div>

                <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5">
                  <div className="text-[11px] text-slate-400 font-medium">펀더멘털 (Fund)</div>
                  <div className="text-xl font-bold text-emerald-400 font-mono mt-1">
                    {opp.sub_scores.fundamental_score !== null ? `${opp.sub_scores.fundamental_score}pt` : 'N/A (ETF)'}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    {opp.fundamental_details.revenueGrowthYoy !== null
                      ? `매출성장 +${opp.fundamental_details.revenueGrowthYoy}%`
                      : 'ETF로 자동 제외'}
                  </div>
                </div>

                <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5">
                  <div className="text-[11px] text-slate-400 font-medium">밸류에이션 (Val)</div>
                  <div className="text-xl font-bold text-amber-400 font-mono mt-1">
                    {opp.sub_scores.valuation_score ?? 50}pt
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    {opp.valuation_details.peForward ? `Fwd P/E ${opp.valuation_details.peForward}` : '적정 평가'}
                  </div>
                </div>
              </div>

              {/* Telegram Preview Box */}
              <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-xs font-semibold text-cyan-400">
                    <Send className="w-4 h-4" />
                    <span>실제 텔레그램 알림 발행 서식 (Section 12 규격)</span>
                  </div>
                  <button
                    onClick={handleCopyTelegram}
                    className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition-colors"
                  >
                    {copiedTelegram ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedTelegram ? '복사 완료' : '서식 복사'}</span>
                  </button>
                </div>
                <pre className="text-[11px] font-mono text-slate-300 bg-slate-900 p-3 rounded-xl border border-slate-800/80 overflow-x-auto whitespace-pre-wrap">
                  {telegramMessage}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 2: OPPORTUNITY ENGINE DEEP DIVE */}
          {activeTab === 'opportunity' && (
            <div className="space-y-6 animate-fadeIn text-xs">
              <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800">
                <h4 className="font-bold text-sm text-slate-100 mb-2 flex items-center space-x-2">
                  <Scale className="w-4 h-4 text-cyan-400" />
                  <span>전략별 가중치 프로파일 (Weight Profile Used)</span>
                </h4>
                <div className="grid grid-cols-4 gap-2 text-center font-mono">
                  <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                    <div className="text-slate-400 text-[10px]">Technical</div>
                    <div className="text-sm font-bold text-blue-400">
                      {(opp.weights_used.technical * 100).toFixed(0)}%
                    </div>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                    <div className="text-slate-400 text-[10px]">Momentum</div>
                    <div className="text-sm font-bold text-cyan-400">
                      {(opp.weights_used.momentum * 100).toFixed(0)}%
                    </div>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                    <div className="text-slate-400 text-[10px]">Fundamental</div>
                    <div className="text-sm font-bold text-emerald-400">
                      {(opp.weights_used.fundamental * 100).toFixed(0)}%
                    </div>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                    <div className="text-slate-400 text-[10px]">Valuation</div>
                    <div className="text-sm font-bold text-amber-400">
                      {(opp.weights_used.valuation * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Detailed Metrics Table */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono">
                {/* Technical Metrics */}
                <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 space-y-2">
                  <div className="font-bold font-sans text-slate-200 pb-2 border-b border-slate-800 flex justify-between">
                    <span>1. 기술적 지표 (Technical)</span>
                    <span className="text-blue-400">{opp.sub_scores.technical_score}점</span>
                  </div>
                  <div className="flex justify-between py-1 text-slate-300">
                    <span>이동평균 추세 (Trend)</span>
                    <span className="font-bold text-cyan-400">{opp.technical_details.maTrend}</span>
                  </div>
                  <div className="flex justify-between py-1 text-slate-300">
                    <span>RSI (14일)</span>
                    <span>{opp.technical_details.rsi14.toFixed(1)} (점수: {opp.technical_details.rsiScore}pt)</span>
                  </div>
                  <div className="flex justify-between py-1 text-slate-300">
                    <span>고점 대비 낙폭 (Drawdown)</span>
                    <span>{opp.technical_details.drawdownFromHigh}%</span>
                  </div>
                  <div className="flex justify-between py-1 text-slate-300">
                    <span>MA 20일선 위 (Price &gt; MA20)</span>
                    <span className={opp.technical_details.priceAboveMa20 ? 'text-emerald-400' : 'text-rose-400'}>
                      {opp.technical_details.priceAboveMa20 ? 'YES' : 'NO'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 text-slate-300">
                    <span>MACD 히스토그램 양수</span>
                    <span className={opp.technical_details.macdHistogramPositive ? 'text-emerald-400' : 'text-slate-400'}>
                      {opp.technical_details.macdHistogramPositive ? 'YES (+)' : 'NO (-)'}
                    </span>
                  </div>
                </div>

                {/* Momentum Metrics */}
                <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 space-y-2">
                  <div className="font-bold font-sans text-slate-200 pb-2 border-b border-slate-800 flex justify-between">
                    <span>2. 가격 모멘텀 (Momentum)</span>
                    <span className="text-cyan-400">{opp.sub_scores.momentum_score}점</span>
                  </div>
                  <div className="flex justify-between py-1 text-slate-300">
                    <span>1개월 수익률 (1M)</span>
                    <span className="text-emerald-400">+{opp.momentum_details.return1M}%</span>
                  </div>
                  <div className="flex justify-between py-1 text-slate-300">
                    <span>3개월 수익률 (3M)</span>
                    <span className="text-emerald-400">+{opp.momentum_details.return3M}%</span>
                  </div>
                  <div className="flex justify-between py-1 text-slate-300">
                    <span>6개월 수익률 (6M)</span>
                    <span className="text-emerald-400">+{opp.momentum_details.return6M}%</span>
                  </div>
                  <div className="flex justify-between py-1 text-slate-300">
                    <span>SPY 대비 상대강도 (RS)</span>
                    <span className="font-bold text-cyan-400">{opp.momentum_details.relativeStrengthVsSpy}x</span>
                  </div>
                </div>

                {/* Fundamental Metrics */}
                <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 space-y-2">
                  <div className="font-bold font-sans text-slate-200 pb-2 border-b border-slate-800 flex justify-between">
                    <span>3. 펀더멘털 (Fundamental)</span>
                    <span className="text-emerald-400">
                      {opp.sub_scores.fundamental_score !== null ? `${opp.sub_scores.fundamental_score}점` : 'N/A'}
                    </span>
                  </div>
                  {opp.fundamental_details.isEtf ? (
                    <div className="text-slate-400 text-xs py-4 text-center font-sans">
                      ETF 자산으로 개별 기업 재무제표 평가를 강제하지 않습니다 (가중치 0% 재정규화).
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between py-1 text-slate-300">
                        <span>매출액 성장률 YoY</span>
                        <span className="text-emerald-400">+{opp.fundamental_details.revenueGrowthYoy}%</span>
                      </div>
                      <div className="flex justify-between py-1 text-slate-300">
                        <span>영업이익 성장률 YoY</span>
                        <span className="text-emerald-400">+{opp.fundamental_details.earningsGrowthYoy}%</span>
                      </div>
                      <div className="flex justify-between py-1 text-slate-300">
                        <span>영업이익률 (Operating Margin)</span>
                        <span>{opp.fundamental_details.operatingMargin}%</span>
                      </div>
                      <div className="flex justify-between py-1 text-slate-300">
                        <span>잉여현금흐름률 (FCF Margin)</span>
                        <span>{opp.fundamental_details.freeCashFlowMargin}%</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Valuation Metrics */}
                <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 space-y-2">
                  <div className="font-bold font-sans text-slate-200 pb-2 border-b border-slate-800 flex justify-between">
                    <span>4. 밸류에이션 (Valuation)</span>
                    <span className="text-amber-400">{opp.sub_scores.valuation_score ?? 50}점</span>
                  </div>
                  <div className="flex justify-between py-1 text-slate-300">
                    <span>Trailing P/E</span>
                    <span>{opp.valuation_details.peTrailing ?? '-'}</span>
                  </div>
                  <div className="flex justify-between py-1 text-slate-300">
                    <span>Forward P/E</span>
                    <span>{opp.valuation_details.peForward ?? '-'}</span>
                  </div>
                  <div className="flex justify-between py-1 text-slate-300">
                    <span>PEG Ratio</span>
                    <span>{opp.valuation_details.pegRatio ?? '-'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: INDEPENDENT RISK ENGINE */}
          {activeTab === 'risk' && (
            <div className="space-y-5 animate-fadeIn text-xs">
              <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-slate-100 flex items-center space-x-2">
                    <Shield className="w-4 h-4 text-cyan-400" />
                    <span>독립 리스크 엔진 제약조건 분석</span>
                  </h4>
                  <p className="text-slate-400 text-xs mt-0.5">
                    기회 점수와 별도로 평가되며, 높은 기회라도 위험이 지나치면 최종 신호를 보류합니다.
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={`px-3 py-1 rounded-xl text-sm font-bold font-mono ${
                      risk.risk_level === 'LOW'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : risk.risk_level === 'MEDIUM'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}
                  >
                    LEVEL: {risk.risk_level} ({risk.risk_score}pt)
                  </span>
                </div>
              </div>

              {/* Risk Components Breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
                <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
                  <div className="text-slate-400 text-[11px]">시장 베타 (Beta)</div>
                  <div className="text-lg font-bold text-slate-100 mt-1">{risk.components.beta.toFixed(2)}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {risk.components.beta > 1.8 ? '초고변동성 위험' : '기준치 이내'}
                  </div>
                </div>

                <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
                  <div className="text-slate-400 text-[11px]">20일 연환산 변동성</div>
                  <div className="text-lg font-bold text-slate-100 mt-1">
                    {risk.components.volatility20dAnnualized}%
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">단기 가격 흔들림</div>
                </div>

                <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
                  <div className="text-slate-400 text-[11px]">52주 최대 낙폭 (MDD)</div>
                  <div className="text-lg font-bold text-slate-100 mt-1">{risk.components.maxDrawdown52w}%</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">구간 최대 하락폭</div>
                </div>

                <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
                  <div className="text-slate-400 text-[11px]">자산 전략 위험 가산</div>
                  <div className="text-lg font-bold text-slate-100 mt-1">
                    {risk.components.isSpeculative ? '적용 (+20)' : '없음 (0)'}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {risk.components.isSpeculative ? 'Speculative 자산' : '우량/지수 자산'}
                  </div>
                </div>
              </div>

              {/* Risk Reasons List */}
              <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800">
                <h5 className="font-semibold text-slate-200 mb-2">상세 위험 요인 (Risk Reasons)</h5>
                <ul className="space-y-1.5 text-slate-300">
                  {risk.risk_reasons.map((r, i) => (
                    <li key={i} className="flex items-start space-x-2">
                      <span className="text-amber-400 mt-0.5">•</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* TAB 4: DECISION ENGINE MATRIX */}
          {activeTab === 'decision' && (
            <div className="space-y-5 animate-fadeIn text-xs">
              <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800">
                <h4 className="font-bold text-sm text-slate-100 mb-1">
                  V8 의사결정 매트릭스 도출 과정 (Decision Traceability)
                </h4>
                <p className="text-slate-400 text-xs">
                  자산 정체성 + 기회 점수 + 독립 리스크 + 신뢰도를 융합하여 최종 행동 권고를 결정합니다.
                </p>
              </div>

              <div className="space-y-3 font-mono">
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-400">1. 대상 자산 전략 (Strategy)</span>
                  <span className="font-bold text-cyan-400">{classification.strategy_type}</span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-400">2. 종합 기회 점수 (Opportunity)</span>
                  <span className="font-bold text-cyan-400">{opp.opportunity_score} / 100</span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-400">3. 독립 리스크 제약 (Risk Level)</span>
                  <span
                    className={`font-bold ${
                      risk.risk_level === 'LOW'
                        ? 'text-emerald-400'
                        : risk.risk_level === 'MEDIUM'
                        ? 'text-amber-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {risk.risk_level} (점수: {risk.risk_score})
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-400">4. 행동 실행 가능 여부 (Actionable)</span>
                  <span className={decision.actionable ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                    {decision.actionable ? '진입 시그널 발행 대상' : '진입 보류 (관찰/중립)'}
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 font-sans leading-relaxed">
                  <strong>최종 행동 판정:</strong> {decision.decision}
                  <div className="mt-1 text-slate-400 text-xs">"{decision.reason}"</div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: HISTORICAL SIGNALS & RETURNS */}
          {activeTab === 'signals' && (
            <div className="space-y-4 animate-fadeIn text-xs">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-slate-100">과거 발생 시그널 스냅샷 원장</h4>
                <span className="text-slate-400 font-mono">총 {tickerSignals.length}건</span>
              </div>

              {tickerSignals.length === 0 ? (
                <div className="bg-slate-950/70 p-8 rounded-2xl border border-slate-800 text-center text-slate-500">
                  해당 종목에 대한 과거 확정 시그널 기록이 없습니다.
                </div>
              ) : (
                <div className="space-y-3">
                  {tickerSignals.map((sig) => (
                    <div key={sig.id} className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between font-mono">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-100">{sig.signal_date}</span>
                          <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[10px]">
                            {sig.strategy_type}
                          </span>
                          <span className="text-slate-400">${sig.signal_price.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className="text-slate-400">
                            5D:{' '}
                            <strong className={sig.return_5d && sig.return_5d >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                              {sig.return_5d ? `${sig.return_5d}%` : '-'}
                            </strong>
                          </span>
                          <span className="text-slate-400">
                            10D:{' '}
                            <strong className={sig.return_10d && sig.return_10d >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                              {sig.return_10d ? `${sig.return_10d}%` : '-'}
                            </strong>
                          </span>
                          <span className="text-slate-400">
                            20D:{' '}
                            <strong className={sig.return_20d && sig.return_20d >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                              {sig.return_20d ? `${sig.return_20d}%` : '-'}
                            </strong>
                          </span>
                        </div>
                      </div>
                      <p className="text-slate-400 text-[11px]">{sig.components.decision_reason}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 6: MANUAL OVERRIDE */}
          {activeTab === 'override' && (
            <form onSubmit={handleSaveClassification} className="space-y-4 animate-fadeIn text-xs">
              <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800">
                <h4 className="font-bold text-sm text-slate-100 flex items-center space-x-2">
                  <Edit3 className="w-4 h-4 text-purple-400" />
                  <span>자산 분류 수동 지정 (Manual Override - Section 13.4)</span>
                </h4>
                <p className="text-slate-400 text-xs mt-0.5">
                  수동 지정된 분류는 자동 스캐너가 덮어쓰지 않으며 영구 보존됩니다.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">자산 대분류 (Asset Type)</label>
                  <select
                    value={editAssetType}
                    onChange={(e) => setEditAssetType(e.target.value as AssetType)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="etf">ETF</option>
                    <option value="equity">개별주 (Equity)</option>
                    <option value="other">기타 자산</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">세부 전략 유형 (Strategy Type)</label>
                  <select
                    value={editStrategy}
                    onChange={(e) => setEditStrategy(e.target.value as StrategyType)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="broad_market_etf">Broad Market ETF (광범위 지수)</option>
                    <option value="growth_etf">Growth ETF (성장형 지수)</option>
                    <option value="dividend_etf">Dividend ETF (배당/방어 지수)</option>
                    <option value="sector_etf">Sector ETF (섹터 집중 지수)</option>
                    <option value="income_etf">Income ETF (월배당/커버드콜)</option>
                    <option value="quality">Quality (우량 최고품질주)</option>
                    <option value="established_growth">Established Growth (대형성장주)</option>
                    <option value="speculative">Speculative (투기/고변동성주)</option>
                    <option value="general_equity">General Equity (일반 보통주)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  분류 신뢰도 확신 (Confidence: {(editConfidence * 100).toFixed(0)}%)
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="1.0"
                  step="0.05"
                  value={editConfidence}
                  onChange={(e) => setEditConfidence(parseFloat(e.target.value))}
                  className="w-full accent-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">수동 지정 사유 (Reason)</label>
                <input
                  type="text"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="pt-3 flex items-center justify-between border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    onResetOverride(evaluation.ticker);
                    setActiveTab('overview');
                  }}
                  className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>자동 분류로 초기화</span>
                </button>

                <button
                  type="submit"
                  className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold shadow-md shadow-purple-600/30 transition-all active:scale-95"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>수동 Override 저장</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
