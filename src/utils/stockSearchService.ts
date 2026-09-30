import { getStockDisplayInfo } from './marketUtils';

export interface StockInfo {
  ticker: string;          // e.g. '373220.KS', '005930.KS', 'NVDA'
  name: string;            // e.g. 'LG에너지솔루션', '삼성전자', '엔비디아'
  englishName?: string;    // e.g. 'LG Energy Solution', 'Samsung Electronics', 'NVIDIA Corp'
  market: 'KR' | 'US';
  exchange?: 'KOSPI' | 'KOSDAQ' | 'NASDAQ' | 'NYSE' | 'AMEX' | 'ETF' | string;
  aliases?: string[];      // e.g. ['엘지에너지솔루션', 'lg엔솔', '엔솔']
  sector?: string;
}

// 종합 국내/미국 대표 주식 마스터 데이터베이스 (KOSPI 100+, KOSDAQ 50+, 미국 대표 100+)
export const STOCK_MASTER_DATABASE: StockInfo[] = [
  // ========== 국내 주요 대형주 / 코스피 (KOSPI) ==========
  {
    ticker: '373220.KS',
    name: 'LG에너지솔루션',
    englishName: 'LG Energy Solution',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['lg에너지솔루션', '엘지에너지솔루션', 'lg엔솔', '엘지엔솔', '엔솔', '373220', '373220.ks', 'lgenergysolution'],
    sector: '2차전지 / 배터리',
  },
  {
    ticker: '005930.KS',
    name: '삼성전자',
    englishName: 'Samsung Electronics',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['삼성전자', '삼전', '005930', '005930.ks', 'samsung'],
    sector: '반도체 / 전기전자',
  },
  {
    ticker: '005935.KS',
    name: '삼성전자우',
    englishName: 'Samsung Electronics (Pref)',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['삼성전자우', '삼전우', '005935', '005935.ks'],
    sector: '반도체 / 우선주',
  },
  {
    ticker: '000660.KS',
    name: 'SK하이닉스',
    englishName: 'SK Hynix',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['sk하이닉스', '하이닉스', '하닉', '000660', '000660.ks', 'hynix'],
    sector: '반도체 (HBM)',
  },
  {
    ticker: '207940.KS',
    name: '삼성바이오로직스',
    englishName: 'Samsung Biologics',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['삼성바이오로직스', '삼바', '삼성바이오', '207940', '207940.ks'],
    sector: '바이오 / 제약',
  },
  {
    ticker: '005380.KS',
    name: '현대차',
    englishName: 'Hyundai Motor',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['현대차', '현대자동차', '005380', '005380.ks', 'hyundai'],
    sector: '자동차',
  },
  {
    ticker: '000270.KS',
    name: '기아',
    englishName: 'Kia Corp',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['기아', '기아차', '기아자동차', '000270', '000270.ks', 'kia'],
    sector: '자동차',
  },
  {
    ticker: '068270.KS',
    name: '셀트리온',
    englishName: 'Celltrion',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['셀트리온', '셀트', '068270', '068270.ks', 'celltrion'],
    sector: '바이오 / 제약',
  },
  {
    ticker: '035420.KS',
    name: 'NAVER',
    englishName: 'Naver Corp',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['네이버', 'naver', '035420', '035420.ks'],
    sector: '인터넷 / 플랫폼',
  },
  {
    ticker: '035720.KS',
    name: '카카오',
    englishName: 'Kakao Corp',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['카카오', 'kakao', '035720', '035720.ks'],
    sector: '인터넷 / 플랫폼',
  },
  {
    ticker: '005490.KS',
    name: 'POSCO홀딩스',
    englishName: 'POSCO Holdings',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['posco홀딩스', '포스코홀딩스', '포스코', 'posco', '005490', '005490.ks'],
    sector: '철강 / 2차전지 소재',
  },
  {
    ticker: '051910.KS',
    name: 'LG화학',
    englishName: 'LG Chem',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['lg화학', '엘지화학', '051910', '051910.ks', 'lgchem'],
    sector: '화학 / 배터리소재',
  },
  {
    ticker: '006400.KS',
    name: '삼성SDI',
    englishName: 'Samsung SDI',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['삼성sdi', '006400', '006400.ks', 'samsungsdi'],
    sector: '배터리 / 전자재료',
  },
  {
    ticker: '012330.KS',
    name: '현대모비스',
    englishName: 'Hyundai Mobis',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['현대모비스', '모비스', '012330', '012330.ks'],
    sector: '자동차 부품',
  },
  {
    ticker: '066570.KS',
    name: 'LG전자',
    englishName: 'LG Electronics',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['lg전자', '엘지전자', '066570', '066570.ks'],
    sector: '가전 / 전장',
  },
  {
    ticker: '028260.KS',
    name: '삼성물산',
    englishName: 'Samsung C&T',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['삼성물산', '028260', '028260.ks'],
    sector: '지주 / 건설',
  },
  {
    ticker: '105560.KS',
    name: 'KB금융',
    englishName: 'KB Financial Group',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['kb금융', '국민은행', '105560', '105560.ks'],
    sector: '금융 / 은행',
  },
  {
    ticker: '055550.KS',
    name: '신한지주',
    englishName: 'Shinhan Financial Group',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['신한지주', '신한은행', '신한금융', '055550', '055550.ks'],
    sector: '금융 / 은행',
  },
  {
    ticker: '086790.KS',
    name: '하나금융지주',
    englishName: 'Hana Financial Group',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['하나금융지주', '하나금융', '하나은행', '086790', '086790.ks'],
    sector: '금융 / 은행',
  },
  {
    ticker: '316140.KS',
    name: '우리금융지주',
    englishName: 'Woori Financial Group',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['우리금융지주', '우리금융', '우리은행', '316140', '316140.ks'],
    sector: '금융 / 은행',
  },
  {
    ticker: '138040.KS',
    name: '메리츠금융지주',
    englishName: 'Meritz Financial Group',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['메리츠금융지주', '메리츠금융', '메리츠', '138040', '138040.ks'],
    sector: '금융 / 보험',
  },
  {
    ticker: '000810.KS',
    name: '삼성화재',
    englishName: 'Samsung Fire & Marine',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['삼성화재', '000810', '000810.ks'],
    sector: '보험 / 금융',
  },
  {
    ticker: '015760.KS',
    name: '한국전력',
    englishName: 'KEPCO',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['한국전력', '한전', '015760', '015760.ks', 'kepco'],
    sector: '전력 / 유틸리티',
  },
  {
    ticker: '032830.KS',
    name: '삼성생명',
    englishName: 'Samsung Life Insurance',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['삼성생명', '032830', '032830.ks'],
    sector: '보험 / 금융',
  },
  {
    ticker: '042700.KS',
    name: '한미반도체',
    englishName: 'Hanmi Semiconductor',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['한미반도체', '042700', '042700.ks'],
    sector: '반도체 / TC본더 / HBM',
  },
  {
    ticker: '047050.KS',
    name: 'POSCO퓨처엠',
    englishName: 'POSCO Future M',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['posco퓨처엠', '포스코퓨처엠', '퓨처엠', '047050', '047050.ks'],
    sector: '2차전지 소재',
  },
  {
    ticker: '241560.KS',
    name: '두산밥캣',
    englishName: 'Doosan Bobcat',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['두산밥캣', '밥캣', '241560', '241560.ks'],
    sector: '기계 / 건설장비',
  },
  {
    ticker: '010130.KS',
    name: '고려아연',
    englishName: 'Korea Zinc',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['고려아연', '010130', '010130.ks'],
    sector: '비철금속',
  },
  {
    ticker: '010620.KS',
    name: 'HD현대미포',
    englishName: 'HD Hyundai Mipo',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['hd현대미포', '현대미포조선', '010620', '010620.ks'],
    sector: '조선',
  },
  {
    ticker: '042660.KS',
    name: '한화오션',
    englishName: 'Hanwha Ocean',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['한화오션', '대우조선해양', '042660', '042660.ks'],
    sector: '조선 / 방산',
  },
  {
    ticker: '012450.KS',
    name: '한화에어로스페이스',
    englishName: 'Hanwha Aerospace',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['한화에어로스페이스', '한화에어로', '012450', '012450.ks', '092400', '092400.ks'],
    sector: '항공우주 / 방산',
  },
  {
    ticker: '272210.KS',
    name: '한화시스템',
    englishName: 'Hanwha Systems',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['한화시스템', '272210', '272210.ks'],
    sector: '방산 / IT',
  },
  {
    ticker: '009540.KS',
    name: 'HD한국조선해양',
    englishName: 'HD Korea Shipbuilding & Offshore',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['hd한국조선해양', '한국조선해양', '009540', '009540.ks'],
    sector: '조선',
  },
  {
    ticker: '009830.KS',
    name: '한화솔루션',
    englishName: 'Hanwha Solutions',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['한화솔루션', '009830', '009830.ks'],
    sector: '태양광 / 화학',
  },
  {
    ticker: '017670.KS',
    name: 'SK텔레콤',
    englishName: 'SK Telecom',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['sk텔레콤', 'sk텔레', 'skt', '017670', '017670.ks'],
    sector: '통신',
  },
  {
    ticker: '030200.KS',
    name: 'KT',
    englishName: 'KT Corp',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['kt', '케이티', '030200', '030200.ks'],
    sector: '통신',
  },
  {
    ticker: '032640.KS',
    name: 'LG유플러스',
    englishName: 'LG Uplus',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['lg유플러스', '엘지유플러스', 'u+', '032640', '032640.ks'],
    sector: '통신',
  },
  {
    ticker: '096770.KS',
    name: 'SK이노베이션',
    englishName: 'SK Innovation',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['sk이노베이션', '096770', '096770.ks'],
    sector: '정유 / 배터리',
  },
  {
    ticker: '010950.KS',
    name: 'S-Oil',
    englishName: 'S-Oil Corp',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['s-oil', '에쓰오일', 's오일', '010950', '010950.ks'],
    sector: '정유',
  },
  {
    ticker: '003550.KS',
    name: 'LG',
    englishName: 'LG Corp',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['lg', '엘지', '003550', '003550.ks'],
    sector: '지주회사',
  },
  {
    ticker: '009150.KS',
    name: '삼성전기',
    englishName: 'Samsung Electro-Mechanics',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['삼성전기', '009150', '009150.ks'],
    sector: '전자부품 / MLCC',
  },
  {
    ticker: '051900.KS',
    name: 'LG생활건강',
    englishName: 'LG H&H',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['lg생활건강', '엘지생활건강', '051900', '051900.ks'],
    sector: '화장품 / 생활용품',
  },
  {
    ticker: '034220.KS',
    name: 'LG디스플레이',
    englishName: 'LG Display',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['lg디스플레이', '엘지디스플레이', '034220', '034220.ks'],
    sector: '디스플레이 / OLED',
  },
  {
    ticker: '259960.KS',
    name: '크래프톤',
    englishName: 'Krafton',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['크래프톤', '배틀그라운드', '배그', '259960', '259960.ks'],
    sector: '게임',
  },
  {
    ticker: '036570.KS',
    name: '엔씨소프트',
    englishName: 'NCsoft',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['엔씨소프트', '엔씨', '036570', '036570.ks'],
    sector: '게임',
  },
  {
    ticker: '251270.KS',
    name: '넷마블',
    englishName: 'Netmarble',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['넷마블', '251270', '251270.ks'],
    sector: '게임',
  },
  {
    ticker: '018260.KS',
    name: '삼성에스디에스',
    englishName: 'Samsung SDS',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['삼성에스디에스', '삼성sds', '018260', '018260.ks'],
    sector: 'IT 서비스',
  },
  {
    ticker: '326030.KS',
    name: 'SK바이오팜',
    englishName: 'SK Biopharm',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['sk바이오팜', '326030', '326030.ks'],
    sector: '바이오 / 뇌질환신약',
  },
  {
    ticker: '302440.KS',
    name: 'SK바이오사이언스',
    englishName: 'SK Bioscience',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['sk바이오사이언스', '302440', '302440.ks'],
    sector: '백신 / 바이오',
  },

  // ========== 국내 코스닥 주요 종목 (KOSDAQ) ==========
  {
    ticker: '247540.KQ',
    name: '에코프로비엠',
    englishName: 'Ecopro BM',
    market: 'KR',
    exchange: 'KOSDAQ',
    aliases: ['에코프로비엠', '247540', '247540.kq', 'ecoprobm'],
    sector: '2차전지 양극재',
  },
  {
    ticker: '086520.KQ',
    name: '에코프로',
    englishName: 'Ecopro',
    market: 'KR',
    exchange: 'KOSDAQ',
    aliases: ['에코프로', '086520', '086520.kq', 'ecopro'],
    sector: '2차전지 지주',
  },
  {
    ticker: '196170.KQ',
    name: '알테오젠',
    englishName: 'Alteogen',
    market: 'KR',
    exchange: 'KOSDAQ',
    aliases: ['알테오젠', '196170', '196170.kq', 'alteogen'],
    sector: '바이오 / SC제형기술',
  },
  {
    ticker: '277810.KQ',
    name: '레인보우로보틱스',
    englishName: 'Rainbow Robotics',
    market: 'KR',
    exchange: 'KOSDAQ',
    aliases: ['레인보우로보틱스', '레인보우', '277810', '277810.kq'],
    sector: '로봇 / 협동로봇',
  },
  {
    ticker: '025860.KQ',
    name: '펄어비스',
    englishName: 'Pearl Abyss',
    market: 'KR',
    exchange: 'KOSDAQ',
    aliases: ['펄어비스', '검은사막', '025860', '025860.kq'],
    sector: '게임',
  },
  {
    ticker: '293490.KQ',
    name: '카카오게임즈',
    englishName: 'Kakao Games',
    market: 'KR',
    exchange: 'KOSDAQ',
    aliases: ['카카오게임즈', '293490', '293490.kq'],
    sector: '게임',
  },
  {
    ticker: '035900.KQ',
    name: 'JYP Ent.',
    englishName: 'JYP Entertainment',
    market: 'KR',
    exchange: 'KOSDAQ',
    aliases: ['jyp', '제이와이피', 'jyp엔터', '035900', '035900.kq'],
    sector: '엔터테인먼트',
  },
  {
    ticker: '041510.KQ',
    name: '에스엠',
    englishName: 'SM Entertainment',
    market: 'KR',
    exchange: 'KOSDAQ',
    aliases: ['sm', '에스엠', 'sm엔터', '041510', '041510.kq'],
    sector: '엔터테인먼트',
  },
  {
    ticker: '122870.KQ',
    name: '와이지엔터테인먼트',
    englishName: 'YG Entertainment',
    market: 'KR',
    exchange: 'KOSDAQ',
    aliases: ['yg', '와이지', '와이지엔터', '122870', '122870.kq'],
    sector: '엔터테인먼트',
  },
  {
    ticker: '263750.KQ',
    name: '펄어비스',
    englishName: 'Pearl Abyss',
    market: 'KR',
    exchange: 'KOSDAQ',
    aliases: ['펄어비스', '263750', '263750.kq'],
    sector: '게임',
  },
  {
    ticker: '357780.KQ',
    name: '솔브레인',
    englishName: 'SoulBrain',
    market: 'KR',
    exchange: 'KOSDAQ',
    aliases: ['솔브레인', '357780', '357780.kq'],
    sector: '반도체 소재',
  },
  {
    ticker: '058470.KQ',
    name: '리노공업',
    englishName: 'Leeno Industrial',
    market: 'KR',
    exchange: 'KOSDAQ',
    aliases: ['리노공업', '리노핀', '058470', '058470.kq'],
    sector: '반도체 테스트 소켓',
  },
  {
    ticker: '214150.KQ',
    name: '클래시스',
    englishName: 'Classys',
    market: 'KR',
    exchange: 'KOSDAQ',
    aliases: ['클래시스', '슈링크', '214150', '214150.kq'],
    sector: '의료기기 / 미용',
  },

  // ========== 국내 대표 지수 ETF ==========
  {
    ticker: '069500.KS',
    name: 'KODEX 200',
    englishName: 'KODEX 200 ETF',
    market: 'KR',
    exchange: 'ETF',
    aliases: ['kodex200', '코덱스200', '코스피200', '069500', '069500.ks'],
    sector: '국내 시장 대표 지수',
  },
  {
    ticker: '102110.KS',
    name: 'TIGER 200',
    englishName: 'TIGER 200 ETF',
    market: 'KR',
    exchange: 'ETF',
    aliases: ['tiger200', '타이거200', '102110', '102110.ks'],
    sector: '국내 시장 대표 지수',
  },
  {
    ticker: '229200.KS',
    name: 'KODEX 코스닥150',
    englishName: 'KODEX Kosdaq 150',
    market: 'KR',
    exchange: 'ETF',
    aliases: ['kodex코스닥150', '코스닥150', '229200', '229200.ks'],
    sector: '코스닥 지수 ETF',
  },
  {
    ticker: '360750.KS',
    name: 'TIGER 미국S&P500',
    englishName: 'TIGER US S&P500 ETF',
    market: 'KR',
    exchange: 'ETF',
    aliases: ['tiger미국s&p500', '타이거미국s&p500', '타이거s&p500', '360750', '360750.ks'],
    sector: '미국 지수 추종 ETF',
  },
  {
    ticker: '133690.KS',
    name: 'TIGER 미국나스닥100',
    englishName: 'TIGER US Nasdaq 100 ETF',
    market: 'KR',
    exchange: 'ETF',
    aliases: ['tiger미국나스닥100', '타이거미국나스닥100', '타이거나스닥100', '133690', '133690.ks'],
    sector: '미국 나스닥 추종 ETF',
  },
  {
    ticker: '458730.KS',
    name: 'TIGER 미국배당다우존스',
    englishName: 'TIGER US Dividend Dow Jones (SCHD)',
    market: 'KR',
    exchange: 'ETF',
    aliases: ['tiger미국배당다우존스', '한국판schd', '타이거배당', '458730', '458730.ks'],
    sector: '배당 성장 ETF',
  },
  {
    ticker: '122630.KS',
    name: 'KODEX 레버리지',
    englishName: 'KODEX Leverage ETF',
    market: 'KR',
    exchange: 'ETF',
    aliases: ['kodex레버리지', '코덱스레버리지', '레버리지', '122630', '122630.ks'],
    sector: 'KOSPI200 2배 레버리지 ETF',
  },
  {
    ticker: '114800.KS',
    name: 'KODEX 인버스',
    englishName: 'KODEX Inverse ETF',
    market: 'KR',
    exchange: 'ETF',
    aliases: ['kodex인버스', '코덱스인버스', '인버스', '114800', '114800.ks'],
    sector: 'KOSPI200 인버스 ETF',
  },
  {
    ticker: '252670.KS',
    name: 'KODEX 200선물인버스2X',
    englishName: 'KODEX 200 Futures Inverse 2X',
    market: 'KR',
    exchange: 'ETF',
    aliases: ['kodex200선물인버스2x', '코덱스곱버스', '곱버스', '252670', '252670.ks'],
    sector: 'KOSPI200 인버스 2배 ETF',
  },
  {
    ticker: '132030.KS',
    name: 'KODEX 골드선물(H)',
    englishName: 'KODEX Gold Futures (H)',
    market: 'KR',
    exchange: 'ETF',
    aliases: ['kodex골드선물', '코덱스골드', '골드선물', '132030', '132030.ks'],
    sector: '금 선물 ETF',
  },
  {
    ticker: '153130.KS',
    name: 'KODEX 단기채권',
    englishName: 'KODEX Short-Term Bond ETF',
    market: 'KR',
    exchange: 'ETF',
    aliases: ['kodex단기채권', '코덱스단기채권', '단기채권', '153130', '153130.ks'],
    sector: '단기 채권 ETF',
  },
  {
    ticker: '233160.KS',
    name: 'KODEX 미국S&P500(H)',
    englishName: 'KODEX US S&P500 (H)',
    market: 'KR',
    exchange: 'ETF',
    aliases: ['kodex미국s&p500', '코덱스미국s&p500', '233160', '233160.ks'],
    sector: '미국 지수 추종 ETF',
  },
  {
    ticker: '233740.KS',
    name: 'KODEX 미국나스닥100(H)',
    englishName: 'KODEX US Nasdaq 100 (H)',
    market: 'KR',
    exchange: 'ETF',
    aliases: ['kodex미국나스닥100', '코덱스미국나스닥100', '233740', '233740.ks'],
    sector: '미국 나스닥 추종 ETF',
  },
  {
    ticker: '305720.KS',
    name: 'KODEX 2차전지산업',
    englishName: 'KODEX Secondary Battery Industry',
    market: 'KR',
    exchange: 'ETF',
    aliases: ['kodex2차전지', '코덱스2차전지', '2차전지', '305720', '305720.ks'],
    sector: '2차전지 테마 ETF',
  },
  {
    ticker: '091160.KS',
    name: 'KODEX 반도체',
    englishName: 'KODEX Semiconductor ETF',
    market: 'KR',
    exchange: 'ETF',
    aliases: ['kodex반도체', '코덱스반도체', '반도체etf', '091160', '091160.ks'],
    sector: '반도체 테마 ETF',
  },

  // ========== 미국 대표 기술주 & 블루칩 (US) ==========
  {
    ticker: 'NVDA',
    name: '엔비디아 (NVIDIA)',
    englishName: 'NVIDIA Corporation',
    market: 'US',
    exchange: 'NASDAQ',
    aliases: ['엔비디아', '엔비', 'nvda', 'nvidia'],
    sector: '반도체 / AI가속기',
  },
  {
    ticker: 'AAPL',
    name: '애플 (Apple)',
    englishName: 'Apple Inc.',
    market: 'US',
    exchange: 'NASDAQ',
    aliases: ['애플', '아이폰', 'aapl', 'apple'],
    sector: '소비자 테크 / 디바이스',
  },
  {
    ticker: 'MSFT',
    name: '마이크로소프트 (Microsoft)',
    englishName: 'Microsoft Corporation',
    market: 'US',
    exchange: 'NASDAQ',
    aliases: ['마이크로소프트', '마소', 'msft', 'microsoft'],
    sector: '소프트웨어 / 클라우드 / AI',
  },
  {
    ticker: 'AMZN',
    name: '아마존 (Amazon)',
    englishName: 'Amazon.com, Inc.',
    market: 'US',
    exchange: 'NASDAQ',
    aliases: ['아마존', 'amzn', 'amazon', 'aws'],
    sector: '이커머스 / 클라우드',
  },
  {
    ticker: 'TSLA',
    name: '테슬라 (Tesla)',
    englishName: 'Tesla, Inc.',
    market: 'US',
    exchange: 'NASDAQ',
    aliases: ['테슬라', '테슬', 'tsla', 'tesla'],
    sector: '전기차 / 자율주행 / 에너지',
  },
  {
    ticker: 'GOOGL',
    name: '구글 (Alphabet A)',
    englishName: 'Alphabet Inc. Class A',
    market: 'US',
    exchange: 'NASDAQ',
    aliases: ['구글', '알파벳', '알파벳a', 'googl', 'google'],
    sector: '인터넷 검색 / 유튜브 / AI',
  },
  {
    ticker: 'GOOG',
    name: '구글 (Alphabet C)',
    englishName: 'Alphabet Inc. Class C',
    market: 'US',
    exchange: 'NASDAQ',
    aliases: ['구글c', '알파벳c', 'goog'],
    sector: '인터넷 검색 / AI',
  },
  {
    ticker: 'META',
    name: '메타 (Meta)',
    englishName: 'Meta Platforms, Inc.',
    market: 'US',
    exchange: 'NASDAQ',
    aliases: ['메타', '페이스북', '인스타그램', 'meta', 'facebook'],
    sector: '소셜미디어 / AI / 메타버스',
  },
  {
    ticker: 'PLTR',
    name: '팔란티어 (Palantir)',
    englishName: 'Palantir Technologies',
    market: 'US',
    exchange: 'NYSE',
    aliases: ['팔란티어', '플트', 'pltr', 'palantir'],
    sector: '빅데이터 / AI엔터프라이즈',
  },
  {
    ticker: 'AMD',
    name: 'AMD',
    englishName: 'Advanced Micro Devices',
    market: 'US',
    exchange: 'NASDAQ',
    aliases: ['amd', '에이엠디', '라이젠'],
    sector: '반도체 / CPU / GPU',
  },
  {
    ticker: 'AVGO',
    name: '브로드컴 (Broadcom)',
    englishName: 'Broadcom Inc.',
    market: 'US',
    exchange: 'NASDAQ',
    aliases: ['브로드컴', 'avgo', 'broadcom'],
    sector: '통신 반도체 / 맞춤형ASIC',
  },
  {
    ticker: 'TSM',
    name: 'TSMC',
    englishName: 'Taiwan Semiconductor Manufacturing',
    market: 'US',
    exchange: 'NYSE',
    aliases: ['tsmc', '티에스엠씨', 'tsm'],
    sector: '반도체 파운드리',
  },
  {
    ticker: 'ASML',
    name: 'ASML',
    englishName: 'ASML Holding N.V.',
    market: 'US',
    exchange: 'NASDAQ',
    aliases: ['asml', '노광장비', 'euv'],
    sector: '반도체 노광장비',
  },
  {
    ticker: 'ARM',
    name: 'ARM 홀딩스',
    englishName: 'ARM Holdings plc',
    market: 'US',
    exchange: 'NASDAQ',
    aliases: ['arm', '암홀딩스', '암'],
    sector: '반도체 IP 아키텍처',
  },
  {
    ticker: 'QCOM',
    name: '퀄컴 (Qualcomm)',
    englishName: 'Qualcomm Inc.',
    market: 'US',
    exchange: 'NASDAQ',
    aliases: ['퀄컴', '스냅드래곤', 'qcom', 'qualcomm'],
    sector: '모바일 칩셋 / 통신',
  },
  {
    ticker: 'INTC',
    name: '인텔 (Intel)',
    englishName: 'Intel Corporation',
    market: 'US',
    exchange: 'NASDAQ',
    aliases: ['인텔', 'intc', 'intel'],
    sector: '반도체 / CPU',
  },
  {
    ticker: 'MU',
    name: '마이크론 (Micron)',
    englishName: 'Micron Technology',
    market: 'US',
    exchange: 'NASDAQ',
    aliases: ['마이크론', 'mu', 'micron'],
    sector: '메모리 반도체',
  },
  {
    ticker: 'NFLX',
    name: '넷플릭스 (Netflix)',
    englishName: 'Netflix, Inc.',
    market: 'US',
    exchange: 'NASDAQ',
    aliases: ['넷플릭스', '넷플', 'nflx', 'netflix'],
    sector: 'OTT / 스트리밍',
  },
  {
    ticker: 'COST',
    name: '코스트코 (Costco)',
    englishName: 'Costco Wholesale',
    market: 'US',
    exchange: 'NASDAQ',
    aliases: ['코스트코', 'cost', 'costco'],
    sector: '유통 / 창고형할인점',
  },
  {
    ticker: 'ORCL',
    name: '오라클 (Oracle)',
    englishName: 'Oracle Corporation',
    market: 'US',
    exchange: 'NYSE',
    aliases: ['오라클', 'orcl', 'oracle'],
    sector: '데이터베이스 / 클라우드',
  },
  {
    ticker: 'HOOD',
    name: '로빈후드 (Robinhood)',
    englishName: 'Robinhood Markets',
    market: 'US',
    exchange: 'NASDAQ',
    aliases: ['로빈후드', 'hood', 'robinhood'],
    sector: '핀테크 / 주식거래',
  },
  {
    ticker: 'OKLO',
    name: '오클로 (Oklo)',
    englishName: 'Oklo Inc.',
    market: 'US',
    exchange: 'NYSE',
    aliases: ['오클로', 'oklo', '소형원전', 'smr'],
    sector: '원자력 SMR / 청정에너지',
  },
  {
    ticker: 'COIN',
    name: '코인베이스 (Coinbase)',
    englishName: 'Coinbase Global',
    market: 'US',
    exchange: 'NASDAQ',
    aliases: ['코인베이스', '코베', 'coin', 'coinbase'],
    sector: '가상자산 거래소',
  },
  {
    ticker: 'MSTR',
    name: '마이크로스트래티지 (MicroStrategy)',
    englishName: 'MicroStrategy Inc.',
    market: 'US',
    exchange: 'NASDAQ',
    aliases: ['마이크로스트래티지', 'mstr', '마스트'],
    sector: '비트코인 보유기업 / BI',
  },
  {
    ticker: 'LLY',
    name: '일라이릴리 (Eli Lilly)',
    englishName: 'Eli Lilly and Company',
    market: 'US',
    exchange: 'NYSE',
    aliases: ['일라이릴리', '릴리', '마운자로', '젭바운드', 'lly'],
    sector: '제약 / 비만치료제',
  },
  {
    ticker: 'NVO',
    name: '노보노디스크 (Novo Nordisk)',
    englishName: 'Novo Nordisk A/S',
    market: 'US',
    exchange: 'NYSE',
    aliases: ['노보노디스크', '위고비', '오젬픽', 'nvo'],
    sector: '제약 / 비만치료제',
  },
  {
    ticker: 'JNJ',
    name: '존슨앤존슨 (J&J)',
    englishName: 'Johnson & Johnson',
    market: 'US',
    exchange: 'NYSE',
    aliases: ['존슨앤존슨', '제이앤제이', 'jnj'],
    sector: '헬스케어 / 의료기기',
  },
  {
    ticker: 'V',
    name: '비자 (Visa)',
    englishName: 'Visa Inc.',
    market: 'US',
    exchange: 'NYSE',
    aliases: ['비자', '비자카드', 'v', 'visa'],
    sector: '결제 네트워크',
  },
  {
    ticker: 'MA',
    name: '마스터카드 (Mastercard)',
    englishName: 'Mastercard Inc.',
    market: 'US',
    exchange: 'NYSE',
    aliases: ['마스터카드', 'ma', 'mastercard'],
    sector: '결제 네트워크',
  },
  {
    ticker: 'DIS',
    name: '디즈니 (Walt Disney)',
    englishName: 'The Walt Disney Company',
    market: 'US',
    exchange: 'NYSE',
    aliases: ['디즈니', 'dis', 'disney'],
    sector: '엔터테인먼트 / 미디어',
  },
  {
    ticker: 'NKE',
    name: '나이키 (Nike)',
    englishName: 'Nike, Inc.',
    market: 'US',
    exchange: 'NYSE',
    aliases: ['나이키', 'nke', 'nike'],
    sector: '스포츠웨어 / 패션',
  },
  {
    ticker: 'MCD',
    name: '맥도날드 (McDonalds)',
    englishName: 'McDonalds Corporation',
    market: 'US',
    exchange: 'NYSE',
    aliases: ['맥도날드', 'mcd', 'mcdonalds'],
    sector: '패스트푸드 / 외식',
  },
  {
    ticker: 'KO',
    name: '코카콜라 (Coca-Cola)',
    englishName: 'The Coca-Cola Company',
    market: 'US',
    exchange: 'NYSE',
    aliases: ['코카콜라', '콜라', 'ko', 'cocacola'],
    sector: '음료 / 필수소비재',
  },
  {
    ticker: 'WMT',
    name: '월마트 (Walmart)',
    englishName: 'Walmart Inc.',
    market: 'US',
    exchange: 'NYSE',
    aliases: ['월마트', 'wmt', 'walmart'],
    sector: '대형 유통 / 리테일',
  },
  {
    ticker: 'XOM',
    name: '엑슨모빌 (ExxonMobil)',
    englishName: 'Exxon Mobil Corporation',
    market: 'US',
    exchange: 'NYSE',
    aliases: ['엑슨모빌', '엑손모빌', 'xom', 'exxon'],
    sector: '에너지 / 석유',
  },
  {
    ticker: 'JPM',
    name: 'JP모건 (JPMorgan Chase)',
    englishName: 'JPMorgan Chase & Co.',
    market: 'US',
    exchange: 'NYSE',
    aliases: ['jp모건', '제이피모건', 'jpm', 'jpmorgan'],
    sector: '금융 / 투자은행',
  },

  // ========== 미국 대표 지수 ETF ==========
  {
    ticker: 'SPY',
    name: 'S&P 500 ETF (SPY)',
    englishName: 'SPDR S&P 500 ETF Trust',
    market: 'US',
    exchange: 'ETF',
    aliases: ['spy', '스파이', 's&p500', 'sp500'],
    sector: '미국 대형주 지수 ETF',
  },
  {
    ticker: 'VOO',
    name: '뱅가드 S&P 500 (VOO)',
    englishName: 'Vanguard S&P 500 ETF',
    market: 'US',
    exchange: 'ETF',
    aliases: ['voo', '브이오오', '뱅가드s&p500'],
    sector: '미국 대형주 지수 ETF',
  },
  {
    ticker: 'IVV',
    name: 'iShares Core S&P 500',
    englishName: 'iShares Core S&P 500 ETF',
    market: 'US',
    exchange: 'ETF',
    aliases: ['ivv', '아이브이브이'],
    sector: '미국 대형주 지수 ETF',
  },
  {
    ticker: 'QQQ',
    name: '나스닥 100 ETF (QQQ)',
    englishName: 'Invesco QQQ Trust',
    market: 'US',
    exchange: 'ETF',
    aliases: ['qqq', '큐큐큐', '나스닥100', 'nasdaq100'],
    sector: '미국 나스닥 지수 ETF',
  },
  {
    ticker: 'QQQM',
    name: '나스닥 100 미니 (QQQM)',
    englishName: 'Invesco NASDAQ 100 ETF',
    market: 'US',
    exchange: 'ETF',
    aliases: ['qqqm', '큐큐큐엠'],
    sector: '미국 나스닥 지수 ETF',
  },
  {
    ticker: 'SCHD',
    name: '슈왑 미국배당다우존스 (SCHD)',
    englishName: 'Schwab U.S. Dividend Equity ETF',
    market: 'US',
    exchange: 'ETF',
    aliases: ['schd', '슈드', '슈왑배당', '배당다우존스'],
    sector: '배당성장 ETF',
  },
  {
    ticker: 'SMH',
    name: '반도체 ETF (SMH)',
    englishName: 'VanEck Semiconductor ETF',
    market: 'US',
    exchange: 'ETF',
    aliases: ['smh', '반도체etf', '스엠에이치'],
    sector: '반도체 테마 ETF',
  },
  {
    ticker: 'SOXX',
    name: 'iShares Semiconductor ETF',
    englishName: 'iShares Semiconductor ETF',
    market: 'US',
    exchange: 'ETF',
    aliases: ['soxx', '속스', '반도체etf'],
    sector: '반도체 테마 ETF',
  },
  {
    ticker: 'SOXL',
    name: '속슬 3배 레버리지 (SOXL)',
    englishName: 'Direxion Daily Semiconductor Bull 3X',
    market: 'US',
    exchange: 'ETF',
    aliases: ['soxl', '속슬', '반도체3배'],
    sector: '반도체 3X 레버리지',
  },
  {
    ticker: 'TQQQ',
    name: '나스닥 3배 레버리지 (TQQQ)',
    englishName: 'ProShares UltraPro QQQ',
    market: 'US',
    exchange: 'ETF',
    aliases: ['tqqq', '티큐', '티큐큐큐', '나스닥3배'],
    sector: '나스닥 3X 레버리지',
  },
  {
    ticker: '003230.KS',
    name: '삼양식품',
    englishName: 'Samyang Foods',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['삼양식품', '불닭', '003230', '003230.ks'],
    sector: '음식료 / K-푸드',
  },
  {
    ticker: '034020.KS',
    name: '두산에너빌리티',
    englishName: 'Doosan Enerbility',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['두산에너빌리티', '두산중공업', '에너빌리티', '034020', '034020.ks', '373130', '373130.ks'],
    sector: '원전 / 에너지',
  },
  {
    ticker: '454910.KS',
    name: '두산로보틱스',
    englishName: 'Doosan Robotics',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['두산로보틱스', '454910', '454910.ks'],
    sector: '로봇 / 자동화',
  },
  {
    ticker: '267260.KS',
    name: 'HD현대일렉트릭',
    englishName: 'HD Hyundai Electric',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['hd현대일렉트릭', '현대일렉트릭', '현대일렉', '267260', '267260.ks'],
    sector: '전력인프라 / 변압기',
  },
  {
    ticker: '329180.KS',
    name: 'HD현대중공업',
    englishName: 'HD Hyundai Heavy Industries',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['hd현대중공업', '현대중공업', '329180', '329180.ks'],
    sector: '조선 / 해양플랜트',
  },
  {
    ticker: '141080.KQ',
    name: '리가켐바이오',
    englishName: 'LigaChem Biosciences',
    market: 'KR',
    exchange: 'KOSDAQ',
    aliases: ['리가켐바이오', '레고켐바이오', '레고켐', '141080', '141080.kq'],
    sector: '바이오 / ADC',
  },
  {
    ticker: '348370.KQ',
    name: '엔켐',
    englishName: 'Enchem',
    market: 'KR',
    exchange: 'KOSDAQ',
    aliases: ['엔켐', '348370', '348370.kq'],
    sector: '2차전지 / 전해액',
  },
  {
    ticker: '000250.KQ',
    name: '삼천당제약',
    englishName: 'Samchundang Pharm',
    market: 'KR',
    exchange: 'KOSDAQ',
    aliases: ['삼천당제약', '삼천당', '000250', '000250.kq'],
    sector: '제약 / 바이오',
  },
  {
    ticker: '450080.KS',
    name: '에코프로머티',
    englishName: 'Ecopro Materials',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['에코프로머티', '에코프로머티리얼즈', '450080', '450080.ks'],
    sector: '2차전지 / 전구체',
  },
  {
    ticker: '010120.KS',
    name: 'LS ELECTRIC',
    englishName: 'LS Electric',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['ls일렉트릭', 'lselectric', '010120', '010120.ks'],
    sector: '전력인프라 / 스마트그리드',
  },
  {
    ticker: '298040.KS',
    name: '효성중공업',
    englishName: 'Hyosung Heavy Industries',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['효성중공업', '효중', '298040', '298040.ks'],
    sector: '전력인프라 / 중공업',
  },
  {
    ticker: '064350.KS',
    name: '현대로템',
    englishName: 'Hyundai Rotem',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['현대로템', '로템', '064350', '064350.ks'],
    sector: '방산 / 철도',
  },
  {
    ticker: '079550.KS',
    name: 'LIG넥스원',
    englishName: 'LIG Nex1',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['lig넥스원', '넥스원', '079550', '079550.ks'],
    sector: '방산 / 유도무기',
  },
  {
    ticker: '352820.KS',
    name: '하이브',
    englishName: 'HYBE',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['하이브', 'hybe', '빅히트', '352820', '352820.ks'],
    sector: '엔터테인먼트 / K-POP',
  },
  {
    ticker: '000100.KS',
    name: '유한양행',
    englishName: 'Yuhan Corporation',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['유한양행', '000100', '000100.ks'],
    sector: '제약 / 바이오',
  },
  {
    ticker: '377300.KS',
    name: '카카오페이',
    englishName: 'Kakao Pay',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['카카오페이', '카페', '377300', '377300.ks'],
    sector: '핀테크 / 금융플랫폼',
  },
  {
    ticker: '323410.KS',
    name: '카카오뱅크',
    englishName: 'KakaoBank',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['카카오뱅크', '카뱅', '323410', '323410.ks'],
    sector: '인터넷전문은행 / 금융',
  },
  {
    ticker: '090430.KS',
    name: '아모레퍼시픽',
    englishName: 'Amorepacific',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['아모레퍼시픽', '아모레', '090430', '090430.ks'],
    sector: '화장품 / 뷰티',
  },
  {
    ticker: '047810.KS',
    name: '한국항공우주',
    englishName: 'Korea Aerospace Industries (KAI)',
    market: 'KR',
    exchange: 'KOSPI',
    aliases: ['한국항공우주', 'kai', '카이', '047810', '047810.ks'],
    sector: '방산 / 항공우주',
  },
  {
    ticker: 'SMCI',
    name: '슈퍼마이크로컴퓨터 (SMCI)',
    englishName: 'Super Micro Computer',
    market: 'US',
    exchange: 'NASDAQ',
    aliases: ['smci', '슈마컴', '슈퍼마이크로'],
    sector: 'AI 서버인프라',
  },
  {
    ticker: 'SOFI',
    name: '소파이 (SoFi)',
    englishName: 'SoFi Technologies',
    market: 'US',
    exchange: 'NASDAQ',
    aliases: ['sofi', '소파이'],
    sector: '핀테크 / 디지털뱅킹',
  },
  {
    ticker: 'APP',
    name: '앱러빈 (AppLovin)',
    englishName: 'AppLovin Corp',
    market: 'US',
    exchange: 'NASDAQ',
    aliases: ['app', '앱러빈', 'applovin'],
    sector: 'AI 광고플랫폼',
  },
  {
    ticker: 'ASTS',
    name: 'AST 스페이스모바일',
    englishName: 'AST SpaceMobile',
    market: 'US',
    exchange: 'NASDAQ',
    aliases: ['asts', '스페이스모바일', '위성통신'],
    sector: '우주 위성통신',
  },
  {
    ticker: 'BBAI',
    name: '빅베어 AI (BigBear.ai)',
    englishName: 'BigBear.ai Holdings',
    market: 'US',
    exchange: 'NYSE',
    aliases: ['bbai', '빅베어', '빅베어ai'],
    sector: 'AI 국방 / 비전',
  },
  {
    ticker: 'RKLB',
    name: '로켓랩 (Rocket Lab)',
    englishName: 'Rocket Lab USA',
    market: 'US',
    exchange: 'NASDAQ',
    aliases: ['rklb', '로켓랩'],
    sector: '우주 발사체 / 위성',
  },
  {
    ticker: 'IONQ',
    name: '아이온큐 (IonQ)',
    englishName: 'IonQ Inc',
    market: 'US',
    exchange: 'NYSE',
    aliases: ['ionq', '아이온큐', '양자컴퓨팅'],
    sector: '양자 컴퓨팅',
  },
  {
    ticker: 'CRWD',
    name: '크라우드스트라이크 (CrowdStrike)',
    englishName: 'CrowdStrike Holdings',
    market: 'US',
    exchange: 'NASDAQ',
    aliases: ['crwd', '크라우드스트라이크'],
    sector: '사이버 보안 / EDR',
  },
  {
    ticker: 'PANW',
    name: '팔로알토 네트웍스 (Palo Alto)',
    englishName: 'Palo Alto Networks',
    market: 'US',
    exchange: 'NASDAQ',
    aliases: ['panw', '팔로알토'],
    sector: '사이버 보안',
  },
];

