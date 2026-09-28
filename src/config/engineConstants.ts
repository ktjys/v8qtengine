/**
 * Centralized engine configuration constants.
 * All magic numbers from classification, opportunity, risk, decision, and dip-buy engines
 * are defined here for maintainability, auditability, and strategy versioning.
 *
 * When tuning strategies, update values here and bump ENGINE_VERSION in evaluateV8.ts
 */

// ==========================================
// CLASSIFICATION ENGINE CONSTANTS
// ==========================================

export const CLASSIFICATION_CONFIG = {
  // Market cap thresholds (USD)
  MEGACAP_THRESHOLD: 500_000_000_000,      // $500B+
  LARGE_CAP_THRESHOLD: 100_000_000_000,    // $100B+
  SPECULATIVE_MCAP_HIGH_BETA: 80_000_000_000,  // $80B for high beta speculative
  SPECULATIVE_MCAP_HIGH_GROWTH: 40_000_000_000, // $40B for high growth speculative

  // Growth thresholds
  HIGH_GROWTH_REVENUE_YOY: 0.20,   // 20%+ YoY revenue growth
  SPECULATIVE_GROWTH_REVENUE_YOY: 0.40, // 40%+ for speculative

  // Beta thresholds
  HIGH_BETA_THRESHOLD: 1.8,
  SPECULATIVE_BETA_THRESHOLD: 2.2,
  LOW_BETA_THRESHOLD: 0.8,
  QUALITY_BETA_MAX: 1.2,

  // Confidence scores
  CONFIDENCE_BROAD_MARKET_ETF: 0.98,
  CONFIDENCE_GROWTH_ETF: 0.95,
  CONFIDENCE_DIVIDEND_ETF: 0.95,
  CONFIDENCE_INCOME_ETF: 0.95,
  CONFIDENCE_SECTOR_ETF: 0.93,
  CONFIDENCE_OTHER_ETF: 0.75,
  CONFIDENCE_SPECULATIVE: 0.90,
  CONFIDENCE_ESTABLISHED_GROWTH: 0.95,
  CONFIDENCE_QUALITY: 0.96,
  CONFIDENCE_GENERAL_EQUITY: 0.70,
  CONFIDENCE_DEFAULT: 0.85,
};

// ==========================================
// OPPORTUNITY ENGINE CONSTANTS
// ==========================================

