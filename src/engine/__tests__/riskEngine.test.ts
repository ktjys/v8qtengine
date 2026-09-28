import { calculateRisk, RawRiskInputs } from '../riskEngine';
import { AssetClassification, RiskLevel } from '../../types/v8';

describe('riskEngine', () => {
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

  const createInputs = (overrides: Partial<RawRiskInputs> = {}): RawRiskInputs => ({
    beta: 1.2,
    volatility20dAnnualized: 0.25,
    maxDrawdown52w: -0.15,
    rsi14: 55,
    priceBelowMa200: false,
    missingDataPoints: 0,
    ...overrides,
  });

  describe('Beta Scoring', () => {
    it('penalizes extreme beta (>2.0)', () => {
      const classification = createClassification('general_equity');
      const inputs = createInputs({ beta: 2.5 });

      const result = calculateRisk(classification, inputs);

      expect(result.risk_score).toBeGreaterThan(50);
      expect(result.risk_reasons.some(r => r.includes('초고베타'))).toBe(true);
    });

    it('penalizes high beta (>1.4)', () => {
      const classification = createClassification('general_equity');
      const inputs = createInputs({ beta: 1.6 });

      const result = calculateRisk(classification, inputs);

      expect(result.risk_score).toBeGreaterThan(40);
      expect(result.risk_reasons.some(r => r.includes('고베타'))).toBe(true);
    });

    it('rewards low beta (<0.8)', () => {
      const classification = createClassification('general_equity');
      const inputs = createInputs({ beta: 0.6 });

      const result = calculateRisk(classification, inputs);

      expect(result.risk_score).toBeLessThan(30);
    });
  });

  describe('Volatility Scoring', () => {
    it('penalizes extreme volatility (>60%)', () => {
      const classification = createClassification('general_equity');
      const inputs = createInputs({ volatility20dAnnualized: 0.70 });

      const result = calculateRisk(classification, inputs);

      expect(result.risk_score).toBeGreaterThan(50);
      expect(result.risk_reasons.some(r => r.includes('극단적 가격 흔들림'))).toBe(true);
    });

    it('penalizes high volatility (>40%)', () => {
      const classification = createClassification('general_equity');
      const inputs = createInputs({ volatility20dAnnualized: 0.50 });

      const result = calculateRisk(classification, inputs);

      expect(result.risk_score).toBeGreaterThan(45);
      expect(result.risk_reasons.some(r => r.includes('경계 필요'))).toBe(true);
    });

    it('rewards low volatility (<18%)', () => {
      const classification = createClassification('general_equity');
      const inputs = createInputs({ volatility20dAnnualized: 0.15 });

      const result = calculateRisk(classification, inputs);

      expect(result.risk_score).toBeLessThan(30);
    });
  });

  describe('Max Drawdown Scoring', () => {
    it('penalizes severe drawdown (<-40%)', () => {
      const classification = createClassification('general_equity');
      const inputs = createInputs({ maxDrawdown52w: -0.50 });

      const result = calculateRisk(classification, inputs);

      expect(result.risk_score).toBeGreaterThan(45);
      expect(result.risk_reasons.some(r => r.includes('추세 손상 위험'))).toBe(true);
    });

    it('penalizes moderate drawdown (<-25%)', () => {
      const classification = createClassification('general_equity');
      const inputs = createInputs({ maxDrawdown52w: -0.30 });

      const result = calculateRisk(classification, inputs);

      expect(result.risk_score).toBeGreaterThan(35);
      expect(result.risk_reasons.some(r => r.includes('반등 지지선 확인'))).toBe(true);
    });
  });

  describe('Strategy Penalty', () => {
    it('penalizes speculative strategy', () => {
      const classification = createClassification('speculative');
      const inputs = createInputs();

      const result = calculateRisk(classification, inputs);

      expect(result.components.isSpeculative).toBe(true);
      expect(result.risk_score).toBeGreaterThan(45);
      expect(result.risk_reasons.some(r => r.includes('투기/고변동성'))).toBe(true);
    });

    it('does not penalize non-speculative strategies', () => {
      const classification = createClassification('quality');
      const inputs = createInputs();

      const result = calculateRisk(classification, inputs);

      expect(result.components.isSpeculative).toBe(false);
      expect(result.risk_score).toBeLessThan(50);
    });
  });

  describe('Technical Instability', () => {
    it('penalizes price below 200MA', () => {
      const classification = createClassification('general_equity');
      const inputs = createInputs({ priceBelowMa200: true });

      const result = calculateRisk(classification, inputs);

      expect(result.risk_score).toBeGreaterThan(40);
      expect(result.risk_reasons.some(r => r.includes('200일 장기 이동평균선 하회'))).toBe(true);
      expect(result.components.technicalInstabilityScore).toBeGreaterThan(30);
    });

    it('penalizes overbought RSI (>75)', () => {
      const classification = createClassification('general_equity');
      const inputs = createInputs({ rsi14: 80 });

      const result = calculateRisk(classification, inputs);

      expect(result.risk_score).toBeGreaterThan(35);
      expect(result.risk_reasons.some(r => r.includes('과매수 영역'))).toBe(true);
    });
  });

  describe('Data Uncertainty', () => {
    it('penalizes missing data points', () => {
      const classification = createClassification('general_equity');
      // Base score 30 + 2 missing * 5 = 40
      const inputs = createInputs({ missingDataPoints: 2 });

      const result = calculateRisk(classification, inputs);

      expect(result.risk_score).toBeGreaterThanOrEqual(40);
      expect(result.risk_reasons.some(r => r.includes('불확실성 패널티'))).toBe(true);
      expect(result.components.dataUncertaintyScore).toBeGreaterThan(30);
    });
  });

  describe('Risk Level Classification', () => {
    it('returns LOW for score < 42', () => {
      const classification = createClassification('quality');
      const inputs = createInputs({ beta: 0.7, volatility20dAnnualized: 0.15, maxDrawdown52w: -0.10 });

      const result = calculateRisk(classification, inputs);

      expect(result.risk_level).toBe('LOW');
    });

    it('returns MEDIUM for score 42-64', () => {
      const classification = createClassification('general_equity');
      // beta 1.5 -> +12 (since > 1.4), vol 0.35 -> no penalty, mdd -0.20 -> no penalty
      // base 30 + 12 = 42 -> MEDIUM threshold
      const inputs = createInputs({ beta: 1.5, volatility20dAnnualized: 0.35, maxDrawdown52w: -0.20 });

      const result = calculateRisk(classification, inputs);

      expect(result.risk_level).toBe('MEDIUM');
    });

    it('returns HIGH for score >= 65', () => {
      const classification = createClassification('speculative');
      const inputs = createInputs({ beta: 2.5, volatility20dAnnualized: 0.70, maxDrawdown52w: -0.50 });

      const result = calculateRisk(classification, inputs);

      expect(result.risk_level).toBe('HIGH');
    });
  });

  describe('Score Bounds', () => {
    it('clamps risk score to 10-99 range', () => {
      const classification = createClassification('speculative');
      const inputs = createInputs({ beta: 3.0, volatility20dAnnualized: 1.0, maxDrawdown52w: -0.80, missingDataPoints: 10 });

      const result = calculateRisk(classification, inputs);

      expect(result.risk_score).toBeLessThanOrEqual(99);
      expect(result.risk_score).toBeGreaterThanOrEqual(10);
    });
  });

  describe('Default Reason', () => {
    it('provides default reason when no risks detected', () => {
      const classification = createClassification('quality');
      const inputs = createInputs({ beta: 0.7, volatility20dAnnualized: 0.15, maxDrawdown52w: -0.05, rsi14: 50 });

      const result = calculateRisk(classification, inputs);

      expect(result.risk_reasons.length).toBeGreaterThan(0);
      expect(result.risk_reasons[0]).toContain('안정적');
    });
  });
});