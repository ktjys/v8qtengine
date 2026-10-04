import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  estimateBudget,
  getOptimalChunkSize,
  getChunkSizeLimit,
  SUBREQUEST_BUDGET,
  CPU_ESTIMATES
} from './scanChunkProcessor';

describe('Budget Guard', () => {
  describe('getChunkSizeLimit', () => {
    it('returns 5 for US market (increased with indicator caching)', () => {
      expect(getChunkSizeLimit('US')).toBe(5);
    });

    it('returns 5 for KR market (increased with indicator caching)', () => {
      expect(getChunkSizeLimit('KR')).toBe(5);
    });
  });

  describe('estimateBudget', () => {
    it('estimates budget correctly for cache hit scenario', () => {
      // 2 tickers with cache hit
      const budget = estimateBudget(2, true);

      // Overhead + 2 * (2 reads + 3 writes) = 3 + 2*5 = 13 subrequests
      expect(budget.subrequests).toBe(13);

      // CPU: 2 * (0.5 + 1.6 + 1.0) = 2 * 3.1 = 6.2ms
      expect(budget.cpuMs).toBeCloseTo(6.2, 1);

      expect(budget.withinLimits).toBe(true);
    });

    it('estimates budget correctly for cache miss scenario', () => {
      // 2 tickers with cache miss (Yahoo fetch)
      const budget = estimateBudget(2, false);

      // Overhead + 2 * (2 yahoo + 2 reads + 3 writes) = 3 + 2*7 = 17 subrequests
      expect(budget.subrequests).toBe(17);

      // CPU: 2 * (1.5 + 1.6 + 0.5 + 1.0) = 2 * 4.6 = 9.2ms
      expect(budget.cpuMs).toBeCloseTo(9.2, 1);

      // Should exceed CPU limit (8ms)
      expect(budget.withinLimits).toBe(false);
    });

    it('estimates budget for single ticker with cache miss', () => {
      const budget = estimateBudget(1, false);

      // Overhead + 1 * (2 yahoo + 2 reads + 3 writes) = 3 + 7 = 10 subrequests
      expect(budget.subrequests).toBe(10);

      // CPU: 1 * (1.5 + 1.6 + 0.5 + 1.0) = 4.6ms
      expect(budget.cpuMs).toBeCloseTo(4.6, 1);

      // Single ticker should be within CPU limit
      expect(budget.withinLimits).toBe(true);
    });

    it('respects budget limits for US market (2 tickers cache miss)', () => {
      // 2 tickers without cache
      const budget = estimateBudget(2, false);

      // 17 subrequests (within 40 limit)
      expect(budget.subrequests).toBeLessThanOrEqual(40);

      // But CPU may exceed 8ms
      expect(budget.cpuMs).toBeGreaterThan(8);
    });

    it('single ticker always within limits', () => {
      const budget = estimateBudget(1, false);
      expect(budget.withinLimits).toBe(true);

      // Even with cache hit
      const budgetCached = estimateBudget(1, true);
      expect(budgetCached.withinLimits).toBe(true);
    });
  });

  describe('getOptimalChunkSize', () => {
    it('returns max chunk size for US when cache hit (CPU budget limited to 2)', () => {
      const size = getOptimalChunkSize('US', true);
      // With cache hit: 2 tickers = 6.2ms CPU, 3 tickers = 9.3ms > 8ms
      // Limit is 5 but CPU budget allows only 2
      expect(size).toBe(2);
    });

    it('reduces chunk size for US when cache miss', () => {
      // With cache miss: 1 ticker = 4.6ms CPU, 2 tickers = 9.2ms > 8ms
      // So should reduce to 1
      const size = getOptimalChunkSize('US', false);
      expect(size).toBe(1);
    });

    it('returns max chunk size for KR when cache hit (limited by CPU budget)', () => {
      const size = getOptimalChunkSize('KR', true);
      // 3 tickers with cache hit: CPU = 3 * 3.1 = 9.3ms > 8ms limit
      // 2 tickers: CPU = 2 * 3.1 = 6.2ms (within limit)
      // Limit is 5 but CPU budget allows only 2
      expect(size).toBe(2);
    });

    it('reduces chunk size for KR when cache miss', () => {
      // 3 tickers without cache: 3 * 4.6 = 13.8ms CPU > 8ms
      // 2 tickers: 9.2ms > 8ms
      // 1 ticker: 4.6ms < 8ms
      const size = getOptimalChunkSize('KR', false);
      expect(size).toBe(1);
    });

    it('never returns less than 1', () => {
      // Even with extreme estimates, should return at least 1
      const size = getOptimalChunkSize('US', false);
      expect(size).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Budget constants', () => {
    it('has correct budget limits', () => {
      expect(SUBREQUEST_BUDGET.MAX_SUBREQUESTS_PER_INVOCATION).toBe(40);
      expect(SUBREQUEST_BUDGET.MAX_CPU_MS_PER_INVOCATION).toBe(8);
    });

    it('has correct CPU estimates (updated for indicator caching)', () => {
      expect(CPU_ESTIMATES.PER_TICKER_EVALUATION_MS).toBe(1.6);
      expect(CPU_ESTIMATES.YAHOO_FETCH_MS).toBe(1.5);
      expect(CPU_ESTIMATES.DB_READ_MS).toBe(0.5);
      expect(CPU_ESTIMATES.DB_WRITE_MS).toBe(1.0);
      expect(CPU_ESTIMATES.INDICATORS_MS).toBe(1.0);
    });
  });

  describe('Edge cases', () => {
    it('handles zero tickers', () => {
      const budget = estimateBudget(0, true);
      expect(budget.subrequests).toBe(SUBREQUEST_BUDGET.OVERHEAD);
      expect(budget.cpuMs).toBe(0);
      expect(budget.withinLimits).toBe(true);
    });

    it('respects CPU limit over subrequest limit for large chunks', () => {
      // Even if subrequests are within limit, CPU may exceed
      const budget = estimateBudget(3, false);
      expect(budget.withinLimits).toBe(false);
      expect(budget.cpuMs).toBeGreaterThan(SUBREQUEST_BUDGET.MAX_CPU_MS_PER_INVOCATION);
    });
  });
});