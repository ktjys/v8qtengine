import { classifyAsset } from '../classificationEngine';
import { AssetClassification } from '../../types/v8';

describe('classificationEngine', () => {
  const createRawMetadata = (overrides: Partial<{
    quoteType: string;
    longName: string;
    sector: string;
    industry: string;
    marketCap: number;
    revenueGrowth: number;
    beta: number;
  }> = {}) => ({
    quoteType: 'EQUITY',
    longName: 'Test Company',
    sector: 'Technology',
    industry: 'Semiconductors',
    marketCap: 100_000_000_000,
    revenueGrowth: 0.15,
    beta: 1.2,
    ...overrides,
  });

  describe('Manual Override Protection', () => {
    it('preserves manual override when classification_source is manual', () => {
      const existing: AssetClassification = {
        ticker: 'TEST',
        asset_type: 'equity',
        strategy_type: 'quality',
        confidence: 0.9,
        classification_source: 'manual',
        reason: 'Manual override by admin',
        classified_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      const result = classifyAsset('TEST', createRawMetadata(), existing);

      expect(result.classification_source).toBe('manual');
      expect(result.strategy_type).toBe('quality');
      expect(result.reason).toBe('Manual override by admin');
      expect(result.updated_at).not.toBe('2024-01-01T00:00:00Z'); // should be updated
    });

    it('reclassifies when classification_source is auto', () => {
      const existing: AssetClassification = {
        ticker: 'TEST',
        asset_type: 'equity',
        strategy_type: 'general_equity',
        confidence: 0.7,
        classification_source: 'auto',
        reason: 'Auto classified',
        classified_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      const result = classifyAsset('NVDA', createRawMetadata({ longName: 'NVIDIA Corporation' }), existing);

      expect(result.classification_source).toBe('auto');
      expect(result.strategy_type).toBe('established_growth');
    });
  });

  describe('ETF Classification', () => {
    it('classifies broad market ETFs correctly', () => {
      const result = classifyAsset('VOO', createRawMetadata({ quoteType: 'ETF', longName: 'Vanguard S&P 500 ETF' }));

      expect(result.asset_type).toBe('etf');
      expect(result.strategy_type).toBe('broad_market_etf');
      expect(result.confidence).toBe(0.98);
    });

    it('classifies growth ETFs correctly', () => {
      const result = classifyAsset('QQQ', createRawMetadata({ quoteType: 'ETF', longName: 'Invesco QQQ Trust' }));

      expect(result.asset_type).toBe('etf');
      expect(result.strategy_type).toBe('growth_etf');
      expect(result.confidence).toBe(0.95);
    });

    it('classifies dividend ETFs correctly', () => {
      const result = classifyAsset('SCHD', createRawMetadata({ quoteType: 'ETF', longName: 'Schwab US Dividend Equity ETF' }));

      expect(result.asset_type).toBe('etf');
      expect(result.strategy_type).toBe('dividend_etf');
      expect(result.confidence).toBe(0.95);
    });

    it('classifies income ETFs correctly', () => {
      const result = classifyAsset('JEPI', createRawMetadata({ quoteType: 'ETF', longName: 'JPMorgan Equity Premium Income ETF' }));

      expect(result.asset_type).toBe('etf');
      expect(result.strategy_type).toBe('income_etf');
      expect(result.confidence).toBe(0.95);
    });

    it('classifies sector ETFs correctly', () => {
      const result = classifyAsset('SMH', createRawMetadata({ quoteType: 'ETF', longName: 'VanEck Semiconductor ETF' }));

      expect(result.asset_type).toBe('etf');
      expect(result.strategy_type).toBe('sector_etf');
      expect(result.confidence).toBe(0.93);
    });

    it('classifies other ETFs with lower confidence', () => {
      const result = classifyAsset('TLT', createRawMetadata({ quoteType: 'ETF', longName: 'iShares 20+ Year Treasury Bond ETF' }));

      expect(result.asset_type).toBe('etf');
      expect(result.strategy_type).toBe('other_etf');
      expect(result.confidence).toBe(0.75);
    });

    it('detects ETF by name keywords', () => {
      const result = classifyAsset('UNKNOWN', createRawMetadata({ longName: 'Some ETF Fund' }));

      expect(result.asset_type).toBe('etf');
    });
  });

  describe('Equity Classification', () => {
    it('classifies speculative stocks correctly', () => {
      const result = classifyAsset('OKLO', createRawMetadata({ longName: 'Oklo Inc', marketCap: 10_000_000_000, beta: 2.5 }));

      expect(result.asset_type).toBe('equity');
      expect(result.strategy_type).toBe('speculative');
      expect(result.confidence).toBe(0.90);
    });

    it('classifies high beta small caps as speculative', () => {
      const result = classifyAsset('TEST', createRawMetadata({ marketCap: 50_000_000_000, beta: 2.0, revenueGrowth: 0.10 }));

      expect(result.strategy_type).toBe('speculative');
    });

    it('classifies high growth small caps as speculative', () => {
      const result = classifyAsset('TEST', createRawMetadata({ marketCap: 30_000_000_000, beta: 1.5, revenueGrowth: 0.50 }));

      expect(result.strategy_type).toBe('speculative');
    });

    it('classifies established growth stocks correctly', () => {
      const result = classifyAsset('NVDA', createRawMetadata({ longName: 'NVIDIA Corporation', marketCap: 2_000_000_000_000, revenueGrowth: 0.50 }));

      expect(result.asset_type).toBe('equity');
      expect(result.strategy_type).toBe('established_growth');
      expect(result.confidence).toBe(0.95);
    });

    it('classifies large cap high growth as established growth', () => {
      const result = classifyAsset('TEST', createRawMetadata({ marketCap: 200_000_000_000, revenueGrowth: 0.25 }));

      expect(result.strategy_type).toBe('established_growth');
    });

    it('classifies quality mega-caps correctly', () => {
      const result = classifyAsset('MSFT', createRawMetadata({ longName: 'Microsoft Corporation', marketCap: 3_000_000_000_000, beta: 1.0 }));

      expect(result.asset_type).toBe('equity');
      expect(result.strategy_type).toBe('quality');
      expect(result.confidence).toBe(0.96);
    });

    it('classifies low beta mega-caps as quality', () => {
      const result = classifyAsset('TEST', createRawMetadata({ marketCap: 600_000_000_000, beta: 1.1 }));

      expect(result.strategy_type).toBe('quality');
    });

    it('classifies general equity as fallback', () => {
      const result = classifyAsset('UNKNOWN', createRawMetadata({ marketCap: 50_000_000_000, beta: 1.2, revenueGrowth: 0.10 }));

      expect(result.asset_type).toBe('equity');
      expect(result.strategy_type).toBe('general_equity');
      expect(result.confidence).toBe(0.70);
    });
  });
});