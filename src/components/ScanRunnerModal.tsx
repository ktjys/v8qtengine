import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCircle2,
  ChevronRight,
  Loader2,
  RefreshCw,
  Zap,
  X,
  Send,
} from 'lucide-react';
import { MarketRegion, ScanRunLog, SignalSnapshot } from '../types/v8';

interface ScanRunnerModalProps {
  onClose: () => void;
  onScanCompleted: (result: { scan_log: ScanRunLog; new_signals: SignalSnapshot[] }) => void;
  totalWatchlistCount?: number;
  onViewAlertHistory?: () => void;
  activeMarket?: MarketRegion;
}

interface ScanStatusResponse {
  success: boolean;
  run?: {
    run_id: string;
    status: 'RUNNING' | 'SUCCESS' | 'PARTIAL_SUCCESS' | 'FAILED' | 'SKIPPED_CLOSED_MARKET' | 'SKIPPED_EMPTY_WATCHLIST';
    started_at: string;
    finished_at: string | null;
    watchlist_count: number;
    evaluated_count: number;
    signal_count: number;
    failure_count: number;
    error_summary: string | null;
    market_region: string;
    chunk_size: number;
    total_chunks: number;
    completed_chunks: number;
    failed_chunks: number;
    meta: any;
  };
  error?: string;
}