export const OPPORTUNITY_CONFIG = {
  // Base scores
  BASE_TECH_SCORE: 50,
  BASE_MOM_SCORE: 50,
  BASE_FUND_SCORE: 50,
  BASE_VAL_SCORE: 50,
  BASE_RSI_SCORE: 50,
  BASE_DD_SCORE: 50,

  // Score bounds
  MIN_FINAL_SCORE: 10,
  MAX_FINAL_SCORE: 98,
  MAX_VAL_SCORE: 95,

  // Technical scoring
  TECH_MA_ALIGNMENT_BULLISH: 18,
  TECH_MA_ALIGNMENT_PARTIAL: 8,
  TECH_MA_ALIGNMENT_BEARISH: -12,
  TECH_PRICE_ABOVE_MA20: 10,
  TECH_PRICE_BELOW_MA20: -6,
  TECH_MACD_HISTOGRAM_POSITIVE: 6,

  // RSI scoring
  RSI_OPTIMAL_MIN: 45,
  RSI_OPTIMAL_MAX: 62,
  RSI_OPTIMAL_SCORE: 85,
  RSI_OPTIMAL_BONUS: 12,
  RSI_DIP_MIN: 35,
  RSI_DIP_MAX: 45,
  RSI_DIP_SCORE: 75,
  RSI_DIP_BONUS: 8,
  RSI_STRONG_UPTREND_MIN: 62,
  RSI_STRONG_UPTREND_MAX: 72,
  RSI_STRONG_UPTREND_SCORE: 70,
  RSI_STRONG_UPTREND_BONUS: 6,
  RSI_OVERBOUGHT_MIN: 72,
  RSI_OVERBOUGHT_SCORE: 40,
  RSI_OVERBOUGHT_PENALTY: -10,
  RSI_OVERSOLD_BEARISH_SCORE: 35,
  RSI_OVERSOLD_BEARISH_PENALTY: -8,

  // Drawdown scoring
  DD_NEAR_HIGHS_MAX: -0.03,
  DD_NEAR_HIGHS_SCORE: 70,
  DD_NEAR_HIGHS_BONUS: 4,
  DD_HEALTHY_PULLBACK_MIN: -0.10,
  DD_HEALTHY_PULLBACK_MAX: -0.03,
  DD_HEALTHY_PULLBACK_SCORE: 88,
  DD_HEALTHY_PULLBACK_BONUS: 8,
  DD_MODERATE_CORRECTION_MIN: -0.20,
  DD_MODERATE_CORRECTION_MAX: -0.10,
  DD_MODERATE_CORRECTION_SCORE: 65,
  DD_DEEP_CRASH_MAX: -0.20,
  DD_DEEP_CRASH_SCORE: 40,
  DD_DEEP_CRASH_PENALTY: -10,

  // Momentum scoring
  MOM_1M_STRONG: 0.05,
  MOM_1M_STRONG_BONUS: 12,
  MOM_1M_POSITIVE_BONUS: 5,
  MOM_1M_NEGATIVE_PENALTY: -10,
  MOM_3M_STRONG: 0.12,
  MOM_3M_STRONG_BONUS: 15,
  MOM_3M_POSITIVE: 0.03,
  MOM_3M_POSITIVE_BONUS: 8,
  MOM_3M_NEGATIVE_PENALTY: -10,
  MOM_6M_STRONG: 0.20,
  MOM_6M_STRONG_BONUS: 12,
  MOM_6M_POSITIVE: 0.05,
  MOM_6M_POSITIVE_BONUS: 6,

  // Relative strength vs SPY
  RS_STRONG: 1.25,
  RS_STRONG_BONUS: 15,
  RS_POSITIVE: 1.05,
  RS_POSITIVE_BONUS: 8,
  RS_WEAK: 0.85,
  RS_WEAK_PENALTY: -12,

  // Fundamental scoring (equities only)
  FUND_REV_GROWTH_VERY_HIGH: 0.35,
  FUND_REV_GROWTH_VERY_HIGH_BONUS: 22,
  FUND_REV_GROWTH_HIGH: 0.18,
  FUND_REV_GROWTH_HIGH_BONUS: 14,
  FUND_REV_GROWTH_POSITIVE: 0.08,
  FUND_REV_GROWTH_POSITIVE_BONUS: 6,
  FUND_REV_GROWTH_NEGATIVE_PENALTY: -15,

  FUND_EPS_GROWTH_VERY_HIGH: 0.30,
  FUND_EPS_GROWTH_VERY_HIGH_BONUS: 16,
  FUND_EPS_GROWTH_HIGH: 0.12,
  FUND_EPS_GROWTH_HIGH_BONUS: 8,
  FUND_EPS_GROWTH_NEGATIVE_PENALTY: -10,

  FUND_OP_MARGIN_EXCELLENT: 0.30,
  FUND_OP_MARGIN_EXCELLENT_BONUS: 12,
  FUND_OP_MARGIN_GOOD: 0.18,
  FUND_OP_MARGIN_GOOD_BONUS: 6,
  FUND_OP_MARGIN_POOR: 0.05,
  FUND_OP_MARGIN_POOR_PENALTY: -10,

  FUND_FCF_MARGIN_EXCELLENT: 0.20,
  FUND_FCF_MARGIN_EXCELLENT_BONUS: 8,

  // Valuation scoring (ETFs)
  ETF_VAL_PE_CHEAP: 18,
  ETF_VAL_PE_CHEAP_SCORE: 80,
  ETF_VAL_PE_FAIR: 25,
  ETF_VAL_PE_FAIR_SCORE: 65,
  ETF_VAL_PE_RICH: 32,
  ETF_VAL_PE_RICH_SCORE: 52,
  ETF_VAL_PE_EXPENSIVE_SCORE: 40,

  // Valuation scoring (equities)
  EQUITY_VAL_PEG_CHEAP: 1.2,
  EQUITY_VAL_PEG_CHEAP_BONUS: 22,
  EQUITY_VAL_PEG_FAIR: 1.8,
  EQUITY_VAL_PEG_FAIR_BONUS: 12,
  EQUITY_VAL_PEG_EXPENSIVE: 3.0,
  EQUITY_VAL_PEG_EXPENSIVE_PENALTY: -15,
  EQUITY_VAL_FWD_PE_CHEAP: 22,
  EQUITY_VAL_FWD_PE_CHEAP_BONUS: 12,
  EQUITY_VAL_FWD_PE_EXPENSIVE: 50,
  EQUITY_VAL_FWD_PE_EXPENSIVE_PENALTY: -12,

  // Default growth assumption for PEG calc
  DEFAULT_EARNINGS_GROWTH_FOR_PEG: 0.15,
  MIN_EARNINGS_GROWTH_FOR_PEG: 0.05,
};

