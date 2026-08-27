import React, { useState } from 'react';
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

export const BackfillModal: React.FC<BackfillModalProps> = ({
  isOpen,
  onClose,
  onBackfillSuccess,
  onShowToast,
}) => {
  const [lookbackRange, setLookbackRange] = useState<'6m' | '1y' | '2y'>('1y');
  const [threshold, setThreshold] = useState<number>(70);
  const [replaceExisting, setReplaceExisting] = useState<boolean>(true);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [result, setResult] = useState<BackfillResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<string>('');

  if (!isOpen) return null;

  const handleRunBackfill = async () => {
    setIsRunning(true);
    setError(null);
    setResult(null);
    setCurrentStep('벤치마크(SPY) 및 워치리스트 1년치 일봉 데이터 수집 중...');

    const stepTimer1 = setTimeout(() => {
      setCurrentStep('Point-in-Time 롤링 시그널 시뮬레이션 및 5D/10D/20D 사후 수익률 계산 중...');
    }, 800);

    const stepTimer2 = setTimeout(() => {
      setCurrentStep('데이터베이스 및 시그널 원장 일괄 인제스천 중...');
    }, 1600);

    try {
      const res = await fetch('/api/v8/backtest/backfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lookbackRange,
          opportunityThreshold: threshold,
          replaceExisting,
        }),
      });

      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(`서버 오류 (${res.status}): ${errorText || '백필 요청에 실패했습니다.'}`);
      }

      const text = await res.text();
      if (!text || !text.trim().startsWith('{')) {
        throw new Error('서버로부터 유효하지 않은 응답을 받았습니다.');
      }

      const data = JSON.parse(text);
      if (!data.success || !data.result) {
        throw new Error(data.message || '백필 실행 중 유효한 결과를 생성하지 못했습니다.');
      }

      const finalResult: BackfillResult = data.result;

      setResult(finalResult);
      onShowToast(`과거 ${lookbackRange} 백필 완료: ${finalResult.totalSignalsGenerated}개 시그널 생성`);
      await onBackfillSuccess();
    } catch (err: any) {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      console.error('Backfill error:', err);
      setError(err?.message || '백필 실행 중 예기치 않은 오류가 발생했습니다.');
    } finally {
      setIsRunning(false);
      setCurrentStep('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2.5 sm:p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl w-full max-w-2xl max-h-[90dvh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-800 bg-slate-950/50 shrink-0">
          <div className="flex items-center space-x-2.5 sm:space-x-3">
            <div className="p-1.5 sm:p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0">
              <Database className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-100 flex items-center space-x-2">
                <span>과거 1년 데이터 백필 (Backfill Engine)</span>
              </h2>
              <p className="text-[10px] sm:text-xs text-slate-400 hidden sm:block">
                과거 OHLCV 일봉 수집 → Point-in-Time 롤링 시뮬레이션 → 20D 실현 수익률 DB 적재
              </p>
            </div>
          </div>
          <button
            id="close-backfill-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all shrink-0 ml-2"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-3.5 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6 flex-1">
          {!result && (
            <>
              {/* Info Callout */}
              <div className="p-4 rounded-2xl bg-cyan-950/20 border border-cyan-500/30 text-xs text-cyan-200/90 space-y-2">
                <div className="flex items-center space-x-2 font-bold text-cyan-300">
                  <Zap className="w-4 h-4 text-cyan-400" />
                  <span>Lookahead Bias & Point-in-Time 무결성 보장</span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-300">
                  각 과거 시점(T)의 일봉 및 지표만 참조하여 시그널을 생성하며, T+5일, T+10일, T+20일 후의 실현 가격을 추적하여 승률 및 수익률을 <code className="text-cyan-300">signal_outcomes</code> 테이블에 저장합니다.
                </p>
              </div>

              {/* Options Form */}
              <div className="space-y-4">
                {/* 1. Lookback Range */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center space-x-1.5">
                    <Calendar className="w-4 h-4 text-cyan-400" />
                    <span>백필 기간 (Lookback Period)</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: '6m', label: '최근 6개월', desc: '~126 거래일' },
                      { id: '1y', label: '과거 1년 (권장)', desc: '~252 거래일' },
                      { id: '2y', label: '과거 2년', desc: '~504 거래일' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setLookbackRange(opt.id as any)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          lookbackRange === opt.id
                            ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300 shadow-md'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
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
                    onChange={(e) => setThreshold(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
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
                      onChange={(e) => setReplaceExisting(e.target.checked)}
                      className="rounded bg-slate-950 border-slate-700 text-cyan-500 focus:ring-cyan-500/20"
                    />
                    <span>기존 백테스트 시그널 데이터를 초기화하고 새로 적재 (권장)</span>
                  </label>
                </div>
              </div>

              {/* Running Status */}
              {isRunning && (
                <div className="p-4 rounded-2xl bg-slate-950 border border-cyan-500/40 text-center space-y-3 animate-pulse">
                  <Loader2 className="w-6 h-6 text-cyan-400 animate-spin mx-auto" />
                  <div className="text-xs font-semibold text-cyan-300">{currentStep}</div>
                  <p className="text-[10px] text-slate-500">
                    야후 파이낸스 1년치 일봉 수집 및 252개 롤링 윈도우 시뮬레이션이 진행 중입니다...
                  </p>
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
                    Supabase &amp; DB 동기화 완료
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
                <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/80 text-xs font-mono">
                  <table className="w-full text-left">
                    <thead className="bg-slate-900 text-slate-400 text-[11px] border-b border-slate-800">
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
                    <span>백필 실행 중...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    <span>1년 백필 시작</span>
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
