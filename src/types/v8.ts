export type AssetType = 'etf' | 'equity' | 'other';

export type ETFStrategyType =
  | 'broad_market_etf'
  | 'growth_etf'
  | 'dividend_etf'
  | 'sector_etf'
  | 'income_etf'
  | 'other_etf';

export type EquityStrategyType =
  | 'quality'
  | 'established_growth'
  | 'speculative'
  | 'general_equity';

export type StrategyType = ETFStrategyType | EquityStrategyType;

export type ClassificationSource = 'auto' | 'manual';

export interface AssetClassification {
  ticker: string;
  asset_type: AssetType;
  strategy_type: StrategyType;
  confidence: number; // 0.0 ~ 1.0
  classification_source: ClassificationSource;
  reason: string;
  classified_at: string;
  updated_at: string;
  /** 수동 오버라이드가 유효해지는 기준일 (YYYY-MM-DD). PIT 백테스트에서 이 날짜 이후에만 적용. */
  effective_date?: string;
}

export interface TechnicalComponents {
  maTrend: 'BULLISH' | 'NEUTRAL' | 'BEARISH';
  rsi14: number;
  rsiScore: number;
  drawdownFromHigh: number; // e.g. -12.4%
  drawdownScore: number;
  ma20Above50: boolean;
  ma50Above200: boolean;
  priceAboveMa20: boolean;
  macdHistogramPositive: boolean;
  macd?: number;
  macdSignal?: number;
  macdHistogram?: number;
}

export interface MomentumComponents {
  return1M: number;
  return3M: number;
  return6M: number;
  return12M?: number;
  relativeStrengthVsSpy: number;
  momentumScore: number;
  trendPersistence: number;
}

export interface FundamentalComponents {
  revenueGrowthYoy: number | null; // %
  earningsGrowthYoy: number | null; // %
  operatingMargin: number | null; // %
  freeCashFlowMargin: number | null; // %
  marketCapBillions: number | null;
  isEtf: boolean;
}

export interface ValuationComponents {
  peTrailing: number | null;
  peForward: number | null;
  psRatio: number | null;
  evToEbitda: number | null;
  pegRatio: number | null;
  isEtf: boolean;
}

export interface SubScores {
  technical_score: number; // 0 ~ 100
  momentum_score: number; // 0 ~ 100
  fundamental_score: number | null; // 0 ~ 100 or null for ETFs
  valuation_score: number | null; // 0 ~ 100 or null
}

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface RiskComponents {
  beta: number;
  volatility20dAnnualized: number; // %
  maxDrawdown52w: number; // %
  isSpeculative: boolean;
  technicalInstabilityScore: number;
  dataUncertaintyScore: number;
}

export interface RiskEvaluation {
  risk_score: number; // 0 ~ 100
  risk_level: RiskLevel;
  components: RiskComponents;
  risk_reasons: string[];
}

export type DecisionType =
  | 'STRONG_OPPORTUNITY'
  | 'OPPORTUNITY'
  | 'WATCH'
  | 'NEUTRAL'
  | 'AVOID';

export interface DecisionEvaluation {
  decision: DecisionType;
  opportunity_score: number; // 0 ~ 100
  confidence: number; // 0.0 ~ 1.0 (signal_confidence)
  reason: string;
  actionable: boolean;
  threshold_met: boolean;
  /** 리스크 기반 동적 포지션 비중 (포트폴리오 대비 %, 0~10). 신호 시점의 제안 크기 */
  position_size_pct?: number;
  /** Kelly 지표 참조 (계산 세부값, 디버깅/텔레그램 표시용) */
  kelly_fraction?: number;
  win_probability?: number;
  payoff_ratio?: number;
}

export interface OpportunityEvaluation {
  opportunity_score: number;
  sub_scores: SubScores;
  weights_used: {
    technical: number;
    momentum: number;
    fundamental: number;
    valuation: number;
  };
  technical_details: TechnicalComponents;
  momentum_details: MomentumComponents;
  fundamental_details: FundamentalComponents;
  valuation_details: ValuationComponents;
}

