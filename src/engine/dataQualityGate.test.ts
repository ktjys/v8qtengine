import { describe, it, expect } from 'vitest';
import { isSignalEligible } from './dataQualityGate';

describe('isSignalEligible', () => {
  it('rejects fallback data regardless of quality', () => {
    expect(
      isSignalEligible({ source: 'seed', isFallback: true }, { data_quality_score: 95 } as never)
    ).toBe(false);
  });

  it('rejects data below the quality threshold', () => {
    expect(
      isSignalEligible({ source: 'yahoo', isFallback: false }, { data_quality_score: 50 } as never)
    ).toBe(false);
  });

  it('accepts good non-fallback data', () => {
    expect(
      isSignalEligible({ source: 'yahoo', isFallback: false }, { data_quality_score: 90 } as never)
    ).toBe(true);
  });

  it('accepts when data quality is absent and not fallback', () => {
    expect(isSignalEligible({ source: 'yahoo', isFallback: false }, null)).toBe(true);
    expect(isSignalEligible({ source: 'yahoo', isFallback: false }, undefined)).toBe(true);
  });
});
