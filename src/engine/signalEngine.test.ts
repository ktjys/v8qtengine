import { describe, it, expect } from 'vitest';
import { shouldGenerateSignal, createSignalSnapshot } from './signalEngine';
import { FullTickerEvaluation, SignalSnapshot } from '../types/v8';

function fullEvaluation(overrides: Partial<FullTickerEvaluation> = {}): FullTickerEvaluation {
  return {
    ticker: 'TEST',
    name: 'Test Co',
    price: 100,
    change1d: 1.5,
    evaluated_at: '2024-01-05T10:00:00.000Z',
    classification: {
      strategy_type: 'established_growth',
      asset_type: 'equity',
      confidence: 0.95,
    } as never,
    opportunity: {
      opportunity_score: 90,
      sub_scores: {
        technical_score: 90,
        momentum_score: 88,
        fundamental_score: 85,
        valuation_score: 70,
      },
      technical_details: { rsi14: 58, drawdownFromHigh: -5 } as never,
      weights_used: { technical: 0.25, momentum: 0.3, fundamental: 0.3, valuation: 0.15 },
    } as never,
    risk: { risk_level: 'LOW', risk_score: 20, risk_reasons: ['x'] } as never,
    decision: { decision: 'STRONG_OPPORTUNITY', confidence: 0.9, reason: 'r' } as never,
    signal_generated: true,
    ...overrides,
  } as FullTickerEvaluation;
}

function existing(date: string, ticker = 'TEST'): SignalSnapshot {
  return { ticker, signal_date: date } as SignalSnapshot;
}

describe('shouldGenerateSignal', () => {
  it('generates when signal is eligible and no recent duplicate', () => {
    expect(shouldGenerateSignal(fullEvaluation(), [])).toBe(true);
  });

  it('does not generate when signal_generated is false', () => {
    expect(
      shouldGenerateSignal(fullEvaluation({ signal_generated: false }), [])
    ).toBe(false);
  });

  it('suppresses duplicate for the same ticker on same day', () => {
    const evalWith = fullEvaluation({ evaluated_at: '2024-01-05T12:00:00.000Z' });
    expect(shouldGenerateSignal(evalWith, [existing('2024-01-05')])).toBe(false);
  });

  it('allows a different ticker even on the same day', () => {
    const evalWith = fullEvaluation({ ticker: 'OTHER' });
    expect(shouldGenerateSignal(evalWith, [existing('2024-01-05', 'TEST')])).toBe(true);
  });
});

describe('createSignalSnapshot', () => {
  it('maps evaluation fields into the snapshot', () => {
    const snap = createSignalSnapshot(fullEvaluation(), 'sig-custom');
    expect(snap.id).toBe('sig-custom');
    expect(snap.signal_date).toBe('2024-01-05');
    expect(snap.ticker).toBe('TEST');
    expect(snap.opportunity_score).toBe(90);
    expect(snap.risk_level).toBe('LOW');
    expect(snap.decision).toBe('STRONG_OPPORTUNITY');
    expect(snap.classification_confidence).toBe(0.95);
    expect(snap.is_closed).toBe(false);
  });

  it('derives id from date and ticker when not overridden', () => {
    const snap = createSignalSnapshot(fullEvaluation());
    expect(snap.id).toBe('sig-2024-01-05-TEST');
  });

  it('copies component references for decision/risk/weights', () => {
    const snap = createSignalSnapshot(fullEvaluation());
    expect(snap.components.weights.fundamental).toBe(0.3);
    expect(snap.components.decision_reason).toBe('r');
  });
});
