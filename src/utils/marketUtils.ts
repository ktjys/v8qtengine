import { MarketRegion } from '../types/v8';

/**
 * 티커 심볼을 기반으로 시장 지역(US: 미국, KR: 한국)을 판별합니다.
 * - .KS : 코스피 (KOSPI)
 * - .KQ : 코스닥 (KOSDAQ)
 * - 6자리 숫자 (예: 005930) : 한국 주식/ETF
 */
export function detectMarketRegion(ticker: string): MarketRegion {
  if (!ticker) return 'US';
  const clean = ticker.toUpperCase().trim();
  if (clean.endsWith('.KS') || clean.endsWith('.KQ')) {
    return 'KR';
  }
  // 6자리 숫자인 경우 한국 주식 코드로 처리
  if (/^\d{6}$/.test(clean)) {
    return 'KR';
  }
  return 'US';
}

/**
 * 한국 주식 티커의 Yahoo Finance 공식 심볼 형태로 정규화합니다.
 * 예: '005930' -> '005930.KS' (기본값)
 * 이미 .KS나 .KQ가 붙어있으면 그대로 유지
 */
export function normalizeTicker(ticker: string, isKosdaq = false): string {
  if (!ticker) return '';
  const clean = ticker.toUpperCase().trim();
  if (clean.endsWith('.KS') || clean.endsWith('.KQ')) {
    return clean;
  }
  if (/^\d{6}$/.test(clean)) {
    return `${clean}.${isKosdaq ? 'KQ' : 'KS'}`;
  }
  return clean;
}

/**
 * 화면 표시용 통화 기호
 */
export function getCurrencySymbol(region: MarketRegion): string {
  return region === 'KR' ? '₩' : '$';
}

/**
 * 벤치마크 지수 이름
 */
export function getBenchmarkName(region: MarketRegion): string {
  return region === 'KR' ? 'KOSPI 200 (069500.KS)' : 'S&P 500 (SPY)';
}

/**
 * 시장 거래 시간대 라벨 (KST 기준)
 */
export function getMarketHoursDescription(region: MarketRegion): string {
  return region === 'KR'
    ? '정규장 09:00 ~ 15:30 (KST)'
    : '정규장 22:30 ~ 05:00 (KST, 서머타임 기준)';
}

/**
 * 국내 및 주요 해외 대표 종목 표준 한글/영문 매핑 사전
 */
export const STOCK_NAME_DICTIONARY: Record<string, string> = {
  // 국내 주요 종목
  '005930': '삼성전자',
  '005930.KS': '삼성전자',
  '000660': 'SK하이닉스',
  '000660.KS': 'SK하이닉스',
  '373220': 'LG에너지솔루션',
  '373220.KS': 'LG에너지솔루션',
  '207940': '삼성바이오로직스',
  '207940.KS': '삼성바이오로직스',
  '005380': '현대차',
  '005380.KS': '현대차',
  '069500': 'KODEX 200',
  '069500.KS': 'KODEX 200',
  '360750': 'TIGER 미국S&P500',
  '360750.KS': 'TIGER 미국S&P500',
  '133690': 'TIGER 미국나스닥100',
  '133690.KS': 'TIGER 미국나스닥100',
  '458730': 'TIGER 미국배당다우존스',
  '458730.KS': 'TIGER 미국배당다우존스',
  '247540': '에코프로비엠',
  '247540.KQ': '에코프로비엠',
  '196170': '알테오젠',
  '196170.KQ': '알테오젠',
  '035420': 'NAVER',
  '035420.KS': 'NAVER',
  '068270': '셀트리온',
  '068270.KS': '셀트리온',
  '005490': 'POSCO홀딩스',
  '005490.KS': 'POSCO홀딩스',
  '035720': '카카오',
  '035720.KS': '카카오',
  '105560': 'KB금융',
  '105560.KS': 'KB금융',
  '055550': '신한지주',
  '055550.KS': '신한지주',
  // 미국 주요 종목 친화적 한국어/약칭 매핑
  'AAPL': '애플 (Apple)',
  'NVDA': '엔비디아 (NVIDIA)',
  'MSFT': '마이크로소프트 (Microsoft)',
  'AMZN': '아마존 (Amazon)',
  'TSLA': '테슬라 (Tesla)',
  'GOOGL': '구글 (Alphabet)',
  'META': '메타 (Meta)',
  'AMD': 'AMD',
  'PLTR': '팔란티어 (Palantir)',
  'SPY': 'S&P 500 (SPY)',
  'QQQ': '나스닥 100 (QQQ)',
  'QQQM': '나스닥 100 미니 (QQQM)',
  'VOO': '뱅가드 S&P 500 (VOO)',
  'SCHD': '슈왑 배당성장 (SCHD)',
  'SMH': '반도체 ETF (SMH)',
  'V': '비자 (Visa)',
  'JNJ': '존슨앤존슨 (J&J)',
  'HOOD': '로빈후드 (Robinhood)',
  'OKLO': '오클로 (Oklo)',
  'ORCL': '오라클 (Oracle)',
};

/**
 * 종목 코드(티커)와 이름을 결합하여 가장 직관적인 '종목명 우선' 표시 형식을 반환합니다.
 *
 * 정책:
 * 1. 국내 종목 (005930.KS 등):
 *    - primary: '삼성전자' (종목명 우선)
 *    - secondary: '005930' (숫자 코드)
 * 2. 미국 종목 (AAPL, NVDA 등):
 *    - primary: 'Apple Inc.' 혹은 사전 정의된 친화적 이름
 *    - secondary: 'AAPL' (티커)
 */
export function getStockDisplayInfo(ticker: string, rawName?: string): {
  primaryName: string;
  subCode: string;
  isKorean: boolean;
} {
  const isKr = detectMarketRegion(ticker) === 'KR';
  const cleanTicker = (ticker || '').toUpperCase().trim();
  const dictName = STOCK_NAME_DICTIONARY[cleanTicker] || STOCK_NAME_DICTIONARY[cleanTicker.replace(/\.(KS|KQ)$/, '')];

  let primaryName = '';
  let subCode = cleanTicker;

  if (isKr) {
    // 숫자를 떼어낸 6자리 코드
    const numericCode = cleanTicker.replace(/\.(KS|KQ)$/, '');
    subCode = numericCode;

    // 종목명이 유의미한 한글/이름인지 검사
    if (dictName) {
      primaryName = dictName;
    } else if (rawName && rawName !== ticker && !rawName.startsWith('0') && rawName.trim().length > 0) {
      primaryName = rawName;
    } else {
      primaryName = `국내종목 ${numericCode}`;
    }
  } else {
    // 미국 종목
    subCode = cleanTicker;
    if (dictName) {
      primaryName = dictName;
    } else if (rawName && rawName !== ticker && rawName.trim().length > 0) {
      primaryName = rawName;
    } else {
      primaryName = cleanTicker;
    }
  }

  return { primaryName, subCode, isKorean: isKr };
}

