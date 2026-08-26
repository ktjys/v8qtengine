import React, { useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronRight,
  Loader2,
  RefreshCw,
  Zap,
  X,
} from 'lucide-react';
import { ScanRunLog, SignalSnapshot } from '../types/v8';

interface ScanRunnerModalProps {
  onClose: () => void;
  onScanCompleted: (result: { scan_log: ScanRunLog; new_signals: SignalSnapshot[] }) => void;
}

export const ScanRunnerModal: React.FC<ScanRunnerModalProps> = ({
  onClose,
  onScanCompleted,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [completedLog, setCompletedLog] = useState<ScanRunLog | null>(null);
  const [newSignals, setNewSignals] = useState<SignalSnapshot[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);

  const steps = [
    { title: '1. Watchlist 동기화', desc: '워치리스트 종목 시세 및 지표 로드' },
    { title: '2. Asset Classification', desc: 'ETF/개별주 자산 정체성 및 전략 분류' },
    { title: '3. Opportunity Engine', desc: '전체 종목 4대 팩터(Tech, Mom, Fund, Val) 산출' },
    { title: '4. Independent Risk Filter', desc: '베타, 변동성, 낙폭 기반 독립 리스크 제약 판정' },
    { title: '5. Decision & Signal Snapshot', desc: '의사결정 매트릭스 도출 및 불변 시그널 원장 저장' },
  ];

  const handleStartScan = async () => {
    setIsRunning(true);
    setCompletedLog(null);
    setNewSignals([]);
    setScanError(null);

    // Step-by-step visual animation
    for (let i = 0; i < steps.length; i++) {
      setCurrentStep(i);
      await new Promise((r) => setTimeout(r, 350));
    }

    try {
      const res = await fetch('/api/v8/scan/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ simulate_partial_failure: simulateFailure }),
      });

      if (!res.ok) {
        throw new Error(`서버 통신 상태 코드 오류: ${res.status}`);
      }

      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        throw new Error(
          res.ok
            ? '서버 응답 형식이 올바르지 않습니다 (HTML/텍스트 반환).'
            : `서버 오류 (${res.status}): ${text.slice(0, 100)}`
        );
      }

      if (data.success) {
        setCompletedLog(data.scan_log);
        setNewSignals(data.new_signals || []);
        onScanCompleted(data);
      } else {
        throw new Error(data.error || '스캔 엔진 실행 중 오류가 발생했습니다.');
      }
    } catch (err: any) {
      console.error('Scan failed', err);
      setScanError(err.message || '스캔 실행 중 문제가 발생했습니다.');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-600/20 text-cyan-400 flex items-center justify-center">
              <RefreshCw className={`w-4 h-4 ${isRunning ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">퀀트 스캐너 실행</h3>
              <p className="text-xs text-slate-400 font-mono">워치리스트 전종목 일괄 평가 파이프라인</p>
            </div>
          </div>

          {!isRunning && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Step Progress Display */}
        <div className="space-y-2.5">
          {steps.map((step, idx) => {
            const isDone = isRunning ? idx < currentStep : completedLog !== null;
            const isCurrent = isRunning && idx === currentStep;

            return (
              <div
                key={idx}
                className={`p-3 rounded-2xl border transition-all text-xs flex items-center justify-between ${
                  isCurrent
                    ? 'bg-cyan-950/40 border-cyan-500/50 text-cyan-200 shadow-sm'
                    : isDone
                    ? 'bg-slate-950/70 border-emerald-500/30 text-slate-200'
                    : 'bg-slate-950/40 border-slate-800 text-slate-500'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center font-mono font-bold text-[10px] ${
                      isDone
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : isCurrent
                        ? 'bg-cyan-500 text-slate-950 animate-pulse'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {isDone ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                  </div>
                  <div>
                    <div className="font-semibold">{step.title}</div>
                    <div className="text-[10px] opacity-75">{step.desc}</div>
                  </div>
                </div>

                {isCurrent && <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />}
              </div>
            );
          })}
        </div>

        {/* Resilience Test Options */}
        {!isRunning && !completedLog && (
          <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={simulateFailure}
                  onChange={(e) => setSimulateFailure(e.target.checked)}
                  className="rounded border-slate-700 accent-cyan-500"
                />
                <span>부분 실패 허용 복원력 테스트 (Simulate Partial Failure)</span>
              </label>
              <span className="text-[10px] text-slate-500 font-mono">장애 격리</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              체크 시 1개 종목의 가상 네트워크 타임아웃을 유발하며, 시스템이 중단되지 않고 나머지 종목을 정상 완료하는지 검증합니다.
            </p>
          </div>
        )}

        {/* Scan Result Summary */}
        {completedLog && (
          <div
            className={`p-4 rounded-2xl border text-xs space-y-2 animate-fadeIn ${
              completedLog.status === 'SUCCESS'
                ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                : 'bg-amber-950/20 border-amber-500/30 text-amber-200'
            }`}
          >
            <div className="flex items-center justify-between font-semibold">
              <span className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  스캔 완료: {completedLog.status === 'SUCCESS' ? '전체 정상 성공' : '부분 성공 (장애 격리 완료)'}
                </span>
              </span>
              <span className="font-mono text-[10px]">
                소요 시간: {new Date(completedLog.finished_at).getTime() - new Date(completedLog.started_at).getTime()}ms
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center font-mono py-1 text-slate-300">
              <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-400">평가 완료</div>
                <div className="text-sm font-bold text-cyan-400">{completedLog.evaluated_count} / {completedLog.watchlist_count}</div>
              </div>
              <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-400">발생 시그널</div>
                <div className="text-sm font-bold text-amber-400">{newSignals.length}건</div>
              </div>
              <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-400">실패/격리</div>
                <div className={`text-sm font-bold ${completedLog.failure_count > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                  {completedLog.failure_count}건
                </div>
              </div>
            </div>

            {completedLog.error_summary && (
              <div className="text-[11px] text-amber-400 bg-slate-900/90 p-2.5 rounded-xl border border-amber-500/20 font-mono">
                ⚠️ {completedLog.error_summary}
              </div>
            )}
          </div>
        )}

        {/* Error Alert */}
        {scanError && !completedLog && (
          <div className="p-3.5 rounded-2xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-start space-x-2 animate-fadeIn">
            <span className="font-bold text-rose-400">⚠️ 오류:</span>
            <span className="leading-relaxed">{scanError}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-2 pt-2">
          {!completedLog ? (
            <button
              onClick={handleStartScan}
              disabled={isRunning}
              className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-cyan-600/30 transition-all flex items-center justify-center space-x-2"
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>엔진 평가 진행 중...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  <span>전체 파이프라인 스캔 시작</span>
                </>
              )}
            </button>
          ) : (
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all"
            >
              스캔 결과 확인 및 닫기
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