// ==========================================
// STRATEGY WEIGHTS
// ==========================================

export const STRATEGY_WEIGHTS: Record<string, { technical: number; momentum: number; fundamental: number; valuation: number }> = {
  broad_market_etf: { technical: 0.45, momentum: 0.45, fundamental: 0.0, valuation: 0.10 },
  growth_etf: { technical: 0.40, momentum: 0.45, fundamental: 0.0, valuation: 0.15 },
  dividend_etf: { technical: 0.35, momentum: 0.30, fundamental: 0.0, valuation: 0.35 },
  income_etf: { technical: 0.40, momentum: 0.30, fundamental: 0.0, valuation: 0.30 },
  sector_etf: { technical: 0.45, momentum: 0.45, fundamental: 0.0, valuation: 0.10 },
  other_etf: { technical: 0.50, momentum: 0.40, fundamental: 0.0, valuation: 0.10 },
  quality: { technical: 0.25, momentum: 0.25, fundamental: 0.35, valuation: 0.15 },
  established_growth: { technical: 0.25, momentum: 0.30, fundamental: 0.30, valuation: 0.15 },
  speculative: { technical: 0.35, momentum: 0.45, fundamental: 0.10, valuation: 0.10 },
  general_equity: { technical: 0.30, momentum: 0.30, fundamental: 0.20, valuation: 0.20 },
};

// ==========================================
// RISK ENGINE CONSTANTS
// ==========================================

export const RISK_CONFIG = {
  // Base score
  BASE_RISK_SCORE: 30,
  MIN_RISK_SCORE: 10,
  MAX_RISK_SCORE: 99,

  // Beta thresholds
  BETA_EXTREME: 2.0,
  BETA_EXTREME_PENALTY: 24,
  BETA_HIGH: 1.4,
  BETA_HIGH_PENALTY: 12,
  BETA_LOW: 0.8,
  BETA_LOW_BONUS: -8,

  // Volatility thresholds (annualized)
  VOL_EXTREME: 0.60,
  VOL_EXTREME_PENALTY: 26,
  VOL_HIGH: 0.40,
  VOL_HIGH_PENALTY: 16,
  VOL_LOW: 0.18,
  VOL_LOW_BONUS: -6,

  // Max drawdown thresholds
  MDD_SEVERE: -0.40,
  MDD_SEVERE_PENALTY: 18,
  MDD_MODERATE: -0.25,
  MDD_MODERATE_PENALTY: 10,

  // Strategy penalties
  SPECULATIVE_PENALTY: 20,

  // Technical instability
  TECH_INSTABILITY_BASE: 20,
  PRICE_BELOW_MA200_PENALTY: 12,
  PRICE_BELOW_MA200_INSTABILITY_BONUS: 30,
  RSI_OVERBOUGHT_THRESHOLD: 75,
  RSI_OVERBOUGHT_PENALTY: 8,
  RSI_OVERBOUGHT_INSTABILITY_BONUS: 20,

  // Data uncertainty
  DATA_UNCERTAINTY_BASE: 10,
  MISSING_DATA_POINT_PENALTY: 5,
  MISSING_DATA_UNCERTAINTY_BONUS: 30,

  // Risk level thresholds
  RISK_LEVEL_HIGH_THRESHOLD: 65,
  RISK_LEVEL_MEDIUM_THRESHOLD: 42,
  // LOW: < 42, MEDIUM: 42-64, HIGH: >= 65
};

