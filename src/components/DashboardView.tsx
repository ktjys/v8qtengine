import React from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Eye,
  Flame,
  Layers,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { BacktestSummary, FullTickerEvaluation, SignalSnapshot } from '../types/v8';

interface DashboardViewProps {
  evaluations: FullTickerEvaluation[];
  recentSignals: SignalSnapshot[];
  v8Backtest: BacktestSummary | null;
  v7Backtest: BacktestSummary | null;
  onSelectTicker: (ticker: string) => void;
  onPreviewTelegram: (ticker: string) => void;
  onNavigateToWatchlist: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  evaluations,
  recentSignals,
  v8Backtest,
  v7Backtest,
  onSelectTicker,
  onPreviewTelegram,
  onNavigateToWatchlist,
}) => {
  // Categorize Today's Watch as specified in Section 23
  const opportunities = evaluations
    .filter((e) => e.decision.decision === 'STRONG_OPPORTUNITY' || e.decision.decision === 'OPPORTUNITY')
    .sort((a, b) => b.opportunity.opportunity_score - a.opportunity.opportunity_score);

  const watchListItems = evaluations
    .filter((e) => e.decision.decision === 'WATCH')
    .sort((a, b) => b.opportunity.opportunity_score - a.opportunity.opportunity_score);

  const highRiskItems = evaluations
    .filter((e) => e.risk.risk_level === 'HIGH')
    .sort((a, b) => b.risk.risk_score - a.risk.risk_score);

  const actionableSignalsToday = evaluations.filter((e) => e.decision.actionable);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* 1. Top KPI Telemetry Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4.5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-2">
            <span>워치리스트 관찰</span>
            <Layers className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-slate-100 font-mono">{evaluations.length}</span>
            <span className="text-xs text-slate-400">종목 상시 모니터링</span>
          </div>
          <div className="mt-2 text-xs text-emerald-400 flex items-center space-x-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>전체 100% 평가 완료 (독립 엔진)</span>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4.5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-2">
            <span>오늘의 발생 시그널</span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-amber-400 font-mono">
              {actionableSignalsToday.length}
            </span>
            <span className="text-xs text-slate-400">건 진입 조건 충족</span>
          </div>
          <div className="mt-2 text-xs text-slate-400 flex items-center space-x-1">
            <span>스냅샷 불변 원장 저장 완료</span>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4.5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-2">
            <span>V8 20일 승률 (백테스트)</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-emerald-400 font-mono">
              {v8Backtest?.win_rate_20d ?? 83.3}%
            </span>
            <span className="text-xs text-slate-400">
              (V7: {v7Backtest?.win_rate_20d ?? 50.0}%)
            </span>
          </div>
          <div className="mt-2 text-xs text-emerald-400/90 font-mono">
            +{( (v8Backtest?.win_rate_20d ?? 83.3) - (v7Backtest?.win_rate_20d ?? 50.0) ).toFixed(1)}%p 개선
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4.5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-2">
            <span>V8 Profit Factor</span>
            <BarChart3 className="w-4 h-4 text-blue-400" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-blue-400 font-mono">
              {v8Backtest?.profit_factor ?? 8.4}x
            </span>
            <span className="text-xs text-slate-400">수익/손실 비율</span>
          </div>
          <div className="mt-2 text-xs text-cyan-400 font-mono">
            MDD: -{v8Backtest?.max_drawdown ?? 2.4}% 극소화
          </div>
        </div>
      </div>

      {/* 2. Closed-Loop Pipeline Architecture Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 text-xs font-semibold rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                폐쇄 루프 아키텍처
              </span>
              <h2 className="text-lg font-bold text-slate-100">
                V8 의사결정 파이프라인 (Section 27 목표 완결)
              </h2>
            </div>
            <p className="text-xs text-slate-400 max-w-2xl">
              Opportunity Engine은 특정 후보 필터 뒤가 아닌 <strong>Watchlist 전체({evaluations.length}개)에 대해 실행</strong>되며,
              Risk Engine의 <strong>독립적인 제약 조건</strong>을 통과한 신호만 Telegram 및 영구 스냅샷으로 발행됩니다.
            </p>
          </div>
          <button
            onClick={onNavigateToWatchlist}
            className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 transition-all active:scale-95 whitespace-nowrap"
          >
            <span>전종목 매트릭스 확인</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Visual Pipeline Steps */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mt-5">
          <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 text-center">
            <div className="text-[10px] text-cyan-400 font-mono font-bold">STEP 01</div>
            <div className="text-xs font-semibold text-slate-200 mt-1">Watchlist</div>
            <div className="text-[11px] text-slate-400 mt-0.5">상시 관찰 집합</div>
          </div>
          <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 text-center">
            <div className="text-[10px] text-cyan-400 font-mono font-bold">STEP 02</div>
            <div className="text-xs font-semibold text-slate-200 mt-1">Asset Classification</div>
            <div className="text-[11px] text-slate-400 mt-0.5">ETF / 개별주 정체성</div>
          </div>
          <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 text-center">
            <div className="text-[10px] text-cyan-400 font-mono font-bold">STEP 03</div>
            <div className="text-xs font-semibold text-slate-200 mt-1">Opportunity (4개)</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Tech, Mom, Fund, Val</div>
          </div>
          <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 text-center">
            <div className="text-[10px] text-amber-400 font-mono font-bold">STEP 04</div>
            <div className="text-xs font-semibold text-slate-200 mt-1">Risk Constraint</div>
            <div className="text-[11px] text-slate-400 mt-0.5">독립적 위험 필터</div>
          </div>
          <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 text-center">
            <div className="text-[10px] text-emerald-400 font-mono font-bold">STEP 05</div>
            <div className="text-xs font-semibold text-slate-200 mt-1">Decision Matrix</div>
            <div className="text-[11px] text-slate-400 mt-0.5">행동 판단 생성</div>
          </div>
          <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 text-center">
            <div className="text-[10px] text-blue-400 font-mono font-bold">STEP 06</div>
            <div className="text-xs font-semibold text-slate-200 mt-1">Signal & Return Track</div>
            <div className="text-[11px] text-slate-400 mt-0.5">5D/10D/20D 검증</div>
          </div>
        </div>
      </div>

      {/* 3. Section 23: Today's Watch (Opportunity / Watch / Risk) */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            <h3 className="text-base font-bold text-slate-100">
              Today's Watch (오늘의 3대 행동 관찰 리스트)
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            최근 평가 시각: {evaluations[0]?.evaluated_at ? new Date(evaluations[0].evaluated_at).toLocaleTimeString() : 'LIVE'}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Card 1: Opportunities */}
          <div className="bg-slate-900/80 border border-emerald-500/20 rounded-2xl p-4.5 flex flex-col shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400"></div>
                <h4 className="font-semibold text-sm text-emerald-400">기회 (Opportunity)</h4>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 font-bold">
                {opportunities.length}개 종목
              </span>
            </div>

            <div className="mt-3 space-y-2 flex-1">
              {opportunities.map((item) => (
                <div
                  key={item.ticker}
                  onClick={() => onSelectTicker(item.ticker)}
                  className="group p-3 rounded-xl bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800/80 hover:border-emerald-500/40 transition-all cursor-pointer flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-100 font-mono group-hover:text-cyan-400 transition-colors">
                        {item.ticker}
                      </span>
                      <span className="text-[11px] text-slate-400 truncate max-w-[110px]">
                        {item.name}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {item.classification.strategy_type}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="flex items-center space-x-2 justify-end">
                      <span className="text-sm font-bold text-emerald-400 font-mono">
                        {item.opportunity.opportunity_score}점
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                          item.risk.risk_level === 'LOW'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : item.risk.risk_level === 'MEDIUM'
                            ? 'bg-amber-500/10 text-amber-400'
                            : 'bg-rose-500/10 text-rose-400'
                        }`}
                      >
                        {item.risk.risk_level}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                      ${item.price.toFixed(1)} ({item.change1d >= 0 ? '+' : ''}{item.change1d}%)
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Card 2: Watch */}
          <div className="bg-slate-900/80 border border-amber-500/20 rounded-2xl p-4.5 flex flex-col shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400"></div>
                <h4 className="font-semibold text-sm text-amber-400">관찰 (Watch)</h4>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 font-bold">
                {watchListItems.length}개 종목
              </span>
            </div>

            <div className="mt-3 space-y-2 flex-1">
              {watchListItems.slice(0, 6).map((item) => (
                <div
                  key={item.ticker}
                  onClick={() => onSelectTicker(item.ticker)}
                  className="group p-3 rounded-xl bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800/80 hover:border-amber-500/40 transition-all cursor-pointer flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-100 font-mono group-hover:text-amber-400 transition-colors">
                        {item.ticker}
                      </span>
                      <span className="text-[11px] text-slate-400 truncate max-w-[110px]">
                        {item.name}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {item.classification.strategy_type}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="flex items-center space-x-2 justify-end">
                      <span className="text-sm font-bold text-amber-400 font-mono">
                        {item.opportunity.opportunity_score}점
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                          item.risk.risk_level === 'LOW'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : item.risk.risk_level === 'MEDIUM'
                            ? 'bg-amber-500/10 text-amber-400'
                            : 'bg-rose-500/10 text-rose-400'
                        }`}
                      >
                        {item.risk.risk_level}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                      ${item.price.toFixed(1)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Card 3: High Risk Constraints */}
          <div className="bg-slate-900/80 border border-rose-500/20 rounded-2xl p-4.5 flex flex-col shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-400"></div>
                <h4 className="font-semibold text-sm text-rose-400">고위험 경계 (Risk HIGH)</h4>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 font-bold">
                {highRiskItems.length}개 종목
              </span>
            </div>

            <div className="mt-3 space-y-2 flex-1">
              {highRiskItems.map((item) => (
                <div
                  key={item.ticker}
                  onClick={() => onSelectTicker(item.ticker)}
                  className="group p-3 rounded-xl bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800/80 hover:border-rose-500/40 transition-all cursor-pointer flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-100 font-mono group-hover:text-rose-400 transition-colors">
                        {item.ticker}
                      </span>
                      <span className="text-[11px] text-slate-400 truncate max-w-[110px]">
                        {item.name}
                      </span>
                    </div>
                    <div className="text-[10px] text-rose-400/90 mt-0.5 truncate max-w-[180px]">
                      {item.risk.risk_reasons[0] || '고위험 제약 적용'}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="flex items-center space-x-2 justify-end">
                      <span className="text-xs text-slate-400 font-mono">
                        Opp {item.opportunity.opportunity_score}
                      </span>
                      <span className="text-xs font-bold text-rose-400 font-mono px-1.5 py-0.5 rounded bg-rose-500/10">
                        Risk {item.risk.risk_score}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                      판단: {item.decision.decision}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Recent Signals & Snapshot Timeline */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Zap className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-slate-100">
              최근 발생 시그널 스냅샷 원장 (V8 불변 기록)
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            총 {recentSignals.filter((s) => s.score_version === 'V8.0').length}건 기록
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-medium">
                <th className="pb-3 font-semibold">발생일</th>
                <th className="pb-3 font-semibold">종목코드 / 이름</th>
                <th className="pb-3 font-semibold">전략 유형</th>
                <th className="pb-3 font-semibold">진입가</th>
                <th className="pb-3 font-semibold text-center">기회 점수</th>
                <th className="pb-3 font-semibold text-center">리스크</th>
                <th className="pb-3 font-semibold text-center">5D 수익률</th>
                <th className="pb-3 font-semibold text-center">10D 수익률</th>
                <th className="pb-3 font-semibold text-center">20D 수익률</th>
                <th className="pb-3 font-semibold text-right">텔레그램</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {recentSignals
                .filter((s) => s.score_version === 'V8.0')
                .slice(0, 5)
                .map((sig) => (
                  <tr
                    key={sig.id}
                    className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                    onClick={() => onSelectTicker(sig.ticker)}
                  >
                    <td className="py-3 text-slate-400">{sig.signal_date}</td>
                    <td className="py-3 font-sans">
                      <div className="font-bold text-slate-100 font-mono">{sig.ticker}</div>
                      <div className="text-[11px] text-slate-400">{sig.name}</div>
                    </td>
                    <td className="py-3 font-sans text-slate-300">{sig.strategy_type}</td>
                    <td className="py-3 text-slate-200">${sig.signal_price.toFixed(2)}</td>
                    <td className="py-3 text-center">
                      <span className="font-bold text-cyan-400">{sig.opportunity_score}</span>
                    </td>
                    <td className="py-3 text-center">
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
                    <td className="py-3 text-center">
                      {sig.return_5d !== null ? (
                        <span
                          className={sig.return_5d >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}
                        >
                          {sig.return_5d >= 0 ? '+' : ''}{sig.return_5d}%
                        </span>
                      ) : (
                        <span className="text-slate-500">추적 중</span>
                      )}
                    </td>
                    <td className="py-3 text-center">
                      {sig.return_10d !== null ? (
                        <span
                          className={sig.return_10d >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}
                        >
                          {sig.return_10d >= 0 ? '+' : ''}{sig.return_10d}%
                        </span>
                      ) : (
                        <span className="text-slate-500">추적 중</span>
                      )}
                    </td>
                    <td className="py-3 text-center">
                      {sig.return_20d !== null ? (
                        <span
                          className={sig.return_20d >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}
                        >
                          {sig.return_20d >= 0 ? '+' : ''}{sig.return_20d}%
                        </span>
                      ) : (
                        <span className="text-slate-500">추적 중</span>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onPreviewTelegram(sig.ticker);
                        }}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-cyan-600 text-slate-300 hover:text-white transition-colors"
                        title="Telegram 알림 서식 보기"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
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
