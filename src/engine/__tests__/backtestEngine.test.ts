import { calculateBacktestMetrics } from '../backtestEngine';
import { SignalSnapshot, RiskLevel, DecisionType, StrategyType, MarketRegion, AssetType } from '../../types/v8';

describe('backtestEngine', () => {
  const createSignal = (overrides: Partial<SignalSnapshot> = {}): SignalSnapshot => ({
    id: `sig-2024-01-01-TEST`,
    signal_date: '2024-01-01',
    ticker: 'TEST',
    name: 'Test Company',
    market_region: 'US' as MarketRegion,
    signal_price: 100,
    strategy_type: 'quality' as StrategyType,
    asset_type: 'equity' as AssetType,
    opportunity_score: 80,
    risk_level: 'LOW' as RiskLevel,
    risk_score: 30,
    decision: 'OPPORTUNITY' as DecisionType,
    signal_confidence: 0.85,
    classification_confidence: 0.9,
    position_size_pct: 2.0,
    technical_score: 80,
    momentum_score: 80,
    fundamental_score: 80,
    valuation_score: 80,
    rsi: 55,
    drawdown: -5,
    return_1d: null,
    return_5d: 2.0,
    return_10d: 3.0,
    return_20d: 5.0,
    return_60d: 8.0,
    return_120d: 12.0,
    return_252d: 20.0,
    current_return: 5.0,
    max_gain: 10.0,
    max_loss: -3.0,
    status: '20D_REACHED' as const,
    is_closed: true,
    components: {
      weights: { technical: 0.3, momentum: 0.3, fundamental: 0.2, valuation: 0.2 },
      risk_reasons: ['Test'],
      decision_reason: 'Test',
    },
    ...overrides,
  });

  // Helper to create signals with unique ticker/date combos
  const createSignals = (count: number, baseOverrides: Partial<SignalSnapshot> = {}) =>
    Array.from({ length: count }, (_, i) =>
      createSignal({
        id: `sig-2024-01-${String(i + 1).padStart(2, '0')}-TICKER${i}`,
        signal_date: `2024-01-${String(i + 1).padStart(2, '0')}`,
        ticker: `TICKER${i}`,
        ...baseOverrides,
      })
    );

  describe('Empty Signals', () => {
    it('returns zeroed summary for empty array', () => {
      const result = calculateBacktestMetrics([]);

      expect(result.total_signals).toBe(0);
      expect(result.completed_signals).toBe(0);
      expect(result.win_rate_5d).toBe(0);
      expect(result.profit_factor).toBe(0);
    });

    it('returns zeroed summary for null', () => {
      const result = calculateBacktestMetrics(null as any);

      expect(result.total_signals).toBe(0);
    });
  });

  describe('Deduplication', () => {
    it('deduplicates signals with same ticker and date', () => {
      const signals = [
        createSignal({ id: 'sig-1', ticker: 'TEST', signal_date: '2024-01-01', return_20d: 5.0 }),
        createSignal({ id: 'sig-2', ticker: 'TEST', signal_date: '2024-01-01', return_20d: 3.0 }), // duplicate
        createSignal({ id: 'sig-3', ticker: 'OTHER', signal_date: '2024-01-01', return_20d: 2.0 }),
      ];

      const result = calculateBacktestMetrics(signals);

      expect(result.total_signals).toBe(2);
      expect(result.completed_signals).toBe(2);
    });
  });

  describe('Win Rate Calculations', () => {
    it('calculates 5D win rate correctly', () => {
      const signals = createSignals(3, { return_5d: 2.0, return_20d: 5.0 });
      signals[1] = createSignal({ ...signals[1], return_5d: -1.0, return_20d: -2.0 });

      const result = calculateBacktestMetrics(signals);

      expect(result.win_rate_5d).toBeCloseTo(66.7, 1); // 2 out of 3 positive
    });

    it('calculates 20D win rate correctly', () => {
      const signals = createSignals(4);
      signals[1] = createSignal({ ...signals[1], return_20d: -2.0 });
      signals[3] = createSignal({ ...signals[3], return_20d: -1.0 });

      const result = calculateBacktestMetrics(signals);

      expect(result.win_rate_20d).toBe(50.0); // 2 out of 4 positive
    });

    it('handles null returns correctly', () => {
      const signals = [
        createSignal({ return_5d: 2.0, return_20d: 5.0 }),
        createSignal({ 
          id: 'sig-2', 
          ticker: 'TICKER2', 
          signal_date: '2024-01-02',
          return_5d: null, 
          return_20d: 3.0 
        }), // incomplete
      ];

      const result = calculateBacktestMetrics(signals);

      expect(result.win_rate_5d).toBe(100.0); // only 1 has 5d return
      expect(result.completed_signals).toBe(2); // both have 20d return
    });
  });

  describe('Average Return Calculations', () => {
    it('calculates average returns correctly', () => {
      const signals = createSignals(3);
      signals[0] = createSignal({ ...signals[0], return_20d: 10.0 });
      signals[1] = createSignal({ ...signals[1], return_20d: -5.0 });
      signals[2] = createSignal({ ...signals[2], return_20d: 5.0 });

      const result = calculateBacktestMetrics(signals);

      expect(result.avg_return_20d).toBeCloseTo(3.3, 1); // (10 - 5 + 5) / 3 = 3.33
    });
  });

  describe('Median Calculation', () => {
    it('calculates median for odd count', () => {
      const signals = createSignals(3);
      signals[0] = createSignal({ ...signals[0], return_20d: 10.0 });
      signals[1] = createSignal({ ...signals[1], return_20d: 5.0 });
      signals[2] = createSignal({ ...signals[2], return_20d: 0.0 });

      const result = calculateBacktestMetrics(signals);

      expect(result.median_return_20d).toBe(5.0);
    });

    it('calculates median for even count (average of middle two)', () => {
      const signals = createSignals(4);
      signals[0] = createSignal({ ...signals[0], return_20d: 10.0 });
      signals[1] = createSignal({ ...signals[1], return_20d: 5.0 });
      signals[2] = createSignal({ ...signals[2], return_20d: -5.0 });
      signals[3] = createSignal({ ...signals[3], return_20d: -10.0 });

      const result = calculateBacktestMetrics(signals);

      expect(result.median_return_20d).toBe(0.0); // (-5 + 5) / 2 = 0
    });
  });

  describe('Max Drawdown', () => {
    it('calculates max trade loss (not portfolio MDD)', () => {
      const signals = createSignals(3);
      signals[0] = createSignal({ ...signals[0], return_20d: 10.0 });
      signals[1] = createSignal({ ...signals[1], return_20d: -20.0 });
      signals[2] = createSignal({ ...signals[2], return_20d: -5.0 });

      const result = calculateBacktestMetrics(signals);

      expect(result.max_drawdown).toBe(20.0); // absolute value of worst trade
    });
  });

  describe('Profit Factor', () => {
    it('calculates profit factor correctly', () => {
      const signals = createSignals(4);
      signals[0] = createSignal({ ...signals[0], return_20d: 10.0 });
      signals[1] = createSignal({ ...signals[1], return_20d: 5.0 });
      signals[2] = createSignal({ ...signals[2], return_20d: -5.0 });
      signals[3] = createSignal({ ...signals[3], return_20d: -10.0 });

      const result = calculateBacktestMetrics(signals);

      // Gross profit = 15, Gross loss = 15, PF = 1.0
      expect(result.profit_factor).toBe(1.0);
    });

    it('returns infinite profit factor when no losses', () => {
      const signals = createSignals(2, { return_20d: 10.0 });
      signals[1] = createSignal({ ...signals[1], return_20d: 5.0 });

      const result = calculateBacktestMetrics(signals);

      expect(result.profit_factor).toBe(99); // PROFIT_FACTOR_INFINITE
    });

    it('returns neutral when no profits or losses', () => {
      const signals = createSignals(1, { return_20d: 0.0 });

      const result = calculateBacktestMetrics(signals);

      expect(result.profit_factor).toBe(1.0);
    });
  });

  describe('Long Horizon Stats', () => {
    it('calculates 60D, 120D, 252D stats', () => {
      const signals = createSignals(2);
      signals[0] = createSignal({ ...signals[0], return_60d: 10.0, return_120d: 15.0, return_252d: 20.0 });
      signals[1] = createSignal({ ...signals[1], return_60d: 5.0, return_120d: 10.0, return_252d: 5.0 }); // both positive

      const result = calculateBacktestMetrics(signals);

      expect(result.completed_signals_60d).toBe(2);
      expect(result.win_rate_60d).toBe(100.0); // both positive
      expect(result.avg_return_60d).toBe(7.5);

      expect(result.completed_signals_120d).toBe(2);
      expect(result.win_rate_120d).toBe(100.0);
      expect(result.avg_return_120d).toBe(12.5);

      expect(result.completed_signals_252d).toBe(2);
      expect(result.win_rate_252d).toBe(100.0); // both positive
      expect(result.avg_return_252d).toBe(12.5);
    });

    it('handles missing long horizon returns', () => {
      const signals = createSignals(1, { return_20d: 5.0, return_60d: null });

      const result = calculateBacktestMetrics(signals);

      expect(result.completed_signals_60d).toBe(0);
      expect(result.win_rate_60d).toBe(0);
    });
  });

  describe('Breakdowns', () => {
    it('includes by_strategy breakdown', () => {
      const signals = createSignals(3);
      signals[0] = createSignal({ ...signals[0], strategy_type: 'quality', return_20d: 5.0 });
      signals[1] = createSignal({ ...signals[1], strategy_type: 'quality', return_20d: 3.0 });
      signals[2] = createSignal({ ...signals[2], strategy_type: 'growth_etf', return_20d: -2.0 });

      const result = calculateBacktestMetrics(signals);

      expect(result.by_strategy.quality).toBeDefined();
      expect(result.by_strategy.quality.count).toBe(2);
      expect(result.by_strategy['growth_etf'].count).toBe(1);
    });

    it('includes by_risk breakdown', () => {
      const signals = createSignals(2);
      signals[0] = createSignal({ ...signals[0], risk_level: 'LOW', return_20d: 5.0 });
      signals[1] = createSignal({ ...signals[1], risk_level: 'HIGH', return_20d: -5.0 });

      const result = calculateBacktestMetrics(signals);

      expect(result.by_risk.LOW.count).toBe(1);
      expect(result.by_risk.HIGH.count).toBe(1);
      expect(result.by_risk.MEDIUM.count).toBe(0);
    });
  });
});