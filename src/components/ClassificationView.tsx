import React, { useState } from 'react';
import {
  Check,
  CheckCircle2,
  Edit3,
  Filter,
  Layers,
  RotateCcw,
  Search,
  Shield,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { AssetClassification, AssetType, FullTickerEvaluation, StrategyType } from '../types/v8';

interface ClassificationViewProps {
  evaluations: FullTickerEvaluation[];
  onSelectTicker: (ticker: string) => void;
  onSaveOverride: (
    ticker: string,
    asset_type: AssetType,
    strategy_type: StrategyType,
    confidence: number,
    reason: string
  ) => void;
  onResetOverride: (ticker: string) => void;
}

export const ClassificationView: React.FC<ClassificationViewProps> = ({
  evaluations,
  onSelectTicker,
  onSaveOverride,
  onResetOverride,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSource, setFilterSource] = useState<'ALL' | 'auto' | 'manual'>('ALL');
  const [filterType, setFilterType] = useState<string>('ALL');

  const manualCount = (evaluations || []).filter(
    (e) => e?.classification?.classification_source === 'manual'
  ).length;
  const autoCount = (evaluations || []).length - manualCount;

  const filtered = (evaluations || []).filter((e) => {
    if (!e) return false;
    const c = e.classification || ({} as any);
    if (filterSource !== 'ALL' && c.classification_source !== filterSource) return false;
    if (filterType !== 'ALL' && c.asset_type !== filterType) return false;
    if (
      searchTerm &&
      !(e.ticker || '').toLowerCase().includes(searchTerm.toLowerCase()) &&
      !(e.name || '').toLowerCase().includes(searchTerm.toLowerCase()) &&
      !(c.strategy_type || '').toLowerCase().includes(searchTerm.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 1. Header & Policy Box */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center space-x-2">
              <Sliders className="w-5 h-5 text-cyan-400" />
              <span>자산 정체성 분류 관리 (Asset Classification)</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              자산의 정체성은 점수 계산의 가중치 프로파일을 결정하며, 수동 지정(Manual Override) 시 자동 스캐너가 덮어쓰지 않습니다.
            </p>
          </div>

          <div className="flex items-center space-x-3 text-xs font-mono">
            <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300">
              <span className="text-slate-500">자동 분류:</span> <strong className="text-cyan-400">{autoCount}</strong>개
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-purple-950/40 border border-purple-500/30 text-purple-300">
              <span className="text-purple-400/80">수동 지정:</span> <strong>{manualCount}</strong>개
            </div>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80 text-xs">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="티커 / 종목 / 전략 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value as any)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">분류 출처 (전체)</option>
            <option value="auto">자동 분석 (Auto)</option>
            <option value="manual">수동 지정 (Manual)</option>
          </select>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">자산 대분류 (전체)</option>
            <option value="etf">ETF</option>
            <option value="equity">개별주 (Equity)</option>
          </select>
        </div>
      </div>

      {/* 2. Classification Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-semibold">
                <th className="py-3.5 px-4">
                  <span className="text-slate-500 font-mono mr-1.5 text-[11px]">No.</span>종목코드 / 이름
                </th>
                <th className="py-3.5 px-3">자산 대분류</th>
                <th className="py-3.5 px-3">전략 유형 (Strategy)</th>
                <th className="py-3.5 px-3 text-center">신뢰도 확신</th>
                <th className="py-3.5 px-3">분류 출처</th>
                <th className="py-3.5 px-4">분류 근거 (Reason)</th>
                <th className="py-3.5 px-4 text-right">수동 편집</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filtered.map((item, idx) => {
                const c = item.classification;
                const isManual = c.classification_source === 'manual';

                return (
                  <tr
                    key={item.ticker}
                    onClick={() => onSelectTicker(item.ticker)}
                    className="hover:bg-slate-800/50 transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-4 font-sans">
                      <div className="flex items-center space-x-2.5">
                        <span className="text-[11px] font-mono font-bold text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 text-center min-w-[26px] shrink-0">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-100 font-mono text-sm">{item.ticker}</div>
                          <div className="text-[11px] text-slate-400 truncate max-w-[150px]">{item.name}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <span className="uppercase text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold">
                        {c.asset_type}
                      </span>
                    </td>

                    <td className="py-3 px-3 font-sans font-medium text-cyan-300">
                      {c.strategy_type}
                    </td>

                    <td className="py-3 px-3 text-center">
                      <span className="font-bold text-slate-200">{(c.confidence * 100).toFixed(0)}%</span>
                    </td>

                    <td className="py-3 px-3">
                      {isManual ? (
                        <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/30 text-[10px]">
                          MANUAL
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px]">
                          AUTO
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 font-sans text-slate-400 text-[11px] max-w-[280px] truncate">
                      {c.reason}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectTicker(item.ticker);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-cyan-600 text-slate-300 hover:text-white font-sans text-xs transition-colors"
                      >
                        수정
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