// ==========================================
// DECISION ENGINE CONSTANTS
// ==========================================

export const DECISION_CONFIG = {
  // Signal confidence calculation weights
  CONFIDENCE_CLASSIFICATION_WEIGHT: 0.5,
  CONFIDENCE_RISK_WEIGHT: 0.5,
  CONFIDENCE_RISK_DENOMINATOR: 150,
  MIN_CONFIDENCE: 0.3,
  MAX_CONFIDENCE: 0.98,

  // Speculative strategy thresholds
  SPECULATIVE_OPPORTUNITY_THRESHOLD: 82,
  SPECULATIVE_WATCH_HIGH_RISK_THRESHOLD: 70,
  SPECULATIVE_WATCH_THRESHOLD: 58,

  // Established growth & quality thresholds
  QUALITY_STRONG_OPPORTUNITY_THRESHOLD: 76,
  QUALITY_OPPORTUNITY_THRESHOLD: 68,
  QUALITY_WATCH_HIGH_RISK_THRESHOLD: 70,
  QUALITY_WATCH_THRESHOLD: 55,
  QUALITY_AVOID_THRESHOLD: 45,

  // ETF thresholds
  ETF_STRONG_OPPORTUNITY_THRESHOLD: 72,
  ETF_OPPORTUNITY_THRESHOLD: 64,
  ETF_WATCH_THRESHOLD: 52,

  // Default signal threshold (used in evaluateV8)
  DEFAULT_SIGNAL_THRESHOLD: 70,
};

// ==========================================
// DIP BUY ENGINE CONSTANTS
// ==========================================

