import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Clock, Layers, RefreshCw, Search } from 'lucide-react';
import { ScanRunLog } from '../types/v8';
import { SortableHeader } from './SortableHeader';

export type ScanRunsSortField =
  | 'run_id'
  | 'started_at'
  | 'status'
  | 'watchlist_count'
  | 'evaluated_count'
  | 'signal_count'
  | 'failure_count';

interface ScanRunsViewProps {
  runs: ScanRunLog[];
  onTriggerScan: () => void;
}

export const ScanRunsView: React.FC<ScanRunsViewProps> = ({ runs, onTriggerScan }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [sortField, setSortField] = useState<ScanRunsSortField>('started_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const handleSort = (field: ScanRunsSortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortField(field);
      setSortOrder(
        field === 'run_id' || field === 'status' ? 'asc' : 'desc'
      );
    }
  };

  const filtered = (runs || []).filter((run) => {
    if (filterStatus !== 'ALL' && run.status !== filterStatus) return false;
    if (
      searchTerm &&
      !(run.run_id || '').toLowerCase().includes(searchTerm.toLowerCase()) &&
      !(run.error_summary || '').toLowerCase().includes(searchTerm.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    let diff = 0;
    switch (sortField) {
      case 'run_id':
        diff = (a.run_id || '').localeCompare(b.run_id || '');
        break;
      case 'started_at':
        diff = new Date(a.started_at).getTime() - new Date(b.started_at).getTime();
        break;
      case 'status':
        diff = (a.status || '').localeCompare(b.status || '');
        break;
      case 'watchlist_count':
        diff = (a.watchlist_count ?? 0) - (b.watchlist_count ?? 0);
        break;
      case 'evaluated_count':
        diff = (a.evaluated_count ?? 0) - (b.evaluated_count ?? 0);
        break;
      case 'signal_count':
        diff = (a.signal_count ?? 0) - (b.signal_count ?? 0);
        break;
      case 'failure_count':
        diff = (a.failure_count ?? 0) - (b.failure_count ?? 0);
        break;
      default:
        diff = 0;
    }
    return sortOrder === 'desc' ? -diff : diff;
  });

  return (
    <div className="space-y-6 animate-fadeIn text-xs">
      {/* Header */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center space-x-2">
              <Layers className="w-5 h-5 text-cyan-400" />
              <span>스캔 실행 및 감사 이력 (Scan Runs Audit - Section 15)</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              "왜 어제는 신호가 1개였고 오늘은 4개인가?"를 역추적할 수 있도록 전체 실행 내역을 기록합니다.
            </p>
          </div>

          <button
            onClick={onTriggerScan}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold shadow-md shadow-cyan-600/30 transition-all active:scale-95 whitespace-nowrap"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>신규 스캔 실행</span>
          </button>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80 text-xs">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="실행 ID / 내용 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">상태 (전체)</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="PARTIAL_SUCCESS">PARTIAL_SUCCESS</option>
            <option value="FAILED">FAILED</option>
          </select>
        </div>
      </div>

      {/* Runs Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-semibold">
                <SortableHeader<ScanRunsSortField>
                  field="run_id"
                  currentField={sortField}
                  currentOrder={sortOrder}
                  onSort={handleSort}
                  className="py-3.5 px-4"
                >
                  <span>실행 ID (Run ID)</span>
                </SortableHeader>

                <SortableHeader<ScanRunsSortField>
                  field="started_at"
                  currentField={sortField}
                  currentOrder={sortOrder}
                  onSort={handleSort}
                  className="py-3.5 px-3"
                >
                  <span>시작 시각</span>
                </SortableHeader>

                <SortableHeader<ScanRunsSortField>
                  field="status"
                  currentField={sortField}
                  currentOrder={sortOrder}
                  onSort={handleSort}
                  className="py-3.5 px-3"
                >
                  <span>상태 (Status)</span>
                </SortableHeader>

                <SortableHeader<ScanRunsSortField>
                  field="watchlist_count"
                  currentField={sortField}
                  currentOrder={sortOrder}
                  onSort={handleSort}
                  align="center"
                  className="py-3.5 px-3 text-center"
                >
                  <span>워치리스트 수</span>
                </SortableHeader>

                <SortableHeader<ScanRunsSortField>
                  field="evaluated_count"
                  currentField={sortField}
                  currentOrder={sortOrder}
                  onSort={handleSort}
                  align="center"
                  className="py-3.5 px-3 text-center"
                >
                  <span>평가 완료 수</span>
                </SortableHeader>

                <SortableHeader<ScanRunsSortField>
                  field="signal_count"
                  currentField={sortField}
                  currentOrder={sortOrder}
                  onSort={handleSort}
                  align="center"
                  className="py-3.5 px-3 text-center"
                >
                  <span>발생 시그널</span>
                </SortableHeader>

                <SortableHeader<ScanRunsSortField>
                  field="failure_count"
                  currentField={sortField}
                  currentOrder={sortOrder}
                  onSort={handleSort}
                  align="center"
                  className="py-3.5 px-3 text-center"
                >
                  <span>실패/격리</span>
                </SortableHeader>

                <th className="py-3.5 px-4 text-slate-400 font-semibold">오류/실행 요약</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500 font-sans">
                    검색 조건과 일치하는 스캔 실행 이력이 없습니다.
                  </td>
                </tr>
              ) : (
                sorted.map((run) => (
                  <tr key={run.run_id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-200">{run.run_id}</td>
                    <td className="py-3 px-3 text-slate-400">
                      {new Date(run.started_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-3">
                      {run.status === 'SUCCESS' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          SUCCESS
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          PARTIAL_SUCCESS
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center text-slate-300">{run.watchlist_count}개</td>
                    <td className="py-3 px-3 text-center text-cyan-400 font-bold">{run.evaluated_count}개</td>
                    <td className="py-3 px-3 text-center text-amber-400 font-bold">{run.signal_count}건</td>
                    <td className="py-3 px-3 text-center">
                      <span className={(run.failure_count || 0) > 0 ? 'text-rose-400 font-bold' : 'text-slate-500'}>
                        {run.failure_count || 0}건
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[11px] font-sans text-slate-400">
                      {run.error_summary || '전체 파이프라인 무결성 평가 완료'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
