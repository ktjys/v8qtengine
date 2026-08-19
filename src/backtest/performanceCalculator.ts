import { BacktestSummary, RiskLevel } from '../types/v8';
import { SimulatedTradeSignal } from './backtestTypes';

export function calculateReplayPerformance(
  signals: SimulatedTradeSignal[],
  version: 'V8.0' | 'V7.0'
): BacktestSummary {
  const total = signals.length;

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

  const sorted20d = completed.map((s) => s.return20d ?? 0).sort((a, b) => a - b);
  const median20d = sorted20d.length > 0 ? sorted20d[Math.floor(sorted20d.length / 2)] : 0;

  // Max Drawdown
  const drawdowns = completed.map((s) => s.maxDrawdownTrade ?? 0);
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

  // Breakdown by Strategy
  const by_strategy: Record<string, { count: number; win_rate_20d: number; avg_return_20d: number }> = {};
  const strategyGroups: Record<string, SimulatedTradeSignal[]> = {};
  completed.forEach((s) => {
    const strat = s.strategyType || 'general_equity';
    if (!strategyGroups[strat]) strategyGroups[strat] = [];
    strategyGroups[strat].push(s);
  });

  Object.keys(strategyGroups).forEach((strat) => {
    const grp = strategyGroups[strat];
    const grpWins = grp.filter((s) => (s.return20d ?? 0) > 0).length;
    const grpAvg = grp.reduce((sum, s) => sum + (s.return20d ?? 0), 0) / grp.length;
    by_strategy[strat] = {
      count: grp.length,
      win_rate_20d: Math.round((grpWins / grp.length) * 1000) / 10,
      avg_return_20d: Math.round(grpAvg * 10) / 10,
    };
  });

  // Breakdown by Risk
  const by_risk: Record<RiskLevel, { count: number; win_rate_20d: number; avg_return_20d: number }> = {
    LOW: { count: 0, win_rate_20d: 0, avg_return_20d: 0 },
    MEDIUM: { count: 0, win_rate_20d: 0, avg_return_20d: 0 },
    HIGH: { count: 0, win_rate_20d: 0, avg_return_20d: 0 },
  };

  (['LOW', 'MEDIUM', 'HIGH'] as RiskLevel[]).forEach((lvl) => {
    const grp = completed.filter((s) => s.riskLevel === lvl);
    if (grp.length > 0) {
      const wins = grp.filter((s) => (s.return20d ?? 0) > 0).length;
      const avg = grp.reduce((sum, s) => sum + (s.return20d ?? 0), 0) / grp.length;
      by_risk[lvl] = {
        count: grp.length,
        win_rate_20d: Math.round((wins / grp.length) * 1000) / 10,
        avg_return_20d: Math.round(avg * 10) / 10,
      };
    }
  });

  // Opportunity Buckets
  const buckets = [
    { label: '65 - 74 (Moderate)', min: 65, max: 74.9 },
    { label: '75 - 84 (High)', min: 75, max: 84.9 },
    { label: '85+ (Exceptional)', min: 85, max: 100 },
  ];

  const by_opportunity_bucket: Record<string, { count: number; win_rate_20d: number; avg_return_20d: number }> = {};
  buckets.forEach((b) => {
    const grp = completed.filter(
      (s) => s.opportunityScore >= b.min && s.opportunityScore <= b.max
    );
    if (grp.length > 0) {
      const wins = grp.filter((s) => (s.return20d ?? 0) > 0).length;
      const avg = grp.reduce((sum, s) => sum + (s.return20d ?? 0), 0) / grp.length;
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
    expectancy,
    by_strategy,
    by_risk,
    by_opportunity_bucket,
  };
}
