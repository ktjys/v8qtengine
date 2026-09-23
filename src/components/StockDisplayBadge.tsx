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
  // abbreviation prop 제거: KRX 공식 종목약명을 그대로 사용 (임의 축약 금지)
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
}) => {
  const { primaryName, subCode, isKorean } = getStockDisplayInfo(ticker, name);

  // variant별 표시 결정
  const isCompact = variant === 'compact' || variant === 'name-only';
  const isNameOnly = variant === 'name-only';
  const shouldShowSubCode = showSubCode && !isNameOnly;
  const shouldShowMarketBadge = showMarketBadge && !isCompact;

  // KRX 공식 종목약명(primaryName)을 그대로 사용 — 임의 축약 금지
  // HTS/MTS 10개사(키움/미래/NH/삼성/한투/KB/대신/유안타/신한/하나) 모두 KRX 약명 1:1 표기
  const displayName = primaryName;

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
 * KRX 약명 그대로 표시, UI truncate만 적용
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
 * KRX 약명 그대로 표시
 */
export const NameOnlyStockBadge: React.FC<{
  ticker: string;
  name?: string;
  className?: string;
}> = ({ ticker, name, className }) => (
  <StockDisplayBadge
    ticker={ticker}
    name={name}
    variant="name-only"
    showSubCode={false}
    showMarketBadge={false}
    primaryClassName="font-bold text-slate-100 text-sm"
    className={className}
  />
);
