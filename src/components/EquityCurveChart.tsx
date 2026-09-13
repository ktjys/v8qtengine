import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import {
  TrendingUp,
  Award,
  ShieldAlert,
  BarChart3,
  Calendar,
  Sparkles,
  Percent,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Info,
} from 'lucide-react';
import { EquityCurveResult, EquityDataPoint } from '../engine/equityCurveEngine';

interface EquityCurveChartProps {
  data: EquityCurveResult | null;
  isLoading?: boolean;
  onRefresh?: () => void;
}

type ViewMode = 'CUMULATIVE' | 'ALPHA' | 'DRAWDOWN';
type TimeRange = 'ALL' | '1Y' | '6M' | '3M';

export const EquityCurveChart: React.FC<EquityCurveChartProps> = ({
  data,
  isLoading = false,
  onRefresh,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('CUMULATIVE');
  const [timeRange, setTimeRange] = useState<TimeRange>('ALL');

  // Filter data points by selected time range
  const filteredData = useMemo(() => {
    if (!data?.dataPoints || data.dataPoints.length === 0) return [];

    const total = data.dataPoints.length;
    if (timeRange === '3M') {
      return data.dataPoints.slice(Math.max(0, total - 65));
    }
    if (timeRange === '6M') {
      return data.dataPoints.slice(Math.max(0, total - 130));
    }
    if (timeRange === '1Y') {
      return data.dataPoints.slice(Math.max(0, total - 250));
    }
    return data.dataPoints;
  }, [data, timeRange]);

  const metrics = data?.metrics;

  const formatPercent = (val: number | undefined) => {
    if (val === undefined || isNaN(val)) return '0.0%';
    const sign = val > 0 ? '+' : '';
    return `${sign}${val.toFixed(1)}%`;
  };

  const formatCurrency = (val: number | undefined) => {
    if (val === undefined || isNaN(val)) return '$100,000';
    return `$${val.toLocaleString()}`;
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-6">
      {/* Header & KPI Summary */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <TrendingUp className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                <span>누적 수익 곡선 & S&P 500 (SPY) 벤치마크 알파</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono font-medium">
                  {metrics ? `Alpha ${formatPercent(metrics.cumulativeAlpha)}` : 'Live Quant'}
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                포트폴리오 자산 성장 추이, 벤치마크 대비 초과 수익률(알파), 낙폭(MDD) 방어력을 종합 검증합니다.
              </p>
            </div>
          </div>
        </div>

        {/* View Mode & Time Range Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Toggle */}
          <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex items-center space-x-1">
            <button
              onClick={() => setViewMode('CUMULATIVE')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                viewMode === 'CUMULATIVE'
                  ? 'bg-cyan-500 text-slate-950 shadow-md font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              누적 수익률
            </button>
            <button
              onClick={() => setViewMode('ALPHA')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                viewMode === 'ALPHA'
                  ? 'bg-cyan-500 text-slate-950 shadow-md font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              알파 스프레드
            </button>
            <button
              onClick={() => setViewMode('DRAWDOWN')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                viewMode === 'DRAWDOWN'
                  ? 'bg-rose-500 text-white shadow-md font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              언더워터 (MDD)
            </button>
          </div>

          {/* Time Range Filter */}
          <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex items-center space-x-1">
            {(['ALL', '1Y', '6M', '3M'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
                  timeRange === range
                    ? 'bg-slate-800 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {range === 'ALL' ? '전체' : range}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      {metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 font-mono">
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 space-y-1">
            <span className="text-[11px] text-slate-400 font-sans flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
              전략 총 수익률
            </span>
            <div className="text-base sm:text-lg font-bold text-cyan-400">
              {formatPercent(metrics.totalStrategyReturn)}
            </div>
            <div className="text-[10px] text-slate-500 font-sans">
              CAGR {formatPercent(metrics.annualizedReturn)}
            </div>
          </div>

          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 space-y-1">
            <span className="text-[11px] text-slate-400 font-sans flex items-center gap-1">
              <BarChart3 className="w-3.5 h-3.5 text-slate-400" />
              S&P 500 (SPY)
            </span>
            <div className="text-base sm:text-lg font-bold text-slate-300">
              {formatPercent(metrics.totalBenchmarkReturn)}
            </div>
            <div className="text-[10px] text-slate-500 font-sans">
              CAGR {formatPercent(metrics.annualizedBenchmarkReturn)}
            </div>
          </div>

          <div className="bg-slate-950/70 border border-emerald-500/30 rounded-xl p-3.5 space-y-1 bg-emerald-500/5">
            <span className="text-[11px] text-emerald-400 font-sans flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              누적 알파 (초과수익)
            </span>
            <div className="text-base sm:text-lg font-bold text-emerald-400">
              {formatPercent(metrics.cumulativeAlpha)}
            </div>
            <div className="text-[10px] text-emerald-500/80 font-sans">
              IR {metrics.informationRatio.toFixed(2)} (우수)
            </div>
          </div>

          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 space-y-1">
            <span className="text-[11px] text-slate-400 font-sans flex items-center gap-1">
              <Award className="w-3.5 h-3.5 text-amber-400" />
              샤프 / 소르티노
            </span>
            <div className="text-base sm:text-lg font-bold text-amber-300">
              {metrics.sharpeRatio.toFixed(2)}
            </div>
            <div className="text-[10px] text-slate-500 font-sans">
              Sortino {metrics.sortinoRatio.toFixed(2)}
            </div>
          </div>

          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 space-y-1">
            <span className="text-[11px] text-slate-400 font-sans flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              최대 낙폭 (MDD)
            </span>
            <div className="text-base sm:text-lg font-bold text-rose-400">
              -{metrics.maxDrawdown.toFixed(1)}%
            </div>
            <div className="text-[10px] text-slate-500 font-sans">
              SPY -{metrics.benchmarkMaxDrawdown.toFixed(1)}%
            </div>
          </div>

          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 space-y-1">
            <span className="text-[11px] text-slate-400 font-sans flex items-center gap-1">
              <Percent className="w-3.5 h-3.5 text-purple-400" />
              승률 / 손익비
            </span>
            <div className="text-base sm:text-lg font-bold text-purple-300">
              {metrics.winRate.toFixed(1)}%
            </div>
            <div className="text-[10px] text-slate-500 font-sans">
              PF {metrics.profitFactor.toFixed(1)}x / Beta {metrics.betaVsBenchmark.toFixed(2)}
            </div>
          </div>
        </div>
      )}

      {/* Main Interactive Recharts */}
      <div className="bg-slate-950/60 border border-slate-800/60 rounded-xl p-3 sm:p-5">
        <div className="h-[360px] sm:h-[420px] w-full">
          {filteredData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-500 text-sm font-mono">
              수익 곡선 데이터를 집계 중입니다...
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              {viewMode === 'CUMULATIVE' ? (
                <ComposedChart
                  data={filteredData}
                  margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="strategyGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(val) => val.slice(5)}
                  />
                  <YAxis
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(val) => `${val > 0 ? '+' : ''}${val}%`}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    verticalAlign="top"
                    height={36}
                    iconType="circle"
                    formatter={(value) => {
                      if (value === 'strategyReturn') return '퀀트 전략 누적 수익률 (%)';
                      if (value === 'benchmarkReturn') return 'S&P 500 (SPY) 벤치마크 (%)';
                      return value;
                    }}
                  />
                  <ReferenceLine y={0} stroke="#475569" strokeDasharray="2 2" />
                  <Area
                    type="monotone"
                    dataKey="strategyReturn"
                    stroke="#06b6d4"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#strategyGrad)"
                    name="strategyReturn"
                  />
                  <Line
                    type="monotone"
                    dataKey="benchmarkReturn"
                    stroke="#94a3b8"
                    strokeWidth={1.8}
                    strokeDasharray="4 4"
                    dot={false}
                    name="benchmarkReturn"
                  />
                </ComposedChart>
              ) : viewMode === 'ALPHA' ? (
                <ComposedChart
                  data={filteredData}
                  margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="alphaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(val) => val.slice(5)}
                  />
                  <YAxis
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(val) => `${val > 0 ? '+' : ''}${val}%p`}
                  />
                  <Tooltip content={<CustomAlphaTooltip />} />
                  <Legend
                    verticalAlign="top"
                    height={36}
                    iconType="circle"
                    formatter={() => '초과 수익률 알파 (전략 - SPY 벤치마크, %p)'}
                  />
                  <ReferenceLine y={0} stroke="#64748b" strokeWidth={1} />
                  <Area
                    type="monotone"
                    dataKey="alpha"
                    stroke="#10b981"
                    strokeWidth={2.2}
                    fillOpacity={1}
                    fill="url(#alphaGrad)"
                    name="alpha"
                  />
                </ComposedChart>
              ) : (
                <ComposedChart
                  data={filteredData}
                  margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.0} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.45} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(val) => val.slice(5)}
                  />
                  <YAxis
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(val) => `${val}%`}
                  />
                  <Tooltip content={<CustomDrawdownTooltip />} />
                  <Legend
                    verticalAlign="top"
                    height={36}
                    iconType="circle"
                    formatter={(value) => {
                      if (value === 'drawdown') return '전략 포트폴리오 낙폭 (Drawdown %)';
                      if (value === 'benchmarkDrawdown') return 'SPY 벤치마크 낙폭 (%)';
                      return value;
                    }}
                  />
                  <ReferenceLine y={0} stroke="#475569" strokeDasharray="2 2" />
                  <Area
                    type="monotone"
                    dataKey="drawdown"
                    stroke="#f43f5e"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#ddGrad)"
                    name="drawdown"
                  />
                  <Line
                    type="monotone"
                    dataKey="benchmarkDrawdown"
                    stroke="#94a3b8"
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                    dot={false}
                    name="benchmarkDrawdown"
                  />
                </ComposedChart>
              )}
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Footer Meta & Quant Notes */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-slate-400 border-t border-slate-800/80 pt-4 gap-2">
        <div className="flex items-center space-x-2">
          <Info className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>
            기준 자본: <b className="text-white font-mono">{formatCurrency(metrics?.initialCapital)}</b> | 
            현재 평가 가치: <b className="text-cyan-400 font-mono">{formatCurrency(metrics?.finalPortfolioValue)}</b>
          </span>
        </div>
        <div className="font-mono text-slate-500 text-[11px]">
          {metrics?.startDate} ~ {metrics?.endDate} ({metrics?.tradingDays} 영업일 거래 집계)
        </div>
      </div>
    </div>
  );
};

// Tooltip Components
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data: EquityDataPoint = payload[0]?.payload;
    if (!data) return null;

    const strat = data.strategyReturn;
    const bench = data.benchmarkReturn;
    const alpha = data.alpha;

    return (
      <div className="bg-slate-950 border border-slate-700 rounded-xl p-3 shadow-xl text-xs font-mono space-y-2 max-w-[260px]">
        <div className="text-slate-400 font-sans border-b border-slate-800 pb-1 font-semibold">
          {label}
        </div>
        <div className="space-y-1">
          <div className="flex justify-between items-center text-cyan-400">
            <span>퀀트 전략:</span>
            <span className="font-bold">{strat >= 0 ? '+' : ''}{strat.toFixed(2)}%</span>
          </div>
          <div className="flex justify-between items-center text-slate-300">
            <span>S&P 500 (SPY):</span>
            <span>{bench >= 0 ? '+' : ''}{bench.toFixed(2)}%</span>
          </div>
          <div className="flex justify-between items-center text-emerald-400 border-t border-slate-800/60 pt-1 font-bold">
            <span>초과 알파:</span>
            <span>{alpha >= 0 ? '+' : ''}{alpha.toFixed(2)}%p</span>
          </div>
          <div className="flex justify-between items-center text-slate-400 pt-1 border-t border-slate-800/60">
            <span>추정 자산:</span>
            <span>${data.portfolioValue?.toLocaleString()}</span>
          </div>
        </div>
        {data.eventTickers && data.eventTickers.length > 0 && (
          <div className="pt-1 text-[10px] text-slate-500 font-sans">
            포착 종목: {data.eventTickers.slice(0, 3).join(', ')}
            {data.eventTickers.length > 3 ? ` 외 ${data.eventTickers.length - 3}건` : ''}
          </div>
        )}
      </div>
    );
  }
  return null;
};

const CustomAlphaTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data: EquityDataPoint = payload[0]?.payload;
    if (!data) return null;

    const alpha = data.alpha;
    return (
      <div className="bg-slate-950 border border-emerald-500/40 rounded-xl p-3 shadow-xl text-xs font-mono space-y-1.5">
        <div className="text-slate-400 font-sans font-semibold border-b border-slate-800 pb-1">
          {label} 알파 분석
        </div>
        <div className="flex justify-between items-center text-emerald-400 font-bold">
          <span>누적 알파 Spread:</span>
          <span>{alpha >= 0 ? '+' : ''}{alpha.toFixed(2)}%p</span>
        </div>
        <div className="text-[10px] text-slate-400 font-sans">
          {alpha >= 0 ? '벤치마크 S&P 500 대비 초과 수익 달성' : '벤치마크 대비 언더퍼폼 구간'}
        </div>
      </div>
    );
  }
  return null;
};

const CustomDrawdownTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data: EquityDataPoint = payload[0]?.payload;
    if (!data) return null;

    return (
      <div className="bg-slate-950 border border-rose-500/40 rounded-xl p-3 shadow-xl text-xs font-mono space-y-1.5">
        <div className="text-slate-400 font-sans font-semibold border-b border-slate-800 pb-1">
          {label} 낙폭 (Underwater)
        </div>
        <div className="flex justify-between items-center text-rose-400 font-bold">
          <span>전략 포트폴리오 낙폭:</span>
          <span>{data.drawdown.toFixed(2)}%</span>
        </div>
        <div className="flex justify-between items-center text-slate-400">
          <span>SPY 시장 낙폭:</span>
          <span>{data.benchmarkDrawdown.toFixed(2)}%</span>
        </div>
      </div>
    );
  }
  return null;
};
