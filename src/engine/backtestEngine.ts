import { BacktestSummary, SignalSnapshot } from '../types/v8';
import { computeBreakdowns } from '../backtest/performanceCalculator';

export function calculateBacktestMetrics(
  signals: SignalSnapshot[]
): BacktestSummary {
  // Deduplicate signals: for each ticker on a given signal_date, ensure only 1 signal is counted
  const dedupMap = new Map<string, SignalSnapshot>();
  for (const s of (signals || [])) {
    const key = `${s.ticker}_${s.signal_date}`;
    if (!dedupMap.has(key)) {
      dedupMap.set(key, s);
    }
  }
  const cleanSignals = Array.from(dedupMap.values());
  const total = cleanSignals.length;

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
      max_drawdown: 0,
      profit_factor: 0,
      by_strategy: {},
      by_risk: {
        LOW: { count: 0, win_rate_20d: 0, avg_return_20d: 0 },
        MEDIUM: { count: 0, win_rate_20d: 0, avg_return_20d: 0 },
        HIGH: { count: 0, win_rate_20d: 0, avg_return_20d: 0 },
      },
      by_opportunity_bucket: {},
    };
  }

  const completed = cleanSignals.filter((s) => s.return_20d !== null);
  const nCompleted = completed.length || 1;

  // 5D, 10D, 20D stats
  const sig5d = cleanSignals.filter((s) => s.return_5d !== null);
  const win5d = sig5d.filter((s) => (s.return_5d ?? 0) > 0).length;
  const avg5d = sig5d.reduce((sum, s) => sum + (s.return_5d ?? 0), 0) / (sig5d.length || 1);

  const sig10d = cleanSignals.filter((s) => s.return_10d !== null);
  const win10d = sig10d.filter((s) => (s.return_10d ?? 0) > 0).length;
  const avg10d = sig10d.reduce((sum, s) => sum + (s.return_10d ?? 0), 0) / (sig10d.length || 1);

  const win20d = completed.filter((s) => (s.return_20d ?? 0) > 0).length;
  const avg20d = completed.reduce((sum, s) => sum + (s.return_20d ?? 0), 0) / nCompleted;

  // Median 20D (짝수 개면 중앙 두 값의 평균 - 표준 정의)
  const sorted20d = completed.map((s) => s.return_20d ?? 0).sort((a, b) => a - b);
  const mid = Math.floor(sorted20d.length / 2);
  const median20d =
    sorted20d.length > 0
      ? sorted20d.length % 2 === 0
        ? (sorted20d[mid - 1] + sorted20d[mid]) / 2
        : sorted20d[mid]
      : 0;

  // Max trade loss: 20D 거래 중 최악의 손실 절댓값 (Portfolio MDD 아님)
  const maxTradeLoss = sorted20d.length > 0 ? Math.abs(Math.min(...sorted20d)) : 0;
  const max_drawdown = maxTradeLoss;

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

  const { by_strategy, by_risk, by_opportunity_bucket } = computeBreakdowns(
    completed.map((s) => ({
      return20d: s.return_20d ?? null,
      strategy: s.strategy_type,
      riskLevel: s.risk_level,
      opportunityScore: s.opportunity_score,
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
    max_drawdown: Math.round(max_drawdown * 10) / 10,
    profit_factor,
    by_strategy,
    by_risk,
    by_opportunity_bucket,
  };
}