export const ScanRunnerModal: React.FC<ScanRunnerModalProps> = ({
  onClose,
  onScanCompleted,
  totalWatchlistCount,
  onViewAlertHistory,
  activeMarket = 'US',
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [sendTelegramOption, setSendTelegramOption] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [completedLog, setCompletedLog] = useState<any>(null);
  const [newSignals, setNewSignals] = useState<any[]>([]);
  const [actionableSignals, setActionableSignals] = useState<any[]>([]);
  const [telegramStatus, setTelegramStatus] = useState<{ sent: boolean; message: string } | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // New: scan status polling state
  const [scanId, setScanId] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<any>(null);
  const [polling, setPolling] = useState(false);

  // ESC key handler & body scroll lock
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isRunning && !polling) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = origOverflow;
    };
  }, [isRunning, polling, onClose]);

  // Polling effect for scan status
  useEffect(() => {
    if (!polling || !scanId) return;

    const pollStatus = async () => {
      try {
        const res = await fetch(`/api/v8/scan/status/${scanId}`);
        if (!res.ok) throw new Error('Failed to fetch scan status');
        const data: any = await res.json();

        if (data.success && data.run) {
          setScanStatus(data.run);

          // If scan is complete, stop polling and fetch results
          if (data.run.status !== 'RUNNING') {
            setPolling(false);
            await fetchFinalResults(scanId);
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
        console.warn('Polling error, will retry:', err);
      }
    };

    const interval = setInterval(pollStatus, 2000);
    pollStatus(); // Initial poll
    return () => clearInterval(interval);
  }, [polling, scanId]);

  const fetchFinalResults = useCallback(async (scanId: string) => {
    try {
      const [evalRes, signalRes] = await Promise.all([
        fetch(`/api/v8/evaluations`),
        fetch(`/api/vapi/v8/signals`),
      ]);

      const evalData = await evalRes.json();
      const signalData = await signalRes.json();

      const evaluations = evalData.success ? evalData.evaluations || [] : [];
      const signals = signalData.success ? signalData.signals || [] : [];

      // Get the scan run
      const runRes = await fetch(`/api/v8/scan/status/${scanId}`);
      const runData = await runRes.json();

      if (runData.success && runData.run) {
        const run = runData.run;
        setCompletedLog(run);

        const evaluations = await fetch('/api/v8/evaluations').then(r => r.json()).then(d => d.success ? d.evaluations || [] : []);
        const actionable = evaluations.filter((e: any) => e.signal_generated);
        setActionableSignals(actionable);
        setNewSignals([]);

        onScanCompleted({ scan_log: run, new_signals: [] });

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('quant-alerts-updated', { detail: { scan_log: run } }));
        }
      }
    } catch (err) {
      console.error('Failed to fetch final results:', err);
    }
  }, []);

  // ESC key handler & body scroll lock
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isRunning && !polling) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = origOverflow;
    };
  }, [isRunning, polling, onClose]);

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
    setActionableSignals([]);
    setTelegramStatus(null);
    setScanError(null);
    setScanId(null);
    setScanStatus(null);
    setPolling(false);

    // Step-by-step visual animation (pre-scan animation)
    for (let i = 0; i < steps.length; i++) {
      setCurrentStep(i);
      await new Promise((r) => setTimeout(r, 350));
    }

    try {
      const storedToken = (typeof localStorage !== 'undefined' ? localStorage.getItem('v8_telegram_bot_token') || '' : '').trim();
      const storedChatId = (typeof localStorage !== 'undefined' ? localStorage.getItem('v8_telegram_chat_id') || '' : '').trim();

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (storedToken) headers['Authorization'] = `Bearer ${storedToken}`;
      if (storedChatId) headers['x-telegram-chat-id'] = storedChatId;

      const res = await fetch('/api/v8/scan/run', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          market: activeMarket,
          simulate_partial_failure: simulateFailure,
        }),
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
            ? '서버 응답 형식이 올바르지 않습니다.'
            : `서버 오류 (${res.status}): ${text.slice(0, 100)}`
        );
      }

      if (data.success && data.scan_id) {
        setScanId(data.scan_id);
        setPolling(true); // Start polling for status
      } else {
        throw new Error(data.error || '스캔 시작 실패');
      }
    } catch (err: any) {
      console.error('Scan failed', err);
      setScanError(err.message || '스캔 실행 중 문제가 발생했습니다.');
      setIsRunning(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="scan-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isRunning && !polling) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4 animate-fadeIn"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl w-full max-w-xl max-h-[90dvh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-950/60">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-600/20 text-cyan-400 flex items-center justify-center shrink-0">
              <RefreshCw className={`w-4 h-4 ${isRunning || polling ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h3 id="scan-modal-title" className="text-sm sm:text-base font-bold text-slate-100">
                  {activeMarket === 'KR' ? '🇰🇷 국내(KR) 퀀트 스캐너 실행' : '🇺🇸 미국(US) 퀀트 스캐너 실행'}
                </h3>
                {totalWatchlistCount !== undefined && totalWatchlistCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    {activeMarket === 'KR' ? '국내 종목' : '미국 종목'} {totalWatchlistCount}개
                  </span>
                )}
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 font-mono">
                {polling
                  ? `청크 ${scanStatus?.completed_chunks || 0} / ${scanStatus?.total_chunks || 0} | 평가 ${scanStatus?.evaluated_count || 0} / ${scanStatus?.watchlist_count || 0} | 시그널 ${scanStatus?.signal_count || 0} | 실패 ${scanStatus?.failure_count || 0}`
                  : (activeMarket === 'KR' ? 'KOSPI / KOSDAQ 전종목 일괄 평가 파이프라인' : 'NYSE / NASDAQ 전종목 일괄 평가 파이프라인')}
              </p>
            </div>
          </div>

          {!isRunning && !polling && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 sm:space-y-4 flex-1">
          {/* Scan Progress / Step Progress Display */}
          <div className="space-y-2">
            {(polling || isRunning) && scanStatus ? (
              // Show chunk progress when polling
              <div className="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-cyan-300">
                    {scanStatus.status === 'RUNNING' ? '청크 처리 중...' :
                     scanStatus.status === 'SUCCESS' ? '완료' :
                     scanStatus.status === 'PARTIAL_SUCCESS' ? '부분 완료' :
                     scanStatus.status === 'FAILED' ? '실패' : scanStatus.status}
                  </span>
                  <span className="font-mono text-[10px] text-cyan-400">
                    청크 {scanStatus.completed_chunks || 0} / {scanStatus.total_chunks || 0}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center font-mono py-1 text-slate-300">
                  <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800">
                    <div className="text-[10px] text-slate-400">청크 진행</div>
                    <div className="text-xs sm:text-sm font-bold text-cyan-400">
                      {scanStatus.completed_chunks || 0} / {scanStatus.total_chunks || 0}
                    </div>
                  </div>
                  <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800">
                    <div className="text-[10px] text-slate-400">평가 완료</div>
                    <div className="text-xs sm:text-sm font-bold text-cyan-400">
                      {scanStatus.evaluated_count || 0} / {scanStatus.watchlist_count || 0}
                    </div>
                  </div>
                  <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800">
                    <div className="text-[10px] text-slate-400">시그널</div>
                    <div className="text-xs sm:text-sm font-bold text-amber-400">
                      {scanStatus.signal_count || 0}건
                    </div>
                  </div>
                </div>
                {scanStatus.failure_count > 0 && (
                  <div className="bg-rose-950/30 border border-rose-500/30 p-2 rounded-xl text-[10px] text-rose-300 font-mono">
                    ⚠️ {scanStatus.failed_chunks || scanStatus.failure_count}개 청크/종목 실패 - 부분 실패 격리됨
                  </div>
                )}
              </div>
            ) : (
              // Original step progress display
              <div className="space-y-2">
                {steps.map((step, idx) => {
                  const isDone = isRunning ? idx < currentStep : completedLog !== null;
                  const isCurrent = isRunning && idx === currentStep;

                  return (
                    <div
                      key={idx}
                      className={`p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border transition-all text-xs flex items-center justify-between ${
                        isCurrent
                          ? 'bg-cyan-950/40 border-cyan-500/50 text-cyan-200 shadow-sm'
                          : isDone
                          ? 'bg-slate-950/70 border-emerald-500/30 text-slate-200'
                          : 'bg-slate-950/40 border-slate-800 text-slate-500'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 sm:space-x-3">
                        <div
                          className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center font-mono font-bold text-[9px] sm:text-[10px] shrink-0 ${
                            isDone
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : isCurrent
                              ? 'bg-cyan-500 text-slate-950 animate-pulse'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {isDone ? <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : idx + 1}
                        </div>
                        <div>
                          <div className="font-semibold text-[11px] sm:text-xs">{step.title}</div>
                          <div className="text-[10px] opacity-75">{step.desc}</div>
                        </div>
                      </div>

                      {isCurrent && <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400 animate-spin shrink-0" />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Scan Options - only show when not running/polling and not completed */}
          {!isRunning && !polling && !completedLog && (
            <div className="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <label className="flex items-center space-x-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendTelegramOption}
                    onChange={(e) => setSendTelegramOption(e.target.checked)}
                    className="rounded border-slate-700 accent-cyan-500"
                  />
                  <span className="text-[11px] sm:text-xs font-medium">스캔 완료 시 텔레그램 리포트 즉시 발송</span>
                </label>
                <span className="text-[10px] text-cyan-400 font-mono">선택 옵션</span>
              </div>

              <div className="border-t border-slate-800/80 pt-2.5">
                <div className="flex items-center justify-between">
                  <label className="flex items-center space-x-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={simulateFailure}
                      onChange={(e) => setSimulateFailure(e.target.checked)}
                      className="rounded border-slate-700 accent-cyan-500"
                    />
                    <span className="text-[11px] sm:text-xs font-medium">부분 실패 허용 복원력 테스트</span>
                  </label>
                  <span className="text-[10px] text-slate-500 font-mono">장애 격리</span>
                </div>
                <p className="text-[10px] sm:text-[11px] text-slate-500 leading-relaxed mt-1">
                  체크 시 1개 종목의 가상 네트워크 타임아웃을 유발하여 시스템 장애 격리 기능을 검증합니다.
                </p>
              </div>
            </div>
          )}

          {/* Scan Result Summary */}
          {completedLog && (
            <div
              className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border text-xs space-y-2 animate-fadeIn ${
                completedLog.status === 'SUCCESS'
                  ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                  : 'bg-amber-950/20 border-amber-500/30 text-amber-200'
              }`}
            >
              <div className="flex items-center justify-between font-semibold text-[11px] sm:text-xs">
                <span className="flex items-center space-x-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>
                    스캔 완료: {completedLog.status === 'SUCCESS' ? '전체 성공' : '부분 성공 (격리 완료)'}
                  </span>
                </span>
                <span className="font-mono text-[10px]">
                  {new Date(completedLog.finished_at).getTime() - new Date(completedLog.started_at).getTime()}ms
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center font-mono py-1 text-slate-300">
                <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400">평가 완료</div>
                  <div className="text-xs sm:text-sm font-bold text-cyan-400">{completedLog.evaluated_count} / {completedLog.watchlist_count}</div>
                </div>
                <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400">포착 시그널</div>
                  <div className="text-xs sm:text-sm font-bold text-amber-400">
                    {completedLog.signal_count}건
                    {newSignals.length > 0 && newSignals.length !== completedLog.signal_count && (
                      <span className="text-[10px] text-emerald-400 font-normal ml-1">(신규 {newSignals.length})</span>
                    )}
                  </div>
                </div>
                <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400">실패/격리</div>
                  <div className={`text-xs sm:text-sm font-bold ${completedLog.failure_count > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                    {completedLog.failure_count}건
                  </div>
                </div>
              </div>

              {/* Telegram Delivery Status */}
              {telegramStatus && (
                <div className={`p-2.5 rounded-xl border text-xs flex items-center justify-between font-mono ${
                  telegramStatus.sent
                    ? 'bg-cyan-950/40 border-cyan-500/30 text-cyan-200'
                    : 'bg-amber-950/30 border-amber-500/30 text-amber-300'
                }`}>
                  <div className="flex items-center space-x-2">
                    <Send className={`w-3.5 h-3.5 ${telegramStatus.sent ? 'text-cyan-400' : 'text-amber-400'}`} />
                    <span className="text-[11px] font-sans font-medium">
                      텔레그램 브리핑 알림:
                    </span>
                  </div>
                  <span className={`text-[11px] font-bold ${telegramStatus.sent ? 'text-cyan-300' : 'text-amber-300'}`}>
                    {telegramStatus.sent
                      ? `✅ 즉시 발송 완료${telegramStatus.target ? ` (${telegramStatus.target})` : ''}`
                      : telegramStatus.message}
                  </span>
                </div>
              )}

              {completedLog.error_summary && (
                <div className="text-[10px] sm:text-[11px] text-amber-400 bg-slate-900/90 p-2.5 rounded-xl border border-amber-500/20 font-mono">
                  ⚠️ {completedLog.error_summary}
                </div>
              )}

              {/* Captured Signal Details List */}
              <div className="mt-2 pt-2 border-t border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300">
                  <span className="flex items-center space-x-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>포착된 진입 시그널 목록 ({actionableSignals.length}건)</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">기회점수 70+ & 리스크 제약 통과</span>
                </div>

                {actionableSignals.length > 0 ? (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {actionableSignals.map((sig, idx) => (
                      <div
                        key={idx}
                        className="bg-slate-900/90 border border-slate-800 hover:border-amber-500/40 rounded-xl p-2 sm:p-2.5 flex items-center justify-between transition-all"
                      >
                        <div className="flex items-center space-x-2 sm:space-x-2.5 min-w-0">
                          <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-950 px-1 py-0.5 rounded border border-slate-800 text-center min-w-[20px] shrink-0">
                            {idx + 1}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-400 font-bold font-mono text-xs border border-slate-700">
                            {sig.ticker}
                          </span>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-200 truncate">
                              {sig.name || sig.ticker}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              ${(sig.price ?? sig.signal_price ?? 0).toFixed(2)}
                              {sig.change1d !== undefined && (
                                <span className={`ml-1.5 font-bold ${sig.change1d >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {sig.change1d >= 0 ? '+' : ''}{sig.change1d.toFixed(2)}%
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 shrink-0">
                          <div className="text-right">
                            <span className="text-[9px] text-slate-400 block font-mono">기회점수</span>
                            <span className="text-xs font-bold text-emerald-400 font-mono">
                              {sig.opportunity?.opportunity_score ?? sig.opportunity_score ?? '-'}점
                            </span>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                            {sig.decision?.decision === 'STRONG_OPPORTUNITY' || sig.decision === 'STRONG_OPPORTUNITY'
                              ? '강력 기회'
                              : '진입 기회'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-slate-900/60 rounded-xl p-3 text-center border border-slate-800/80 text-[11px] text-slate-400">
                    현재 진입 기준(기회 점수 70점 이상 및 리스크 필터 통과)을 만족한 신호가 없습니다. (시장 관망 권고)
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error Alert */}
          {scanError && !completedLog && (
            <div className="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-start space-x-2 animate-fadeIn">
              <span className="font-bold text-rose-400">⚠️ 오류:</span>
              <span className="leading-relaxed text-[11px] sm:text-xs">{scanError}</span>
            </div>
          )}
        </div>

        {/* Modal Fixed Footer Action Buttons */}
        <div className="p-3.5 sm:p-4 border-t border-slate-800/80 bg-slate-950/60 shrink-0">
          {!completedLog && !polling ? (
            <button
              onClick={handleStartScan}
              disabled={isRunning}
              className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs sm:text-sm font-bold shadow-lg shadow-cyan-600/30 transition-all flex items-center justify-center space-x-2 active:scale-95"
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>엔진 평가 시작 중...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  <span>청크 기반 스캔 시작</span>
                </>
              )}
            </button>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-2">
              {onViewAlertHistory && (
                <button
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      window.dispatchEvent(new CustomEvent('quant-alerts-updated'));
                    }
                    onClose();
                    onViewAlertHistory();
                  }}
                  className="w-full sm:w-1/2 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs sm:text-sm font-bold shadow-md shadow-purple-600/30 transition-all flex items-center justify-center space-x-1.5 active:scale-95"
                >
                  <Bell className="w-4 h-4" />
                  <span>발송 알림 이력 확인</span>
                </button>
              )}
              <button
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('quant-alerts-updated'));
                  }
                  onClose();
                }}
                className={`w-full ${onViewAlertHistory ? 'sm:w-1/2' : ''} py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-bold transition-all active:scale-95`}
              >
                스캔 결과 확인 및 닫기
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
