import React, { useEffect, useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';
import {
  Activity,
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Eye,
  Info,
  Layers,
  Maximize2,
  RefreshCw,
  Sliders,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { DailyScorePoint, SymbolScoreHistoryResult, SymbolScoreHistorySummary } from '../types/v8';
import { formatStockPrice, formatChangePercent } from '../utils/formatters';
import { dailyScoreHistoryService } from '../pipeline/dailyScoreHistoryService';

interface SymbolDailyScoreChartProps {
  ticker: string;
  initialRange?: string;
  onSelectDate?: (point: DailyScorePoint) => void;
}

export const SymbolDailyScoreChart: React.FC<SymbolDailyScoreChartProps> = ({
  ticker,
  initialRange = '6m',
  onSelectDate,
}) => {
  const [range, setRange] = useState<string>(initialRange);
  const [data, setData] = useState<SymbolScoreHistoryResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [pinnedPoint, setPinnedPoint] = useState<DailyScorePoint | null>(null);

  // Visibility Toggles
  const [showOpportunity, setShowOpportunity] = useState(true);
  const [showTechScore, setShowTechScore] = useState(true);
  const [showMomScore, setShowMomScore] = useState(true);
  const [showRiskScore, setShowRiskScore] = useState(true);
  const [showMA20, setShowMA20] = useState(true);
  const [showMA50, setShowMA50] = useState(true);
  const [showMA200, setShowMA200] = useState(true);
  const [showRsiPanel, setShowRsiPanel] = useState(true);
  const [showMacdPanel, setShowMacdPanel] = useState(false);
  const [showDrawdownPanel, setShowDrawdownPanel] = useState(false);

  const fetchHistory = async (selectedRange: string) => {
    setLoading(true);
    setError(null);
    try {
      let historyData: SymbolScoreHistoryResult | null = null;

      // 1. Try API endpoint first
      try {
        const res = await fetch(`/api/v8/evaluations/history/${ticker}?range=${selectedRange}`);
        if (res.ok) {
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const json = await res.json();
            if (json.success && json.data) {
              historyData = json.data;
            }
          }
        }
      } catch (apiErr) {
        console.warn('[SymbolDailyScoreChart] API fetch notice, switching to client calculator:', apiErr);
      }

      // 2. Client-side generator fallback if API was unavailable (e.g. edge worker static route)
      if (!historyData) {
        historyData = await dailyScoreHistoryService.getDailyScoreHistory(ticker, selectedRange);
      }

      if (historyData) {
        setData(historyData);
        if (historyData.history?.length > 0) {
          setPinnedPoint(historyData.history[historyData.history.length - 1]);
        }
      } else {
        setError('일별 점수 및 기술적 지표 데이터를 불러올 수 없습니다.');
      }
    } catch (err: any) {
      console.error('[SymbolDailyScoreChart] Critical chart history error:', err);
      setError(err.message || '네트워크 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory(range);
  }, [ticker, range]);

  const summary = data?.summary;
  const history = data?.history || [];

  // Determine min & max for Price axis
  const priceMin = useMemo(() => {
    if (history.length === 0) return 0;
    const min = Math.min(...history.map((h) => h.low || h.price));
    return Math.floor(min * 0.96);
  }, [history]);

  const priceMax = useMemo(() => {
    if (history.length === 0) return 100;
    const max = Math.max(...history.map((h) => h.high || h.price));
    return Math.ceil(max * 1.04);
  }, [history]);

  // Custom Chart Tooltip
  const CustomScoreTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const pt: DailyScorePoint = payload[0].payload;

    return (
      <div className="bg-slate-950/95 backdrop-blur-md border border-slate-700/80 rounded-2xl p-3.5 shadow-2xl text-xs space-y-2.5 min-w-[240px] pointer-events-none z-50">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="font-mono font-bold text-slate-200">{pt.date}</div>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              pt.decision === 'STRONG_OPPORTUNITY'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : pt.decision === 'OPPORTUNITY'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : pt.decision === 'WATCH'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            {pt.decision}
          </span>
        </div>

        {/* Price & Change */}
        <div className="flex items-center justify-between font-mono">
          <span className="text-slate-400">종가 (Price):</span>
          <div className="flex items-center space-x-1.5">
            <span className="font-bold text-slate-100">{formatStockPrice(pt.price, ticker)}</span>
            <span
              className={`text-[11px] font-semibold ${
                pt.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {formatChangePercent(pt.changePercent)}
            </span>
          </div>
        </div>

        {/* Scores Matrix */}
        <div className="space-y-1 pt-1 border-t border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-cyan-400 font-bold flex items-center space-x-1">
              <Sparkles className="w-3 h-3" />
              <span>종합 기회 점수:</span>
            </span>
            <span className="font-bold font-mono text-cyan-300 text-sm">
              {pt.opportunityScore}점
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1 pt-1 text-[10px] font-mono">
            <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800">
              <div className="text-blue-400">기술 (Tech)</div>
              <div className="font-bold text-slate-200">{pt.technicalScore}pt</div>
            </div>
            <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800">
              <div className="text-teal-400">모멘텀 (Mom)</div>
              <div className="font-bold text-slate-200">{pt.momentumScore}pt</div>
            </div>
            <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800">
              <div className="text-rose-400">리스크 (Risk)</div>
              <div className="font-bold text-slate-200">{pt.riskScore}pt</div>
            </div>
          </div>
        </div>

        {/* Technical Indicators */}
        <div className="space-y-1 pt-1 border-t border-slate-800/80 text-[11px]">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">RSI(14):</span>
            <span
              className={`font-mono font-bold ${
                pt.rsi14 <= 35
                  ? 'text-emerald-400'
                  : pt.rsi14 >= 70
                  ? 'text-rose-400'
                  : 'text-slate-200'
              }`}
            >
              {pt.rsi14.toFixed(1)} {pt.rsi14 <= 35 ? '(과매도)' : pt.rsi14 >= 70 ? '(과열)' : ''}
            </span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
            <span>MA20 / 50 / 200:</span>
            <span>
              {pt.ma20} / {pt.ma50} / {pt.ma200}
            </span>
          </div>
          {pt.drawdownFromHigh !== undefined && (
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="text-slate-400">고점대비 낙폭:</span>
              <span className="text-amber-400">{pt.drawdownFromHigh}%</span>
            </div>
          )}
        </div>

        {pt.isSignal && (
          <div className="bg-emerald-950/60 border border-emerald-500/40 rounded-xl p-1.5 text-[10px] text-emerald-300 flex items-center space-x-1.5">
            <Zap className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="font-semibold">퀀트 매수 시그널 포착일</span>
          </div>
        )}
      </div>
    );
  };

  if (loading && !data) {
    return (
      <div className="p-8 rounded-3xl bg-slate-950/60 border border-slate-800 flex flex-col items-center justify-center space-y-3 min-h-[320px]">
        <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
        <div className="text-sm font-medium text-slate-300 font-mono">
          {ticker}의 일별 점수 및 기술적 지표 시계열 데이터를 산출 중입니다...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-3xl bg-rose-950/20 border border-rose-800/40 text-rose-300 space-y-3">
        <div className="flex items-center space-x-2 font-bold text-sm">
          <AlertCircle className="w-5 h-5" />
          <span>차트 데이터 로드 오류</span>
        </div>
        <p className="text-xs text-rose-400">{error}</p>
        <button
          onClick={() => fetchHistory(range)}
          className="px-3 py-1.5 rounded-xl bg-rose-900/50 hover:bg-rose-900/80 text-xs font-semibold text-rose-200 flex items-center space-x-1.5 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>다시 시도</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Top Header & Range Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-950/80 p-4 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <h4 className="text-base font-bold text-slate-100 flex items-center space-x-2">
              <span>📈 일별 퀀트 점수 & 기술 지표 타임라인</span>
              <span className="text-xs px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 font-mono border border-cyan-500/30">
                {ticker}
              </span>
            </h4>
            {loading && <RefreshCw className="w-3.5 h-3.5 text-cyan-400 animate-spin" />}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            기회 4대 서브 스코어 변동, 주가 이동평균선(MA20/50/200), RSI 오실레이터의 일별 동기화 추적
          </p>
        </div>

        {/* Range Buttons */}
        <div className="flex items-center space-x-1 bg-slate-900/90 p-1 rounded-xl border border-slate-700/60 self-stretch sm:self-auto justify-center">
          {[
            { key: '1m', label: '1개월' },
            { key: '3m', label: '3개월' },
            { key: '6m', label: '6개월' },
            { key: '1y', label: '1년' },
            { key: 'all', label: '전체' },
          ].map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                range === r.key
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary KPI Cards Bar */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {/* Card 1: Current Score */}
          <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800/80">
            <div className="text-[11px] text-slate-400 font-medium flex items-center justify-between">
              <span>현재 기회 점수</span>
              <Sparkles className="w-3 h-3 text-cyan-400" />
            </div>
            <div className="text-xl font-bold font-mono text-cyan-400 mt-1 flex items-baseline space-x-1.5">
              <span>{summary.currentScore}점</span>
              <span
                className={`text-xs font-semibold ${
                  summary.scoreChange30d > 0
                    ? 'text-emerald-400'
                    : summary.scoreChange30d < 0
                    ? 'text-rose-400'
                    : 'text-slate-400'
                }`}
              >
                {summary.scoreChange30d > 0
                  ? `+${summary.scoreChange30d}pt`
                  : `${summary.scoreChange30d}pt`}{' '}
                (30d)
              </span>
            </div>
          </div>

          {/* Card 2: Highest & Lowest Score */}
          <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800/80">
            <div className="text-[11px] text-slate-400 font-medium">기간 최고 / 최저점</div>
            <div className="text-sm font-bold font-mono text-slate-200 mt-1 flex items-center space-x-2">
              <span className="text-emerald-400">▲ {summary.highestScore}점</span>
              <span className="text-slate-600">/</span>
              <span className="text-rose-400">▼ {summary.lowestScore}점</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              최고일: {summary.highestScoreDate}
            </div>
          </div>

          {/* Card 3: RSI Level & State */}
          <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800/80">
            <div className="text-[11px] text-slate-400 font-medium">RSI(14) 상태</div>
            <div className="text-sm font-bold font-mono mt-1 flex items-center space-x-1.5">
              <span className="text-slate-100">{summary.currentRsi.toFixed(1)}</span>
              <span
                className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                  summary.rsiState === 'OVERSOLD'
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : summary.rsiState === 'HEALTHY_BUY'
                    ? 'bg-cyan-500/20 text-cyan-300'
                    : summary.rsiState === 'OVERBOUGHT'
                    ? 'bg-rose-500/20 text-rose-300'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {summary.rsiState === 'OVERSOLD'
                  ? '과매도 (반등기회)'
                  : summary.rsiState === 'HEALTHY_BUY'
                  ? '눌림목 매수권'
                  : summary.rsiState === 'OVERBOUGHT'
                  ? '단기 과열'
                  : '중립 구간'}
              </span>
            </div>
          </div>

          {/* Card 4: Moving Average Alignment Trend */}
          <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800/80">
            <div className="text-[11px] text-slate-400 font-medium">이평선 추세 배열</div>
            <div className="text-sm font-bold mt-1">
              {summary.trendState === 'STRONG_BULL' ? (
                <span className="text-emerald-400 flex items-center space-x-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>완전 정배열 (강세)</span>
                </span>
              ) : summary.trendState === 'BULL' ? (
                <span className="text-cyan-400 flex items-center space-x-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>상승 추세 (MA50 위)</span>
                </span>
              ) : summary.trendState === 'CORRECTION' ? (
                <span className="text-amber-400 flex items-center space-x-1">
                  <TrendingDown className="w-3.5 h-3.5" />
                  <span>조정 국면 (MA50 아래)</span>
                </span>
              ) : (
                <span className="text-rose-400 flex items-center space-x-1">
                  <TrendingDown className="w-3.5 h-3.5" />
                  <span>역배열 / 약세</span>
                </span>
              )}
            </div>
          </div>

          {/* Card 5: Period Signal Counts */}
          <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800/80 col-span-2 sm:col-span-1">
            <div className="text-[11px] text-slate-400 font-medium">기회 포착 신호 발생</div>
            <div className="text-base font-bold font-mono text-emerald-400 mt-1 flex items-center space-x-1">
              <Zap className="w-4 h-4 text-emerald-400" />
              <span>총 {summary.totalSignalsInPeriod}회 포착</span>
            </div>
          </div>
        </div>
      )}

      {/* Indicator Toggle Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-950/60 rounded-2xl border border-slate-800/80 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-slate-400 text-[11px] font-semibold mr-1 flex items-center space-x-1">
            <Sliders className="w-3.5 h-3.5" />
            <span>지표 토글:</span>
          </span>

          <button
            onClick={() => setShowOpportunity(!showOpportunity)}
            className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
              showOpportunity
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
                : 'bg-slate-900 text-slate-500 border border-slate-800'
            }`}
          >
            🎯 종합 기회 점수
          </button>

          <button
            onClick={() => setShowTechScore(!showTechScore)}
            className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
              showTechScore
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/50'
                : 'bg-slate-900 text-slate-500 border border-slate-800'
            }`}
          >
            ⚡ 기술 점수
          </button>

          <button
            onClick={() => setShowMomScore(!showMomScore)}
            className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
              showMomScore
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/50'
                : 'bg-slate-900 text-slate-500 border border-slate-800'
            }`}
          >
            🚀 모멘텀 점수
          </button>

          <button
            onClick={() => setShowRiskScore(!showRiskScore)}
            className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
              showRiskScore
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/50'
                : 'bg-slate-900 text-slate-500 border border-slate-800'
            }`}
          >
            🛡️ 리스크 점수
          </button>
        </div>

        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => {
              const next = !(showMA20 && showMA50 && showMA200);
              setShowMA20(next);
              setShowMA50(next);
              setShowMA200(next);
            }}
            className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
              showMA20 || showMA50 || showMA200
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                : 'bg-slate-900 text-slate-500 border border-slate-800'
            }`}
          >
            이평선 (MA20/50/200)
          </button>

          <button
            onClick={() => setShowRsiPanel(!showRsiPanel)}
            className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
              showRsiPanel
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/50'
                : 'bg-slate-900 text-slate-500 border border-slate-800'
            }`}
          >
            RSI(14) 패널
          </button>

          <button
            onClick={() => setShowDrawdownPanel(!showDrawdownPanel)}
            className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
              showDrawdownPanel
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/50'
                : 'bg-slate-900 text-slate-500 border border-slate-800'
            }`}
          >
            고점낙폭 %
          </button>
        </div>
      </div>

      {/* ========================================================
          PANEL 1: 퀀트 기회 점수 & 서브 스코어 차트 (0 ~ 100)
         ======================================================== */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-slate-200">
              📊 퀀트 기회 점수 & 서브 스코어 트렌드
            </span>
            <span className="text-[11px] text-slate-400 font-mono">(0 ~ 100 pt)</span>
          </div>
          <div className="flex items-center space-x-3 text-[11px]">
            <span className="flex items-center space-x-1 text-cyan-400 font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block"></span>
              <span>기회 점수</span>
            </span>
            <span className="flex items-center space-x-1 text-emerald-400">
              <span className="w-2.5 h-0.5 bg-emerald-400 inline-block"></span>
              <span>70pt 포착선</span>
            </span>
            <span className="flex items-center space-x-1 text-rose-400">
              <span className="w-2.5 h-0.5 border-t border-dashed border-rose-400 inline-block"></span>
              <span>리스크 점수</span>
            </span>
          </div>
        </div>

        <div className="h-64 sm:h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={history}
              onClick={(e: any) => {
                if (e && e.activePayload && e.activePayload.length > 0) {
                  setPinnedPoint(e.activePayload[0].payload);
                  if (onSelectDate) onSelectDate(e.activePayload[0].payload);
                }
              }}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="scoreAreaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />

              <XAxis
                dataKey="date"
                stroke="#64748b"
                tick={{ fontSize: 10 }}
                tickFormatter={(val) => val.slice(5)}
              />
              <YAxis
                domain={[0, 100]}
                ticks={[0, 25, 50, 70, 85, 100]}
                stroke="#64748b"
                tick={{ fontSize: 10 }}
              />

              <Tooltip content={<CustomScoreTooltip />} />

              {/* 70 Threshold Line */}
              <ReferenceLine
                y={70}
                stroke="#10b981"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: '기회 포착선 (70pt)',
                  fill: '#10b981',
                  fontSize: 10,
                  position: 'right',
                }}
              />

              {/* 85 Strong Opportunity Line */}
              <ReferenceLine
                y={85}
                stroke="#06b6d4"
                strokeDasharray="2 2"
                strokeWidth={1}
                label={{
                  value: '강력 포착 (85pt)',
                  fill: '#06b6d4',
                  fontSize: 9,
                  position: 'right',
                }}
              />

              {/* Opportunity Area & Line */}
              {showOpportunity && (
                <Area
                  type="monotone"
                  dataKey="opportunityScore"
                  name="기회 점수"
                  stroke="#06b6d4"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#scoreAreaGradient)"
                />
              )}

              {/* Sub-score lines */}
              {showTechScore && (
                <Line
                  type="monotone"
                  dataKey="technicalScore"
                  name="기술 점수"
                  stroke="#3b82f6"
                  strokeWidth={1.5}
                  dot={false}
                />
              )}

              {showMomScore && (
                <Line
                  type="monotone"
                  dataKey="momentumScore"
                  name="모멘텀 점수"
                  stroke="#14b8a6"
                  strokeWidth={1.5}
                  dot={false}
                />
              )}

              {showRiskScore && (
                <Line
                  type="monotone"
                  dataKey="riskScore"
                  name="리스크 점수"
                  stroke="#f43f5e"
                  strokeDasharray="3 3"
                  strokeWidth={1.5}
                  dot={false}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ========================================================
          PANEL 2: 주가 & 이동평균선 (MA20, MA50, MA200)
         ======================================================== */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-slate-200">
              💵 주가 및 이동평균선 (Price & MA Trend)
            </span>
          </div>
          <div className="flex items-center space-x-3 text-[11px] font-mono">
            <span className="flex items-center space-x-1 text-slate-200 font-bold">
              <span className="w-2.5 h-0.5 bg-slate-200 inline-block"></span>
              <span>종가</span>
            </span>
            {showMA20 && (
              <span className="flex items-center space-x-1 text-amber-400">
                <span className="w-2.5 h-0.5 bg-amber-400 inline-block"></span>
                <span>MA20</span>
              </span>
            )}
            {showMA50 && (
              <span className="flex items-center space-x-1 text-sky-400">
                <span className="w-2.5 h-0.5 bg-sky-400 inline-block"></span>
                <span>MA50</span>
              </span>
            )}
            {showMA200 && (
              <span className="flex items-center space-x-1 text-purple-400">
                <span className="w-2.5 h-0.5 bg-purple-400 inline-block"></span>
                <span>MA200</span>
              </span>
            )}
          </div>
        </div>

        <div className="h-56 sm:h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={history}
              onClick={(e: any) => {
                if (e && e.activePayload && e.activePayload.length > 0) {
                  setPinnedPoint(e.activePayload[0].payload);
                  if (onSelectDate) onSelectDate(e.activePayload[0].payload);
                }
              }}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />

              <XAxis
                dataKey="date"
                stroke="#64748b"
                tick={{ fontSize: 10 }}
                tickFormatter={(val) => val.slice(5)}
              />
              <YAxis
                domain={[priceMin, priceMax]}
                stroke="#64748b"
                tick={{ fontSize: 10 }}
                tickFormatter={(v) => `$${v}`}
              />

              <Tooltip content={<CustomScoreTooltip />} />

              {/* Price Line & Gradient */}
              <Area
                type="monotone"
                dataKey="price"
                stroke="#f8fafc"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#priceGradient)"
              />

              {/* Moving Averages */}
              {showMA20 && (
                <Line
                  type="monotone"
                  dataKey="ma20"
                  name="MA20"
                  stroke="#f59e0b"
                  strokeWidth={1.5}
                  dot={false}
                />
              )}

              {showMA50 && (
                <Line
                  type="monotone"
                  dataKey="ma50"
                  name="MA50"
                  stroke="#38bdf8"
                  strokeWidth={1.5}
                  dot={false}
                />
              )}

              {showMA200 && (
                <Line
                  type="monotone"
                  dataKey="ma200"
                  name="MA200"
                  stroke="#c084fc"
                  strokeWidth={1.5}
                  dot={false}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ========================================================
          PANEL 3: RSI(14) 모멘텀 오실레이터 (30 과매도 / 70 과열)
         ======================================================== */}
      {showRsiPanel && (
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-200">
                ⚡ RSI (14) 모멘텀 오실레이터
              </span>
              <span className="text-[11px] text-slate-400">
                (30 과매도 반등구간 / 70 과열 주의구간)
              </span>
            </div>
            <div className="flex items-center space-x-3 text-[11px]">
              <span className="text-emerald-400 font-mono">30 과매도 기준</span>
              <span className="text-slate-500 font-mono">50 중심선</span>
              <span className="text-rose-400 font-mono">70 과열선</span>
            </div>
          </div>

          <div className="h-40 sm:h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={history}
                onClick={(e: any) => {
                  if (e && e.activePayload && e.activePayload.length > 0) {
                    setPinnedPoint(e.activePayload[0].payload);
                    if (onSelectDate) onSelectDate(e.activePayload[0].payload);
                  }
                }}
                margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />

                <XAxis
                  dataKey="date"
                  stroke="#64748b"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(val) => val.slice(5)}
                />
                <YAxis domain={[10, 90]} ticks={[30, 50, 70]} stroke="#64748b" tick={{ fontSize: 10 }} />

                <Tooltip content={<CustomScoreTooltip />} />

                {/* Overbought line */}
                <ReferenceLine
                  y={70}
                  stroke="#f43f5e"
                  strokeDasharray="3 3"
                  strokeWidth={1}
                  label={{ value: '과열 (70)', fill: '#f43f5e', fontSize: 9, position: 'right' }}
                />

                {/* Midline */}
                <ReferenceLine y={50} stroke="#475569" strokeDasharray="2 2" strokeWidth={1} />

                {/* Oversold line */}
                <ReferenceLine
                  y={30}
                  stroke="#10b981"
                  strokeDasharray="3 3"
                  strokeWidth={1}
                  label={{ value: '과매도 (30)', fill: '#10b981', fontSize: 9, position: 'right' }}
                />

                {/* RSI Line */}
                <Line
                  type="monotone"
                  dataKey="rsi14"
                  name="RSI(14)"
                  stroke="#a855f7"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ========================================================
          PANEL 4: 고점 대비 낙폭 (Drawdown %)
         ======================================================== */}
      {showDrawdownPanel && (
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-200">
                📉 52주 고점 대비 낙폭 (Drawdown %)
              </span>
            </div>
          </div>

          <div className="h-36 sm:h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={history}
                margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
                <XAxis
                  dataKey="date"
                  stroke="#64748b"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(val) => val.slice(5)}
                />
                <YAxis
                  stroke="#64748b"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip content={<CustomScoreTooltip />} />

                <Area
                  type="monotone"
                  dataKey="drawdownFromHigh"
                  stroke="#f43f5e"
                  fill="#f43f5e"
                  fillOpacity={0.2}
                  strokeWidth={1.5}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Selected Day Diagnosis Detail Inspector */}
      {pinnedPoint && (
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/90 border border-cyan-500/30 space-y-3 animate-fadeIn">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
                <Crosshair className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs text-slate-400">선택 일자 퀀트 진단 세부 스냅샷</div>
                <div className="text-sm font-bold text-slate-100 font-mono flex items-center space-x-2">
                  <span>📅 {pinnedPoint.date}</span>
                  <span>•</span>
                  <span>{formatStockPrice(pinnedPoint.price, ticker)}</span>
                  <span
                    className={`text-xs ${
                      pinnedPoint.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {formatChangePercent(pinnedPoint.changePercent)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <span
                className={`px-2.5 py-1 rounded-xl text-xs font-bold font-mono ${
                  pinnedPoint.decision === 'STRONG_OPPORTUNITY'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : pinnedPoint.decision === 'OPPORTUNITY'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : pinnedPoint.decision === 'WATCH'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                🎯 {pinnedPoint.decision}
              </span>
              <div className="px-3 py-1 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono font-bold text-cyan-400">
                {pinnedPoint.opportunityScore}점
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80">
              <span className="text-slate-400 text-[11px]">기술 점수 (Tech)</span>
              <div className="font-bold text-blue-400 font-mono text-sm mt-0.5">
                {pinnedPoint.technicalScore}pt
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                RSI {pinnedPoint.rsi14.toFixed(1)} / MA20 {pinnedPoint.ma20}
              </div>
            </div>

            <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80">
              <span className="text-slate-400 text-[11px]">모멘텀 점수 (Mom)</span>
              <div className="font-bold text-teal-400 font-mono text-sm mt-0.5">
                {pinnedPoint.momentumScore}pt
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                MA50 {pinnedPoint.ma50} / MA200 {pinnedPoint.ma200}
              </div>
            </div>

            <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80">
              <span className="text-slate-400 text-[11px]">독립 리스크 (Risk)</span>
              <div className="font-bold text-rose-400 font-mono text-sm mt-0.5">
                {pinnedPoint.riskScore}pt ({pinnedPoint.riskLevel})
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                고점대비 낙폭: {pinnedPoint.drawdownFromHigh}%
              </div>
            </div>

            <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80">
              <span className="text-slate-400 text-[11px]">시그널 상태</span>
              <div className="font-bold text-slate-200 font-mono text-sm mt-0.5 flex items-center space-x-1">
                {pinnedPoint.isSignal ? (
                  <span className="text-emerald-400 flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>매수 포착</span>
                  </span>
                ) : (
                  <span className="text-slate-400">관망 / 기준미달</span>
                )}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                전략: {pinnedPoint.strategyType}
              </div>
            </div>
          </div>

          {pinnedPoint.decisionReason && (
            <div className="text-xs text-slate-300 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 leading-relaxed">
              💡 <strong>당일 판단 근거:</strong> "{pinnedPoint.decisionReason}"
            </div>
          )}
        </div>
      )}
    </div>
  );
};
