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
    it('returns 2 for US market', () => {
      expect(getChunkSizeLimit('US')).toBe(2);
    });

    it('returns 3 for KR market', () => {
      expect(getChunkSizeLimit('KR')).toBe(3);
    });
  });

  describe('estimateBudget', () => {
    it('estimates budget correctly for cache hit scenario', () => {
      // 2 tickers with cache hit
      const budget = estimateBudget(2, true);
      
      // Overhead + 2 * (2 reads + 3 writes) = 3 + 2*5 = 13 subrequests
      expect(budget.subrequests).toBe(13);
      
      // CPU: 2 * (0.5 + 2.5 + 1.0) = 2 * 4.0 = 8.0ms
      expect(budget.cpuMs).toBeCloseTo(8.0, 1);
      
      expect(budget.withinLimits).toBe(true);
    });

    it('estimates budget correctly for cache miss scenario', () => {
      // 2 tickers with cache miss (Yahoo fetch)
      const budget = estimateBudget(2, false);
      
      // Overhead + 2 * (2 yahoo + 2 reads + 3 writes) = 3 + 2*7 = 17 subrequests
      expect(budget.subrequests).toBe(17);
      
      // CPU: 2 * (1.5 + 2.5 + 0.5 + 1.0) = 2 * 5.5 = 11.0ms
      expect(budget.cpuMs).toBeCloseTo(11.0, 1);
      
      // Should exceed CPU limit (8ms)
      expect(budget.withinLimits).toBe(false);
    });

    it('estimates budget for single ticker with cache miss', () => {
      const budget = estimateBudget(1, false);
      
      // Overhead + 1 * (2 yahoo + 2 reads + 3 writes) = 3 + 7 = 10 subrequests
      expect(budget.subrequests).toBe(10);
      
      // CPU: 1 * (1.5 + 2.5 + 0.5 + 1.0) = 5.5ms
      expect(budget.cpuMs).toBeCloseTo(5.5, 1);
      
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
    it('returns max chunk size for US when cache hit', () => {
      const size = getOptimalChunkSize('US', true);
      expect(size).toBe(2); // US limit is 2, cache hit allows 2
    });

    it('reduces chunk size for US when cache miss', () => {
      // With cache miss, 2 tickers exceed CPU budget (11ms > 8ms)
      // So should reduce to 1
      const size = getOptimalChunkSize('US', false);
      expect(size).toBe(1);
    });

    it('returns max chunk size for KR when cache hit (limited by CPU budget)', () => {
      const size = getOptimalChunkSize('KR', true);
      // 3 tickers with cache hit: CPU = 3 * (0.5 + 2.5 + 1.0) = 12ms > 8ms limit
      // So it reduces to 2 tickers: CPU = 2 * 4.0 = 8.0ms (within limit)
      expect(size).toBe(2);
    });

    it('reduces chunk size for KR when cache miss', () => {
      // 3 tickers without cache: 3 * 5.5 = 16.5ms CPU > 8ms
      // 2 tickers: 11ms > 8ms
      // 1 ticker: 5.5ms < 8ms
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

    it('has correct CPU estimates', () => {
      expect(CPU_ESTIMATES.PER_TICKER_EVALUATION_MS).toBe(2.5);
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