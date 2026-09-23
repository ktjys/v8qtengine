import React from 'react';
import { getStockDisplayInfo } from '../utils/marketUtils';

type BadgeVariant = 'full' | 'compact' | 'name-only' | 'auto';

interface StockDisplayBadgeProps {
  ticker: string;
  name?: string;
  showSubCode?: boolean;
  showMarketBadge?: boolean;
  className?: string;
  primaryClassName?: string;
  subCodeClassName?: string;
  variant?: BadgeVariant;           // 표시 밀도 제어
  maxWidth?: string | number;      // 최대 너비 제한 (px 또는 %)
  abbreviation?: 'none' | 'korean' | 'smart'; // 축약 규칙
}

/**
 * 한국 종목명 스마트 축약 규칙
 * - 접미사 제거: '홀딩스', '지주', '그룹', '컴퍼니', '인터내셔널'
 * - 알려진 긴 이름 매핑
 * - 6자 초과 시 앞 4자 + '…' 처리
 */
function abbreviateKoreanName(name: string): string {
  const abbreviations: Record<string, string> = {
    '삼성바이오로직스': '삼성바이오',
    'LG에너지솔루션': 'LG에너지',
    'POSCO홀딩스': 'POSCO',
    'POSCO퓨처엠': 'POSCO퓨처',
    'SK이노베이션': 'SK이노',
    'SK바이오팜': 'SK바팜',
    'SK바이오사이언스': 'SK바사',
    '한화에어로스페이스': '한화에어로',
    '한화시스템': '한화시스',
    '한화솔루션': '한화솔',
    'HD현대중공업': 'HD현대중',
    '현대중공업': '현대중공',
    '두산에너빌리티': '두산에너',
    '두산밥캣': '두산밥캣',
    '한국항공우주': '한국항우',
    '한국전력': '한전',
    'LG생활건강': 'LG생건',
    'LG디스플레이': 'LG디플',
    'LG헬로비전': 'LG헬로',
    'LG유플러스': 'LG유플',
    'SK텔레콤': 'SKT',
    'KB금융': 'KB금융',
    '신한지주': '신한지주',
    '하나금융지주': '하나금융',
    '우리금융지주': '우리금융',
    '메리츠금융지주': '메리츠금융',
    '카카오게임즈': '카카오겜',
    '네이버웹툰': '네이버웹',
    '삼성물산': '삼성물산',
    '삼성화재': '삼성화재',
    '삼성전기': '삼성전기',
    '삼성SDI': '삼성SDI',
    '현대모비스': '현대모비',
    '현대제철': '현대제철',
    '고려아연': '고려아연',
    'S-Oil': 'S-Oil',
    '넷마블': '넷마블',
    '크래프톤': '크래프톤',
    '엔씨소프트': '엔씨소프트',
    '펄어비스': '펄어비스',
    '제넥신': '제넥신',
    '알테오젠': '알테오젠',
    '에코프로비엠': '에코프로비',
    '한미반도체': '한미반도',
    '셀트리온': '셀트리온',
    '카카오': '카카오',
    'NAVER': 'NAVER',
    '기아': '기아',
    '현대차': '현대차',
    '삼성전자': '삼성전자',
    'SK하이닉스': 'SK하닉',
    'LG전자': 'LG전자',
    'KODEX 200': 'KODEX200',
    'TIGER 미국S&P500': 'TIGER미국',
    'TIGER 미국나스닥100': 'TIGER나스닥',
    'TIGER 미국배당다우존스': 'TIGER배당',
  };

  if (abbreviations[name]) return abbreviations[name];

  // 접미사 제거
  const suffixes = ['홀딩스', '지주', '그룹', '컴퍼니', '인터내셔널', '코리아', '코퍼레이션', '인더스트리'];
  let shortened = name;
  for (const suffix of suffixes) {
    if (shortened.endsWith(suffix) && shortened.length > suffix.length + 1) {
      shortened = shortened.slice(0, -suffix.length);
      break;
    }
  }

  // 여전히 길면 앞 4자 + 말줄임
  if (shortened.length > 6) {
    return shortened.slice(0, 4) + '…';
  }
  return shortened;
}

/**
 * 영문 종목명 스마트 축약
 */
