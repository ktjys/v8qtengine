import {
  AssetClassification,
  FullTickerEvaluation,
  ScanRunLog,
  SignalSnapshot,
  WatchlistItem,
} from '../../types/v8';
import { classifyAsset, RawYahooMetadata } from '../../engine/classificationEngine';
import { calculateOpportunity, RawMarketIndicators } from '../../engine/opportunityEngine';
import { calculateRisk, RawRiskInputs } from '../../engine/riskEngine';
import { makeDecision } from '../../engine/decisionEngine';

export interface SeedTickerInfo {
  ticker: string;
  name: string;
  price: number;
  change1d: number;
  memo: string;
  metadata: RawYahooMetadata;
  indicators: RawMarketIndicators;
  riskInputs: RawRiskInputs;
  manualClassification?: Partial<AssetClassification>;
}

export const INITIAL_WATCHLIST_RAW: SeedTickerInfo[] = [
  {
    "ticker": "VOO",
    "name": "Vanguard S&P 500 ETF",
    "price": 707.24,
    "change1d": 0.5,
    "memo": "미국 대형주 핵심 패시브 코어 자산",
    "metadata": {
      "quoteType": "ETF",
      "longName": "Vanguard S&P 500 ETF",
      "beta": -0.02,
      "marketCap": 1250000000000,
      "trailingPE": 24.5,
      "forwardPE": 21.8
    },
    "indicators": {
      "price": 707.24,
      "ma20": 721.38,
      "ma50": 671.88,
      "ma200": 636.52,
      "rsi14": 56.7,
      "drawdownFromHigh": -0.013,
      "macdHistogramPositive": false,
      "return1M": 0.03,
      "return3M": 0.014,
      "return6M": 0.12,
      "relativeStrengthVsSpy": 1,
      "marketCapBillions": 1250,
      "forwardPe": 21.8,
      "trailingPe": 24.5,
      "pegRatio": null
    },
    "riskInputs": {
      "beta": -0.02,
      "volatility20dAnnualized": 0.092,
      "maxDrawdown52w": -0.013,
      "rsi14": 56.7,
      "priceBelowMa200": false
    }
  },
  {
    "ticker": "SCHD",
    "name": "Schwab U.S. Dividend Equity ETF",
    "price": 34.9,
    "change1d": -0.6,
    "memo": "배당성장 및 변동성 방어용 ETF",
    "metadata": {
      "quoteType": "ETF",
      "longName": "Schwab U.S. Dividend Equity ETF",
      "beta": -0.06,
      "marketCap": 60000000000,
      "trailingPE": 16.2,
      "forwardPE": 15.1,
      "dividendYield": 0.034
    },
    "indicators": {
      "price": 34.9,
      "ma20": 34.2,
      "ma50": 33.15,
      "ma200": 31.41,
      "rsi14": 63.5,
      "drawdownFromHigh": -0.012,
      "macdHistogramPositive": false,
      "return1M": 0.043,
      "return3M": 0.085,
      "return6M": 0.095,
      "relativeStrengthVsSpy": 1.07,
      "marketCapBillions": 60,
      "forwardPe": 15.1,
      "trailingPe": 16.2,
      "pegRatio": null
    },
    "riskInputs": {
      "beta": -0.06,
      "volatility20dAnnualized": 0.099,
      "maxDrawdown52w": -0.012,
      "rsi14": 63.5,
      "priceBelowMa200": false
    }
  },
  {
    "ticker": "NVDA",
    "name": "NVIDIA Corporation",
    "price": 217.55,
    "change1d": 1.32,
    "memo": "AI 가속기 및 데이터센터 GPU 독점 기업",
    "metadata": {
      "quoteType": "EQUITY",
      "longName": "NVIDIA Corporation",
      "sector": "Technology",
      "industry": "Semiconductors",
      "beta": -0.02,
      "marketCap": 4400000000000,
      "revenueGrowth": 0.94,
      "earningsGrowth": 1.12,
      "trailingPE": 52,
      "forwardPE": 36.5
    },
    "indicators": {
      "price": 217.55,
      "ma20": 221.9,
      "ma50": 206.67,
      "ma200": 195.8,
      "rsi14": 52.3,
      "drawdownFromHigh": -0.08,
      "macdHistogramPositive": false,
      "return1M": 0.084,
      "return3M": -0.03,
      "return6M": 0.192,
      "relativeStrengthVsSpy": 0.95,
      "marketCapBillions": 4400,
      "forwardPe": 36.5,
      "trailingPe": 52,
      "pegRatio": 0.85,
      "revenueGrowthYoy": 0.94,
      "earningsGrowthYoy": 1.12,
      "operatingMargin": 0.62,
      "freeCashFlowMargin": 0.48
    },
    "riskInputs": {
      "beta": -0.02,
      "volatility20dAnnualized": 0.461,
      "maxDrawdown52w": -0.08,
      "rsi14": 52.3,
      "priceBelowMa200": false
    }
  },
  {
    "ticker": "MSFT",
    "name": "Microsoft Corporation",
    "price": 513.53,
    "change1d": 6.27,
    "memo": "클라우드(Azure) 및 엔터프라이즈 AI 플랫폼 리더",
    "metadata": {
      "quoteType": "EQUITY",
      "longName": "Microsoft Corporation",
      "sector": "Technology",
      "industry": "Software - Infrastructure",
      "beta": 0.24,
      "marketCap": 3350000000000,
      "revenueGrowth": 0.16,
      "earningsGrowth": 0.18,
      "trailingPE": 35.8,
      "forwardPE": 29.4
    },
    "indicators": {
      "price": 513.53,
      "ma20": 503.26,
      "ma50": 487.85,
      "ma200": 462.18,
      "rsi14": 73.1,
      "drawdownFromHigh": -0.073,
      "macdHistogramPositive": false,
      "return1M": 0.105,
      "return3M": 0.115,
      "return6M": 0.289,
      "relativeStrengthVsSpy": 1.1,
      "marketCapBillions": 3350,
      "forwardPe": 29.4,
      "trailingPe": 35.8,
      "pegRatio": 1.65,
      "revenueGrowthYoy": 0.16,
      "earningsGrowthYoy": 0.18,
      "operatingMargin": 0.45,
      "freeCashFlowMargin": 0.33
    },
    "riskInputs": {
      "beta": 0.24,
      "volatility20dAnnualized": 0.211,
      "maxDrawdown52w": -0.073,
      "rsi14": 73.1,
      "priceBelowMa200": false
    }
  },
  {
    "ticker": "AAPL",
    "name": "Apple Inc.",
    "price": 319.7,
    "change1d": 3.35,
    "memo": "아이폰 생태계 및 서비스 매출 안정적 성장",
    "metadata": {
      "quoteType": "EQUITY",
      "longName": "Apple Inc.",
      "sector": "Technology",
      "industry": "Consumer Electronics",
      "beta": 0.07,
      "marketCap": 3520000000000,
      "revenueGrowth": 0.08,
      "earningsGrowth": 0.12,
      "trailingPE": 33.2,
      "forwardPE": 28
    },
    "indicators": {
      "price": 319.7,
      "ma20": 313.31,
      "ma50": 303.71,
      "ma200": 287.73,
      "rsi14": 57.4,
      "drawdownFromHigh": -0.072,
      "macdHistogramPositive": true,
      "return1M": 0.035,
      "return3M": 0.044,
      "return6M": 0.208,
      "relativeStrengthVsSpy": 1.03,
      "marketCapBillions": 3520,
      "forwardPe": 28,
      "trailingPe": 33.2,
      "pegRatio": 2.35,
      "revenueGrowthYoy": 0.08,
      "earningsGrowthYoy": 0.12,
      "operatingMargin": 0.31,
      "freeCashFlowMargin": 0.28
    },
    "riskInputs": {
      "beta": 0.07,
      "volatility20dAnnualized": 0.175,
      "maxDrawdown52w": -0.072,
      "rsi14": 57.4,
      "priceBelowMa200": false
    }
  },
  {
    "ticker": "JNJ",
    "name": "Johnson & Johnson",
    "price": 268.04,
    "change1d": -0.81,
    "memo": "헬스케어 및 제약 글로벌 대표 방어주",
    "metadata": {
      "quoteType": "EQUITY",
      "longName": "Johnson & Johnson",
      "sector": "Healthcare",
      "industry": "Drug Manufacturers - General",
      "beta": -0.05,
      "marketCap": 395000000000,
      "revenueGrowth": 0.05,
      "earningsGrowth": 0.07,
      "trailingPE": 17.5,
      "forwardPE": 15.2,
      "dividendYield": 0.031
    },
    "indicators": {
      "price": 268.04,
      "ma20": 262.68,
      "ma50": 254.64,
      "ma200": 241.24,
      "rsi14": 56,
      "drawdownFromHigh": -0.03,
      "macdHistogramPositive": false,
      "return1M": 0.046,
      "return3M": 0.199,
      "return6M": 0.078,
      "relativeStrengthVsSpy": 1.18,
      "marketCapBillions": 395,
      "forwardPe": 15.2,
      "trailingPe": 17.5,
      "pegRatio": 2.1,
      "revenueGrowthYoy": 0.05,
      "earningsGrowthYoy": 0.07,
      "operatingMargin": 0.28,
      "freeCashFlowMargin": 0.22
    },
    "riskInputs": {
      "beta": -0.05,
      "volatility20dAnnualized": 0.189,
      "maxDrawdown52w": -0.03,
      "rsi14": 56,
      "priceBelowMa200": false
    }
  },
  {
    "ticker": "SMH",
    "name": "VanEck Semiconductor ETF",
    "price": 553.11,
    "change1d": -1.3,
    "memo": "글로벌 반도체 밸류체인 집중 투자 ETF",
    "metadata": {
      "quoteType": "ETF",
      "longName": "VanEck Semiconductor ETF",
      "beta": -0.38,
      "marketCap": 28000000000,
      "trailingPE": 42,
      "forwardPE": 31.5
    },
    "indicators": {
      "price": 553.11,
      "ma20": 564.17,
      "ma50": 525.45,
      "ma200": 497.8,
      "rsi14": 45,
      "drawdownFromHigh": -0.177,
      "macdHistogramPositive": false,
      "return1M": 0.023,
      "return3M": -0.09,
      "return6M": 0.361,
      "relativeStrengthVsSpy": 0.89,
      "marketCapBillions": 28,
      "forwardPe": 31.5,
      "trailingPe": 42,
      "pegRatio": null
    },
    "riskInputs": {
      "beta": -0.38,
      "volatility20dAnnualized": 0.359,
      "maxDrawdown52w": -0.177,
      "rsi14": 45,
      "priceBelowMa200": false
    }
  },
  {
    "ticker": "OKLO",
    "name": "Oklo Inc.",
    "price": 40.14,
    "change1d": -4.63,
    "memo": "차세대 소형 모듈 원자로(SMR) 개발 스타트업",
    "metadata": {
      "quoteType": "EQUITY",
      "longName": "Oklo Inc.",
      "sector": "Energy",
      "industry": "Nuclear",
      "beta": -0.59,
      "marketCap": 3200000000
    },
    "indicators": {
      "price": 40.14,
      "ma20": 40.94,
      "ma50": 38.13,
      "ma200": 36.13,
      "rsi14": 43.8,
      "drawdownFromHigh": -0.793,
      "macdHistogramPositive": false,
      "return1M": 0.034,
      "return3M": -0.4,
      "return6M": -0.379,
      "relativeStrengthVsSpy": 0.59,
      "marketCapBillions": 3.2,
      "forwardPe": null,
      "trailingPe": null,
      "pegRatio": null
    },
    "riskInputs": {
      "beta": -0.59,
      "volatility20dAnnualized": 0.955,
      "maxDrawdown52w": -0.793,
      "rsi14": 43.8,
      "priceBelowMa200": true
    }
  },
  {
    "ticker": "PLTR",
    "name": "Palantir Technologies Inc.",
    "price": 186.29,
    "change1d": 3.53,
    "memo": "AIP 인공지능 플랫폼 엔터프라이즈 및 정부 도입 가속",
    "metadata": {
      "quoteType": "EQUITY",
      "longName": "Palantir Technologies Inc.",
      "sector": "Technology",
      "industry": "Software - Infrastructure",
      "beta": 0.29,
      "marketCap": 168000000000,
      "revenueGrowth": 0.36,
      "earningsGrowth": 0.85,
      "trailingPE": 110,
      "forwardPE": 75
    },
    "indicators": {
      "price": 186.29,
      "ma20": 182.56,
      "ma50": 176.98,
      "ma200": 167.66,
      "rsi14": 69.3,
      "drawdownFromHigh": -0.102,
      "macdHistogramPositive": true,
      "return1M": 0.514,
      "return3M": 0.16,
      "return6M": 0.283,
      "relativeStrengthVsSpy": 1.14,
      "marketCapBillions": 168,
      "forwardPe": 75,
      "trailingPe": 110,
      "pegRatio": 1.85,
      "revenueGrowthYoy": 0.36,
      "earningsGrowthYoy": 0.85,
      "operatingMargin": 0.24,
      "freeCashFlowMargin": 0.32
    },
    "riskInputs": {
      "beta": 0.29,
      "volatility20dAnnualized": 1.141,
      "maxDrawdown52w": -0.102,
      "rsi14": 69.3,
      "priceBelowMa200": true
    }
  },
  {
    "ticker": "QQQ",
    "name": "Invesco QQQ Trust",
    "price": 716.43,
    "change1d": 0.42,
    "memo": "나스닥 100 대형 혁신 기술주 대표 ETF",
    "metadata": {
      "quoteType": "ETF",
      "longName": "Invesco QQQ Trust",
      "beta": -0.1,
      "marketCap": 310000000000,
      "trailingPE": 31.5,
      "forwardPE": 26.8
    },
    "indicators": {
      "price": 716.43,
      "ma20": 730.76,
      "ma50": 680.61,
      "ma200": 644.79,
      "rsi14": 51.9,
      "drawdownFromHigh": -0.043,
      "macdHistogramPositive": false,
      "return1M": 0.041,
      "return3M": -0.035,
      "return6M": 0.178,
      "relativeStrengthVsSpy": 0.95,
      "marketCapBillions": 310,
      "forwardPe": 26.8,
      "trailingPe": 31.5,
      "pegRatio": null
    },
    "riskInputs": {
      "beta": -0.1,
      "volatility20dAnnualized": 0.174,
      "maxDrawdown52w": -0.043,
      "rsi14": 51.9,
      "priceBelowMa200": false
    }
  },
  {
    "ticker": "SPY",
    "name": "SPDR S&P 500 ETF Trust",
    "price": 769.35,
    "change1d": 0.47,
    "memo": "미국 S&P 500 시장 대표 지수 ETF",
    "metadata": {
      "quoteType": "ETF",
      "longName": "SPDR S&P 500 ETF Trust",
      "beta": 1,
      "marketCap": 610000000000,
      "trailingPE": 25.1,
      "forwardPE": 22.4
    },
    "indicators": {
      "price": 769.35,
      "ma20": 784.74,
      "ma50": 730.88,
      "ma200": 692.42,
      "rsi14": 56.6,
      "drawdownFromHigh": -0.013,
      "macdHistogramPositive": false,
      "return1M": 0.03,
      "return3M": 0.014,
      "return6M": 0.121,
      "relativeStrengthVsSpy": 1,
      "marketCapBillions": 610,
      "forwardPe": 22.4,
      "trailingPe": 25.1,
      "pegRatio": null
    },
    "riskInputs": {
      "beta": 1,
      "volatility20dAnnualized": 0.093,
      "maxDrawdown52w": -0.013,
      "rsi14": 56.6,
      "priceBelowMa200": false
    }
  },
  {
    "ticker": "AMZN",
    "name": "Amazon.com Inc.",
    "price": 266.43,
    "change1d": 3.02,
    "memo": "AWS 클라우드 인프라 및 이커머스 절대 강자",
    "metadata": {
      "quoteType": "EQUITY",
      "longName": "Amazon.com Inc.",
      "sector": "Consumer Cyclical",
      "industry": "Internet Retail",
      "beta": 1.43,
      "marketCap": 2280000000000,
      "revenueGrowth": 0.14,
      "earningsGrowth": 0.38,
      "trailingPE": 41.5,
      "forwardPE": 32
    },
    "indicators": {
      "price": 266.43,
      "ma20": 261.1,
      "ma50": 253.11,
      "ma200": 239.79,
      "rsi14": 55.9,
      "drawdownFromHigh": -0.072,
      "macdHistogramPositive": false,
      "return1M": -0.019,
      "return3M": 0.02,
      "return6M": 0.279,
      "relativeStrengthVsSpy": 1.01,
      "marketCapBillions": 2280,
      "forwardPe": 32,
      "trailingPe": 41.5,
      "pegRatio": 1.42,
      "revenueGrowthYoy": 0.14,
      "earningsGrowthYoy": 0.38,
      "operatingMargin": 0.11,
      "freeCashFlowMargin": 0.09
    },
    "riskInputs": {
      "beta": 1.43,
      "volatility20dAnnualized": 0.258,
      "maxDrawdown52w": -0.072,
      "rsi14": 55.9,
      "priceBelowMa200": false
    }
  },
  {
    "ticker": "GOOGL",
    "name": "Alphabet Inc.",
    "price": 346.59,
    "change1d": 0.51,
    "memo": "구글 검색 독점력, 유튜브 및 Gemini AI 생태계",
    "metadata": {
      "quoteType": "EQUITY",
      "longName": "Alphabet Inc.",
      "sector": "Communication Services",
      "industry": "Internet Content & Information",
      "beta": 1.38,
      "marketCap": 2340000000000,
      "revenueGrowth": 0.15,
      "earningsGrowth": 0.28,
      "trailingPE": 24.8,
      "forwardPE": 20.5
    },
    "indicators": {
      "price": 346.59,
      "ma20": 353.52,
      "ma50": 329.26,
      "ma200": 311.93,
      "rsi14": 49.3,
      "drawdownFromHigh": -0.152,
      "macdHistogramPositive": true,
      "return1M": -0.027,
      "return3M": -0.079,
      "return6M": 0.131,
      "relativeStrengthVsSpy": 0.91,
      "marketCapBillions": 2340,
      "forwardPe": 20.5,
      "trailingPe": 24.8,
      "pegRatio": 1.15,
      "revenueGrowthYoy": 0.15,
      "earningsGrowthYoy": 0.28,
      "operatingMargin": 0.32,
      "freeCashFlowMargin": 0.24
    },
    "riskInputs": {
      "beta": 1.38,
      "volatility20dAnnualized": 0.239,
      "maxDrawdown52w": -0.152,
      "rsi14": 49.3,
      "priceBelowMa200": false
    }
  },
  {
    "ticker": "META",
    "name": "Meta Platforms Inc.",
    "price": 578.02,
    "change1d": 5.11,
    "memo": "인스타그램/페이스북 광고 고효율화 및 Llama 오픈소스 AI 선도",
    "metadata": {
      "quoteType": "EQUITY",
      "longName": "Meta Platforms Inc.",
      "sector": "Communication Services",
      "industry": "Internet Content & Information",
      "beta": 1.4,
      "marketCap": 1730000000000,
      "revenueGrowth": 0.22,
      "earningsGrowth": 0.42,
      "trailingPE": 28.5,
      "forwardPE": 24
    },
    "indicators": {
      "price": 578.02,
      "ma20": 566.46,
      "ma50": 549.12,
      "ma200": 520.22,
      "rsi14": 49.6,
      "drawdownFromHigh": -0.269,
      "macdHistogramPositive": true,
      "return1M": 0.038,
      "return3M": -0.037,
      "return6M": -0.116,
      "relativeStrengthVsSpy": 0.95,
      "marketCapBillions": 10,
      "forwardPe": null,
      "trailingPe": null,
      "pegRatio": null
    },
    "riskInputs": {
      "beta": 1.4,
      "volatility20dAnnualized": 0.291,
      "maxDrawdown52w": -0.269,
      "rsi14": 49.6,
      "priceBelowMa200": true
    }
  },
  {
    "ticker": "TSLA",
    "name": "Tesla Inc.",
    "price": 348.75,
    "change1d": -3.89,
    "memo": "전기차(EV) 생태계, FSD 자율주행 및 에너지 스토리지",
    "metadata": {
      "quoteType": "EQUITY",
      "longName": "Tesla Inc.",
      "sector": "Consumer Cyclical",
      "industry": "Auto Manufacturers",
      "beta": 2.25,
      "marketCap": 1040000000000,
      "revenueGrowth": 0.09,
      "earningsGrowth": 0.18,
      "trailingPE": 88,
      "forwardPE": 68
    },
    "indicators": {
      "price": 348.75,
      "ma20": 341.78,
      "ma50": 331.31,
      "ma200": 313.88,
      "rsi14": 50.9,
      "drawdownFromHigh": -0.301,
      "macdHistogramPositive": true,
      "return1M": 0.121,
      "return3M": -0.161,
      "return6M": -0.135,
      "relativeStrengthVsSpy": 0.83,
      "marketCapBillions": 1040,
      "forwardPe": 68,
      "trailingPe": 88,
      "pegRatio": 2.85,
      "revenueGrowthYoy": 0.09,
      "earningsGrowthYoy": 0.18,
      "operatingMargin": 0.09,
      "freeCashFlowMargin": 0.07
    },
    "riskInputs": {
      "beta": 2.25,
      "volatility20dAnnualized": 0.37,
      "maxDrawdown52w": -0.301,
      "rsi14": 50.9,
      "priceBelowMa200": true
    }
  },
  {
    "ticker": "AMD",
    "name": "Advanced Micro Devices Inc.",
    "price": 465.58,
    "change1d": -1.62,
    "memo": "데이터센터 EPYC CPU 및 MI300 시리즈 AI 가속기 경쟁력",
    "metadata": {
      "quoteType": "EQUITY",
      "longName": "Advanced Micro Devices Inc.",
      "sector": "Technology",
      "industry": "Semiconductors",
      "beta": 3.16,
      "marketCap": 240000000000,
      "revenueGrowth": 0.28,
      "earningsGrowth": 0.62,
      "trailingPE": 65,
      "forwardPE": 34.5
    },
    "indicators": {
      "price": 465.58,
      "ma20": 474.89,
      "ma50": 442.3,
      "ma200": 419.02,
      "rsi14": 44.8,
      "drawdownFromHigh": -0.204,
      "macdHistogramPositive": false,
      "return1M": -0.022,
      "return3M": -0.087,
      "return6M": 1.344,
      "relativeStrengthVsSpy": 0.9,
      "marketCapBillions": 240,
      "forwardPe": 34.5,
      "trailingPe": 65,
      "pegRatio": 1.35,
      "revenueGrowthYoy": 0.28,
      "earningsGrowthYoy": 0.62,
      "operatingMargin": 0.15,
      "freeCashFlowMargin": 0.18
    },
    "riskInputs": {
      "beta": 3.16,
      "volatility20dAnnualized": 0.558,
      "maxDrawdown52w": -0.204,
      "rsi14": 44.8,
      "priceBelowMa200": false
    }
  },
  {
    "ticker": "V",
    "name": "Visa Inc.",
    "price": 381.6,
    "change1d": 2.85,
    "memo": "글로벌 결제 네트워크 독점 및 안정적 배당 성장 우량주",
    "metadata": {
      "quoteType": "EQUITY",
      "longName": "Visa Inc.",
      "sector": "Financial Services",
      "industry": "Credit Services",
      "beta": 0.29,
      "marketCap": 620000000000,
      "revenueGrowth": 0.11,
      "earningsGrowth": 0.14,
      "trailingPE": 30.5,
      "forwardPE": 25.8,
      "dividendYield": 0.0075
    },
    "indicators": {
      "price": 381.6,
      "ma20": 373.97,
      "ma50": 362.52,
      "ma200": 343.44,
      "rsi14": 65.5,
      "drawdownFromHigh": -0.01,
      "macdHistogramPositive": true,
      "return1M": 0.042,
      "return3M": 0.182,
      "return6M": 0.191,
      "relativeStrengthVsSpy": 1.17,
      "marketCapBillions": 10,
      "forwardPe": null,
      "trailingPe": null,
      "pegRatio": null
    },
    "riskInputs": {
      "beta": 0.29,
      "volatility20dAnnualized": 0.189,
      "maxDrawdown52w": -0.01,
      "rsi14": 65.5,
      "priceBelowMa200": false
    }
  },
  {
    "ticker": "ORCL",
    "name": "Oracle Corporation",
    "price": 150.85,
    "change1d": 2.99,
    "memo": "클라우드 인프라(OCI) 급성장 및 생성형 AI 데이터베이스 수요 확대",
    "metadata": {
      "quoteType": "EQUITY",
      "longName": "Oracle Corporation",
      "sector": "Technology",
      "industry": "Software - Infrastructure",
      "beta": 2.01,
      "marketCap": 465000000000,
      "revenueGrowth": 0.18,
      "earningsGrowth": 0.25,
      "trailingPE": 38.2,
      "forwardPE": 28.5,
      "dividendYield": 0.0095
    },
    "indicators": {
      "price": 150.85,
      "ma20": 147.83,
      "ma50": 143.31,
      "ma200": 135.76,
      "rsi14": 56.1,
      "drawdownFromHigh": -0.564,
      "macdHistogramPositive": true,
      "return1M": 0.162,
      "return3M": -0.392,
      "return6M": 0.011,
      "relativeStrengthVsSpy": 0.6,
      "marketCapBillions": 10,
      "forwardPe": null,
      "trailingPe": null,
      "pegRatio": null
    },
    "riskInputs": {
      "beta": 2.01,
      "volatility20dAnnualized": 0.411,
      "maxDrawdown52w": -0.564,
      "rsi14": 56.1,
      "priceBelowMa200": true
    }
  },
  {
    "ticker": "HOOD",
    "name": "Robinhood Markets, Inc.",
    "price": 32.85,
    "change1d": 3.45,
    "memo": "모바일 리테일 금융 플랫폼 및 암호화폐 거래 고성장주",
    "metadata": {
      "quoteType": "EQUITY",
      "longName": "Robinhood Markets, Inc.",
      "sector": "Financial Services",
      "industry": "Capital Markets",
      "beta": 1.68,
      "marketCap": 28500000000,
      "revenueGrowth": 0.35,
      "earningsGrowth": 0.85,
      "trailingPE": 42.5,
      "forwardPE": 28.0
    },
    "indicators": {
      "price": 32.85,
      "ma20": 31.2,
      "ma50": 28.5,
      "ma200": 23.4,
      "rsi14": 62.4,
      "drawdownFromHigh": -0.085,
      "macdHistogramPositive": true,
      "return1M": 0.095,
      "return3M": 0.285,
      "return6M": 0.450,
      "relativeStrengthVsSpy": 1.35,
      "marketCapBillions": 28.5,
      "forwardPe": 28.0,
      "trailingPe": 42.5,
      "pegRatio": 1.2,
      "revenueGrowthYoy": 0.35,
      "earningsGrowthYoy": 0.85,
      "operatingMargin": 0.22,
      "freeCashFlowMargin": 0.18
    },
    "riskInputs": {
      "beta": 1.68,
      "volatility20dAnnualized": 0.38,
      "maxDrawdown52w": -0.085,
      "rsi14": 62.4,
      "priceBelowMa200": false
    }
  },
  {
    "ticker": "SPCX",
    "name": "CrossingBridge Pre-Merger SPAC ETF",
    "price": 21.15,
    "change1d": 0.05,
    "memo": "SPAC 상장 전 차익 거래 및 자본 보존형 저변동성 액티브 ETF",
    "metadata": {
      "quoteType": "ETF",
      "longName": "CrossingBridge Pre-Merger SPAC ETF",
      "beta": 0.05,
      "marketCap": 150000000,
      "trailingPE": 18.5,
      "forwardPE": 17.0
    },
    "indicators": {
      "price": 21.15,
      "ma20": 21.08,
      "ma50": 20.95,
      "ma200": 20.65,
      "rsi14": 54.2,
      "drawdownFromHigh": -0.005,
      "macdHistogramPositive": true,
      "return1M": 0.008,
      "return3M": 0.021,
      "return6M": 0.038,
      "relativeStrengthVsSpy": 0.95,
      "marketCapBillions": 0.15,
      "forwardPe": null,
      "trailingPe": null,
      "pegRatio": null
    },
    "riskInputs": {
      "beta": 0.05,
      "volatility20dAnnualized": 0.035,
      "maxDrawdown52w": -0.005,
      "rsi14": 54.2,
      "priceBelowMa200": false
    }
  }
];