/**
 * 텍스트 정규화 헬퍼 (공백 제거, 특수문자 정리, 소문자화)
 */
function normalizeQuery(q: string): string {
  return q
    .toLowerCase()
    .replace(/[\s\-_.,/·]/g, '')
    .trim();
}

/**
 * 사용자 입력 문자열(종목명, 티커, 약칭 등)을 authoritative 티커 및 종목 정보로 단일 변환(해석)합니다.
 * 예: 'lg에너지솔루션' -> { ticker: '373220.KS', name: 'LG에너지솔루션', market: 'KR', resolved: true }
 * 예: '373220' -> { ticker: '373220.KS', name: 'LG에너지솔루션', market: 'KR', resolved: true }
 * 예: '003230.KS' -> { ticker: '003230.KS', name: '삼양식품', market: 'KR', resolved: true }
 * 예: '삼성전자' -> { ticker: '005930.KS', name: '삼성전자', market: 'KR', resolved: true }
 * 예: 'AAPL' -> { ticker: 'AAPL', name: '애플 (Apple)', market: 'US', resolved: true }
 */
export function resolveSingleQuery(rawQuery: string): {
  ticker: string;
  name: string;
  market: 'KR' | 'US';
  resolved: boolean;
  matchType?: 'exact_ticker' | 'code_digit' | 'alias' | 'name' | 'fallback_ticker';
} {
  const trimmed = rawQuery.trim();
  if (!trimmed) {
    return { ticker: '', name: '', market: 'KR', resolved: false };
  }

  const upper = trimmed.toUpperCase();
  const cleanQ = normalizeQuery(trimmed);

  // 1. 이미 정규화된 6자리 티커 코드 + .KS / .KQ 일치 검사
  const exactMatch = STOCK_MASTER_DATABASE.find(
    (s) => s.ticker.toUpperCase() === upper
  );
  if (exactMatch) {
    return {
      ticker: exactMatch.ticker,
      name: exactMatch.name,
      market: exactMatch.market,
      resolved: true,
      matchType: 'exact_ticker',
    };
  }

  // 1-1. 6자리 티커 코드 + .KS / .KQ 정규식 일치 (마스터 DB 미등록이어도 모든 국내 정상 티커로 승인)
  if (/^\d{6}\.(KS|KQ)$/i.test(upper)) {
    const code = upper.substring(0, 6);
    const matchedByCode = STOCK_MASTER_DATABASE.find(
      (s) => s.ticker.replace(/\.(KS|KQ)$/i, '') === code
    );
    if (matchedByCode) {
      return {
        ticker: upper,
        name: matchedByCode.name,
        market: 'KR',
        resolved: true,
        matchType: 'exact_ticker',
      };
    }
    const display = getStockDisplayInfo(upper);
    return {
      ticker: upper,
      name: display.primaryName || upper,
      market: 'KR',
      resolved: true,
      matchType: 'code_digit',
    };
  }

  // 2. 6자리 순수 숫자 코드인 경우 (예: '373220' -> '373220.KS')
  if (/^\d{6}$/.test(upper)) {
    const matchedByCode = STOCK_MASTER_DATABASE.find(
      (s) => s.ticker.replace(/\.(KS|KQ)$/i, '') === upper
    );
    if (matchedByCode) {
      return {
        ticker: matchedByCode.ticker,
        name: matchedByCode.name,
        market: 'KR',
        resolved: true,
        matchType: 'code_digit',
      };
    }
    const display = getStockDisplayInfo(`${upper}.KS`);
    return {
      ticker: `${upper}.KS`,
      name: display.primaryName || upper,
      market: 'KR',
      resolved: true,
      matchType: 'code_digit',
    };
  }

  // 3. 종목명 및 별칭(Aliases) 완전 일치 또는 정규화 일치 검사 (LG에너지솔루션, lg엔솔, 삼전, 엔비디아 등)
  for (const stock of STOCK_MASTER_DATABASE) {
    // 종목명 일치
    if (normalizeQuery(stock.name) === cleanQ) {
      return {
        ticker: stock.ticker,
        name: stock.name,
        market: stock.market,
        resolved: true,
        matchType: 'name',
      };
    }
    // 영문명 일치
    if (stock.englishName && normalizeQuery(stock.englishName) === cleanQ) {
      return {
        ticker: stock.ticker,
        name: stock.name,
        market: stock.market,
        resolved: true,
        matchType: 'name',
      };
    }
    // 별칭 일치
    if (stock.aliases) {
      for (const alias of stock.aliases) {
        if (normalizeQuery(alias) === cleanQ) {
          return {
            ticker: stock.ticker,
            name: stock.name,
            market: stock.market,
            resolved: true,
            matchType: 'alias',
          };
        }
      }
    }
  }

  // 4. 종목명 또는 별칭 부분 포함(Substring) 매칭
  // 예: '에너지솔루션' -> 'LG에너지솔루션'
  const partialMatches = STOCK_MASTER_DATABASE.filter((stock) => {
    if (normalizeQuery(stock.name).includes(cleanQ)) return true;
    if (stock.aliases && stock.aliases.some((a) => normalizeQuery(a).includes(cleanQ))) return true;
    return false;
  });

  if (partialMatches.length === 1) {
    const match = partialMatches[0];
    return {
      ticker: match.ticker,
      name: match.name,
      market: match.market,
      resolved: true,
      matchType: 'alias',
    };
  }

  // 5. 미국 티커 형식 검사 (1~6자 영문)
  if (/^[A-Z]{1,6}([.-][A-Z]{1,3})?$/.test(upper)) {
    const matched = STOCK_MASTER_DATABASE.find((s) => s.ticker.toUpperCase() === upper);
    if (matched) {
      return {
        ticker: matched.ticker,
        name: matched.name,
        market: matched.market,
        resolved: true,
        matchType: 'exact_ticker',
      };
    }
    const display = getStockDisplayInfo(upper);
    return {
      ticker: upper,
      name: display.primaryName || upper,
      market: 'US',
      resolved: true,
      matchType: 'fallback_ticker',
    };
  }

  // 매칭 실패
  return {
    ticker: upper,
    name: trimmed,
    market: 'KR',
    resolved: false,
  };
}

