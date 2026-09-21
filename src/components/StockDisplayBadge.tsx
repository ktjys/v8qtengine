import React from 'react';
import { getStockDisplayInfo } from '../utils/marketUtils';

interface StockDisplayBadgeProps {
  ticker: string;
  name?: string;
  showSubCode?: boolean; // 공간 여유가 있을 때 코드(005930 / AAPL) 보조 표시
  showMarketBadge?: boolean; // 🇰🇷 / 🇺🇸 배지 표시 여부
  className?: string;
  primaryClassName?: string;
  subCodeClassName?: string;
}

export const StockDisplayBadge: React.FC<StockDisplayBadgeProps> = ({
  ticker,
  name,
  showSubCode = true,
  showMarketBadge = false,
  className = '',
  primaryClassName = 'font-bold text-slate-100 text-sm',
  subCodeClassName = 'text-xs text-slate-400 font-mono',
}) => {
  const { primaryName, subCode, isKorean } = getStockDisplayInfo(ticker, name);

  return (
    <div className={`flex items-center space-x-1.5 min-w-0 ${className}`}>
      <span className={`truncate ${primaryClassName}`} title={`${primaryName} (${subCode})`}>
        {primaryName}
      </span>

      {showSubCode && (
        <span className={`shrink-0 px-1 py-0.2 rounded bg-slate-800/80 text-[10px] ${subCodeClassName}`}>
          {subCode}
        </span>
      )}

      {showMarketBadge && (
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