export const INITIAL_HISTORICAL_SIGNALS: SignalSnapshot[] = [
  {
    id: 'sig-2026-08-15-NVDA',
    signal_date: '2026-08-15',
    ticker: 'NVDA',
    name: 'NVIDIA Corporation',
    signal_price: 172.4,
    strategy_type: 'established_growth',
    asset_type: 'equity',
    opportunity_score: 84,
    risk_level: 'MEDIUM',
    risk_score: 54,
    decision: 'STRONG_OPPORTUNITY',
    signal_confidence: 0.88,
    classification_confidence: 0.95,
    technical_score: 87,
    momentum_score: 91,
    fundamental_score: 88,
    valuation_score: 64,
    rsi: 58.4,
    drawdown: -4.8,
    return_5d: null, // 최근 발생(3거래일 경과)으로 아직 5D/10D/20D 미확정
    return_10d: null,
    return_20d: null,
    current_return: 5.1, // 현재 진행 중 수익률
    status: 'ACTIVE',
    is_closed: false,
    components: {
      weights: { technical: 0.25, momentum: 0.3, fundamental: 0.3, valuation: 0.15 },
      risk_reasons: ['고베타(Beta 1.68) 시장 대비 민감한 주가 변동'],
      decision_reason: '우수한 펀더멘털 및 기술적 추세 결합, 제어 가능한 리스크(MEDIUM) 상태의 강력한 기회',
    },
  },
  {
    id: 'sig-2026-08-12-PLTR',
    signal_date: '2026-08-12',
    ticker: 'PLTR',
    name: 'Palantir Technologies Inc.',
    signal_price: 68.9,
    strategy_type: 'established_growth',
    asset_type: 'equity',
    opportunity_score: 81,
    risk_level: 'MEDIUM',
    risk_score: 58,
    decision: 'STRONG_OPPORTUNITY',
    signal_confidence: 0.85,
    classification_confidence: 0.95,
    technical_score: 84,
    momentum_score: 93,
    fundamental_score: 79,
    valuation_score: 52,
    rsi: 61.2,
    drawdown: -6.5,
    return_5d: 6.2, // 5거래일 경과하여 5D 확정
    return_10d: null, // 10D/20D는 아직 미도달
    return_20d: null,
    current_return: 8.1,
    status: 'ACTIVE',
    is_closed: false,
    components: {
      weights: { technical: 0.25, momentum: 0.3, fundamental: 0.3, valuation: 0.15 },
      risk_reasons: ['고베타(Beta 2.15) 시장 대비 민감한 주가 변동'],
      decision_reason: '실적 기반 고성장세와 강력한 시장 지배력을 확보한 대형 성장주',
    },
  },
  {
    id: 'sig-2026-07-22-VOO',
    signal_date: '2026-07-22',
    ticker: 'VOO',
    name: 'Vanguard S&P 500 ETF',
    signal_price: 538.2,
    strategy_type: 'broad_market_etf',
    asset_type: 'etf',
    opportunity_score: 76,
    risk_level: 'LOW',
    risk_score: 28,
    decision: 'STRONG_OPPORTUNITY',
    signal_confidence: 0.92,
    classification_confidence: 0.98,
    technical_score: 79,
    momentum_score: 74,
    fundamental_score: null,
    valuation_score: 72,
    rsi: 54.2,
    drawdown: -1.8,
    return_5d: 1.2,
    return_10d: 2.1,
    return_20d: 3.5,
    return_60d: 7.8,
    return_120d: 14.2,
    return_252d: 24.5,
    current_return: 3.5,
    status: '20D_REACHED',
    is_closed: true,
    components: {
      weights: { technical: 0.45, momentum: 0.45, fundamental: 0.0, valuation: 0.1 },
      risk_reasons: ['변동성 및 베타가 안정적이며 기술적 지지선 유지 중'],
      decision_reason: '지수/섹터 ETF의 낮은 리스크(LOW)와 강력한 추세/풀백 반등 모멘텀(76점) 포착',
    },
  },
  {
    id: 'sig-2026-07-15-SMH',
    signal_date: '2026-07-15',
    ticker: 'SMH',
    name: 'VanEck Semiconductor ETF',
    signal_price: 265.1,
    strategy_type: 'sector_etf',
    asset_type: 'etf',
    opportunity_score: 79,
    risk_level: 'MEDIUM',
    risk_score: 48,
    decision: 'OPPORTUNITY',
    signal_confidence: 0.86,
    classification_confidence: 0.93,
    technical_score: 82,
    momentum_score: 85,
    fundamental_score: null,
    valuation_score: 62,
    rsi: 57.8,
    drawdown: -5.8,
    return_5d: 3.4,
    return_10d: 6.8,
    return_20d: 10.2,
    return_60d: 18.6,
    return_120d: 32.1,
    return_252d: 54.8,
    current_return: 10.2,
    status: '20D_REACHED',
    is_closed: true,
    components: {
      weights: { technical: 0.45, momentum: 0.45, fundamental: 0.0, valuation: 0.1 },
      risk_reasons: ['섹터 집중 및 중기 변동성 지수 대비 다소 높음'],
      decision_reason: 'ETF 추세 정배열 및 모멘텀 유효로 매수/편입 관점 접근 가능',
    },
  },
  {
    id: 'sig-2026-05-10-AAPL',
    signal_date: '2026-05-10',
    ticker: 'AAPL',
    name: 'Apple Inc.',
    signal_price: 215.3,
    strategy_type: 'established_growth',
    asset_type: 'equity',
    opportunity_score: 82,
    risk_level: 'LOW',
    risk_score: 32,
    decision: 'STRONG_OPPORTUNITY',
    signal_confidence: 0.90,
    classification_confidence: 0.96,
    technical_score: 83,
    momentum_score: 80,
    fundamental_score: 89,
    valuation_score: 68,
    rsi: 52.1,
    drawdown: -3.2,
    return_5d: 2.8,
    return_10d: 4.5,
    return_20d: 7.9,
    return_60d: 15.4,
    return_120d: 26.8,
    return_252d: 38.2,
    current_return: 7.9,
    status: '20D_REACHED',
    is_closed: true,
    components: {
      weights: { technical: 0.25, momentum: 0.3, fundamental: 0.3, valuation: 0.15 },
      risk_reasons: ['우수한 현금흐름 및 자사주 매입 기반 안정적 밸류에이션'],
      decision_reason: '견고한 마진율과 프리미엄 브랜드 파워를 바탕으로 한 안정적 대형 우량주',
    },
  },
  {
    id: 'sig-2026-04-18-MSFT',
    signal_date: '2026-04-18',
    ticker: 'MSFT',
    name: 'Microsoft Corporation',
    signal_price: 432.5,
    strategy_type: 'established_growth',
    asset_type: 'equity',
    opportunity_score: 85,
    risk_level: 'LOW',
    risk_score: 30,
    decision: 'STRONG_OPPORTUNITY',
    signal_confidence: 0.93,
    classification_confidence: 0.98,
    technical_score: 86,
    momentum_score: 84,
    fundamental_score: 92,
    valuation_score: 70,
    rsi: 55.6,
    drawdown: -2.4,
    return_5d: 3.1,
    return_10d: 5.8,
    return_20d: 9.4,
    return_60d: 16.2,
    return_120d: 28.5,
    return_252d: 42.0,
    current_return: 9.4,
    status: '20D_REACHED',
    is_closed: true,
    components: {
      weights: { technical: 0.25, momentum: 0.3, fundamental: 0.3, valuation: 0.15 },
      risk_reasons: ['클라우드 및 AI 수익화 성장세 지속'],
      decision_reason: '독점적 클라우드/AI 생태계 및 높은 재투자 수익률(ROIC) 보유',
    },
  },
  {
    id: 'sig-2026-03-05-SCHD',
    signal_date: '2026-03-05',
    ticker: 'SCHD',
    name: 'Schwab U.S. Dividend Equity ETF',
    signal_price: 81.4,
    strategy_type: 'dividend_etf',
    asset_type: 'etf',
    opportunity_score: 78,
    risk_level: 'LOW',
    risk_score: 22,
    decision: 'OPPORTUNITY',
    signal_confidence: 0.89,
    classification_confidence: 0.95,
    technical_score: 75,
    momentum_score: 72,
    fundamental_score: null,
    valuation_score: 84,
    rsi: 48.9,
    drawdown: -1.9,
    return_5d: 1.5,
    return_10d: 2.8,
    return_20d: 4.8,
    return_60d: 9.2,
    return_120d: 16.5,
    return_252d: 21.8,
    current_return: 4.8,
    status: '20D_REACHED',
    is_closed: true,
    components: {
      weights: { technical: 0.45, momentum: 0.45, fundamental: 0.0, valuation: 0.1 },
      risk_reasons: ['배당 안정성 및 가치주 중심 구성으로 하방 경직성 확보'],
      decision_reason: '배당 성장률과 건전한 재무지표를 고루 갖춘 방어형 배당 ETF',
    },
  },
];