function abbreviateEnglishName(name: string): string {
  const abbreviations: Record<string, string> = {
    'Apple Inc.': 'Apple',
    'Microsoft Corporation': 'Microsoft',
    'Amazon.com Inc.': 'Amazon',
    'Tesla Inc.': 'Tesla',
    'Alphabet Inc.': 'Alphabet',
    'Meta Platforms Inc.': 'Meta',
    'NVIDIA Corporation': 'NVIDIA',
    'Broadcom Inc.': 'Broadcom',
    'Palantir Technologies Inc.': 'Palantir',
    'MicroStrategy Incorporated': 'MicroStrategy',
    'Taiwan Semiconductor Manufacturing': 'TSMC',
    'ASML Holding NV': 'ASML',
    'Qualcomm Incorporated': 'Qualcomm',
    'Texas Instruments Inc.': 'Texas Inst.',
    'Intel Corporation': 'Intel',
    'Micron Technology Inc.': 'Micron',
    'Lam Research Corporation': 'Lam Research',
    'KLA Corporation': 'KLA',
    'Applied Materials Inc.': 'Applied Mat.',
    'Synopsys Inc.': 'Synopsys',
    'Cadence Design Systems': 'Cadence',
    'Marvell Technology Inc.': 'Marvell',
    'Arista Networks Inc.': 'Arista',
    'Palo Alto Networks Inc.': 'Palo Alto',
    'CrowdStrike Holdings Inc.': 'CrowdStrike',
    'Zscaler Inc.': 'Zscaler',
    'Okta Inc.': 'Okta',
    'Datadog Inc.': 'Datadog',
    'Snowflake Inc.': 'Snowflake',
    'MongoDB Inc.': 'MongoDB',
    'Elastic NV': 'Elastic',
    'Atlassian Corporation': 'Atlassian',
    'Workday Inc.': 'Workday',
    'Roku Inc.': 'Roku',
    'The Trade Desk Inc.': 'Trade Desk',
    'Roblox Corporation': 'Roblox',
    'Unity Software Inc.': 'Unity',
    'Planet Fitness Inc.': 'Planet Fit.',
    'DraftKings Inc.': 'DraftKings',
    'Penn National Gaming': 'Penn Gaming',
    'MGM Resorts International': 'MGM',
    'Las Vegas Sands Corp.': 'LV Sands',
    'Wynn Resorts': 'Wynn',
    'Carnival Corporation': 'Carnival',
    'Royal Caribbean Cruises': 'Royal Carib.',
    'Norwegian Cruise Line': 'Norwegian',
    'The Boeing Company': 'Boeing',
    'Lockheed Martin Corporation': 'Lockheed',
    'RTX Corporation': 'RTX',
    'Northrop Grumman Corporation': 'Northrop G.',
    'General Dynamics Corporation': 'General Dyn.',
    'Caterpillar Inc.': 'Caterpillar',
    'Deere & Company': 'Deere',
    'Honeywell International': 'Honeywell',
    '3M Company': '3M',
    'General Electric Company': 'GE',
    'Union Pacific Corporation': 'Union Pac.',
    'FedEx Corporation': 'FedEx',
    'United Parcel Service': 'UPS',
    'Delta Air Lines Inc.': 'Delta Air',
    'United Airlines Holdings': 'United Air',
    'American Airlines Group': 'American Air',
    'Southwest Airlines Co.': 'Southwest',
    'JPMorgan Chase & Co.': 'JPMorgan',
    'Bank of America Corporation': 'Bank of Am.',
    'Wells Fargo & Company': 'Wells Fargo',
    'Citigroup Inc.': 'Citigroup',
    'The Goldman Sachs Group': 'Goldman Sachs',
    'Morgan Stanley': 'Morgan Stanley',
    'BlackRock Inc.': 'BlackRock',
    'The Charles Schwab Corporation': 'Schwab',
    'American Express Company': 'Amex',
    'Mastercard Incorporated': 'Mastercard',
    'Visa Inc.': 'Visa',
    'PayPal Holdings Inc.': 'PayPal',
    'Block Inc.': 'Block',
    'Capital One Financial': 'Capital One',
    'U.S. Bancorp': 'US Bancorp',
    'PNC Financial Services': 'PNC',
    'Truist Financial Corporation': 'Truist',
    'Coinbase Global Inc.': 'Coinbase',
    'Riot Platforms Inc.': 'Riot',
    'Marathon Digital Holdings': 'Marathon',
  };

  if (abbreviations[name]) return abbreviations[name];

  // Inc., Corp., Corporation, Company, Group, Holdings, Limited, Ltd. 제거
  let shortened = name
    .replace(/\s+(Inc\.?|Corp\.?|Corporation|Company|Group|Holdings?|Limited|Ltd\.?)$/i, '')
    .replace(/\s+\(.*?\)$/, ''); // 괄호 내용 제거

  // 여전히 길면 앞 12자 + 말줄임
  if (shortened.length > 14) {
    return shortened.slice(0, 12) + '…';
  }
  return shortened;
}

