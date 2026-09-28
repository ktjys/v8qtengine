import { makeDecision } from '../decisionEngine';
import { AssetClassification, DecisionType, OpportunityEvaluation, RiskEvaluation, RiskLevel, SubScores, TechnicalComponents, MomentumComponents, FundamentalComponents, ValuationComponents } from '../../types/v8';

describe('decisionEngine', () => {
  const createClassification = (strategy: AssetClassification['strategy_type']): AssetClassification => ({
    ticker: 'TEST',
    asset_type: 'equity',
    strategy_type: strategy,
    confidence: 0.9,
    classification_source: 'auto',
    reason: 'Test',
    classified_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  const createOpportunity = (score: number): OpportunityEvaluation => ({
    opportunity_score: score,
    sub_scores: {
      technical_score: score,
      momentum_score: score,
      fundamental_score: score,
      valuation_score: score,
    } as SubScores,
    weights_used: { technical: 0.3, momentum: 0.3, fundamental: 0.2, valuation: 0.2 },
    technical_details: {
      maTrend: 'BULLISH',
      rsi14: 55,
      rsiScore: 85,
      drawdownFromHigh: -5,
      drawdownScore: 88,
      ma20Above50: true,
      ma50Above200: true,
      priceAboveMa20: true,
      macdHistogramPositive: true,
    } as TechnicalComponents,
    momentum_details: {
      return1M: 5,
      return3M: 15,
      return6M: 25,
      relativeStrengthVsSpy: 1.1,
      momentumScore: score,
      trendPersistence: 0.9,
    } as MomentumComponents,
    fundamental_details: {
      revenueGrowthYoy: 20,
      earningsGrowthYoy: 25,
      operatingMargin: 25,
      freeCashFlowMargin: 20,
      marketCapBillions: 100,
      isEtf: false,
    } as FundamentalComponents,
    valuation_details: {
      peTrailing: 25,
      peForward: 22,
      psRatio: 5,
      evToEbitda: null,
      pegRatio: 1.0,
      isEtf: false,
    } as ValuationComponents,
  });

  const createRisk = (level: RiskLevel, score: number): RiskEvaluation => ({
    risk_score: score,
    risk_level: level,
    components: {
      beta: 1.2,
      volatility20dAnnualized: 25,
      maxDrawdown52w: -15,
      isSpeculative: false,
      technicalInstabilityScore: 20,
      dataUncertaintyScore: 10,
    },
    risk_reasons: ['Test risk'],
  });

  describe('Speculative Strategy', () => {
    it('returns OPPORTUNITY for high score with non-HIGH risk', () => {
      const classification = createClassification('speculative');
      const opportunity = createOpportunity(85);
      const risk = createRisk('MEDIUM', 50);

      const result = makeDecision(classification, opportunity, risk);

      expect(result.decision).toBe('OPPORTUNITY');
      expect(result.actionable).toBe(true);
      expect(result.threshold_met).toBe(true);
    });

    it('returns WATCH for high score with HIGH risk', () => {
      const classification = createClassification('speculative');
      const opportunity = createOpportunity(75);
      const risk = createRisk('HIGH', 70);

      const result = makeDecision(classification, opportunity, risk);

      expect(result.decision).toBe('WATCH');
      expect(result.actionable).toBe(false);
      expect(result.threshold_met).toBe(false);
    });

    it('returns WATCH for moderate score', () => {
      const classification = createClassification('speculative');
      const opportunity = createOpportunity(65);
      const risk = createRisk('LOW', 30);

      const result = makeDecision(classification, opportunity, risk);

      expect(result.decision).toBe('WATCH');
    });

    it('returns AVOID for low score', () => {
      const classification = createClassification('speculative');
      const opportunity = createOpportunity(50);
      const risk = createRisk('LOW', 30);

      const result = makeDecision(classification, opportunity, risk);

      expect(result.decision).toBe('AVOID');
    });
  });

  describe('Quality & Established Growth Strategy', () => {
    it('returns STRONG_OPPORTUNITY for high score with LOW/MEDIUM risk', () => {
      const classification = createClassification('quality');
      const opportunity = createOpportunity(80);
      const risk = createRisk('LOW', 30);

      const result = makeDecision(classification, opportunity, risk);

      expect(result.decision).toBe('STRONG_OPPORTUNITY');
      expect(result.actionable).toBe(true);
      expect(result.threshold_met).toBe(true);
    });

    it('returns OPPORTUNITY for good score with non-HIGH risk', () => {
      const classification = createClassification('established_growth');
      const opportunity = createOpportunity(72);
      const risk = createRisk('MEDIUM', 50);

      const result = makeDecision(classification, opportunity, risk);

      expect(result.decision).toBe('OPPORTUNITY');
      expect(result.actionable).toBe(true);
      expect(result.threshold_met).toBe(true);
    });

    it('returns WATCH for high score with HIGH risk', () => {
      const classification = createClassification('quality');
      const opportunity = createOpportunity(75);
      const risk = createRisk('HIGH', 70);

      const result = makeDecision(classification, opportunity, risk);

      expect(result.decision).toBe('WATCH');
    });

    it('returns WATCH for moderate score', () => {
      const classification = createClassification('quality');
      const opportunity = createOpportunity(60);
      const risk = createRisk('LOW', 30);

      const result = makeDecision(classification, opportunity, risk);

      expect(result.decision).toBe('WATCH');
    });

    it('returns AVOID for very low score', () => {
      const classification = createClassification('quality');
      const opportunity = createOpportunity(40);
      const risk = createRisk('LOW', 30);

      const result = makeDecision(classification, opportunity, risk);

      expect(result.decision).toBe('AVOID');
    });

    it('returns NEUTRAL for low-moderate score', () => {
      const classification = createClassification('established_growth');
      const opportunity = createOpportunity(50);
      const risk = createRisk('LOW', 30);

      const result = makeDecision(classification, opportunity, risk);

      expect(result.decision).toBe('NEUTRAL');
    });
  });

  describe('ETF Strategy', () => {
    it('returns STRONG_OPPORTUNITY for high score with LOW risk', () => {
      const classification = createClassification('broad_market_etf');
      const opportunity = createOpportunity(75);
      const risk = createRisk('LOW', 30);

      const result = makeDecision(classification, opportunity, risk);

      expect(result.decision).toBe('STRONG_OPPORTUNITY');
      expect(result.actionable).toBe(true);
      expect(result.threshold_met).toBe(true);
    });

    it('returns OPPORTUNITY for good score with non-HIGH risk', () => {
      const classification = createClassification('growth_etf');
      const opportunity = createOpportunity(68);
      const risk = createRisk('MEDIUM', 50);

      const result = makeDecision(classification, opportunity, risk);

      expect(result.decision).toBe('OPPORTUNITY');
      expect(result.actionable).toBe(true);
      expect(result.threshold_met).toBe(true);
    });

    it('returns WATCH for moderate score', () => {
      const classification = createClassification('dividend_etf');
      const opportunity = createOpportunity(58);
      const risk = createRisk('LOW', 30);

      const result = makeDecision(classification, opportunity, risk);

      expect(result.decision).toBe('WATCH');
    });

    it('returns NEUTRAL for low score', () => {
      const classification = createClassification('sector_etf');
      const opportunity = createOpportunity(45);
      const risk = createRisk('LOW', 30);

      const result = makeDecision(classification, opportunity, risk);

      expect(result.decision).toBe('NEUTRAL');
    });
  });

  describe('Signal Confidence', () => {
    it('calculates confidence based on classification confidence and risk score', () => {
      const classification = createClassification('quality');
      classification.confidence = 0.95;
      const opportunity = createOpportunity(80);
      const risk = createRisk('LOW', 20);

      const result = makeDecision(classification, opportunity, risk);

      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.confidence).toBeLessThanOrEqual(0.98);
    });

    it('caps confidence at 0.98', () => {
      const classification = createClassification('quality');
      classification.confidence = 1.0;
      const opportunity = createOpportunity(90);
      const risk = createRisk('LOW', 10);

      const result = makeDecision(classification, opportunity, risk);

      expect(result.confidence).toBeLessThanOrEqual(0.98);
    });

    it('floors confidence at 0.3', () => {
      const classification = createClassification('speculative');
      classification.confidence = 0.5;
      const opportunity = createOpportunity(30);
      const risk = createRisk('HIGH', 95);

      const result = makeDecision(classification, opportunity, risk);

      expect(result.confidence).toBeGreaterThanOrEqual(0.3);
    });
  });
});