export interface DataQualityReport {
  data_quality_score: number; // 0 ~ 100
  data_freshness: 'FRESH' | 'RECENT' | 'STALE' | 'OUTDATED';
  last_updated: string;
  source: 'yahoo' | 'seed' | 'database' | string;
  data_warnings: string[];
  bars_count: number;
  has_fundamentals: boolean;
}

/**
 * 데이터 소스 신뢰성 계약.
 *
 * - `isFallback`이 true이면 시장(OHLCV) 데이터 수집이 실패하고 허용된 폴백(seed 등)으로
 *   대체되었음을 의미한다. 이런 입력은 절대 매수/액션 신호를 생성해서는 안 된다. (하드 게이트)
 * - `source`는 데이터의 실제 출처를 정직하게 기록한다 (yahoo / seed / database / custom).
 * - `marketDataSource` / `fundamentalDataSource` / `classificationSource`는 각 데이터
 *   구성 요소의 출처를 독립적으로 추적한다. Fundamental이 seed baseline에서 온 경우
 *   `warnings`에 정직하게 표시한다 (차단하지 않고 플래그).
 */
export interface DataProvenance {
  /** 레거시: 전체 데이터의 대표 출처 (yahoo / seed / database / custom). */
  source: string;
  /** 시장(OHLCV) 폴백 여부 — 유일한 하드 게이트 판정 기준. true면 신호 차단. */
  isFallback: boolean;
  /** OHLCV 시장 데이터의 실제 출처 (yahoo / seed / database). */
  marketDataSource?: string;
  /** 펀더멘털 데이터의 실제 출처 (yahoo / seed / database). */
  fundamentalDataSource?: string;
  /** 분류의 출처 (rule_based / manual_override / seed). */
  classificationSource?: string;
  /** 정직한 출처 경고 (예: 'fundamentals sourced from seed baseline'). 차단하지 않는다. */
  warnings?: string[];
}

export interface FullTickerEvaluation {
  ticker: string;
  name: string;
  price: number;
  change1d: number;
  evaluated_at: string;
  classification: AssetClassification;
  opportunity: OpportunityEvaluation;
  risk: RiskEvaluation;
  decision: DecisionEvaluation;
  signal_generated: boolean;
  data_quality?: DataQualityReport;
  provenance?: DataProvenance;
  raw_metadata?: Record<string, any>;
}

export type SignalStatus =
  | 'NEW'
  | 'ACTIVE'
  | 'TRACKING'
  | '5D_REACHED'
  | '10D_REACHED'
  | '20D_REACHED'
  | 'CLOSED'
  | 'EXPIRED'
  | 'CANCELLED';

export interface SignalSnapshot {
  id: string;
  signal_date: string;
  ticker: string;
  name: string;
  signal_price: number;
  strategy_type: StrategyType;
  asset_type: AssetType;
  opportunity_score: number;
  risk_level: RiskLevel;
  risk_score: number;
  decision: DecisionType;
  signal_confidence: number;
  classification_confidence: number;
  /** 리스크 기반 동적 제안 포지션 비중 (포트폴리오 대비 %) */
  position_size_pct?: number;
  technical_score: number;
  momentum_score: number;
  fundamental_score: number | null;
  valuation_score: number | null;
  rsi: number;
  drawdown: number;
  return_1d?: number | null;
  return_5d: number | null;
  return_10d: number | null;
  return_20d: number | null;
  current_return: number | null;
  max_gain?: number;
  max_loss?: number;
  status?: SignalStatus;
  is_closed: boolean;
  components: {
    weights: { technical: number; momentum: number; fundamental: number; valuation: number };
    risk_reasons: string[];
    decision_reason: string;
  };
}

export interface WatchlistItem {
  ticker: string;
  name: string;
  is_active: boolean;
  memo: string;
  created_at: string;
}

export interface ScanRunItem {
  scan_run_id: string;
  ticker: string;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  error_code?: string;
  error_message?: string;
  started_at: string;
  finished_at: string;
  opportunity_score?: number;
  decision?: DecisionType;
}