function getAbbreviatedName(name: string, isKorean: boolean, mode: 'none' | 'korean' | 'smart'): string {
  if (mode === 'none') return name;
  if (mode === 'korean') return isKorean ? abbreviateKoreanName(name) : abbreviateEnglishName(name);
  // smart: 한국어는 korean 규칙, 영어는 english 규칙
  return isKorean ? abbreviateKoreanName(name) : abbreviateEnglishName(name);
}

export const StockDisplayBadge: React.FC<StockDisplayBadgeProps> = ({
  ticker,
  name,
  showSubCode = true,
  showMarketBadge = false,
  className = '',
  primaryClassName = 'font-bold text-slate-100 text-sm',
  subCodeClassName = 'text-xs text-slate-400 font-mono',
  variant = 'auto',
  maxWidth,
  abbreviation = 'smart',
}) => {
  const { primaryName, subCode, isKorean } = getStockDisplayInfo(ticker, name);

  // variant별 표시 결정
  const isCompact = variant === 'compact' || variant === 'name-only';
  const isNameOnly = variant === 'name-only';
  const shouldShowSubCode = showSubCode && !isNameOnly;
  const shouldShowMarketBadge = showMarketBadge && !isCompact;

  // 축약 적용
  const displayName = getAbbreviatedName(primaryName, isKorean, abbreviation as 'none' | 'korean' | 'smart');

  // 스타일 구성
  const containerStyle = maxWidth ? { maxWidth: typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth } : {};
  const primaryStyle = isCompact ? 'text-[11px]' : '';

  return (
    <div
      className={`flex items-center space-x-1.5 min-w-0 ${className}`}
      style={containerStyle}
      title={`${primaryName} (${subCode})`}
    >
      <span className={`truncate ${primaryClassName} ${primaryStyle}`}>
        {displayName}
      </span>

      {shouldShowSubCode && (
        <span className={`shrink-0 px-1 py-0.2 rounded bg-slate-800/80 text-[10px] ${subCodeClassName}`}>
          {subCode}
        </span>
      )}

      {shouldShowMarketBadge && (
        <span
          className={`shrink-0 px-1.5 py-0.2 text-[9px] rounded font-semibold border ${
            isKorean
              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
              : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
          }`}
        >
          {isKorean ? '🇰🇷 국내' : '🇺🇸 미국'}
        </span>
      )}
    </div>
  );
};

/**
 * 테이블 셀 등 좁은 공간용 컴팩트 배지
 */
export const CompactStockBadge: React.FC<{
  ticker: string;
  name?: string;
  className?: string;
}> = ({ ticker, name, className }) => (
  <StockDisplayBadge
    ticker={ticker}
    name={name}
    variant="compact"
    showSubCode={true}
    showMarketBadge={false}
    primaryClassName="font-semibold text-slate-100 text-[11px]"
    subCodeClassName="text-[9px] text-slate-400 font-mono"
    className={className}
  />
);

/**
 * 리스트/카드 헤더용 네임 온리 배지
 */
export const NameOnlyStockBadge: React.FC<{
  ticker: string;
  name?: string;
  className?: string;
  abbreviation?: 'none' | 'korean' | 'smart';
}> = ({ ticker, name, className, abbreviation = 'smart' }) => (
  <StockDisplayBadge
    ticker={ticker}
    name={name}
    variant="name-only"
    showSubCode={false}
    showMarketBadge={false}
    primaryClassName="font-bold text-slate-100 text-sm"
    abbreviation={abbreviation as 'none' | 'korean' | 'smart'}
    className={className}
  />
);
