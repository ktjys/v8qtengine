import React from 'react';
import { AlertCircle, CheckCircle2, Clock, Layers, RefreshCw } from 'lucide-react';
import { ScanRunLog } from '../types/v8';

interface ScanRunsViewProps {
  runs: ScanRunLog[];
  onTriggerScan: () => void;
}

export const ScanRunsView: React.FC<ScanRunsViewProps> = ({ runs, onTriggerScan }) => {
  return (
    <div className="space-y-6 animate-fadeIn text-xs">
      {/* Header */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
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
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold shadow-md shadow-cyan-600/30 transition-all active:scale-95"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>신규 스캔 실행</span>
          </button>
        </div>
      </div>

      {/* Runs Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-semibold">
                <th className="py-3.5 px-4">실행 ID (Run ID)</th>
                <th className="py-3.5 px-3">시작 시각</th>
                <th className="py-3.5 px-3">상태 (Status)</th>
                <th className="py-3.5 px-3 text-center">워치리스트 수</th>
                <th className="py-3.5 px-3 text-center">평가 완료 수</th>
                <th className="py-3.5 px-3 text-center">발생 시그널</th>
                <th className="py-3.5 px-3 text-center">실패/격리</th>
                <th className="py-3.5 px-4">오류/실행 요약</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {runs.map((run) => (
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
                    <span className={run.failure_count > 0 ? 'text-rose-400 font-bold' : 'text-slate-500'}>
                      {run.failure_count}건
                    </span>
                  </td>
                  <td className="py-3 px-4 text-[11px] font-sans text-slate-400">
                    {run.error_summary || '전체 파이프라인 무결성 평가 완료'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
