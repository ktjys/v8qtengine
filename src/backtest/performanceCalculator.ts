import { BacktestSummary, RiskLevel } from '../types/v8';
import { SimulatedTradeSignal } from './backtestTypes';

export interface BreakdownSignal {
  return20d: number | null;
  strategy: string;
  riskLevel: RiskLevel;
  opportunityScore: number;
}

export interface BreakdownGroup {
  count: number;
  win_rate_20d: number;
  avg_return_20d: number;
}

const OPPORTUNITY_BUCKETS = [
  { label: '65 - 74 (Moderate)', min: 65, max: 74.9 },
  { label: '75 - 84 (High)', min: 75, max: 84.9 },
  { label: '85+ (Exceptional)', min: 85, max: 100 },
];

function groupStats(
  signals: BreakdownSignal[],
  predicate: (s: BreakdownSignal) => boolean
): BreakdownGroup | null {
  const grp = signals.filter(predicate);
  if (grp.length === 0) return null;
  const wins = grp.filter((s) => (s.return20d ?? 0) > 0).length;
  const avg = grp.reduce((sum, s) => sum + (s.return20d ?? 0), 0) / grp.length;
  return {
    count: grp.length,
    win_rate_20d: Math.round((wins / grp.length) * 1000) / 10,
    avg_return_20d: Math.round(avg * 10) / 10,
  };
}

export function computeBreakdowns(completed: BreakdownSignal[]): {
  by_strategy: Record<string, BreakdownGroup>;
  by_risk: Record<RiskLevel, BreakdownGroup>;
  by_opportunity_bucket: Record<string, BreakdownGroup>;
} {
  const by_strategy: Record<string, BreakdownGroup> = {};
  const strategyGroups: Record<string, BreakdownSignal[]> = {};
  for (const s of completed) {
    const strat = s.strategy || 'general_equity';
    if (!strategyGroups[strat]) strategyGroups[strat] = [];
    strategyGroups[strat].push(s);
  }
  for (const strat of Object.keys(strategyGroups)) {
    const stats = groupStats(strategyGroups[strat], () => true);
    if (stats) by_strategy[strat] = stats;
  }

  const by_risk: Record<RiskLevel, BreakdownGroup> = {
    LOW: { count: 0, win_rate_20d: 0, avg_return_20d: 0 },
    MEDIUM: { count: 0, win_rate_20d: 0, avg_return_20d: 0 },
    HIGH: { count: 0, win_rate_20d: 0, avg_return_20d: 0 },
  };
  (['LOW', 'MEDIUM', 'HIGH'] as RiskLevel[]).forEach((lvl) => {
    const stats = groupStats(completed, (s) => s.riskLevel === lvl);
    if (stats) by_risk[lvl] = stats;
  });

  const by_opportunity_bucket: Record<string, BreakdownGroup> = {};
  OPPORTUNITY_BUCKETS.forEach((b) => {
    const stats = groupStats(
      completed,
      (s) => s.opportunityScore >= b.min && s.opportunityScore <= b.max
    );
    if (stats) by_opportunity_bucket[b.label] = stats;
  });

  return { by_strategy, by_risk, by_opportunity_bucket };
}