/**
 * 실시간 자동완성 검색 API 함수
 * - 종목명, 티커, 영문명, 별칭을 검색하여 매칭도 높은 순으로 최대 `limit`건 반환
 * - 6자리 종목코드나 티커 직접 입력 시 자동완성 항목 즉시 합성 주입
 */
export function searchStockMaster(query: string, limit = 10): StockInfo[] {
  const trimmed = query.trim();
  if (!trimmed) return STOCK_MASTER_DATABASE.slice(0, limit);

  const cleanQ = normalizeQuery(trimmed);
  const upper = trimmed.toUpperCase();

  const results: Array<{ stock: StockInfo; score: number }> = [];

  for (const stock of STOCK_MASTER_DATABASE) {
    let score = 0;
    const stockCleanName = normalizeQuery(stock.name);
    const stockTickerNoExt = stock.ticker.replace(/\.(KS|KQ)$/i, '').toUpperCase();
    const stockTickerFull = stock.ticker.toUpperCase();

    // 1. 정확한 티커 일치 (최우선)
    if (stockTickerFull === upper || stockTickerNoExt === upper) {
      score += 1000;
    }
    // 2. 정확한 한글 종목명 일치
    else if (stockCleanName === cleanQ) {
      score += 800;
    }
    // 3. 별칭 정확 일치
    else if (stock.aliases && stock.aliases.some((a) => normalizeQuery(a) === cleanQ)) {
      score += 600;
    }
    // 4. 티커 접두어 일치 (e.g. 'NV' -> NVDA, '373' -> 373220.KS)
    else if (stockTickerFull.startsWith(upper) || stockTickerNoExt.startsWith(upper)) {
      score += 400;
    }
    // 5. 종목명 접두어 일치 (e.g. 'LG에' -> LG에너지솔루션)
    else if (stockCleanName.startsWith(cleanQ)) {
      score += 300;
    }
    // 6. 종목명 부분 포함 (e.g. '에너지솔루션' -> LG에너지솔루션)
    else if (stockCleanName.includes(cleanQ)) {
      score += 200;
    }
    // 7. 별칭 부분 포함
    else if (stock.aliases && stock.aliases.some((a) => normalizeQuery(a).includes(cleanQ))) {
      score += 150;
    }
    // 8. 영문명 포함
    else if (stock.englishName && normalizeQuery(stock.englishName).includes(cleanQ)) {
      score += 100;
    }

    if (score > 0) {
      results.push({ stock, score });
    }
  }

  // 6자리 국내 종목코드 또는 표준 티커 직접 입력 시 검색 결과에 즉시 합성 등록 항목 추가
  if (/^\d{6}(\.(KS|KQ))?$/i.test(trimmed)) {
    const norm = /^\d{6}$/.test(trimmed) ? `${trimmed}.KS` : trimmed.toUpperCase();
    if (!results.some((r) => r.stock.ticker.toUpperCase() === norm.toUpperCase())) {
      const display = getStockDisplayInfo(norm);
      results.unshift({
        stock: {
          ticker: norm,
          name: display.primaryName || norm,
          englishName: norm,
          market: 'KR',
          exchange: norm.endsWith('.KQ') ? 'KOSDAQ' : 'KOSPI',
          sector: '국내 상장 주식',
          aliases: [trimmed, norm],
        },
        score: 3000,
      });
    }
  } else if (/^[A-Za-z]{1,6}([.-][A-Za-z]{1,3})?$/.test(trimmed) && trimmed.length >= 2) {
    const norm = trimmed.toUpperCase();
    const hasStrongKrMatch = results.some((r) => r.stock.market === 'KR' && r.score >= 300);
    if (!hasStrongKrMatch && !results.some((r) => r.stock.ticker.toUpperCase() === norm)) {
      const display = getStockDisplayInfo(norm);
      results.unshift({
        stock: {
          ticker: norm,
          name: display.primaryName || norm,
          englishName: norm,
          market: 'US',
          exchange: 'US',
          sector: '미국 상장 주식',
          aliases: [trimmed, norm],
        },
        score: 3000,
      });
    }
  }

  // 매칭 점수 내림차순 정렬
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.stock);
}
