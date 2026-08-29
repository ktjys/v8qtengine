import { describe, it, expect } from 'vitest';
import { makeDecision } from './decisionEngine';
import { AssetClassification, OpportunityEvaluation, RiskEvaluation } from '../types/v8';

function classification(strategyType: string, confidence = 0.9): AssetClassification {
  return { strategy_type: strategyType, confidence } as unknown as AssetClassification;
}

function opportunity(score: number): OpportunityEvaluation {
  return { opportunity_score: score } as unknown as OpportunityEvaluation;
}

function risk(level: RiskEvaluation['risk_level'], score: number): RiskEvaluation {
  return { risk_level: level, risk_score: score } as unknown as RiskEvaluation;
}

describe('makeDecision', () => {
  it('returns STRONG_OPPORTUNITY for established_growth with high score and LOW risk', () => {
    const d = makeDecision(classification('established_growth'), opportunity(80), risk('LOW', 20));
    expect(d.decision).toBe('STRONG_OPPORTUNITY');
    expect(d.actionable).toBe(true);
    expect(d.threshold_met).toBe(true);
  });

  it('returns OPPORTUNITY for established_growth with moderate score and MEDIUM risk', () => {
    const d = makeDecision(classification('established_growth'), opportunity(70), risk('MEDIUM', 50));
    expect(d.decision).toBe('OPPORTUNITY');
    expect(d.actionable).toBe(true);
  });

  it('downgrades high-score established_growth to WATCH when risk is HIGH', () => {
    const d = makeDecision(classification('established_growth'), opportunity(80), risk('HIGH', 70));
    expect(d.decision).toBe('WATCH');
    expect(d.actionable).toBe(false);
  });

  it('returns OPPORTUNITY for speculative with extreme score and controlled risk', () => {
    const d = makeDecision(classification('speculative'), opportunity(85), risk('LOW', 20));
    expect(d.decision).toBe('OPPORTUNITY');
    expect(d.actionable).toBe(true);
  });

  it('returns WATCH for speculative with high score but HIGH risk', () => {
    const d = makeDecision(classification('speculative'), opportunity(75), risk('HIGH', 70));
    expect(d.decision).toBe('WATCH');
    expect(d.actionable).toBe(false);
  });

  it('returns STRONG_OPPORTUNITY for broad_market_etf with score and LOW risk', () => {
    const d = makeDecision(classification('broad_market_etf'), opportunity(75), risk('LOW', 20));
    expect(d.decision).toBe('STRONG_OPPORTUNITY');
    expect(d.actionable).toBe(true);
  });

  it('returns AVOID for established_growth with very low score', () => {
    const d = makeDecision(classification('established_growth'), opportunity(40), risk('LOW', 30));
    expect(d.decision).toBe('AVOID');
    expect(d.actionable).toBe(false);
  });

  it('clamps signal confidence within [0.3, 0.98]', () => {
    const lowConf = makeDecision(
      classification('established_growth', 0.1),
      opportunity(80),
      risk('LOW', 20)
    );
    const highConf = makeDecision(
      classification('established_growth', 0.99),
      opportunity(60),
      risk('LOW', 5)
    );
    expect(lowConf.confidence).toBeGreaterThanOrEqual(0.3);
    expect(highConf.confidence).toBeLessThanOrEqual(0.98);
  });
});