export const DIP_BUY_CONFIG = {
  // Blue-chip suitability weights (sum = 100)
  SUITABILITY_INDEX_STATUS_WEIGHT: 30,
  SUITABILITY_MARKET_CAP_WEIGHT: 25,
  SUITABILITY_QUALITY_WEIGHT: 25,
  SUITABILITY_STABILITY_WEIGHT: 20,

  // Index/ETF status scores
  INDEX_STATUS_BROAD_MARKET_ETF: 30,
  INDEX_STATUS_SECTOR_ETF: 25,
  INDEX_STATUS_OTHER_ETF: 20,
  INDEX_STATUS_MEGACAP_QUALITY: 28,
  INDEX_STATUS_QUALITY: 24,
  INDEX_STATUS_ESTABLISHED_GROWTH: 20,
  INDEX_STATUS_SPECULATIVE: 5,
  INDEX_STATUS_GENERAL_EQUITY: 14,

  // Market cap scores (equities)
  MCAP_MEGACAP_500B: 25,
  MCAP_LARGE_150B: 22,
  MCAP_MID_LARGE_60B: 18,
  MCAP_MID_20B: 12,
  MCAP_SMALL: 4,
  ETF_MCAP_SCORE: 25,

  // Quality scores
  QUALITY_BASE: 10,
  QUALITY_OP_MARGIN_EXCELLENT: 0.25,
  QUALITY_OP_MARGIN_EXCELLENT_BONUS: 8,
  QUALITY_OP_MARGIN_GOOD: 0.15,
  QUALITY_OP_MARGIN_GOOD_BONUS: 5,
  QUALITY_OP_MARGIN_OK: 0.05,
  QUALITY_OP_MARGIN_OK_BONUS: 2,
  QUALITY_OP_MARGIN_POOR_PENALTY: -4,
  QUALITY_FCF_MARGIN_EXCELLENT: 0.20,
  QUALITY_FCF_MARGIN_EXCELLENT_BONUS: 7,
  QUALITY_FCF_MARGIN_GOOD: 0.10,
  QUALITY_FCF_MARGIN_GOOD_BONUS: 4,
  QUALITY_FCF_MARGIN_POSITIVE_BONUS: 1,
  QUALITY_FCF_MARGIN_NEGATIVE_PENALTY: -4,
  QUALITY_MAX_SCORE: 25,
  QUALITY_MIN_SCORE: 0,

  // Stability scores
  STABILITY_BASE: 10,
  STABILITY_BETA_VERY_LOW: 1.05,
  STABILITY_BETA_VERY_LOW_BONUS: 5,
  STABILITY_BETA_LOW: 1.35,
  STABILITY_BETA_LOW_BONUS: 3,
  STABILITY_BETA_MEDIUM: 1.7,
  STABILITY_BETA_MEDIUM_PENALTY: -2,
  STABILITY_BETA_HIGH_PENALTY: -6,
  STABILITY_MDD_LOW: 0.20,
  STABILITY_MDD_LOW_BONUS: 5,
  STABILITY_MDD_MODERATE: 0.35,
  STABILITY_MDD_MODERATE_BONUS: 2,
  STABILITY_MDD_HIGH_PENALTY: -4,
  STABILITY_MAX_SCORE: 20,
  STABILITY_MIN_SCORE: 0,

  // Tier thresholds
  TIER_S_THRESHOLD: 85,
  TIER_A_THRESHOLD: 70,
  TIER_B_THRESHOLD: 55,
  // C: < 55

  // Dip timing scores
  TIMING_RSI_DEEP_OVERSOLD: 32,
  TIMING_RSI_DEEP_OVERSOLD_SCORE: 40,
  TIMING_RSI_DIP_ZONE_MAX: 45,
  TIMING_RSI_DIP_ZONE_SCORE: 36,
  TIMING_RSI_HEALTHY_MAX: 55,
  TIMING_RSI_HEALTHY_SCORE: 25,
  TIMING_RSI_RISING_MAX: 68,
  TIMING_RSI_RISING_SCORE: 14,
  TIMING_RSI_OVERBOUGHT_SCORE: 0,

  // Drawdown scoring
  DD_NEAR_HIGH_MAX: -3.0,
  DD_NEAR_HIGH_SCORE: 12,
  DD_SHALLOW_MAX: -8.0,
  DD_SHALLOW_SCORE: 26,
  DD_GOLDEN_MAX: -18.0,
  DD_GOLDEN_SCORE: 35,
  DD_DEEP_MAX: -30.0,
  DD_DEEP_SCORE: 28,
  DD_CRASH_MAX: -30.0,
  DD_CRASH_SCORE: 15,

  // Support alignment
  SUPPORT_BASE: 12,
  SUPPORT_ABOVE_MA200_BONUS: 8,
  SUPPORT_NEAR_MA50_BONUS: 5,
  SUPPORT_BELOW_MA200_PENALTY: -4,
  MA50_PROXIMITY_THRESHOLD: 0.03,

  // Action signal thresholds
  STRONG_DIP_BUY_TIMING_THRESHOLD: 72,
  MODERATE_DCA_TIMING_THRESHOLD: 52,
  OVERBOUGHT_WAIT_TIMING_THRESHOLD: 35,

  // Dip score weighting
  DIP_SCORE_SUITABILITY_WEIGHT: 0.35,
  DIP_SCORE_TIMING_WEIGHT: 0.65,
  DIP_SCORE_UNSUITABLE_SUITABILITY_WEIGHT: 0.3,
};

// ==========================================
// BACKTEST ENGINE CONSTANTS
// ==========================================

export const BACKTEST_CONFIG = {
  // Default lookback periods
  DEFAULT_LOOKBACK_DAYS: 252,
  DEFAULT_LOOKBACK_6M: 126,
  DEFAULT_LOOKBACK_2Y: 504,
  DEFAULT_LOOKBACK_5Y: 1260,

  // Profit factor fallback
  PROFIT_FACTOR_INFINITE: 99,
  PROFIT_FACTOR_NEUTRAL: 1.0,

  // Median calculation uses standard definition (average of middle two for even count)
};

