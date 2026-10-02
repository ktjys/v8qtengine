import React, { useState } from 'react';
import { Clock, ShieldCheck, AlertCircle, RefreshCw, Info } from 'lucide-react';
import { FullTickerEvaluation } from '../types/v8';

interface DataFreshnessBadgeProps {
  evaluations?: FullTickerEvaluation[];
  lastUpdated?: string | null;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  className?: string;
  showDetails?: boolean;
}

export const DataFreshnessBadge: React.FC<DataFreshnessBadgeProps> = ({
  evaluations = [],
  lastUpdated,
  onRefresh,
  isRefreshing = false,
  className = '',
  showDetails = false,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  // Determine freshness from evaluations or explicit lastUpdated
  let latestTimeStr: string | null = lastUpdated || null;
  let hasFallbackSeed = false;
  let totalQualityScore = 0;
  let evaluatedCount = 0;

  if (evaluations && evaluations.length > 0) {
    evaluations.forEach((ev) => {
      if (ev.as_of_date) {
        if (!latestTimeStr || new Date(ev.as_of_date).getTime() > new Date(latestTimeStr).getTime()) {
          latestTimeStr = ev.as_of_date;
        }
      }
      if (ev.data_quality?.data_quality_score) {
        totalQualityScore += ev.data_quality.data_quality_score;
        evaluatedCount++;
      }
      if (ev.data_quality?.source === 'seed' || ev.data_source?.isFallback) {
        hasFallbackSeed = true;
      }
    });
  }

  const avgQualityScore = evaluatedCount > 0 ? Math.round(totalQualityScore / evaluatedCount) : 95;

  let freshnessLevel: 'FRESH' | 'RECENT' | 'STALE' | 'OUTDATED' = 'RECENT';
  let badgeLabel = '당일 마감';
  let badgeColor = 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
  let dotColor = 'bg-cyan-400';

  if (latestTimeStr) {
    const evalTime = new Date(latestTimeStr).getTime();
    const diffHours = (Date.now() - evalTime) / (1000 * 60 * 60);

    if (diffHours < 2) {
      freshnessLevel = 'FRESH';
      badgeLabel = '실시간/최신';
      badgeColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      dotColor = 'bg-emerald-400 animate-pulse';
    } else if (diffHours < 24) {
      freshnessLevel = 'RECENT';
      badgeLabel = '당일 시세';
      badgeColor = 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
      dotColor = 'bg-cyan-400';
    } else if (diffHours < 72) {
      freshnessLevel = 'STALE';
      badgeLabel = '주말/휴장';
      badgeColor = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      dotColor = 'bg-amber-400';
    } else {
      freshnessLevel = 'OUTDATED';
      badgeLabel = '갱신 권장';
      badgeColor = 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      dotColor = 'bg-rose-400';
    }
  }

  const formatDisplayTime = (time: string | null) => {
    if (!time) return '데이터 로드 대기 중';
    try {
      const d = new Date(time);
      if (isNaN(d.getTime())) return time;
      return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    } catch {
      return time;
    }
  };

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <button
        type="button"
        onClick={() => setShowTooltip((prev) => !prev)}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`flex items-center space-x-1.5 px-2 py-1 rounded-lg border text-[11px] font-medium transition-all ${badgeColor} hover:brightness-110 active:scale-95`}
        title="데이터 신선도 및 품질 상태 확인 (P1-1)"
        aria-label={`데이터 신선도: ${badgeLabel}, 품질 점수 ${avgQualityScore}점`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
        <span className="font-semibold">{badgeLabel}</span>
        {showDetails && (
          <span className="text-[10px] opacity-80 font-mono hidden sm:inline">
            ({avgQualityScore}점)
          </span>
        )}
      </button>

      {/* Popover Card */}
      {showTooltip && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-64 p-3 bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl text-xs space-y-2 animate-fadeIn text-left backdrop-blur-md">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
            <span className="font-bold text-slate-100 flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span>데이터 신선도 & 무결성</span>
            </span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${badgeColor}`}>
              {freshnessLevel}
            </span>
          </div>

          <div className="space-y-1 text-[11px] text-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-400">최종 동기화:</span>
              <span className="font-mono text-slate-200">{formatDisplayTime(latestTimeStr)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">데이터 품질:</span>
              <span className="font-mono font-bold text-cyan-300">{avgQualityScore} / 100</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">평가 종목수:</span>
              <span className="font-mono text-slate-200">{evaluations.length}개</span>
            </div>
            {hasFallbackSeed && (
              <div className="flex items-center space-x-1 text-amber-400 text-[10px] mt-1 pt-1 border-t border-slate-800">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>일부 종목 오프라인 시드 보존값 포함</span>
              </div>
            )}
          </div>

          {onRefresh && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowTooltip(false);
                onRefresh();
              }}
              disabled={isRefreshing}
              className="w-full mt-2 py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
              <span>{isRefreshing ? '데이터 갱신 중...' : '지금 시세 새로고침'}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
