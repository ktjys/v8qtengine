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
  // 국내 주요 종목 (KOSPI / KOSDAQ)
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
  '000270': '기아',
  '000270.KS': '기아',
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
  '042700': '한미반도체',
  '042700.KS': '한미반도체',
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
  '051910': 'LG화학',
  '051910.KS': 'LG화학',
  '006400': '삼성SDI',
  '006400.KS': '삼성SDI',
  '012330': '현대모비스',
  '012330.KS': '현대모비스',
  '066570': 'LG전자',
  '066570.KS': 'LG전자',
  '028260': '삼성물산',
  '028260.KS': '삼성물산',
  '000810': '삼성화재',
  '000810.KS': '삼성화재',
  '316140': '우리금융지주',
  '316140.KS': '우리금융지주',
  '138040': '메리츠금융지주',
  '138040.KS': '메리츠금융지주',
  '086790': '하나금융지주',
  '086790.KS': '하나금융지주',
  '017670': 'SK텔레콤',
  '017670.KS': 'SK텔레콤',
  '030200': 'KT',
  '030200.KS': 'KT',
  '032640': 'LG유플러스',
  '032640.KS': 'LG유플러스',
  '096770': 'SK이노베이션',
  '096770.KS': 'SK이노베이션',
  '010950': 'S-Oil',
  '010950.KS': 'S-Oil',
  '003550': 'LG',
  '003550.KS': 'LG',
  '009150': '삼성전기',
  '009150.KS': '삼성전기',
  '051900': 'LG생활건강',
  '051900.KS': 'LG생활건강',
  '015760': '한국전력',
  '015760.KS': '한국전력',
  '047050': 'POSCO퓨처엠',
  '047050.KS': 'POSCO퓨처엠',
  '373130': '두산에너빌리티',
  '373130.KS': '두산에너빌리티',
  '034020': '두산밥캣',
  '034020.KS': '두산밥캣',
  '004020': '현대제철',
  '004020.KS': '현대제철',
  '010130': '고려아연',
  '010130.KS': '고려아연',
  '001450': '현대중공업',
  '001450.KS': '현대중공업',
  '393800': 'HD현대중공업',
  '393800.KS': 'HD현대중공업',
  '034220': 'LG디스플레이',
  '034220.KS': 'LG디스플레이',
  '092400': '한화에어로스페이스',
  '092400.KS': '한화에어로스페이스',
  '012450': '한화시스템',
  '012450.KS': '한화시스템',
  '009540': '한화솔루션',
  '009540.KS': '한화솔루션',
  '251270': '넷마블',
  '251270.KS': '넷마블',
  '259960': '크래프톤',
  '259960.KS': '크래프톤',
  '293490': '카카오게임즈',
  '293490.KS': '카카오게임즈',
  '326030': 'SK바이오팜',
  '326030.KS': 'SK바이오팜',
  '302440': 'SK바이오사이언스',
  '302440.KS': 'SK바이오사이언스',
  '139480': '제넥신',
  '139480.KQ': '제넥신',
  '095660': '네이버웹툰',
  '095660.KS': '네이버웹툰',
  '089590': 'LG헬로비전',
  '089590.KS': 'LG헬로비전',
  '047810': '한국항공우주',
  '047810.KS': '한국항공우주',
  '036570': '엔씨소프트',
  '036570.KS': '엔씨소프트',
  '025860': '펄어비스',
  '025860.KQ': '펄어비스',

  // 미국 주요 종목 친화적 한국어/약칭 매핑
  'AAPL': '애플 (Apple)',
  'NVDA': '엔비디아 (NVIDIA)',
  'MSFT': '마이크로소프트 (Microsoft)',
  'AMZN': '아마존 (Amazon)',
  'TSLA': '테슬라 (Tesla)',
  'GOOGL': '구글 (Alphabet)',
  'GOOG': '구글 (Alphabet C)',
  'META': '메타 (Meta)',
  'AMD': 'AMD',
  'PLTR': '팔란티어 (Palantir)',
  'AVGO': '브로드컴 (Broadcom)',
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
  'COST': '코스트코 (Costco)',
  'NFLX': '넷플릭스 (Netflix)',
  'ADBE': '어도비 (Adobe)',
  'CRM': '세일즈포스 (Salesforce)',
  'INTU': '인튜이트 (Intuit)',
  'NOW': '서비스나우 (ServiceNow)',
  'UBER': '우버 (Uber)',
  'ABNB': '에어비앤비 (Airbnb)',
  'SHOP': '쇼피파이 (Shopify)',
  'SQ': '블록 (Block)',
  'PYPL': '페이팔 (PayPal)',
  'COIN': '코인베이스 (Coinbase)',
  'MSTR': '마이크로스트래티지 (MicroStrategy)',
  'RIOT': '라이엇 플랫폼스 (Riot Platforms)',
  'MARA': '마라톤 디지털 (Marathon Digital)',
  'TSM': 'TSMC (Taiwan Semiconductor)',
  'ASML': 'ASML',
  'ARM': 'ARM 홀딩스 (ARM)',
  'QCOM': '퀄컴 (Qualcomm)',
  'TXN': '텍사스인스트루먼트 (TI)',
  'INTC': '인텔 (Intel)',
  'MU': '마이크론 (Micron)',
  'LRCX': '램리서치 (Lam Research)',
  'KLAC': 'KLA (KLA Corporation)',
  'AMAT': '어플라이드 머티어리얼즈 (Applied Materials)',
  'SNPS': '시놉시스 (Synopsys)',
  'CDNS': '케이던스 (Cadence)',
  'MRVL': '마벨 테크놀로지 (Marvell)',
  'ANET': '아리스타 네트웍스 (Arista Networks)',
  'PANW': '팔로알토 네트웍스 (Palo Alto Networks)',
  'CRWD': '크라우드스트라이크 (CrowdStrike)',
  'ZS': '지스케일러 (Zscaler)',
  'OKTA': '옥타 (Okta)',
  'DDOG': '데이터독 (Datadog)',
  'SNOW': '스노우플레이크 (Snowflake)',
  'MDB': '몽고DB (MongoDB)',
  'ESTC': '엘라스틱 (Elastic)',
  'TEAM': '아틀라시안 (Atlassian)',
  'WDAY': '워크데이 (Workday)',
  'ROKU': '로쿠 (Roku)',
  'TTD': '트레이드 데스크 (Trade Desk)',
  'RBLX': '로블록스 (Roblox)',
  'U': '유니티 (Unity)',
  'PLNT': '플래닛 피트니스 (Planet Fitness)',
  'DKNG': '드래프트킹스 (DraftKings)',
  'PENN': '펜 내셔널 게이밍 (Penn National Gaming)',
  'MGM': 'MGM 리조트 (MGM Resorts)',
  'LVS': '라스베이거스 샌즈 (Las Vegas Sands)',
  'WYNN': '윈 리조트 (Wynn Resorts)',
  'CCL': '카니발 (Carnival)',
  'RCL': '로얄 캐리비안 (Royal Caribbean)',
  'NCLH': '노르웨이지안 크루즈 (Norwegian Cruise)',
  'BA': '보잉 (Boeing)',
  'LMT': '록히드 마틴 (Lockheed Martin)',
  'RTX': 'RTX (Raytheon)',
  'NOC': '노스롭 그루먼 (Northrop Grumman)',
  'GD': '제너럴 다이내믹스 (General Dynamics)',
  'CAT': '캐터필러 (Caterpillar)',
  'DE': '디어 (Deere)',
  'HON': '하니웰 (Honeywell)',
  'MMM': '쓰리엠 (3M)',
  'GE': '제너럴 일렉트릭 (GE)',
  'UNP': '유니온 퍼시픽 (Union Pacific)',
  'FDX': '페덱스 (FedEx)',
  'UPS': 'UPS',
  'DAL': '델타 항공 (Delta Air Lines)',
  'UAL': '유나이티드 항공 (United Airlines)',
  'AAL': '아메리칸 항공 (American Airlines)',
  'LUV': '사우스웨스트 항공 (Southwest Airlines)',
  'JPM': 'JP모건 체이스 (JPMorgan Chase)',
  'BAC': '뱅크 오브 아메리카 (Bank of America)',
  'WFC': '웰스 파고 (Wells Fargo)',
  'C': '시티그룹 (Citigroup)',
  'GS': '골드만 삭스 (Goldman Sachs)',
  'MS': '모건 스탠리 (Morgan Stanley)',
  'BLK': '블랙록 (BlackRock)',
  'SCHW': '찰스 슈왑 (Charles Schwab)',
  'AXP': '아메리칸 익스프레스 (American Express)',
  'MA': '마스터카드 (Mastercard)',
  'COF': '캐피탈 원 (Capital One)',
  'USB': 'US 뱅코프 (US Bancorp)',
  'PNC': 'PNC 파이낸셜 (PNC Financial)',
  'TFC': '트루이스트 (Truist)',
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