// ==========================================
// DATA QUALITY CONSTANTS
// ==========================================

export const DATA_QUALITY_CONFIG = {
  // Freshness thresholds (hours)
  FRESH_HOURS: 6,
  RECENT_HOURS: 24,
  STALE_HOURS: 72,
  // OUTDATED: > 72 hours

  // Minimum bars for quality
  MIN_BARS_FULL: 200,
  MIN_BARS_ACCEPTABLE: 50,

  // Quality score weights
  QUALITY_FRESHNESS_WEIGHT: 0.4,
  QUALITY_COMPLETENESS_WEIGHT: 0.3,
  QUALITY_CONSISTENCY_WEIGHT: 0.3,
};

// ==========================================
// SIGNAL ENGINE CONSTANTS
// ==========================================

export const SIGNAL_CONFIG = {
  // Deduplication window
  SAME_DAY_DEDUP: true,
  COOLDOWN_HOURS: 24,

  // Signal ID prefix
  SIGNAL_ID_PREFIX: 'sig-',
};

// ==========================================
// SCAN SERVICE CONSTANTS
// ==========================================

export const SCAN_CONFIG = {
  // Batch sizes
  PRELOAD_BATCH_SIZE: 10,
  EVALUATION_BATCH_SIZE: 5,
  SCAN_BATCH_SIZE: 10,

  // Rate limiting
  RATE_LIMIT_BATCH_SIZE: 4,
};

// ==========================================
// MARKET DATA SERVICE CONSTANTS
// ==========================================

export const MARKET_DATA_CONFIG = {
  // Cache TTL
  QUOTE_CACHE_TTL_MS: 60_000,        // 1 minute
  LIVE_QUOTE_CACHE_TTL_MS: 30_000,   // 30 seconds
  HISTORY_CACHE_TTL_MS: 300_000,     // 5 minutes
  BENCHMARK_CACHE_TTL_MS: 600_000,   // 10 minutes

  // Bar count normalization
  TARGET_BAR_COUNT: 252,
  MIN_BAR_COUNT: 50,

  // Timeouts
  QUOTE_FETCH_TIMEOUT_MS: 2500,
  HISTORY_FETCH_TIMEOUT_MS: 3000,
  STOOQ_FETCH_TIMEOUT_MS: 5000,
};

// ==========================================
// TECHNICAL INDICATORS CONSTANTS
// ==========================================

export const TECHNICAL_CONFIG = {
  // Moving average periods
  MA_SHORT: 20,
  MA_MEDIUM: 50,
  MA_LONG: 200,
  MA_52WEEK: 252,

  // RSI
  RSI_PERIOD: 14,
  RSI_DEFAULT: 50.0,

  // MACD
  MACD_FAST: 12,
  MACD_SLOW: 26,
  MACD_SIGNAL: 9,
};

// ==========================================
// MOMENTUM INDICATORS CONSTANTS
// ==========================================

export const MOMENTUM_CONFIG = {
  // Return periods
  RETURN_1M_DAYS: 21,
  RETURN_3M_DAYS: 63,
  RETURN_6M_DAYS: 126,

  // Volatility
  VOL_20D_PERIOD: 20,
  VOL_60D_PERIOD: 60,
  TRADING_DAYS_PER_YEAR: 252,
};

// ==========================================
// FUNDAMENTAL INDICATORS CONSTANTS
// ==========================================

export const FUNDAMENTAL_CONFIG = {
  // Default values when data unavailable
  DEFAULT_MARKET_CAP_BILLIONS: 10,
  DEFAULT_BETA: 1.0,
  DEFAULT_TRAILING_PE: 22,
  DEFAULT_FORWARD_PE: 22,
  DEFAULT_OPERATING_MARGIN: 0.15,
  DEFAULT_FCF_MARGIN: 0.12,
  DEFAULT_REVENUE_GROWTH: 0.10,
  DEFAULT_EARNINGS_GROWTH: 0.10,
};

