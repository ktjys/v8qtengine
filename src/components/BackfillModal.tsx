import React, { useState, useRef, useEffect } from 'react';
import {
  Activity,
  AlertCircle,
  BarChart3,
  Calendar,
  CheckCircle2,
  Database,
  Layers,
  Loader2,
  RefreshCw,
  Sliders,
  TrendingUp,
  X,
  Zap,
  Terminal,
  ShieldCheck,
} from 'lucide-react';

interface BackfillResult {
  success: boolean;
  totalTickers: number;
  totalBarsIngested: number;
  totalSignalsGenerated: number;
  completedSignals: number;
  winRate5d: number;
  winRate10d: number;
  winRate20d: number;
  avgReturn20d: number;
  dateRange: {
    start: string;
    end: string;
  };
  detailsByTicker: Record<
    string,
    {
      barsCount: number;
      signalsCount: number;
      winRate20d: number;
      avgReturn20d: number;
    }
  >;
}

interface BackfillModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBackfillSuccess: () => Promise<void> | void;
  onShowToast: (msg: string) => void;
}

interface LogEntry {
  id: string;
  time: string;
  type: 'info' | 'success' | 'warn' | 'error' | 'accent';
  message: string;
}

export const BackfillModal: React.FC<BackfillModalProps> = ({
  isOpen,
  onClose,
  onBackfillSuccess,
  onShowToast,
}) => {
  const [lookbackRange, setLookbackRange] = useState<'6m' | '1y' | '2y'>('2y');
  const [threshold, setThreshold] = useState<number>(70);
  const [replaceExisting, setReplaceExisting] = useState<boolean>(true);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [result, setResult] = useState<BackfillResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<string>('');
  const [progress, setProgress] = useState<{ current: number; total: number; percent: number }>({
    current: 0,
    total: 0,
    percent: 0,
  });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const terminalBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalBottomRef.current) {
      terminalBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  if (!isOpen) return null;

  const appendLog = (message: string, type: LogEntry['type'] = 'info') => {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    setLogs((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        time: timeStr,
        type,
        message,
      },
    ]);
  };

  const handleRunBackfill = async () => {
    setIsRunning(true);
    setError(null);
    setResult(null);
    setLogs([]);
    setProgress({ current: 0, total: 0, percent: 0 });

    appendLog(`🚀 [시작] 과거 ${lookbackRange === '6m' ? '6개월' : lookbackRange === '2y' ? '2년' : '1년'} 시계열 백필 파이프라인 초기화...`, 'accent');
    setCurrentStep('벤치마크(SPY) 일봉 수집 및 대상 종목 파싱 중...');

    try {
      // 1. Step 1: Try Chunked API Initialization (/api/v8/backtest/backfill-init)
      let initRes = await fetch('/api/v8/backtest/backfill-init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lookbackRange,
          replaceExisting,
        }),
      });

      // Fallback to monolithic backfill if chunked endpoint is 404 (e.g. legacy/static cloudflare deployment)
      if (initRes.status === 404) {
        appendLog('ℹ️ [엔드포인트 전환] 분할 API 대신 통합 배치 백필 파이프라인(/api/v8/backtest/backfill)으로 실행합니다...', 'warn');
        setCurrentStep('전체 종목 통합 백필 및 롤링 시뮬레이션 일괄 실행 중...');
        
        const fallbackRes = await fetch('/api/v8/backtest/backfill', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lookbackRange,
            opportunityThreshold: threshold,
            replaceExisting,
          }),
        });

        if (!fallbackRes.ok) {
          const errData = await fallbackRes.json().catch(() => ({}));
          throw new Error(errData.error || `통합 백필 실행 실패 (${fallbackRes.status})`);
        }

        const fallbackJson = await fallbackRes.json();
        const finalResult: BackfillResult = fallbackJson.result;

        appendLog(
          `🎉 [백필 완료] 총 ${finalResult.totalBarsIngested.toLocaleString()}개 일봉, ${finalResult.totalSignalsGenerated}개 시그널 적재 완료! (20D 승률: ${finalResult.winRate20d}%)`,
          'accent'
        );

        setResult(finalResult);
        onShowToast(`과거 ${lookbackRange} 백필 완료: ${finalResult.totalSignalsGenerated}개 시그널 적재`);
        await onBackfillSuccess();
        return;
      }

      if (!initRes.ok) {
        const errJson = await initRes.json().catch(() => ({}));
        throw new Error(errJson.error || `초기화 실패 (${initRes.status})`);
      }

      const initJson = await initRes.json();
      const initData = initJson.data;
      const targetTickers: string[] = initData.targetTickers || [];
      const benchmarkBarsCount = initData.benchmarkBarsCount || 0;

      appendLog(
        `📊 [SPY 벤치마크] ${benchmarkBarsCount}개 일봉 DB 적재 완료 (출처: ${initData.benchmarkSource})`,
        'info'
      );
      appendLog(
        `📋 대상 워치리스트: 총 ${targetTickers.length}개 종목 (${targetTickers.join(', ')})`,
        'info'
      );

      const totalCount = targetTickers.length;
      setProgress({ current: 0, total: totalCount, percent: 0 });

      let totalBarsIngested = benchmarkBarsCount;
      const allSignals: any[] = [];
      const detailsByTicker: BackfillResult['detailsByTicker'] = {};
      let minDate = '9999-99-99';
      let maxDate = '0000-00-00';

      // 2. Step 2: Sequential Ticker Chunking (Cloudflare Function Timeout-Proof)
      for (let i = 0; i < targetTickers.length; i++) {
        const ticker = targetTickers[i];
        const stepNum = i + 1;
        setCurrentStep(`[${stepNum}/${totalCount}] ${ticker} 과거 일봉 수집 및 롤링 윈도우 시뮬레이션 중...`);

        try {
          const tickerRes = await fetch('/api/v8/backtest/backfill-ticker', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ticker,
              lookbackRange,
              opportunityThreshold: threshold,
            }),
          });

          if (!tickerRes.ok) {
            throw new Error(`HTTP ${tickerRes.status}`);
          }

          const tickerJson = await tickerRes.json();
          const tData = tickerJson.data;

          totalBarsIngested += tData.barsCount;
          if (tData.signals && tData.signals.length > 0) {
            allSignals.push(...tData.signals);
          }

          detailsByTicker[ticker] = {
            barsCount: tData.barsCount,
            signalsCount: tData.signalsCount,
            winRate20d: tData.winRate20d,
            avgReturn20d: tData.avgReturn20d,
          };

          if (tData.minDate && tData.minDate < minDate) minDate = tData.minDate;
          if (tData.maxDate && tData.maxDate > maxDate) maxDate = tData.maxDate;

          const sign = tData.avgReturn20d >= 0 ? '+' : '';
          appendLog(
            `[${stepNum}/${totalCount}] ${ticker}: 일봉 ${tData.barsCount}개 → 시그널 ${tData.signalsCount}개 생성 (20D 승률 ${tData.winRate20d}%, 평균 ${sign}${tData.avgReturn20d}%)`,
            'success'
          );
        } catch (symErr: any) {
          appendLog(`⚠️ [${stepNum}/${totalCount}] ${ticker} 처리 오류 (건너뜀): ${symErr.message}`, 'warn');
        }

        const pct = Math.round(((i + 1) / totalCount) * 100);
        setProgress({ current: i + 1, total: totalCount, percent: pct });
      }

      // 3. Step 3: Finalize Backfill Summary & Record Scan Log
      setCurrentStep('백필 성과 통계 집계 및 DB 스캔 로그 작성 중...');
      appendLog('📦 전체 백필 결과 집계 및 signal_outcomes 동기화 중...', 'info');

      const finalizeRes = await fetch('/api/v8/backtest/backfill-finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetTickers,
          range: lookbackRange,
          totalBarsIngested,
          allSignals,
          detailsByTicker,
          minDate,
          maxDate,
        }),
      });

      if (!finalizeRes.ok) {
        throw new Error(`집계 저장 실패 (${finalizeRes.status})`);
      }

      const finalizeJson = await finalizeRes.json();
      const finalResult: BackfillResult = finalizeJson.result;

      appendLog(
        `🎉 [백필 완료] 총 ${finalResult.totalBarsIngested.toLocaleString()}개 일봉, ${finalResult.totalSignalsGenerated}개 시그널 적재 완료! (20D 승률: ${finalResult.winRate20d}%)`,
        'accent'
      );

      setResult(finalResult);
      onShowToast(`과거 ${lookbackRange} 백필 완료: ${finalResult.totalSignalsGenerated}개 시그널 적재`);
      await onBackfillSuccess();
    } catch (err: any) {
      console.error('Backfill error:', err);
      appendLog(`🚨 백필 중단 오류: ${err.message || '알 수 없는 에러'}`, 'error');
      setError(err?.message || '백필 실행 중 예기치 않은 오류가 발생했습니다.');
    } finally {
      setIsRunning(false);
      setCurrentStep('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2.5 sm:p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl w-full max-w-2xl max-h-[92dvh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-800 bg-slate-950/50 shrink-0">
          <div className="flex items-center space-x-2.5 sm:space-x-3">
            <div className="p-1.5 sm:p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0">
              <Database className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-100 flex items-center space-x-2">
                <span>과거 데이터 백필 엔진 (Backfill Engine)</span>
              </h2>
              <p className="text-[10px] sm:text-xs text-slate-400 hidden sm:block">
                과거 OHLCV 일봉 수집 → Point-in-Time 롤링 시뮬레이션 → 20D 실현 수익률 DB 적재
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isRunning}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all disabled:opacity-30"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-3.5 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5 flex-1">
          {!result && (
            <>
              {/* Info Callout */}
              <div className="p-3.5 rounded-2xl bg-cyan-950/20 border border-cyan-500/30 text-xs text-cyan-200/90 space-y-2">
                <div className="flex items-center justify-between font-bold text-cyan-300">
                  <span className="flex items-center space-x-1.5">
                    <ShieldCheck className="w-4 h-4 text-cyan-400" />
                    <span>클라우드플레어 펑션 타임아웃 방지 &amp; 스트리밍 분할 실행</span>
                  </span>
                  <span className="text-[10px] font-mono text-cyan-400/80 bg-cyan-500/10 px-2 py-0.5 rounded-md border border-cyan-500/20">
                    Chunked Step-by-Step
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-300">
                  각 종목별 1~2초 단위로 분할 요청을 수행하여 Cloudflare 30초 타임아웃을 완전 방지하며, 과거 시점(T)의 일봉만 참조하는 <strong>Point-in-Time 무결성</strong>과 5D/10D/20D 실현 수익률을 <code className="text-cyan-300">signals</code> 및 <code className="text-cyan-300">signal_outcomes</code> DB에 즉시 적재합니다.
                </p>
              </div>

              {/* Options Form */}
              <div className="space-y-3.5">
                {/* 1. Lookback Range */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center space-x-1.5">
                    <Calendar className="w-4 h-4 text-cyan-400" />
                    <span>백필 기간 (Lookback Period)</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: '6m', label: '최근 6개월', desc: '~126 거래일' },
                      { id: '1y', label: '과거 1년', desc: '~252 거래일' },
                      { id: '2y', label: '과거 2년 (심층)', desc: '~504 거래일' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={isRunning}
                        onClick={() => setLookbackRange(opt.id as any)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          lookbackRange === opt.id
                            ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300 shadow-md'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                        } disabled:opacity-50`}
                      >
                        <div className="text-xs font-bold">{opt.label}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Opportunity Score Threshold */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300 flex items-center space-x-1.5">
                      <Sliders className="w-4 h-4 text-cyan-400" />
                      <span>시그널 진입 점수 임계값 (Min Opportunity Score)</span>
                    </span>
                    <span className="font-mono font-bold text-cyan-400">{threshold}점 이상</span>
                  </div>
                  <input
                    type="range"
                    min="60"
                    max="85"
                    step="5"
                    value={threshold}
                    disabled={isRunning}
                    onChange={(e) => setThreshold(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500 disabled:opacity-50"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>60점 (많은 시그널)</span>
                    <span>70점 (표준)</span>
                    <span>85점 (고선별)</span>
                  </div>
                </div>

                {/* 3. Replace Existing Checkbox */}
                <div className="pt-2 border-t border-slate-800/80">
                  <label className="flex items-center space-x-2.5 cursor-pointer text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={replaceExisting}
                      disabled={isRunning}
                      onChange={(e) => setReplaceExisting(e.target.checked)}
                      className="rounded bg-slate-950 border-slate-700 text-cyan-500 focus:ring-cyan-500/20 disabled:opacity-50"
                    />
                    <span>기존 백테스트 시그널 데이터를 초기화하고 새로 적재 (권장)</span>
                  </label>
                </div>
              </div>

              {/* Progress & Live Terminal Output */}
              {(isRunning || logs.length > 0) && (
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  {/* Progress Bar */}
                  {isRunning && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-cyan-300 flex items-center space-x-1.5">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                          <span>{currentStep}</span>
                        </span>
                        <span className="font-mono font-bold text-cyan-400">
                          {progress.current} / {progress.total} 종목 ({progress.percent}%)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 transition-all duration-300"
                          style={{ width: `${progress.percent}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Terminal Log Console */}
                  <div className="rounded-xl border border-slate-800 bg-slate-950/90 overflow-hidden font-mono text-[11px] shadow-inner">
                    <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/90 border-b border-slate-800/80 text-slate-400">
                      <div className="flex items-center space-x-1.5 text-xs text-slate-300">
                        <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                        <span>실시간 백필 실행 콘솔 로그 (Live Stream)</span>
                      </div>
                      <span className="text-[10px] text-slate-500">
                        {logs.length}줄 기록됨
                      </span>
                    </div>
                    <div className="p-3 max-h-48 overflow-y-auto space-y-1 select-text">
                      {logs.map((log) => (
                        <div key={log.id} className="flex items-start space-x-2 leading-relaxed">
                          <span className="text-slate-600 shrink-0 select-none">[{log.time}]</span>
                          <span
                            className={
                              log.type === 'accent'
                                ? 'text-cyan-300 font-bold'
                                : log.type === 'success'
                                ? 'text-emerald-400'
                                : log.type === 'warn'
                                ? 'text-amber-400'
                                : log.type === 'error'
                                ? 'text-rose-400 font-bold'
                                : 'text-slate-300'
                            }
                          >
                            {log.message}
                          </span>
                        </div>
                      ))}
                      <div ref={terminalBottomRef} />
                    </div>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="p-3.5 rounded-xl bg-red-950/30 border border-red-500/30 text-red-300 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{error}</span>
                </div>
              )}
            </>
          )}

          {/* Results Summary */}
          {result && (
            <div className="space-y-5 animate-fadeIn">
              <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 text-emerald-300 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span>과거 {lookbackRange} 백필 및 DB 인제스천 완료!</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    DB 동기화 완료
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  {result.dateRange.start} ~ {result.dateRange.end} 기간 동안 {result.totalBarsIngested.toLocaleString()}개 일봉(market_data_daily)과 {result.totalSignalsGenerated}개 시그널(signals, signal_outcomes)을 DB에 저장했습니다.
                </p>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center font-mono">
                <div className="bg-slate-950/80 p-3 rounded-2xl border border-slate-800">
                  <div className="text-[10px] text-slate-400">총 적재 일봉 수</div>
                  <div className="text-lg font-bold text-cyan-400 mt-1">{result.totalBarsIngested} bars</div>
                </div>
                <div className="bg-slate-950/80 p-3 rounded-2xl border border-slate-800">
                  <div className="text-[10px] text-slate-400">생성된 시그널</div>
                  <div className="text-lg font-bold text-indigo-400 mt-1">{result.totalSignalsGenerated}건</div>
                </div>
                <div className="bg-slate-950/80 p-3 rounded-2xl border border-slate-800">
                  <div className="text-[10px] text-slate-400">20D 승률 (Win Rate)</div>
                  <div className="text-lg font-bold text-emerald-400 mt-1">{result.winRate20d}%</div>
                </div>
                <div className="bg-slate-950/80 p-3 rounded-2xl border border-slate-800">
                  <div className="text-[10px] text-slate-400">20D 평균 수익률</div>
                  <div className={`text-lg font-bold mt-1 ${result.avgReturn20d >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {result.avgReturn20d >= 0 ? `+${result.avgReturn20d}%` : `${result.avgReturn20d}%`}
                  </div>
                </div>
              </div>

              {/* Ticker Breakdown Table */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-300">종목별 백필 결과 요약</div>
                <div className="max-h-44 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/80 text-xs font-mono">
                  <table className="w-full text-left">
                    <thead className="bg-slate-900 text-slate-400 text-[11px] border-b border-slate-800 sticky top-0">
                      <tr>
                        <th className="p-2.5">티커</th>
                        <th className="p-2.5 text-right">일봉 수</th>
                        <th className="p-2.5 text-right">시그널</th>
                        <th className="p-2.5 text-right">20D 승률</th>
                        <th className="p-2.5 text-right">20D 평균수익</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850 text-slate-200">
                      {Object.entries(result.detailsByTicker).map(([sym, itemInfo]) => {
                        const item = itemInfo as {
                          barsCount: number;
                          signalsCount: number;
                          winRate20d: number;
                          avgReturn20d: number;
                        };
                        return (
                          <tr key={sym} className="hover:bg-slate-900/40">
                            <td className="p-2.5 font-bold text-cyan-400">{sym}</td>
                            <td className="p-2.5 text-right text-slate-400">{item.barsCount}</td>
                            <td className="p-2.5 text-right text-slate-300">{item.signalsCount}</td>
                            <td className="p-2.5 text-right text-emerald-400">{item.winRate20d}%</td>
                            <td className={`p-2.5 text-right ${item.avgReturn20d >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {item.avgReturn20d >= 0 ? `+${item.avgReturn20d}%` : `${item.avgReturn20d}%`}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-slate-800 bg-slate-950/50 space-x-3">
          {result ? (
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all shadow-md shadow-cyan-600/30"
            >
              백테스트 분석 화면으로 돌아가기
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={isRunning}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all disabled:opacity-50"
              >
                취소
              </button>
              <button
                id="run-historical-backfill-btn"
                type="button"
                onClick={handleRunBackfill}
                disabled={isRunning}
                className="flex items-center space-x-2 px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-lg shadow-cyan-600/30 transition-all disabled:opacity-50 active:scale-95"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>백필 실행 중... ({progress.percent}%)</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    <span>{lookbackRange === '6m' ? '6개월' : lookbackRange === '2y' ? '2년' : '1년'} 백필 시작</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