export const INITIAL_SCAN_RUNS: ScanRunLog[] = [
  {
    run_id: 'run-20260819-060000',
    started_at: '2026-08-19T06:00:00.000Z',
    finished_at: '2026-08-19T06:00:04.250Z',
    watchlist_count: 20,
    evaluated_count: 20,
    signal_count: 4,
    failure_count: 0,
    failed_tickers: [],
    status: 'SUCCESS',
    error_summary: '정규장 마감 20개 전종목 무결성 평가 완료 (4건 진입 기회 포착)',
  },
  {
    run_id: 'run-20260818-180000',
    started_at: '2026-08-18T18:00:00.000Z',
    finished_at: '2026-08-18T18:00:05.100Z',
    watchlist_count: 20,
    evaluated_count: 19,
    signal_count: 3,
    failure_count: 1,
    failed_tickers: [
      {
        ticker: 'OKLO',
        error: 'Simulated quote API timeout (Gracefully logged and skipped)',
      },
    ],
    status: 'PARTIAL_SUCCESS',
    error_summary: '1건 API 실패 발생했으나 19개 종목 평가 지속 완료',
  },
];

export function runPipelineOnSeedData(
  manualOverrides: Record<string, AssetClassification> = {}
): {
  evaluations: FullTickerEvaluation[];
  watchlist: WatchlistItem[];
} {
  const evaluations: FullTickerEvaluation[] = [];
  const watchlist: WatchlistItem[] = [];

  for (const item of INITIAL_WATCHLIST_RAW) {
    // 1. Classification
    const classification = classifyAsset(
      item.ticker,
      item.metadata,
      manualOverrides[item.ticker]
    );

    // 2. Opportunity
    const opportunity = calculateOpportunity(classification, item.indicators);

    // 3. Risk
    const risk = calculateRisk(classification, item.riskInputs);

    // 4. Decision
    const decision = makeDecision(classification, opportunity, risk);

    // 5. Signal check - Valid opportunities with score >= 70
    const isSignal = decision.actionable && opportunity.opportunity_score >= 70;

    evaluations.push({
      ticker: item.ticker,
      name: item.name,
      price: item.price,
      change1d: item.change1d,
      evaluated_at: new Date().toISOString(),
      classification,
      opportunity,
      risk,
      decision,
      signal_generated: isSignal,
      data_quality: {
        data_quality_score: 85,
        data_freshness: 'FRESH',
        last_updated: new Date().toISOString(),
        source: 'seed',
        data_warnings: [],
        bars_count: 252,
        has_fundamentals: classification.asset_type === 'equity',
      },
    });

    watchlist.push({
      ticker: item.ticker,
      name: item.name,
      is_active: true,
      memo: item.memo,
      created_at: '2026-08-01T00:00:00.000Z',
    });
  }

  return { evaluations, watchlist };
}

// Backward compatibility alias
export const runV8PipelineOnSeedData = runPipelineOnSeedData;