// ==========================================
// POSITION SIZING CONSTANTS
// ==========================================

export const POSITION_SIZING_CONFIG = {
  // Kelly criterion
  KELLY_MAX_FRACTION: 0.25,    // Cap at 25% of portfolio
  KELLY_CONSERVATIVE_MULTIPLIER: 0.5, // Half-Kelly for safety

  // Risk level multipliers
  RISK_LOW_MULTIPLIER: 1.0,
  RISK_MEDIUM_MULTIPLIER: 0.7,
  RISK_HIGH_MULTIPLIER: 0.4,

  // Account limits
  MAX_POSITION_PCT: 10,        // Max 10% per position
  DEFAULT_RISK_TOLERANCE_PCT: 1.0, // 1% of equity per trade
};

// ==========================================
// MACRO / EARNINGS CONSTANTS
// ==========================================

export const MACRO_CONFIG = {
  // VIX thresholds
  VIX_NORMAL_MAX: 20,
  VIX_ELEVATED_MAX: 30,
  // PANIC: > 30

  // Regime multipliers
  RISK_ON_MULTIPLIER: 1.0,
  CAUTION_MULTIPLIER: 0.7,
  RISK_OFF_MULTIPLIER: 0.4,

  // Momentum cutoff bonuses
  RISK_ON_BONUS: 0,
  CAUTION_BONUS: 5,
  RISK_OFF_BONUS: 10,

  // Earnings risk
  EARNINGS_IMMINENT_DAYS: 7,
  EARNINGS_POSITION_CAP_IMMINENT: 0.5,
  EARNINGS_POSITION_CAP_SAFE: 1.0,
};

// ==========================================
// PORTFOLIO / SECTOR CONSTANTS
// ==========================================

export const PORTFOLIO_CONFIG = {
  // Sector caps
  SECTOR_MAX_CAP_PCT: 30,
  SECTOR_ELEVATED_PCT: 20,

  // Correlation thresholds
  HIGH_CORRELATION_THRESHOLD: 0.7,
  MODERATE_CORRELATION_THRESHOLD: 0.4,

  // Cash buffer
  MIN_CASH_BUFFER_PCT: 5,
  TARGET_CASH_BUFFER_PCT: 10,
};

// ==========================================
// EXIT SIGNAL CONSTANTS
// ==========================================

export const EXIT_CONFIG = {
  // Take profit levels
  TP1_PCT: 15,
  TP2_PCT: 25,

  // Stop loss
  STOP_LOSS_PCT: -7,

  // Trailing stop
  TRAILING_STOP_PCT: -7,

  // Technical exits
  RSI_OVERBOUGHT_EXIT: 75,
  MA20_BREAK_EXIT: true,
  MA50_BREAK_EXIT: true,
};

// ==========================================
// TYPE EXPORTS FOR CONSUMERS
// ==========================================

export type ClassificationConfig = typeof CLASSIFICATION_CONFIG;
export type OpportunityConfig = typeof OPPORTUNITY_CONFIG;
export type RiskConfig = typeof RISK_CONFIG;
export type DecisionConfig = typeof DECISION_CONFIG;
export type DipBuyConfig = typeof DIP_BUY_CONFIG;
export type BacktestConfig = typeof BACKTEST_CONFIG;
export type DataQualityConfig = typeof DATA_QUALITY_CONFIG;
export type SignalConfig = typeof SIGNAL_CONFIG;
export type ScanConfig = typeof SCAN_CONFIG;
export type MarketDataConfig = typeof MARKET_DATA_CONFIG;
export type TechnicalConfig = typeof TECHNICAL_CONFIG;
export type MomentumConfig = typeof MOMENTUM_CONFIG;
export type FundamentalConfig = typeof FUNDAMENTAL_CONFIG;
export type PositionSizingConfig = typeof POSITION_SIZING_CONFIG;
export type MacroConfig = typeof MACRO_CONFIG;
export type PortfolioConfig = typeof PORTFOLIO_CONFIG;
export type ExitConfig = typeof EXIT_CONFIG;