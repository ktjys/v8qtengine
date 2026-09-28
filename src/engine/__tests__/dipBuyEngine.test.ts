import { calculateBlueChipSuitability, calculateDipTiming, evaluateDipBuyStrategy } from '../dipBuyEngine';
import { AssetClassification, RawMarketIndicators, RawRiskInputs, RawYahooMetadata } from '../../types/v8';

describe('dipBuyEngine', () => {
  const createClassification = (strategy: AssetClassification['strategy_type'], asset_type: 'etf' | 'equity' = 'equity'): AssetClassification => ({
    ticker: 'TEST',
    asset_type,
    strategy_type: strategy,
    confidence: 0.9,
    classification_source: 'auto',
    reason: 'Test',
    classified_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  const createIndicators = (overrides: Partial<RawMarketIndicators> = {}): RawMarketIndicators => ({
    price: 100,
    ma20: 98,
    ma50: 95,
    ma200: 90,
    rsi14: 55,
    drawdownFromHigh: -0.05,
    macdHistogramPositive: true,
    return1M: 0.05,
    return3M: 0.15,
    return6M: 0.25,
    relativeStrengthVsSpy: 1.1,
    revenueGrowthYoy: 0.25,
    earningsGrowthYoy: 0.30,
    operatingMargin: 0.25,
    freeCashFlowMargin: 0.20,
    marketCapBillions: 100,
    trailingPe: 25,
    forwardPe: 22,
    psRatio: 5,
    pegRatio: 1.0,
    ...overrides,
  });

  const createMetadata = (overrides: Partial<RawYahooMetadata> = {}): RawYahooMetadata => ({
    quoteType: 'EQUITY',
    longName: 'Test Company',
    sector: 'Technology',
    industry: 'Semiconductors',
    marketCap: 100_000_000_000,
    revenueGrowth: 0.25,
    beta: 1.2,
    ...overrides,
  });

  const createRiskInputs = (overrides: Partial<RawRiskInputs> = {}): RawRiskInputs => ({
    beta: 1.2,
    volatility20dAnnualized: 0.25,
    maxDrawdown52w: -0.15,
    rsi14: 55,
    priceBelowMa200: false,
    missingDataPoints: 0,
    ...overrides,
  });

  describe('calculateBlueChipSuitability', () => {
    it('scores broad market ETFs highest for index status', () => {
      const classification = createClassification('broad_market_etf', 'etf');
      const indicators = createIndicators();

      const result = calculateBlueChipSuitability('VOO', classification, indicators);

      expect(result.breakdown.indexStatusScore).toBe(30);
      expect(result.tier).toBe('S');
      expect(result.isSuitable).toBe(true);
    });

    it('scores sector ETFs well for index status', () => {
      const classification = createClassification('sector_etf', 'etf');
      const indicators = createIndicators();

      const result = calculateBlueChipSuitability('SMH', classification, indicators);

      expect(result.breakdown.indexStatusScore).toBe(25);
    });

    it('scores mega-cap quality equities highest', () => {
      const classification = createClassification('quality');
      const indicators = createIndicators();
      const metadata = createMetadata({ marketCap: 2_000_000_000_000 });

      const result = calculateBlueChipSuitability('AAPL', classification, indicators, metadata);

      expect(result.breakdown.indexStatusScore).toBe(28);
    });

    it('scores quality strategy well', () => {
      const classification = createClassification('quality');
      const indicators = createIndicators();

      const result = calculateBlueChipSuitability('TEST', classification, indicators);

      expect(result.breakdown.indexStatusScore).toBe(24);
    });

    it('scores speculative very low', () => {
      const classification = createClassification('speculative');
      const indicators = createIndicators();

      const result = calculateBlueChipSuitability('TEST', classification, indicators);

      expect(result.breakdown.indexStatusScore).toBe(5);
      expect(result.isSuitable).toBe(false);
    });

    it('scores market cap correctly', () => {
      const classification = createClassification('quality');
      // Need >500B for max score, use 1T. Don't set marketCapBillions in indicators to use metadata.
      const metadata = createMetadata({ marketCap: 1_000_000_000_000 });
      const indicators = createIndicators({ marketCapBillions: undefined });

      const result = calculateBlueChipSuitability('TEST', classification, indicators, metadata);

      // The engine gives 25 for megacap >= 500B
      expect(result.breakdown.marketCapScore).toBe(25);
    });

    it('scores quality based on margins', () => {
      const classification = createClassification('quality');
      const indicators = createIndicators({ operatingMargin: 0.35, freeCashFlowMargin: 0.25 });

      const result = calculateBlueChipSuitability('TEST', classification, indicators);

      expect(result.breakdown.qualityScore).toBeGreaterThan(20);
    });

    it('scores stability based on beta and drawdown', () => {
      const classification = createClassification('quality');
      const riskInputs = createRiskInputs({ beta: 0.9, maxDrawdown52w: -0.10 });

      const result = calculateBlueChipSuitability('TEST', classification, createIndicators(), undefined, riskInputs);

      expect(result.breakdown.stabilityScore).toBeGreaterThan(15);
    });
  });

  describe('calculateDipTiming', () => {
    it('scores deep oversold RSI highly', () => {
      const indicators = createIndicators({ rsi14: 28 });

      const result = calculateDipTiming(indicators);

      expect(result.rsiZone).toBe('DEEP_OVERSOLD');
      expect(result.score).toBeGreaterThan(70);
    });

    it('scores dip zone RSI well', () => {
      const indicators = createIndicators({ rsi14: 40 });

      const result = calculateDipTiming(indicators);

      expect(result.rsiZone).toBe('DIP_ZONE');
      expect(result.score).toBeGreaterThan(60);
    });

    it('scores overbought RSI poorly', () => {
      const indicators = createIndicators({ rsi14: 80 });

      const result = calculateDipTiming(indicators);

      expect(result.rsiZone).toBe('OVERBOUGHT');
      // With overbought RSI (0 points) and neutral drawdown/support, score is around 55
      expect(result.score).toBeLessThan(60);
    });

    it('scores golden drawdown zone (-8% to -18%) highest', () => {
      const indicators = createIndicators({ drawdownFromHigh: -0.12, rsi14: 45 });

      const result = calculateDipTiming(indicators);

      expect(result.drawdownLabel).toContain('황금 눌림목');
      expect(result.score).toBeGreaterThan(70);
    });

    it('scores deep discount zone (-18% to -30%) well', () => {
      const indicators = createIndicators({ drawdownFromHigh: -0.25, rsi14: 45 });

      const result = calculateDipTiming(indicators);

      expect(result.drawdownLabel).toContain('깊은 할인');
    });

    it('rewards price above 200MA and near 50MA', () => {
      const indicators = createIndicators({ price: 100, ma200: 90, ma50: 99 });

      const result = calculateDipTiming(indicators);

      expect(result.supportLevel).toContain('50일 이동평균선 지지');
      expect(result.score).toBeGreaterThan(70);
    });

    it('penalizes price below 200MA', () => {
      const indicators = createIndicators({ price: 85, ma200: 90, ma50: 88, rsi14: 45 });

      const result = calculateDipTiming(indicators);

      expect(result.supportLevel).toContain('200일선 하회');
      // With RSI 45 (dip zone score 36) and below 200MA penalty, score around 68
      expect(result.score).toBeLessThan(75);
    });
  });

  describe('evaluateDipBuyStrategy', () => {
    it('returns INELIGIBLE_AVOID for unsuitable tickers', () => {
      const classification = createClassification('speculative');
      const indicators = createIndicators();

      const result = evaluateDipBuyStrategy('TEST', 'Test', 100, 0, classification, indicators);

      expect(result.actionSignal).toBe('INELIGIBLE_AVOID');
      expect(result.actionable).toBe(false);
      expect(result.signalLabel).toContain('추매 부적합');
    });

    it('returns STRONG_DIP_BUY for suitable with good timing', () => {
      const classification = createClassification('quality');
      const indicators = createIndicators({ rsi14: 35, drawdownFromHigh: -0.10 });
      const riskInputs = createRiskInputs({ beta: 1.0, maxDrawdown52w: -0.10 });

      const result = evaluateDipBuyStrategy('AAPL', 'Apple', 150, 0, classification, indicators, createMetadata({ marketCap: 2_000_000_000_000 }), riskInputs);

      expect(result.actionSignal).toBe('STRONG_DIP_BUY');
      expect(result.actionable).toBe(true);
      expect(result.signalLabel).toContain('적극 분할추매');
    });

    it('returns MODERATE_DCA for suitable with moderate timing', () => {
      const classification = createClassification('quality');
      const indicators = createIndicators({ rsi14: 50, drawdownFromHigh: -0.03 });
      const riskInputs = createRiskInputs({ beta: 1.0, maxDrawdown52w: -0.05 });

      const result = evaluateDipBuyStrategy('MSFT', 'Microsoft', 300, 0, classification, indicators, createMetadata({ marketCap: 2_000_000_000_000 }), riskInputs);

      expect(result.actionSignal).toBe('MODERATE_DCA');
      expect(result.actionable).toBe(true);
    });

    it('returns OVERBOUGHT_WAIT for overbought', () => {
      const classification = createClassification('quality');
      const indicators = createIndicators({ rsi14: 75, drawdownFromHigh: -0.02 });
      const riskInputs = createRiskInputs({ beta: 1.0 });

      const result = evaluateDipBuyStrategy('TEST', 'Test', 100, 0, classification, indicators, undefined, riskInputs);

      expect(result.actionSignal).toBe('OVERBOUGHT_WAIT');
      expect(result.actionable).toBe(false);
    });

    it('calculates dip score with correct weights', () => {
      const classification = createClassification('quality');
      const indicators = createIndicators({ rsi14: 40, drawdownFromHigh: -0.10 });
      const riskInputs = createRiskInputs({ beta: 1.0 });

      const result = evaluateDipBuyStrategy('TEST', 'Test', 100, 0, classification, indicators, undefined, riskInputs);

      // suitability ~80, timing ~80, dip = 0.35*80 + 0.65*80 = 80
      expect(result.dip_score).toBeGreaterThan(70);
    });
  });
});