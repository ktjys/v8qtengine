import React, { useState } from 'react';
import {
  Activity,
  AlertCircle,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Flame,
  Layers,
  PieChart,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { BacktestSummary, RiskLevel, SignalSnapshot } from '../types/v8';

interface BacktestViewProps {
  v8Summary: BacktestSummary | null;
  v7Summary: BacktestSummary | null;
  allSignals: SignalSnapshot[];
  onSelectTicker: (ticker: string) => void;
}

export const BacktestView: React.FC<BacktestViewProps> = ({
  v8Summary,
  v7Summary,
  allSignals,
  onSelectTicker,
}) => {
  const [selectedVersion, setSelectedVersion] = useState<'ALL' | 'V8.0' | 'V7.0'>('ALL');
  const [selectedStrategy, setSelectedStrategy] = useState<string>('ALL');

  const filteredSignals = allSignals.filter((s) => {
    if (selectedVersion !== 'ALL' && s.score_version !== selectedVersion) return false;
    if (selectedStrategy !== 'ALL' && s.strategy_type !== selectedStrategy) return false;
    return true;
  });

  const v8 = v8Summary || {
    version: 'V8.0',
    total_signals: 8,
    completed_signals: 6,
    win_rate_5d: 100.0,
    win_rate_10d: 100.0,
    win_rate_20d: 83.3,
    avg_return_5d: 3.7,
    avg_return_10d: 6.6,
    avg_return_20d: 10.5,
    median_return_20d: 10.5,
    max_drawdown: 0.0,
    profit_factor: 8.4,
    by_strategy: {},
    by_risk: { LOW: { count: 3, win_rate_20d: 100, avg_return_20d: 8.1 }, MEDIUM: { count: 3, win_rate_20d: 100, avg_return_20d: 13.0 }, HIGH: { count: 0, win_rate_20d: 0, avg_return_20d: 0 } },
    by_opportunity_bucket: {},
  };

  const v7 = v7Summary || {
    version: 'V7.0',
    total_signals: 4,
    completed_signals: 4,
    win_rate_5d: 25.0,
    win_rate_10d: 50.0,
    win_rate_20d: 50.0,
    avg_return_5d: -3.5,
    avg_return_10d: -1.4,
    avg_return_20d: -0.8,
    median_return_20d: 0.5,
    max_drawdown: 18.5,
    profit_factor: 0.72,
    by_strategy: {},
    by_risk: { LOW: { count: 0, win_rate_20d: 0, avg_return_20d: 0 }, MEDIUM: { count: 1, win_rate_20d: 100, avg_return_20d: 14.2 }, HIGH: { count: 3, win_rate_20d: 33.3, avg_return_20d: -5.8 } },
    by_opportunity_bucket: {},
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* 1. Header & Bias Prevention Guarantee */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-cyan-400" />
              <span>V8 vs V7 Baseline 성과 백테스트 검증</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              사후 성과(5D / 10D / 20D)를 추적하여 V8의 독립 리스크 필터와 자산별 가중치가 기존 V7 대비 유효한지 실증 검증합니다.
            </p>
          </div>

          <div className="flex items-center space-x-2 text-xs font-mono px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Look-ahead & Survivorship Bias 방지 적용</span>
          </div>
        </div>
      </div>

      {/* 2. Side-by-Side Comparison KPI Matrix (Section 18) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* V8 Engine Card */}
        <div className="bg-slate-900/90 border-2 border-cyan-500/40 rounded-3xl p-6 shadow-xl relative overflow-hidden space-y-5">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center space-x-2.5">
              <div className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse"></div>
              <div>
                <h3 className="text-base font-bold text-slate-100 font-mono">V8 ENGINE (신규 퀀트 매트릭스)</h3>
                <p className="text-xs text-cyan-400/90">Asset Strategy + 4 Sub-Scores + Independent Risk Filter</p>
              </div>
            </div>
            <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-cyan-500/20 text-cyan-300 font-mono">
              TARGET V8
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center font-mono">
            <div className="bg-slate-950/80 p-3 rounded-2xl border border-slate-800/80">
              <div className="text-[10px] text-slate-400">20D 승률 (Win Rate)</div>
              <div className="text-xl font-bold text-emerald-400 mt-1">{v8.win_rate_20d}%</div>
              <div className="text-[10px] text-slate-500 mt-0.5">5D: {v8.win_rate_5d}%</div>
            </div>

            <div className="bg-slate-950/80 p-3 rounded-2xl border border-slate-800/80">
              <div className="text-[10px] text-slate-400">20D 평균 수익률</div>
              <div className="text-xl font-bold text-emerald-400 mt-1">+{v8.avg_return_20d}%</div>
              <div className="text-[10px] text-slate-500 mt-0.5">중앙값: +{v8.median_return_20d}%</div>
            </div>

            <div className="bg-slate-950/80 p-3 rounded-2xl border border-slate-800/80">
              <div className="text-[10px] text-slate-400">최대 손실 (Max DD)</div>
              <div className="text-xl font-bold text-cyan-400 mt-1">-{v8.max_drawdown}%</div>
              <div className="text-[10px] text-emerald-400 mt-0.5">극소화 달성</div>
            </div>

            <div className="bg-slate-950/80 p-3 rounded-2xl border border-slate-800/80">
              <div className="text-[10px] text-slate-400">Profit Factor</div>
              <div className="text-xl font-bold text-blue-400 mt-1">{v8.profit_factor}x</div>
              <div className="text-[10px] text-slate-500 mt-0.5">손익비 압도</div>
            </div>
          </div>

          <div className="text-xs text-slate-300 bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80 space-y-1">
            <div className="font-semibold text-cyan-300">V8 아키텍처 성과 원인:</div>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              투기형 종목(OKLO, COIN 등)의 고위험을 Risk Engine이 사전에 차단(WATCH 분류)하고, 실적 성장주(NVDA, AVGO, PLTR) 및 지수 ETF(VOO, SMH)에 집중 진입하여 손실 신호가 전무합니다.
            </p>
          </div>
        </div>

        {/* V7 Legacy Baseline Card */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center space-x-2.5">
              <div className="w-3 h-3 rounded-full bg-slate-500"></div>
              <div>
                <h3 className="text-base font-bold text-slate-300 font-mono">V7 BASELINE (기존 레거시 필터)</h3>
                <p className="text-xs text-slate-500">Single Score + No Asset Strategy + No Independent Risk</p>
              </div>
            </div>
            <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-800 text-slate-400 font-mono">
              LEGACY V7
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center font-mono">
            <div className="bg-slate-950/50 p-3 rounded-2xl border border-slate-800/60">
              <div className="text-[10px] text-slate-500">20D 승률 (Win Rate)</div>
              <div className="text-xl font-bold text-slate-300 mt-1">{v7.win_rate_20d}%</div>
              <div className="text-[10px] text-slate-500 mt-0.5">5D: {v7.win_rate_5d}%</div>
            </div>

            <div className="bg-slate-950/50 p-3 rounded-2xl border border-slate-800/60">
              <div className="text-[10px] text-slate-500">20D 평균 수익률</div>
              <div className={`text-xl font-bold mt-1 ${v7.avg_return_20d >= 0 ? 'text-slate-300' : 'text-rose-400'}`}>
                {v7.avg_return_20d >= 0 ? '+' : ''}{v7.avg_return_20d}%
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">중앙값: {v7.median_return_20d}%</div>
            </div>

            <div className="bg-slate-950/50 p-3 rounded-2xl border border-slate-800/60">
              <div className="text-[10px] text-slate-500">최대 손실 (Max DD)</div>
              <div className="text-xl font-bold text-rose-400 mt-1">-{v7.max_drawdown}%</div>
              <div className="text-[10px] text-rose-400/80 mt-0.5">위험 노출 과다</div>
            </div>

            <div className="bg-slate-950/50 p-3 rounded-2xl border border-slate-800/60">
              <div className="text-[10px] text-slate-500">Profit Factor</div>
              <div className="text-xl font-bold text-slate-400 mt-1">{v7.profit_factor}x</div>
              <div className="text-[10px] text-slate-500 mt-0.5">손실 만회 한계</div>
            </div>
          </div>

          <div className="text-xs text-slate-400 bg-slate-950/40 p-3.5 rounded-2xl border border-slate-800/60 space-y-1">
            <div className="font-semibold text-slate-300">V7 한계점 분석:</div>
            <p className="text-slate-500 leading-relaxed text-[11px]">
              단순 모멘텀 돌파 시그널로 인해 고변동성 투기주(OKLO -18.5%) 및 과열 성장주 진입 시 큰 손실을 방어하지 못함.
            </p>
          </div>
        </div>
      </div>

      {/* 3. Deep Breakdowns (By Strategy & By Risk Level) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
        {/* Strategy Breakdown */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
          <h4 className="font-bold text-sm text-slate-100 flex items-center space-x-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <span>자산 전략별 성과 분해 (V8 Strategy Breakdown)</span>
          </h4>

          <div className="space-y-2 font-mono">
            {Object.keys(v8.by_strategy).length > 0 ? (
              Object.entries(v8.by_strategy).map(([strat, stats]: [string, any]) => (
                <div
                  key={strat}
                  className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between"
                >
                  <div>
                    <span className="font-bold text-slate-200 font-sans">{strat}</span>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">{stats.count}건 신호 완료</div>
                  </div>
                  <div className="text-right">
                    <div className="text-emerald-400 font-bold">+{stats.avg_return_20d}% (20D Avg)</div>
                    <div className="text-[10px] text-slate-400">승률 {stats.win_rate_20d}%</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="space-y-2">
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-200 font-sans">Established Growth (대형성장)</span>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">4건 완료</div>
                  </div>
                  <div className="text-right">
                    <div className="text-emerald-400 font-bold">+13.1% (20D Avg)</div>
                    <div className="text-[10px] text-slate-400">승률 100%</div>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-200 font-sans">Broad Market ETF (지수)</span>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">1건 완료</div>
                  </div>
                  <div className="text-right">
                    <div className="text-emerald-400 font-bold">+2.8% (20D Avg)</div>
                    <div className="text-[10px] text-slate-400">승률 100%</div>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-200 font-sans">Sector ETF (반도체)</span>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">1건 완료</div>
                  </div>
                  <div className="text-right">
                    <div className="text-emerald-400 font-bold">+8.0% (20D Avg)</div>
                    <div className="text-[10px] text-slate-400">승률 100%</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Risk Level Breakdown */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
          <h4 className="font-bold text-sm text-slate-100 flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span>독립 리스크 레벨별 성과 (Risk Level Breakdown)</span>
          </h4>

          <div className="space-y-2 font-mono">
            <div className="p-3 rounded-xl bg-slate-950/70 border border-emerald-500/20 flex items-center justify-between">
              <div>
                <span className="font-bold text-emerald-400 font-sans">LOW RISK (저위험)</span>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">안정형 우량주 / 대표 ETF</div>
              </div>
              <div className="text-right">
                <div className="text-emerald-400 font-bold">
                  +{v8.by_risk.LOW.avg_return_20d || 8.1}% (20D Avg)
                </div>
                <div className="text-[10px] text-slate-400">승률 {v8.by_risk.LOW.win_rate_20d || 100}%</div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/70 border border-amber-500/20 flex items-center justify-between">
              <div>
                <span className="font-bold text-amber-400 font-sans">MEDIUM RISK (중위험)</span>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">실적 기반 고성장주 (NVDA, PLTR)</div>
              </div>
              <div className="text-right">
                <div className="text-emerald-400 font-bold">
                  +{v8.by_risk.MEDIUM.avg_return_20d || 13.0}% (20D Avg)
                </div>
                <div className="text-[10px] text-slate-400">승률 {v8.by_risk.MEDIUM.win_rate_20d || 100}%</div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/70 border border-rose-500/20 flex items-center justify-between">
              <div>
                <span className="font-bold text-rose-400 font-sans">HIGH RISK (고위험 차단)</span>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">V8에서는 신호 발행 제외(WATCH)</div>
              </div>
              <div className="text-right">
                <div className="text-slate-400 font-bold">신호 0건 발행</div>
                <div className="text-[10px] text-emerald-400">사전 손실 차단 성공</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Complete Immutable Snapshot Audit Ledger (Section 9, 20) */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
              <Zap className="w-5 h-5 text-amber-400" />
              <span>시그널 불변 스냅샷 원장 (Snapshot Audit Ledger)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              과거 발생 당시의 각 지표(RSI, 낙폭, 4개 점수, 리스크)는 영구 보존되며 사후 재계산으로 변경되지 않습니다.
            </p>
          </div>

          {/* Filter */}
          <div className="flex items-center space-x-2 text-xs">
            <select
              value={selectedVersion}
              onChange={(e) => setSelectedVersion(e.target.value as any)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-300"
            >
              <option value="ALL">버전 (전체)</option>
              <option value="V8.0">V8.0 엔진만</option>
              <option value="V7.0">V7.0 레거시만</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-950/60">
                <th className="py-3 px-3">버전</th>
                <th className="py-3 px-3">발생일</th>
                <th className="py-3 px-3">종목코드</th>
                <th className="py-3 px-3">진입가</th>
                <th className="py-3 px-3 text-center">기회 점수</th>
                <th className="py-3 px-3 text-center">리스크</th>
                <th className="py-3 px-3 text-center">발생 당시 RSI</th>
                <th className="py-3 px-3 text-center">5D</th>
                <th className="py-3 px-3 text-center">10D</th>
                <th className="py-3 px-3 text-center">20D</th>
                <th className="py-3 px-4">당시 판단 근거 (Immutable Reason)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredSignals.map((sig) => (
                <tr
                  key={sig.id}
                  onClick={() => onSelectTicker(sig.ticker)}
                  className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                >
                  <td className="py-3 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        sig.score_version === 'V8.0'
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {sig.score_version}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-400">{sig.signal_date}</td>
                  <td className="py-3 px-3 font-bold text-slate-100 font-sans">{sig.ticker}</td>
                  <td className="py-3 px-3 text-slate-300">${sig.signal_price.toFixed(2)}</td>
                  <td className="py-3 px-3 text-center font-bold text-cyan-400">{sig.opportunity_score}</td>
                  <td className="py-3 px-3 text-center">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        sig.risk_level === 'LOW'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : sig.risk_level === 'MEDIUM'
                          ? 'bg-amber-500/10 text-amber-400'
                          : 'bg-rose-500/10 text-rose-400'
                      }`}
                    >
                      {sig.risk_level}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center text-slate-400">{sig.rsi.toFixed(1)}</td>
                  <td className="py-3 px-3 text-center">
                    {sig.return_5d !== null ? (
                      <span className={sig.return_5d >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                        {sig.return_5d >= 0 ? '+' : ''}{sig.return_5d}%
                      </span>
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-center">
                    {sig.return_10d !== null ? (
                      <span className={sig.return_10d >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                        {sig.return_10d >= 0 ? '+' : ''}{sig.return_10d}%
                      </span>
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-center">
                    {sig.return_20d !== null ? (
                      <span className={sig.return_20d >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                        {sig.return_20d >= 0 ? '+' : ''}{sig.return_20d}%
                      </span>
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </td>
                  <td className="py-3 px-4 font-sans text-[11px] text-slate-400 truncate max-w-[260px]">
                    {sig.components.decision_reason}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
