import { BacktestSummary, RiskLevel, SignalSnapshot } from '../types/v8';

export function calculateBacktestMetrics(
  signals: SignalSnapshot[],
  version: 'V8.0' | 'V7.0'
): BacktestSummary {
  const versionSignals = signals.filter((s) => s.score_version === version);
  const total = versionSignals.length;

  if (total === 0) {
    return {
      version,
      total_signals: 0,
      completed_signals: 0,
      win_rate_5d: 0,
      win_rate_10d: 0,
      win_rate_20d: 0,
      avg_return_5d: 0,
      avg_return_10d: 0,
      avg_return_20d: 0,
      median_return_20d: 0,
      max_drawdown: 0,
      profit_factor: 0,
      by_strategy: {},
      by_risk: { LOW: { count: 0, win_rate_20d: 0, avg_return_20d: 0 }, MEDIUM: { count: 0, win_rate_20d: 0, avg_return_20d: 0 }, HIGH: { count: 0, win_rate_20d: 0, avg_return_20d: 0 } },
      by_opportunity_bucket: {},
    };
  }

  const completed = versionSignals.filter((s) => s.return_20d !== null);
  const nCompleted = completed.length || 1;

  // 5D, 10D, 20D stats
  const sig5d = versionSignals.filter((s) => s.return_5d !== null);
  const win5d = sig5d.filter((s) => (s.return_5d ?? 0) > 0).length;
  const avg5d = sig5d.reduce((sum, s) => sum + (s.return_5d ?? 0), 0) / (sig5d.length || 1);

  const sig10d = versionSignals.filter((s) => s.return_10d !== null);
  const win10d = sig10d.filter((s) => (s.return_10d ?? 0) > 0).length;
  const avg10d = sig10d.reduce((sum, s) => sum + (s.return_10d ?? 0), 0) / (sig10d.length || 1);

  const win20d = completed.filter((s) => (s.return_20d ?? 0) > 0).length;
  const avg20d = completed.reduce((sum, s) => sum + (s.return_20d ?? 0), 0) / nCompleted;

  // Median 20D
  const sorted20d = completed.map((s) => s.return_20d ?? 0).sort((a, b) => a - b);
  const median20d = sorted20d.length > 0 ? sorted20d[Math.floor(sorted20d.length / 2)] : 0;

  // Max Drawdown among signals
  const minReturn = sorted20d.length > 0 ? Math.min(...sorted20d) : 0;
  const max_drawdown = minReturn < 0 ? Math.abs(minReturn) : 0;

  // Profit Factor = Gross Profits / Gross Losses
  const profits = completed
    .filter((s) => (s.return_20d ?? 0) > 0)
    .reduce((sum, s) => sum + (s.return_20d ?? 0), 0);
  const losses = Math.abs(
    completed
      .filter((s) => (s.return_20d ?? 0) < 0)
      .reduce((sum, s) => sum + (s.return_20d ?? 0), 0)
  );
  const profit_factor = losses > 0 ? Math.round((profits / losses) * 100) / 100 : profits > 0 ? 99 : 1.0;

  // Breakdown by Strategy
  const by_strategy: Record<string, { count: number; win_rate_20d: number; avg_return_20d: number }> = {};
  const strategyGroups: Record<string, SignalSnapshot[]> = {};
  completed.forEach((s) => {
    const strat = s.strategy_type || 'general_equity';
    if (!strategyGroups[strat]) strategyGroups[strat] = [];
    strategyGroups[strat].push(s);
  });

  Object.keys(strategyGroups).forEach((strat) => {
    const grp = strategyGroups[strat];
    const grpWins = grp.filter((s) => (s.return_20d ?? 0) > 0).length;
    const grpAvg = grp.reduce((sum, s) => sum + (s.return_20d ?? 0), 0) / grp.length;
    by_strategy[strat] = {
      count: grp.length,
      win_rate_20d: Math.round((grpWins / grp.length) * 1000) / 10,
      avg_return_20d: Math.round(grpAvg * 10) / 10,
    };
  });

  // Breakdown by Risk Level
  const by_risk: Record<RiskLevel, { count: number; win_rate_20d: number; avg_return_20d: number }> = {
    LOW: { count: 0, win_rate_20d: 0, avg_return_20d: 0 },
    MEDIUM: { count: 0, win_rate_20d: 0, avg_return_20d: 0 },
    HIGH: { count: 0, win_rate_20d: 0, avg_return_20d: 0 },
  };

  (['LOW', 'MEDIUM', 'HIGH'] as RiskLevel[]).forEach((lvl) => {
    const grp = completed.filter((s) => s.risk_level === lvl);
    if (grp.length > 0) {
      const wins = grp.filter((s) => (s.return_20d ?? 0) > 0).length;
      const avg = grp.reduce((sum, s) => sum + (s.return_20d ?? 0), 0) / grp.length;
      by_risk[lvl] = {
        count: grp.length,
        win_rate_20d: Math.round((wins / grp.length) * 1000) / 10,
        avg_return_20d: Math.round(avg * 10) / 10,
      };
    }
  });

  // Breakdown by Opportunity Bucket
  const buckets = [
    { label: '65 - 74 (Moderate)', min: 65, max: 74.9 },
    { label: '75 - 84 (High)', min: 75, max: 84.9 },
    { label: '85+ (Exceptional)', min: 85, max: 100 },
  ];

  const by_opportunity_bucket: Record<string, { count: number; win_rate_20d: number; avg_return_20d: number }> = {};
  buckets.forEach((b) => {
    const grp = completed.filter(
      (s) => s.opportunity_score >= b.min && s.opportunity_score <= b.max
    );
    if (grp.length > 0) {
      const wins = grp.filter((s) => (s.return_20d ?? 0) > 0).length;
      const avg = grp.reduce((sum, s) => sum + (s.return_20d ?? 0), 0) / grp.length;
      by_opportunity_bucket[b.label] = {
        count: grp.length,
        win_rate_20d: Math.round((wins / grp.length) * 1000) / 10,
        avg_return_20d: Math.round(avg * 10) / 10,
      };
    }
  });

  return {
    version,
    total_signals: total,
    completed_signals: completed.length,
    win_rate_5d: Math.round((win5d / (sig5d.length || 1)) * 1000) / 10,
    win_rate_10d: Math.round((win10d / (sig10d.length || 1)) * 1000) / 10,
    win_rate_20d: Math.round((win20d / nCompleted) * 1000) / 10,
    avg_return_5d: Math.round(avg5d * 10) / 10,
    avg_return_10d: Math.round(avg10d * 10) / 10,
    avg_return_20d: Math.round(avg20d * 10) / 10,
    median_return_20d: Math.round(median20d * 10) / 10,
    max_drawdown: Math.round(max_drawdown * 10) / 10,
    profit_factor,
    by_strategy,
    by_risk,
    by_opportunity_bucket,
  };
}
