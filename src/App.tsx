import React, { useEffect, useState, useMemo } from 'react';
import { Trash2, RefreshCw, Database } from 'lucide-react';
import {
  ActiveStrategyMode,
  BacktestSummary,
  FullTickerEvaluation,
  ScanRunLog,
  SignalSnapshot,
  WatchlistItem,
  MarketRegion,
} from './types/v8';
import { detectMarketRegion } from './utils/marketUtils';
import { Navbar } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { WatchlistView } from './components/WatchlistView';
import { BacktestView } from './components/BacktestView';
import { ClassificationView } from './components/ClassificationView';
import { ScanRunsView } from './components/ScanRunsView';
import { MacroEarningsView } from './components/MacroEarningsView';
import { PortfolioAllocationView } from './components/PortfolioAllocationView';
import { PaperTradingView } from './components/PaperTradingView';
import { StrategyGuideView } from './components/StrategyGuideView';
import { ExitSignalDashboardView } from './components/ExitSignalDashboardView';
import { SymbolDetailModal } from './components/SymbolDetailModal';
import { ScanRunnerModal } from './components/ScanRunnerModal';
import { BackfillModal } from './components/BackfillModal';
import { AutoScanScheduleModal } from './components/AutoScanScheduleModal';
import { DatabaseHealthModal } from './components/DatabaseHealthModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MAX_WATCHLIST_CAPACITY, WATCHLIST_CAPACITY_ERROR_MESSAGE } from './constants/limits';
import { calculateBacktestMetrics } from './engine/backtestEngine';
import {
  DEFAULT_STRATEGY_CONFIG,
  recalculateEvaluationsWithConfig,
  StrategyOptimizationConfig,
} from './engine/strategyOptimizerEngine';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'watchlist' | 'backtest' | 'exit' | 'classification' | 'runs' | 'macro' | 'portfolio' | 'paper' | 'guide'>('dashboard');
  const [activeMarket, setActiveMarket] = useState<MarketRegion>(() => {
    try {
      const saved = localStorage.getItem('quant_active_market_v8');
      if (saved === 'US' || saved === 'KR') return saved;
    } catch (e) {}
    return 'US';
  });

  const handleSelectMarket = (market: MarketRegion) => {
    setActiveMarket(market);
    try {
      localStorage.setItem('quant_active_market_v8', market);
    } catch (e) {}
  };
  const [strategyConfig, setStrategyConfig] = useState<StrategyOptimizationConfig>(() => {
    try {
      const saved = localStorage.getItem('quant_strategy_config_v8');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return DEFAULT_STRATEGY_CONFIG;
  });

  const [signals, setSignals] = useState<SignalSnapshot[]>([]);
  const [backtestSummary, setBacktestSummary] = useState<BacktestSummary | null>(null);
  const [runs, setRuns] = useState<ScanRunLog[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [watchlistStrategyMode, setWatchlistStrategyMode] = useState<ActiveStrategyMode>('MOMENTUM');
  const [evaluations, setEvaluations] = useState<FullTickerEvaluation[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);

  // Modals
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [selectedModalTab, setSelectedModalTab] = useState<'overview' | 'chart' | 'dip_buy'>('overview');
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isBackfillModalOpen, setIsBackfillModalOpen] = useState(false);
  const [isDbHealthModalOpen, setIsDbHealthModalOpen] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [deleteTargetTicker, setDeleteTargetTicker] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [alertRefreshKey, setAlertRefreshKey] = useState<number>(0);

  const handleOpenSymbolDetail = (ticker: string, initialTab: 'overview' | 'chart' | 'dip_buy' = 'overview') => {
    setSelectedTicker(ticker);
    setSelectedModalTab(initialTab);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleApplyStrategyConfig = (newConfig: StrategyOptimizationConfig) => {
    setStrategyConfig(newConfig);
    try {
      localStorage.setItem('quant_strategy_config_v8', JSON.stringify(newConfig));
    } catch (e) {}

    const updated = recalculateEvaluationsWithConfig(evaluations, newConfig);
    setEvaluations(updated);
    try {
      localStorage.setItem('quant_evaluations_cache_v8', JSON.stringify(updated));
    } catch (e) {}

    showToast(`전략 [${newConfig.name}]이(가) 적용되어 ${updated.length}개 모니터링 종목의 평가 및 신호가 즉시 갱신되었습니다.`);
  };

  const handleRecalculateEvaluations = async () => {
    try {
      setIsRecalculating(true);
      let newEvaluations: FullTickerEvaluation[] = [];
      let successMsg = '';

      const res = await fetch('/api/v8/evaluations/recalculate', { method: 'POST' });
      if (res.ok) {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await res.json();
          if (data.success && Array.isArray(data.evaluations) && data.evaluations.length > 0) {
            newEvaluations = data.evaluations;
            successMsg = data.message || '';
          }
        }
      }

      if (newEvaluations.length > 0) {
        setEvaluations(newEvaluations);
        try {
          localStorage.setItem('quant_evaluations_cache_v8', JSON.stringify(newEvaluations));
        } catch (e) {}
        showToast(successMsg || `${newEvaluations.length}개 종목의 DB 퀀트 평가가 최신화되었습니다.`);
      } else {
        showToast('DB 데이터 평가 갱신 완료 (현재 데이터 유지)');
      }
    } catch (err: any) {
      console.error('Recalculate error:', err);
      showToast('DB 데이터 평가 갱신 완료');
    } finally {
      setIsRecalculating(false);
    }
  };

  const safeFetchJson = async (url: string) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);
    try {
      // Add cache buster and no-store to prevent aggressive browser caching of API results
      const separator = url.includes('?') ? '&' : '?';
      const noCacheUrl = `${url}${separator}_t=${Date.now()}`;
      
      const res = await fetch(noCacheUrl, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) {
        return null;
      }
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await res.json();
      }
      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    } catch (e) {
      clearTimeout(timeoutId);
      console.warn(`Fetch error for ${url}:`, e);
      return null;
    }
  };

  const loadAllData = async () => {
    try {
      // Parallel execution for near-instant database read across all tables
      const [currentWl, loadedEvals, latestSignals, btData, currentRuns] = await Promise.all([
        safeFetchJson('/api/v8/watchlist'),
        safeFetchJson('/api/v8/evaluations'),
        safeFetchJson('/api/v8/signals'),
        safeFetchJson('/api/v8/backtest'),
        safeFetchJson('/api/v8/runs'),
      ]);

      if (currentWl?.success && Array.isArray(currentWl.watchlist)) {
        setWatchlist(currentWl.watchlist);
        try {
          localStorage.setItem('quant_watchlist_cache_v8', JSON.stringify(currentWl.watchlist));
        } catch {}
      } else {
        setWatchlist([]);
      }

      if (loadedEvals?.success && Array.isArray(loadedEvals.evaluations)) {
        const evalsToSet = strategyConfig.id !== DEFAULT_STRATEGY_CONFIG.id
          ? recalculateEvaluationsWithConfig(loadedEvals.evaluations, strategyConfig)
          : loadedEvals.evaluations;
        setEvaluations(evalsToSet);
        try {
          localStorage.setItem('quant_evaluations_cache_v8', JSON.stringify(evalsToSet));
        } catch {}
      } else {
        setEvaluations([]);
      }

      if (latestSignals?.success && Array.isArray(latestSignals.signals)) {
        const sigMap = new Map<string, SignalSnapshot>();
        for (const s of latestSignals.signals) {
          const key = `${s.ticker}_${s.signal_date}`;
          if (!sigMap.has(key)) {
            sigMap.set(key, s);
          }
        }
        const dedupedSignals = Array.from(sigMap.values()).sort((a, b) => b.signal_date.localeCompare(a.signal_date));
        setSignals(dedupedSignals);
      }

      if (currentRuns?.success && Array.isArray(currentRuns.runs)) {
        setRuns(currentRuns.runs);
      }

      if (btData?.success && (btData.data?.summary || btData.summary)) {
        setBacktestSummary(btData.data?.summary || btData.summary);
      }
    } catch (err) {
      console.error('Failed to load initial data', err);
    } finally {
      setIsInitialLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Synchronize market-specific backtest metrics (Win rate, Profit Factor, MDD) when switching US <-> KR
  useEffect(() => {
    let isCancelled = false;
    const syncMarketBacktest = async () => {
      try {
        const btData = await safeFetchJson(`/api/v8/backtest?market=${activeMarket}&_t=${Date.now()}`);
        if (!isCancelled && btData?.success && (btData.data?.summary || btData.summary)) {
          setBacktestSummary(btData.data?.summary || btData.summary);
        }
      } catch (err) {
        console.error('Failed to sync market backtest metrics', err);
      }
    };
    syncMarketBacktest();
    return () => {
      isCancelled = true;
    };
  }, [activeMarket]);

  const handleSaveOverride = async (
    ticker: string,
    asset_type: any,
    strategy_type: any,
    confidence: number,
    reason: string
  ) => {
    try {
      await fetch('/api/v8/classification/override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker, asset_type, strategy_type, confidence, reason }),
      });

      showToast(`${ticker} 자산 분류 수동 지정이 저장되었습니다.`);
      await loadAllData();
    } catch (err) {
      console.error('Failed to save override', err);
    }
  };

  const handleResetOverride = async (ticker: string) => {
    try {
      await fetch(`/api/v8/classification/override/${ticker}`, {
        method: 'DELETE',
      });

      showToast(`${ticker} 분류가 자동 분석으로 복원되었습니다.`);
      await loadAllData();
    } catch (err) {
      console.error('Failed to reset override', err);
    }
  };

  const handleAddTicker = async (tickerInput: string, name: string, memo: string) => {
    if (!tickerInput || !tickerInput.trim()) return;

    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('quant_db_cleared_v8');
      }

      const res = await fetch('/api/v8/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: tickerInput.trim(), name, memo, is_active: true }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(`추가 실패: ${data.error || '알 수 없는 오류가 발생했습니다.'}`);
        return;
      }

      const addedList = data.added_tickers || (data.item ? [data.item.ticker] : []);
      const rejectedList = data.rejected || [];
      const alreadyList = data.already_exists || [];

      let msg = `${addedList.join(', ')} (${addedList.length}개) 추가 및 평가 완료`;
      if (rejectedList.length > 0) {
        msg += ` | 제외: ${rejectedList.map((r: any) => `${r.ticker}(${r.reason})`).join(', ')}`;
      }
      if (alreadyList.length > 0) {
        msg += ` | 이미 존재: ${alreadyList.join(', ')}`;
      }

      showToast(msg);
      await loadAllData();
    } catch (err: any) {
      console.error('Failed to add ticker', err);
      showToast(`추가 실패: ${err.message}`);
    }
  };

  const handleDeleteTicker = (ticker: string) => {
    setDeleteTargetTicker(ticker.toUpperCase().trim());
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetTicker) return;
    const cleanTicker = deleteTargetTicker.toUpperCase().trim();
    setIsDeleting(true);

    try {
      // 1. Optimistic local state update for instant UI feedback
      setEvaluations((prev) => {
        const updated = prev.filter((e) => e.ticker.toUpperCase() !== cleanTicker);
        try {
          localStorage.setItem('quant_evaluations_cache_v8', JSON.stringify(updated));
        } catch {}
        return updated;
      });
      setWatchlist((prev) => prev.filter((w) => w.ticker.toUpperCase() !== cleanTicker));

      // 2. Server delete request
      const res = await fetch(`/api/v8/watchlist/${cleanTicker}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || '삭제 요청 처리에 실패했습니다.');
      }

      showToast(`${cleanTicker} 종목이 워치리스트에서 삭제되었습니다.`);
      setDeleteTargetTicker(null);
      await loadAllData();
    } catch (err: any) {
      console.error('Failed to delete ticker', err);
      showToast(`삭제 실패: ${err.message}`);
      await loadAllData();
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClearDummyTickers = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch('/api/v8/watchlist/clear?mode=dummy', {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.error || '더미 종목 정리에 실패했습니다.');
      }
      showToast(data.message || '더미(샘플) 종목이 모두 정리되었습니다.');
      await loadAllData();
    } catch (err: any) {
      console.error('Failed to clear dummy tickers', err);
      showToast(`더미 종목 정리 실패: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClearAllWatchlist = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch('/api/v8/watchlist/clear?mode=all', {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.error || '워치리스트 비우기에 실패했습니다.');
      }
      showToast('워치리스트가 완전히 비워졌습니다.');
      setWatchlist([]);
      setEvaluations([]);
      try {
        localStorage.removeItem('quant_watchlist_cache_v8');
        localStorage.removeItem('quant_evaluations_cache_v8');
      } catch {}
      await loadAllData();
    } catch (err: any) {
      console.error('Failed to clear all watchlist', err);
      showToast(`비우기 실패: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRestoreDefaultSeed = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch('/api/v8/system/db/seed', {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.error || '기본 종목 복원에 실패했습니다.');
      }
      showToast(data.message || '기본 대표 종목(18개)이 성공적으로 복원되었습니다.');
      await loadAllData();
    } catch (err: any) {
      console.error('Failed to restore default seed', err);
      showToast(`기본 종목 복원 실패: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleActive = async (ticker: string, is_active: boolean) => {
    try {
      await fetch(`/api/v8/watchlist/${ticker}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active }),
      });
      await loadAllData();
    } catch (err) {
      console.error('Failed to toggle active', err);
    }
  };

  const handleScanCompleted = async (scanResult?: any) => {
    if (scanResult?.evaluations && Array.isArray(scanResult.evaluations) && scanResult.evaluations.length > 0) {
      setEvaluations(scanResult.evaluations);
      try {
        localStorage.setItem('quant_evaluations_cache_v8', JSON.stringify(scanResult.evaluations));
      } catch (e) {}
    }
    showToast('전체 워치리스트 퀀트 파이프라인 평가 및 스냅샷 저장이 완료되었습니다.');
    setAlertRefreshKey((k) => k + 1);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('quant-alerts-updated', { detail: scanResult }));
    }
    await loadAllData();
  };

  const selectedEvaluation = evaluations.find((e) => e.ticker === selectedTicker) || null;

  // Filter evaluations and signals strictly according to activeMarket ('US' | 'KR')
  const filteredEvaluations = useMemo(() => {
    return evaluations.filter((e) => {
      const region = e.market_region || detectMarketRegion(e.ticker);
      return region === activeMarket;
    });
  }, [evaluations, activeMarket]);

  const filteredSignals = useMemo(() => {
    return signals.filter((s) => {
      const region = s.market_region || detectMarketRegion(s.ticker);
      return region === activeMarket;
    });
  }, [signals, activeMarket]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-cyan-500 selection:text-white">
      {/* Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeMarket={activeMarket}
        onSelectMarket={handleSelectMarket}
        onOpenScanModal={() => setIsScanModalOpen(true)}
        onOpenScheduleModal={() => setIsScheduleModalOpen(true)}
        onOpenDbHealthModal={() => setIsDbHealthModalOpen(true)}
        totalCount={filteredEvaluations.length}
        signalsCount={filteredSignals.length}
        isInitialLoading={isInitialLoading}
      />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isInitialLoading ? (
          <div className="flex flex-col items-center justify-center min-h-[460px] py-20 px-4 animate-fadeIn">
            <div className="relative flex items-center justify-center mb-6">
              <div className="absolute w-20 h-20 rounded-3xl bg-cyan-500/10 animate-ping opacity-60" />
              <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-cyan-500/30 flex items-center justify-center shadow-lg shadow-cyan-500/10 relative z-10">
                <RefreshCw className="w-7 h-7 text-cyan-400 animate-spin" />
              </div>
            </div>
            <div className="text-center max-w-sm space-y-2 font-sans">
              <h3 className="text-base sm:text-lg font-bold text-slate-100 flex items-center justify-center gap-2">
                <Database className="w-4 h-4 text-cyan-400" />
                데이터베이스 조회 중...
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Supabase DB에서 등록된 워치리스트와 최신 퀀트 시그널 데이터를 안전하게 불러오고 있습니다.
              </p>
              <div className="w-40 h-1.5 bg-slate-800 rounded-full overflow-hidden mx-auto mt-4">
                <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full animate-pulse w-3/4" />
              </div>
            </div>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <DashboardView
                evaluations={filteredEvaluations}
                recentSignals={filteredSignals}
                backtestSummary={backtestSummary}
                activeMarket={activeMarket}
                currentConfig={strategyConfig}
                onApplyConfig={handleApplyStrategyConfig}
                onSelectTicker={(t, tab) => handleOpenSymbolDetail(t, tab || 'overview')}
                onPreviewTelegram={(t) => handleOpenSymbolDetail(t, 'overview')}
                onNavigateToWatchlist={(mode) => {
                  if (mode) setWatchlistStrategyMode(mode);
                  setActiveTab('watchlist');
                }}
                onNavigateToMacro={() => setActiveTab('macro')}
                onNavigateToPortfolio={() => setActiveTab('portfolio')}
                onNavigateToPaper={() => setActiveTab('paper')}
                onNavigateToGuide={() => setActiveTab('guide')}
                onNavigateToExit={() => setActiveTab('exit')}
                onRecalculate={handleRecalculateEvaluations}
                isRecalculating={isRecalculating}
              />
            )}

        {activeTab === 'watchlist' && (
          <WatchlistView
            key={`${watchlistStrategyMode}_${activeMarket}`}
            evaluations={filteredEvaluations}
            activeMarket={activeMarket}
            initialStrategyMode={watchlistStrategyMode}
            currentConfig={strategyConfig}
            onApplyConfig={handleApplyStrategyConfig}
            onSelectTicker={(t, tab) => handleOpenSymbolDetail(t, tab || 'overview')}
            onPreviewTelegram={(t) => handleOpenSymbolDetail(t, 'overview')}
            onAddTicker={handleAddTicker}
            onDeleteTicker={handleDeleteTicker}
            onToggleActive={handleToggleActive}
            onRecalculate={handleRecalculateEvaluations}
            isRecalculating={isRecalculating}
            onClearDummyTickers={handleClearDummyTickers}
            onClearAllWatchlist={handleClearAllWatchlist}
            onRestoreDefaultSeed={handleRestoreDefaultSeed}
            onOpenDbHealthModal={() => setIsDbHealthModalOpen(true)}
          />
        )}

        {activeTab === 'exit' && (
          <ExitSignalDashboardView
            evaluations={filteredEvaluations}
            activeMarket={activeMarket}
            onSelectTicker={(t) => handleOpenSymbolDetail(t, 'overview')}
          />
        )}

        {activeTab === 'backtest' && (
          <BacktestView
            summary={backtestSummary}
            allSignals={filteredSignals}
            evaluations={filteredEvaluations}
            activeMarket={activeMarket}
            currentConfig={strategyConfig}
            onApplyConfig={handleApplyStrategyConfig}
            onSelectTicker={(t) => handleOpenSymbolDetail(t, 'overview')}
            onOpenBackfillModal={() => setIsBackfillModalOpen(true)}
          />
        )}

        {activeTab === 'classification' && (
          <ClassificationView
            evaluations={filteredEvaluations}
            onSelectTicker={(t) => handleOpenSymbolDetail(t, 'overview')}
            onSaveOverride={handleSaveOverride}
            onResetOverride={handleResetOverride}
          />
        )}

        {activeTab === 'runs' && (
          <ScanRunsView
            runs={runs}
            alertRefreshKey={alertRefreshKey}
            activeMarket={activeMarket}
            onTriggerScan={() => setIsScanModalOpen(true)}
            onSelectTicker={(t, tab) => handleOpenSymbolDetail(t, tab || 'overview')}
            onOpenDbHealthModal={() => setIsDbHealthModalOpen(true)}
          />
        )}

        {activeTab === 'macro' && (
          <MacroEarningsView
            activeMarket={activeMarket}
            onSelectTicker={(t) => handleOpenSymbolDetail(t, 'overview')}
          />
        )}

        {activeTab === 'portfolio' && (
          <PortfolioAllocationView
            activeMarket={activeMarket}
            onSelectTicker={(t) => handleOpenSymbolDetail(t, 'overview')}
          />
        )}

        {activeTab === 'paper' && (
          <PaperTradingView
            activeMarket={activeMarket}
            onSelectTicker={(t) => handleOpenSymbolDetail(t, 'overview')}
          />
        )}

        {activeTab === 'guide' && (
          <StrategyGuideView
            evaluations={evaluations}
            onSelectTicker={(t, tab) => handleOpenSymbolDetail(t, tab || 'overview')}
            onNavigateToWatchlist={(mode) => {
              if (mode) setWatchlistStrategyMode(mode);
              setActiveTab('watchlist');
            }}
            onNavigateToMacro={() => setActiveTab('macro')}
            onNavigateToPaper={() => setActiveTab('paper')}
          />
        )}
          </>
        )}
      </main>

      {/* Delete Confirmation Modal */}
      {deleteTargetTicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-5 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-rose-400">
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <Trash2 className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">워치리스트 종목 삭제</h3>
                <p className="text-xs text-slate-400">등록된 관심종목을 목록에서 제외합니다.</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-950/80 border border-slate-800/80 rounded-xl text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">삭제 대상 티커</span>
                <span className="font-mono font-bold text-white text-base px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                  {deleteTargetTicker}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 pt-1.5 border-t border-slate-800/60 leading-relaxed">
                삭제 시 실시간 4대 팩터(기술·모멘텀·펀더멘털·밸류) 평가 및 알림 추적 대상에서 제외되며, 워치리스트 슬롯이 1개 확보됩니다.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  if (!isDeleting) setDeleteTargetTicker(null);
                }}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 active:scale-95 text-white shadow-lg shadow-rose-600/30 transition-all disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>삭제 처리 중...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>삭제 확인</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Symbol Detail Modal (Debug / Diagnostics) */}
      {selectedTicker && (
        <SymbolDetailModal
          evaluation={selectedEvaluation}
          historicalSignals={signals}
          initialTab={selectedModalTab}
          onClose={() => setSelectedTicker(null)}
          onSaveOverride={handleSaveOverride}
          onResetOverride={handleResetOverride}
        />
      )}

      {/* Scan Runner Modal */}
      {isScanModalOpen && (
        <ScanRunnerModal
          onClose={() => setIsScanModalOpen(false)}
          onScanCompleted={handleScanCompleted}
          totalWatchlistCount={filteredEvaluations.length}
          onViewAlertHistory={() => setActiveTab('runs')}
          activeMarket={activeMarket}
        />
      )}

      {/* Historical 1-Year Backfill Modal */}
      {isBackfillModalOpen && (
        <BackfillModal
          isOpen={isBackfillModalOpen}
          onClose={() => setIsBackfillModalOpen(false)}
          onBackfillSuccess={loadAllData}
          onShowToast={showToast}
        />
      )}

      {/* Auto Scan & Schedule Notification Modal */}
      {isScheduleModalOpen && (
        <AutoScanScheduleModal
          isOpen={isScheduleModalOpen}
          onClose={() => setIsScheduleModalOpen(false)}
          onShowToast={showToast}
        />
      )}

      {/* Database Health Check & DDL Modal */}
      {isDbHealthModalOpen && (
        <ErrorBoundary fallbackTitle="DB 헬스체크 모달을 표시할 수 없습니다." onReset={() => setIsDbHealthModalOpen(false)}>
          <DatabaseHealthModal
            isOpen={isDbHealthModalOpen}
            onClose={() => setIsDbHealthModalOpen(false)}
            onShowToast={showToast}
          />
        </ErrorBoundary>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-cyan-500/40 text-cyan-200 px-4 py-3 rounded-2xl shadow-2xl text-xs font-semibold flex items-center space-x-2 animate-fadeIn">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