export interface ScanRunLog {
  run_id: string;
  started_at: string;
  finished_at: string;
  watchlist_count: number;
  evaluated_count: number;
  signal_count: number;
  failure_count: number;
  failed_tickers: { ticker: string; error: string }[];
  items?: ScanRunItem[];
  status: 'SUCCESS' | 'PARTIAL_SUCCESS' | 'FAILED';
  error_summary?: string;
  created_at?: string;
}

export interface BacktestSummary {
  total_signals: number;
  completed_signals: number;
  win_rate_5d: number;
  win_rate_10d: number;
  win_rate_20d: number;
  avg_return_5d: number;
  avg_return_10d: number;
  avg_return_20d: number;
  median_return_20d: number;
  /** 장기 투자 지평 성과. 시그널당 전개 시간이 길어 샘플 수가 급감한다. */
  completed_signals_60d: number;
  win_rate_60d: number;
  avg_return_60d: number;
  completed_signals_120d: number;
  win_rate_120d: number;
  avg_return_120d: number;
  completed_signals_252d: number;
  win_rate_252d: number;
  avg_return_252d: number;
  /** positionSizePct(제안 비중)로 가중한 20d 평균 수익률. 사이징 적용 성과 */
  weighted_avg_return_20d?: number;
  /** 같은 시그널 셋의 등가중 20d 평균 수익률 (weighted와 비교용) */
  equal_weight_avg_return_20d?: number;
  /** 가중 지표 계산에 사용된 시그널 수 */
  weighted_monitor_count?: number;
  max_drawdown: number;
  profit_factor: number;
  expectancy?: number;
  by_strategy: Record<string, { count: number; win_rate_20d: number; avg_return_20d: number }>;
  by_risk: Record<RiskLevel, { count: number; win_rate_20d: number; avg_return_20d: number }>;
  by_opportunity_bucket: Record<string, { count: number; win_rate_20d: number; avg_return_20d: number }>;
}

export interface SystemStatus {
  dataProvider: 'yahoo' | 'seed' | 'fallback';
  marketStatus: {
    isOpen: boolean;
    lastSyncedAt: string;
    benchmarkPriceSPY: number;
  };
  dataCoverage: {
    ohlcvPercent: number;
    fundamentalsPercent: number;
    watchlistActiveCount: number;
  };
  dbStatus: {
    connected: boolean;
    type: 'supabase' | 'local_persistent';
    evaluationsCount: number;
    signalsCount: number;
    scanRunsCount: number;
  };
  lastScan?: {
    run_id: string;
    status: string;
    evaluated_count: number;
    signals_generated: number;
    timestamp: string;
  };
}

export interface DailyScorePoint {
  date: string;
  price: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  changePercent: number;
  ma20: number;
  ma50: number;
  ma200: number;
  rsi14: number;
  macd: number;
  macdSignal: number;
  macdHist: number;
  drawdownFromHigh: number;
  opportunityScore: number;
  technicalScore: number;
  momentumScore: number;
  fundamentalScore: number | null;
  valuationScore: number | null;
  riskScore: number;
  riskLevel: RiskLevel;
  strategyType: StrategyType;
  decision: DecisionType;
  isSignal: boolean;
  decisionReason: string;
}

export interface SymbolScoreHistorySummary {
  ticker: string;
  currentPrice: number;
  currentScore: number;
  score30dAgo: number;
  scoreChange30d: number;
  highestScoreDate: string;
  highestScore: number;
  lowestScoreDate: string;
  lowestScore: number;
  totalSignalsInPeriod: number;
  currentRsi: number;
  rsiState: 'OVERSOLD' | 'HEALTHY_BUY' | 'NEUTRAL' | 'OVERBOUGHT';
  trendState: 'STRONG_BULL' | 'BULL' | 'CORRECTION' | 'BEAR';
}

export interface SymbolScoreHistoryResult {
  ticker: string;
  range: string;
  summary: SymbolScoreHistorySummary;
  history: DailyScorePoint[];
}