export function calculateReplayPerformance(
  signals: SimulatedTradeSignal[]
): BacktestSummary {
  const total = signals.length;

  if (total === 0) {
    return {
      total_signals: 0,
      completed_signals: 0,
      win_rate_5d: 0,
      win_rate_10d: 0,
      win_rate_20d: 0,
      avg_return_5d: 0,
      avg_return_10d: 0,
      avg_return_20d: 0,
      median_return_20d: 0,
      completed_signals_60d: 0,
      win_rate_60d: 0,
      avg_return_60d: 0,
      completed_signals_120d: 0,
      win_rate_120d: 0,
      avg_return_120d: 0,
      completed_signals_252d: 0,
      win_rate_252d: 0,
      avg_return_252d: 0,
      max_drawdown: 0,
      profit_factor: 0,
      expectancy: 0,
      by_strategy: {},
      by_risk: {
        LOW: { count: 0, win_rate_20d: 0, avg_return_20d: 0 },
        MEDIUM: { count: 0, win_rate_20d: 0, avg_return_20d: 0 },
        HIGH: { count: 0, win_rate_20d: 0, avg_return_20d: 0 },
      },
      by_opportunity_bucket: {},
    };
  }

  const completed = signals.filter((s) => s.return20d !== undefined && s.return20d !== null);
  const nCompleted = completed.length || 1;

  const sig5d = signals.filter((s) => s.return5d !== undefined && s.return5d !== null);
  const win5d = sig5d.filter((s) => (s.return5d ?? 0) > 0).length;
  const avg5d = sig5d.reduce((sum, s) => sum + (s.return5d ?? 0), 0) / (sig5d.length || 1);

  const sig10d = signals.filter((s) => s.return10d !== undefined && s.return10d !== null);
  const win10d = sig10d.filter((s) => (s.return10d ?? 0) > 0).length;
  const avg10d = sig10d.reduce((sum, s) => sum + (s.return10d ?? 0), 0) / (sig10d.length || 1);

  const win20d = completed.filter((s) => (s.return20d ?? 0) > 0).length;
  const avg20d = completed.reduce((sum, s) => sum + (s.return20d ?? 0), 0) / nCompleted;

  // 장기 투자 지평 (60/120/252 거래일): 시그널당 전개가 길어 샘플 수가 급감하므로
  // 각자 완료된 시그널 수를 별도로 보고한다 (샘플이 적으면 신뢰도 낮음).
  const longStats = (field: 'return60d' | 'return120d' | 'return252d') => {
    const subset = signals.filter((s) => s[field] !== undefined && s[field] !== null);
    const count = subset.length;
    const wins = subset.filter((s) => (s[field] ?? 0) > 0).length;
    const avg = count > 0 ? subset.reduce((sum, s) => sum + (s[field] ?? 0), 0) / count : 0;
    return {
      count,
      winRate: count > 0 ? Math.round((wins / count) * 1000) / 10 : 0,
      avg: Math.round(avg * 10) / 10,
    };
  };
  const s60 = longStats('return60d');
  const s120 = longStats('return120d');
  const s252 = longStats('return252d');

  // Portfolio 사이징 가중 성과: positionSizePct(제안 비중)로 가중한 20d 수익률.
  // positionSizePct와 return20d가 모두 있는 completed 시그널만 대상.
  // 사이징 적용 성과(weighted)를 동일 셋 등가중(equal_weight)과 비교해 검증한다.
  const sizedSignals = completed.filter(
    (s) => s.positionSizePct !== undefined && s.return20d !== null && s.return20d !== undefined
  );
  const sizedN = sizedSignals.length;
  let weightedAvg20d: number | undefined;
  let equalWeightAvg20d: number | undefined;
  if (sizedN > 0) {
    const totalWeight = sizedSignals.reduce((sum, s) => sum + (s.positionSizePct ?? 0), 0);
    if (totalWeight > 0) {
      weightedAvg20d =
        sizedSignals.reduce((sum, s) => sum + (s.positionSizePct ?? 0) * (s.return20d ?? 0), 0) /
        totalWeight;
    }
    equalWeightAvg20d = sizedSignals.reduce((sum, s) => sum + (s.return20d ?? 0), 0) / sizedN;
  }

  const sorted20d = completed.map((s) => s.return20d ?? 0).sort((a, b) => a - b);
  // 중앙값: 짝수 개면 중앙 두 값의 평균 (표준 정의)
  const mid = Math.floor(sorted20d.length / 2);
  const median20d =
    sorted20d.length > 0
      ? sorted20d.length % 2 === 0
        ? (sorted20d[mid - 1] + sorted20d[mid]) / 2
        : sorted20d[mid]
      : 0;

  // Max Adverse Excursion (단일 트레이드 최대 불리한 일탈). Portfolio MDD 아님.
  const drawdowns = completed.map((s) => s.maxAdverseExcursionTrade ?? 0);
  const minDd = drawdowns.length > 0 ? Math.min(...drawdowns) : 0;
  const max_drawdown = Math.abs(minDd);

  // Profit Factor
  const profits = completed
    .filter((s) => (s.return20d ?? 0) > 0)
    .reduce((sum, s) => sum + (s.return20d ?? 0), 0);
  const losses = Math.abs(
    completed
      .filter((s) => (s.return20d ?? 0) < 0)
      .reduce((sum, s) => sum + (s.return20d ?? 0), 0)
  );
  const profit_factor = losses > 0 ? Math.round((profits / losses) * 100) / 100 : profits > 0 ? 99 : 1.0;

  // Expectancy (WinRate * AvgWin - LossRate * AvgLoss)
  const winningTrades = completed.filter((s) => (s.return20d ?? 0) > 0);
  const losingTrades = completed.filter((s) => (s.return20d ?? 0) < 0);
  const avgWin = winningTrades.length > 0 ? profits / winningTrades.length : 0;
  const avgLoss = losingTrades.length > 0 ? losses / losingTrades.length : 0;
  const winRate = completed.length > 0 ? win20d / completed.length : 0;
  const lossRate = 1 - winRate;
  const expectancy = Math.round((winRate * avgWin - lossRate * avgLoss) * 100) / 100;

  const { by_strategy, by_risk, by_opportunity_bucket } = computeBreakdowns(
    completed.map((s) => ({
      return20d: s.return20d ?? null,
      strategy: s.strategyType,
      riskLevel: s.riskLevel,
      opportunityScore: s.opportunityScore,
    }))
  );

  return {
    total_signals: total,
    completed_signals: completed.length,
    win_rate_5d: Math.round((win5d / (sig5d.length || 1)) * 1000) / 10,
    win_rate_10d: Math.round((win10d / (sig10d.length || 1)) * 1000) / 10,
    win_rate_20d: Math.round((win20d / nCompleted) * 1000) / 10,
    avg_return_5d: Math.round(avg5d * 10) / 10,
    avg_return_10d: Math.round(avg10d * 10) / 10,
    avg_return_20d: Math.round(avg20d * 10) / 10,
    median_return_20d: Math.round(median20d * 10) / 10,
    completed_signals_60d: s60.count,
    win_rate_60d: s60.winRate,
    avg_return_60d: s60.avg,
    completed_signals_120d: s120.count,
    win_rate_120d: s120.winRate,
    avg_return_120d: s120.avg,
    completed_signals_252d: s252.count,
    win_rate_252d: s252.winRate,
    avg_return_252d: s252.avg,
    weighted_avg_return_20d:
      weightedAvg20d !== undefined ? Math.round(weightedAvg20d * 100) / 100 : undefined,
    equal_weight_avg_return_20d:
      equalWeightAvg20d !== undefined ? Math.round(equalWeightAvg20d * 100) / 100 : undefined,
    weighted_monitor_count: sizedN > 0 ? sizedN : undefined,
    max_drawdown: Math.round(max_drawdown * 10) / 10,
    profit_factor,
    expectancy,
    by_strategy,
    by_risk,
    by_opportunity_bucket,
  };
}
