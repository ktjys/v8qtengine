import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  ExternalLink,
  Flame,
  Globe,
  HelpCircle,
  Info,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { MacroMarketRegime, EarningsEvent, EarningsRiskStage } from '../types/v8';
import { MacroEarningsEngine } from '../engine/macroEarningsEngine';

interface MacroEarningsViewProps {
  onSelectTicker?: (ticker: string) => void;
}

export const MacroEarningsView: React.FC<MacroEarningsViewProps> = ({ onSelectTicker }) => {
  const [macroRegime, setMacroRegime] = useState<MacroMarketRegime | null>(null);
  const [earningsEvents, setEarningsEvents] = useState<EarningsEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filterStage, setFilterStage] = useState<'ALL' | EarningsRiskStage>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = async (forceRefresh = false) => {
    setIsLoading(true);
    try {
      // Try API first, fallback to client-side engine if needed
      try {
        const url = forceRefresh ? '/api/v8/macro/regime?refresh=true' : '/api/v8/macro/regime';
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data.regime) {
            setMacroRegime(data.regime);
          }
        } else {
          const clientRegime = await MacroEarningsEngine.getMacroMarketRegime(forceRefresh);
          setMacroRegime(clientRegime);
        }
      } catch {
        const clientRegime = await MacroEarningsEngine.getMacroMarketRegime(forceRefresh);
        setMacroRegime(clientRegime);
      }

      try {
        const res = await fetch('/api/v8/macro/earnings');
        if (res.ok) {
          const data = await res.json();
          if (data.events) {
            setEarningsEvents(data.events);
          }
        } else {
          setEarningsEvents(MacroEarningsEngine.getEarningsCalendar());
        }
      } catch {
        setEarningsEvents(MacroEarningsEngine.getEarningsCalendar());
      }
    } catch (err) {
      console.error('[MacroEarningsView] Load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredEarnings = earningsEvents.filter((ev) => {
    if (filterStage !== 'ALL' && ev.riskStage !== filterStage) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toUpperCase().trim();
      const matchTicker = ev.ticker.toUpperCase().includes(q);
      const matchName = ev.companyName.toUpperCase().includes(q);
      if (!matchTicker && !matchName) return false;
    }
    return true;
  });

  const imminentCount = earningsEvents.filter((e) => e.riskStage === 'IMMINENT_DANGER').length;
  const upcomingCount = earningsEvents.filter((e) => e.riskStage === 'UPCOMING_SOON').length;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900/80 border border-slate-800 p-5 rounded-2xl">
        <div className="flex items-start space-x-3.5">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 mt-1">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                매크로 시장 체제 & 실적 리스크 가드
              </h1>
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                Phase 1 완료
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              VIX 공포지수, 미국 10년물 국채금리, 달러 인덱스(DXY)를 결합한 시장 국면 분석과 실적 발표(Earnings) D-Day 위험 관리
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3 self-end sm:self-auto">
          <button
            id="macro-refresh-btn"
            onClick={() => loadData(true)}
            disabled={isLoading}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-medium border border-slate-700 transition-all active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
            <span>매크로 갱신</span>
          </button>
        </div>
      </div>

      {/* Main Macro Regime Banner */}
      {macroRegime && (
        <div className="bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 pb-6 border-b border-slate-800/80">
            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-xs text-slate-400 font-mono">
                <span>COMPOSITE REGIME ANALYSIS</span>
                <span>•</span>
                <span>실시간 종합 시장 체제</span>
              </div>
              <div className="flex items-center space-x-3">
                <span className={`inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-base sm:text-lg font-bold border ${macroRegime.regimeBadgeColor}`}>
                  <ShieldCheck className="w-5 h-5" />
                  <span>{macroRegime.regimeLabel}</span>
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  (최종 진단: {new Date(macroRegime.lastUpdated).toLocaleTimeString()})
                </span>
              </div>
              <p className="text-sm text-slate-300 max-w-3xl leading-relaxed">
                {macroRegime.actionableSummary}
              </p>
            </div>

            {/* Guardrail Metrics */}
            <div className="grid grid-cols-2 gap-3 shrink-0 lg:w-72">
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
                <div className="text-[11px] text-slate-400 flex items-center justify-between">
                  <span>포지션 사이징 배수</span>
                  <Activity className="w-3.5 h-3.5 text-cyan-400" />
                </div>
                <div className="text-xl font-bold text-white font-mono mt-1">
                  {(macroRegime.riskMultiplier * 100).toFixed(0)}%
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {macroRegime.riskMultiplier === 1.0 ? '정규 비중 정상 집행' : '변동성 대비 비중 축소'}
                </div>
              </div>

              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
                <div className="text-[11px] text-slate-400 flex items-center justify-between">
                  <span>모멘텀 요구 컷오프</span>
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <div className="text-xl font-bold text-amber-300 font-mono mt-1">
                  +{macroRegime.momentumCutoffBonus}점
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {macroRegime.momentumCutoffBonus === 0 ? '기본 70점 기준 유지' : '보수적 기준 상향 적용'}
                </div>
              </div>
            </div>
          </div>

          {/* 3 Major Macro Gauges */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6">
            {/* VIX */}
            <div className="bg-slate-950/60 border border-slate-800/90 rounded-xl p-4 hover:border-slate-700 transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-300">VIX 공포지수</div>
                    <div className="text-[10px] text-slate-500 font-mono">CBOE Volatility</div>
                  </div>
                </div>
                <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                  {macroRegime.vix.label}
                </span>
              </div>

              <div className="flex items-baseline space-x-2 mt-3">
                <span className="text-2xl font-bold text-white font-mono">
                  {macroRegime.vix.level.toFixed(2)}
                </span>
                <span className={`text-xs font-medium font-mono flex items-center ${
                  macroRegime.vix.change1d < 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {macroRegime.vix.change1d < 0 ? (
                    <ArrowDownRight className="w-3.5 h-3.5" />
                  ) : (
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  )}
                  {macroRegime.vix.change1d > 0 ? '+' : ''}
                  {macroRegime.vix.change1d.toFixed(2)}
                </span>
              </div>

              {/* Gauge Progress */}
              <div className="mt-3">
                <div className="flex justify-between text-[10px] text-slate-500 font-mono mb-1">
                  <span>0 (안정)</span>
                  <span>20 (경계)</span>
                  <span>28+ (패닉)</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden flex">
                  <div className="bg-emerald-500 h-full" style={{ width: '50%' }} />
                  <div className="bg-amber-500 h-full" style={{ width: '20%' }} />
                  <div className="bg-rose-500 h-full" style={{ width: '30%' }} />
                </div>
              </div>

              <p className="text-[11px] text-slate-400 mt-2.5 leading-relaxed">
                {macroRegime.vix.historicalInterpretation}
              </p>
            </div>

            {/* US 10Y Yield */}
            <div className="bg-slate-950/60 border border-slate-800/90 rounded-xl p-4 hover:border-slate-700 transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-300">미국 10년물 국채금리</div>
                    <div className="text-[10px] text-slate-500 font-mono">10Y Treasury Yield</div>
                  </div>
                </div>
                <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                  {macroRegime.us10y.label}
                </span>
              </div>

              <div className="flex items-baseline space-x-2 mt-3">
                <span className="text-2xl font-bold text-white font-mono">
                  {macroRegime.us10y.level.toFixed(2)}%
                </span>
                <span className={`text-xs font-medium font-mono flex items-center ${
                  macroRegime.us10y.change1d > 0 ? 'text-amber-400' : 'text-emerald-400'
                }`}>
                  {macroRegime.us10y.change1d > 0 ? '+' : ''}
                  {macroRegime.us10y.change1d.toFixed(1)} bps
                </span>
              </div>

              {/* Progress */}
              <div className="mt-3">
                <div className="flex justify-between text-[10px] text-slate-500 font-mono mb-1">
                  <span>3.8% (저금리)</span>
                  <span>4.2%~4.4% (박스권)</span>
                  <span>4.6%+ (고금리)</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden flex">
                  <div className="bg-emerald-500 h-full" style={{ width: '35%' }} />
                  <div className="bg-blue-500 h-full" style={{ width: '35%' }} />
                  <div className="bg-rose-500 h-full" style={{ width: '30%' }} />
                </div>
              </div>

              <p className="text-[11px] text-slate-400 mt-2.5 leading-relaxed">
                {macroRegime.us10y.historicalInterpretation}
              </p>
            </div>

            {/* DXY */}
            <div className="bg-slate-950/60 border border-slate-800/90 rounded-xl p-4 hover:border-slate-700 transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400">
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-300">달러 인덱스 (DXY)</div>
                    <div className="text-[10px] text-slate-500 font-mono">US Dollar Index</div>
                  </div>
                </div>
                <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                  {macroRegime.dxy.label}
                </span>
              </div>

              <div className="flex items-baseline space-x-2 mt-3">
                <span className="text-2xl font-bold text-white font-mono">
                  {macroRegime.dxy.level.toFixed(2)}
                </span>
                <span className={`text-xs font-medium font-mono flex items-center ${
                  macroRegime.dxy.change1d > 0 ? 'text-slate-300' : 'text-emerald-400'
                }`}>
                  {macroRegime.dxy.change1d > 0 ? '+' : ''}
                  {macroRegime.dxy.change1d.toFixed(2)}
                </span>
              </div>

              {/* Progress */}
              <div className="mt-3">
                <div className="flex justify-between text-[10px] text-slate-500 font-mono mb-1">
                  <span>100 (약달러)</span>
                  <span>103 (중립)</span>
                  <span>106+ (강달러)</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden flex">
                  <div className="bg-emerald-500 h-full" style={{ width: '30%' }} />
                  <div className="bg-purple-500 h-full" style={{ width: '40%' }} />
                  <div className="bg-rose-500 h-full" style={{ width: '30%' }} />
                </div>
              </div>

              <p className="text-[11px] text-slate-400 mt-2.5 leading-relaxed">
                {macroRegime.dxy.historicalInterpretation}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Earnings Calendar & Risk Guard Section */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg sm:text-xl font-bold text-white">
                워치리스트 실적 발표 캘린더 & 어닝 리스크 가드
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              실적 발표 직전 변동성 폭탄(어닝 겜블)을 방지하기 위해 <b>D-7 이내 종목은 신규 비중을 50% 축소</b>하고 안내 가드를 발동합니다.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <div className="px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs font-semibold text-rose-400 flex items-center space-x-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>D-7 이내 임박: {imminentCount}건</span>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs font-semibold text-amber-400 flex items-center space-x-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>3주 이내 예정: {upcomingCount}건</span>
            </div>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setFilterStage('ALL')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                filterStage === 'ALL'
                  ? 'bg-slate-800 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              전체 일정 ({earningsEvents.length})
            </button>
            <button
              onClick={() => setFilterStage('IMMINENT_DANGER')}
              className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg font-medium transition-all ${
                filterStage === 'IMMINENT_DANGER'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 font-semibold'
                  : 'text-rose-400 hover:bg-slate-900'
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              <span>🚨 어닝 임박 (D-7 이내, {imminentCount})</span>
            </button>
            <button
              onClick={() => setFilterStage('UPCOMING_SOON')}
              className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg font-medium transition-all ${
                filterStage === 'UPCOMING_SOON'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                  : 'text-amber-400 hover:bg-slate-900'
              }`}
            >
              <Clock className="w-3 h-3" />
              <span>⏳ 3주 이내 ({upcomingCount})</span>
            </button>
            <button
              onClick={() => setFilterStage('SAFE')}
              className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg font-medium transition-all ${
                filterStage === 'SAFE'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <CheckCircle2 className="w-3 h-3" />
              <span>✅ 안정권</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="티커 / 종목명 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
            />
          </div>
        </div>

        {/* Earnings Table */}
        <div className="border border-slate-800 rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-medium">
                <th className="py-3 px-4">종목 (Ticker)</th>
                <th className="py-3 px-4">실적 발표일 (KST/EST)</th>
                <th className="py-3 px-4">D-Day 상태</th>
                <th className="py-3 px-4">컨센서스 (예상 EPS / 매출)</th>
                <th className="py-3 px-4">직전 서프라이즈</th>
                <th className="py-3 px-4">퀀트 리스크 가드 조치</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
              {filteredEarnings.map((item) => {
                const isDanger = item.riskStage === 'IMMINENT_DANGER';
                const isUpcoming = item.riskStage === 'UPCOMING_SOON';

                return (
                  <tr
                    key={item.ticker}
                    className={`hover:bg-slate-800/40 transition-colors ${
                      isDanger ? 'bg-rose-500/[0.04]' : ''
                    }`}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => onSelectTicker?.(item.ticker)}
                          className="font-bold font-mono text-cyan-400 hover:text-cyan-300 hover:underline flex items-center space-x-1"
                        >
                          <span>{item.ticker}</span>
                          <ExternalLink className="w-3 h-3 opacity-60" />
                        </button>
                        <span className="text-xs text-slate-400 truncate max-w-[130px]">
                          {item.companyName}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono text-slate-300">
                      <div>{item.earningsDate}</div>
                      <div className="text-[10px] text-slate-500">
                        {item.reportTime === 'AMC'
                          ? '장마감 후 (After Market Close)'
                          : item.reportTime === 'BMO'
                          ? '장시작 전 (Before Market Open)'
                          : '정규장 (During Market)'}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      {isDanger ? (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                          <span>D-{item.daysUntil} (임박 경고)</span>
                        </span>
                      ) : isUpcoming ? (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          <span>D-{item.daysUntil} (시즌 도래)</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span>{item.daysUntil >= 0 ? `D-${item.daysUntil} (안정)` : '최근 완료'}</span>
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 font-mono text-slate-300">
                      {item.estimatedEps !== null ? (
                        <div>
                          <span className="font-semibold text-white">${item.estimatedEps}</span>
                          <span className="text-xs text-slate-400 ml-1.5">/ {item.estimatedRevenue}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">-</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-xs font-mono">
                      <span className={item.lastSurprise?.includes('Beat') ? 'text-emerald-400 font-semibold' : item.lastSurprise?.includes('Miss') ? 'text-rose-400 font-semibold' : 'text-slate-400'}>
                        {item.lastSurprise || 'N/A'}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-start space-x-1.5 text-xs">
                        {isDanger ? (
                          <div className="text-rose-300 font-medium">
                            <span className="inline-block px-1.5 py-0.5 bg-rose-500/20 rounded text-[10px] font-bold border border-rose-500/30 mr-1">
                              비중 50% 캡
                            </span>
                            {item.guardAction}
                          </div>
                        ) : isUpcoming ? (
                          <div className="text-amber-300/90">
                            <span className="inline-block px-1.5 py-0.5 bg-amber-500/20 rounded text-[10px] font-semibold border border-amber-500/30 mr-1">
                              주의 요망
                            </span>
                            {item.guardAction}
                          </div>
                        ) : (
                          <div className="text-slate-400">
                            {item.guardAction}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Strategic Synergy Guide Box */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 sm:p-5 flex items-start space-x-3.5 text-xs sm:text-sm text-slate-400 leading-relaxed">
        <Info className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
        <div className="space-y-1.5">
          <div className="text-slate-200 font-semibold text-sm">
            💡 퀀트 알고리즘과 매크로·어닝 가드의 유기적 연동 원리
          </div>
          <div>
            1. <b>매크로 리스크 연동</b>: VIX가 20 이상으로 상승하거나 10년물 금리가 급등할 경우, 전략 A(모멘텀 돌파)의 최소 기회점수 요구 기준이 <b>+5~10점 상향</b>되며 포지션 제안 비중이 <b>70%~40%로 자동 감축</b>됩니다.
          </div>
          <div>
            2. <b>어닝 가드 연동</b>: 개별 종목의 실적 발표일이 <b>D-7 이내</b>로 진입하면 단기 겜블링 리스크를 차단하기 위해 텔레그램 알림 및 대시보드에서 <b>경고 플래그</b>가 부착되고 Kelly 포지션 크기가 <b>절반(50%)</b>으로 보호 제한됩니다.
          </div>
        </div>
      </div>
    </div>
  );
};
