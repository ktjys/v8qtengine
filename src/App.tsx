import React, { useEffect, useState } from 'react';
import {
  BacktestSummary,
  FullTickerEvaluation,
  ScanRunLog,
  SignalSnapshot,
  WatchlistItem,
} from './types/v8';
import {
  INITIAL_HISTORICAL_SIGNALS,
  INITIAL_SCAN_RUNS,
  runPipelineOnSeedData,
} from './data/seed/initialData';
import { calculateBacktestMetrics } from './engine/backtestEngine';
import { signalRepository } from './db/repositories/signalRepository';
import { scanRunRepository } from './db/repositories/scanRunRepository';
import { Navbar } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { WatchlistView } from './components/WatchlistView';
import { BacktestView } from './components/BacktestView';
import { ClassificationView } from './components/ClassificationView';
import { ScanRunsView } from './components/ScanRunsView';
import { SymbolDetailModal } from './components/SymbolDetailModal';
import { ScanRunnerModal } from './components/ScanRunnerModal';
import { DatabaseSettingsModal } from './components/DatabaseSettingsModal';
import { BackfillModal } from './components/BackfillModal';
import { AutoScanScheduleModal } from './components/AutoScanScheduleModal';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'watchlist' | 'backtest' | 'classification' | 'runs'>('dashboard');
  const [evaluations, setEvaluations] = useState<FullTickerEvaluation[]>(() => {
    try {
      const saved = localStorage.getItem('quant_evaluations_cache_v8');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return runPipelineOnSeedData().evaluations;
  });
  const [signals, setSignals] = useState<SignalSnapshot[]>(INITIAL_HISTORICAL_SIGNALS);
  const [backtestSummary, setBacktestSummary] = useState<BacktestSummary | null>(() => {
    return calculateBacktestMetrics(INITIAL_HISTORICAL_SIGNALS);
  });
  const [runs, setRuns] = useState<ScanRunLog[]>(INITIAL_SCAN_RUNS);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>(() => {
    try {
      const saved = localStorage.getItem('quant_watchlist_cache_v8');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return runPipelineOnSeedData().watchlist;
  });

  // Modals
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [selectedModalTab, setSelectedModalTab] = useState<'overview' | 'chart'>('overview');
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [isDbModalOpen, setIsDbModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isBackfillModalOpen, setIsBackfillModalOpen] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleOpenSymbolDetail = (ticker: string, initialTab: 'overview' | 'chart' = 'overview') => {
    setSelectedTicker(ticker);
    setSelectedModalTab(initialTab);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleRecalculateEvaluations = async () => {
    try {
      setIsRecalculating(true);
      const res = await fetch('/api/v8/evaluations/recalculate', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.evaluations) {
        setEvaluations(data.evaluations);
        try {
          localStorage.setItem('quant_evaluations_cache_v8', JSON.stringify(data.evaluations));
        } catch (e) {}
        showToast(data.message || 'DB 기반 퀀트 평가 및 가격 데이터가 최신화되었습니다.');
      } else {
        showToast('DB 데이터 평가 중 오류가 발생했습니다.');
      }
    } catch (err: any) {
      showToast('DB 데이터 평가 갱신 실패');
    } finally {
      setIsRecalculating(false);
    }
  };

  const safeFetchJson = async (url: string) => {
    try {
      const res = await fetch(url);
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
      console.warn(`Fetch error for ${url}:`, e);
      return null;
    }
  };

  const loadAllData = async () => {
    try {
      // 1. Fetch watchlist first and reconcile with client-side localStorage additions
      const wlData = await safeFetchJson('/api/v8/watchlist');
      let currentWl: WatchlistItem[] = wlData?.success && wlData.watchlist ? wlData.watchlist : [];

      try {
        const cachedRaw = localStorage.getItem('quant_watchlist_cache_v8');
        if (cachedRaw) {
          const cachedItems: WatchlistItem[] = JSON.parse(cachedRaw);
          const serverTickers = new Set(currentWl.map((w) => w.ticker.toUpperCase()));
          const missingItems = cachedItems.filter((c) => !serverTickers.has(c.ticker.toUpperCase()));

          if (missingItems.length > 0) {
            for (const m of missingItems) {
              await fetch('/api/v8/watchlist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ticker: m.ticker, name: m.name, memo: m.memo }),
              });
            }
            const reloadedWl = await safeFetchJson('/api/v8/watchlist');
            if (reloadedWl?.success && reloadedWl.watchlist) {
              currentWl = reloadedWl.watchlist;
            }
          }
        }
      } catch (e) {
        // Ignore localStorage parsing errors
      }

      if (currentWl.length > 0) {
        setWatchlist(currentWl);
        try {
          localStorage.setItem('quant_watchlist_cache_v8', JSON.stringify(currentWl));
        } catch (e) {}
      }

      // 2. Fetch live evaluations (now synchronized with all active watchlist items)
      const evalData = await safeFetchJson('/api/v8/evaluations');
      if (evalData?.success && evalData.evaluations) {
        setEvaluations(evalData.evaluations);
        try {
          localStorage.setItem('quant_evaluations_cache_v8', JSON.stringify(evalData.evaluations));
        } catch (e) {}
      }

      // 3. Fetch signals
      let latestSignals: SignalSnapshot[] = [];
      const sigData = await safeFetchJson('/api/v8/signals');
      if (sigData?.success && sigData.signals && sigData.signals.length > 0) {
        latestSignals = sigData.signals;
      } else {
        const repoSignals = await signalRepository.getAll();
        if (repoSignals && repoSignals.length > 0) {
          latestSignals = repoSignals;
        }
      }
      if (latestSignals.length > 0) {
        setSignals(latestSignals);
      }

      // 4. Fetch backtest
      const btData = await safeFetchJson('/api/v8/backtest');
      if (btData?.success && (btData.data?.summary || btData.summary)) {
        setBacktestSummary(btData.data?.summary || btData.summary || null);
      } else if (latestSignals.length > 0) {
        setBacktestSummary(calculateBacktestMetrics(latestSignals));
      }

      // 5. Fetch runs
      const runData = await safeFetchJson('/api/v8/runs');
      if (runData?.success && runData.runs && runData.runs.length > 0) {
        setRuns(runData.runs);
      } else {
        const repoRuns = await scanRunRepository.getAll();
        if (repoRuns && repoRuns.length > 0) {
          setRuns(repoRuns);
        }
      }
    } catch (err) {
      console.error('Failed to load initial data', err);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const handleSaveOverride = async (
    ticker: string,
    asset_type: any,
    strategy_type: any,
    confidence: number,
    reason: string
  ) => {
    try {
      const res = await fetch('/api/v8/classification/override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker, asset_type, strategy_type, confidence, reason }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`${ticker} 자산 분류 수동 지정이 영구 저장되었습니다.`);
        await loadAllData();
      }
    } catch (err) {
      console.error('Failed to save override', err);
    }
  };

  const handleResetOverride = async (ticker: string) => {
    try {
      const res = await fetch(`/api/v8/classification/override/${ticker}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        showToast(`${ticker} 분류가 자동 분석으로 복원되었습니다.`);
        await loadAllData();
      }
    } catch (err) {
      console.error('Failed to reset override', err);
    }
  };

  const handleAddTicker = async (ticker: string, name: string, memo: string) => {
    const cleanTicker = ticker.toUpperCase().trim();
    if (!cleanTicker) return;

    try {
      // Optimistically update localStorage cache
      try {
        const cachedRaw = localStorage.getItem('quant_watchlist_cache_v8');
        const cached: WatchlistItem[] = cachedRaw ? JSON.parse(cachedRaw) : [];
        if (!cached.some((c) => c.ticker.toUpperCase() === cleanTicker)) {
          cached.push({
            ticker: cleanTicker,
            name: name || cleanTicker,
            memo: memo || '관심 종목',
            is_active: true,
            created_at: new Date().toISOString(),
          });
          localStorage.setItem('quant_watchlist_cache_v8', JSON.stringify(cached));
        }
      } catch (e) {}

      const res = await fetch('/api/v8/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: cleanTicker, name, memo }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`${cleanTicker} 종목이 워치리스트에 추가되고 즉시 퀀트 평가가 완료되었습니다.`);
        await loadAllData();
      } else {
        showToast(`추가 실패: ${data.error}`);
      }
    } catch (err) {
      console.error('Failed to add ticker', err);
    }
  };

  const handleDeleteTicker = async (ticker: string) => {
    const cleanTicker = ticker.toUpperCase().trim();
    if (!confirm(`${cleanTicker} 종목을 워치리스트에서 삭제하시겠습니까?`)) return;

    try {
      // Remove from localStorage cache immediately
      try {
        const cachedRaw = localStorage.getItem('quant_watchlist_cache_v8');
        if (cachedRaw) {
          const cachedItems: WatchlistItem[] = JSON.parse(cachedRaw);
          const filtered = cachedItems.filter((c) => c.ticker.toUpperCase() !== cleanTicker);
          localStorage.setItem('quant_watchlist_cache_v8', JSON.stringify(filtered));
        }
        const cachedEvalRaw = localStorage.getItem('quant_evaluations_cache_v8');
        if (cachedEvalRaw) {
          const cachedEvals: FullTickerEvaluation[] = JSON.parse(cachedEvalRaw);
          const filtered = cachedEvals.filter((c) => c.ticker.toUpperCase() !== cleanTicker);
          localStorage.setItem('quant_evaluations_cache_v8', JSON.stringify(filtered));
        }
      } catch (e) {}

      // Optimistically update React state
      setEvaluations((prev) => prev.filter((e) => e.ticker.toUpperCase() !== cleanTicker));
      setWatchlist((prev) => prev.filter((w) => w.ticker.toUpperCase() !== cleanTicker));

      const res = await fetch(`/api/v8/watchlist/${cleanTicker}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        showToast(`${cleanTicker} 종목이 삭제되었습니다.`);
        await loadAllData();
      }
    } catch (err) {
      console.error('Failed to delete ticker', err);
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

  const handleScanCompleted = async () => {
    showToast('전체 워치리스트 퀀트 파이프라인 평가 및 스냅샷 저장이 완료되었습니다.');
    await loadAllData();
  };

  const selectedEvaluation = evaluations.find((e) => e.ticker === selectedTicker) || null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-cyan-500 selection:text-white">
      {/* Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenScanModal={() => setIsScanModalOpen(true)}
        onOpenDbModal={() => setIsDbModalOpen(true)}
        onOpenScheduleModal={() => setIsScheduleModalOpen(true)}
        totalCount={evaluations.length}
        signalsCount={signals.length}
      />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && (
          <DashboardView
            evaluations={evaluations}
            recentSignals={signals}
            backtestSummary={backtestSummary}
            onSelectTicker={(t) => handleOpenSymbolDetail(t, 'overview')}
            onPreviewTelegram={(t) => handleOpenSymbolDetail(t, 'overview')}
            onNavigateToWatchlist={() => setActiveTab('watchlist')}
            onRecalculate={handleRecalculateEvaluations}
            isRecalculating={isRecalculating}
          />
        )}

        {activeTab === 'watchlist' && (
          <WatchlistView
            evaluations={evaluations}
            onSelectTicker={(t, tab) => handleOpenSymbolDetail(t, tab || 'overview')}
            onPreviewTelegram={(t) => handleOpenSymbolDetail(t, 'overview')}
            onAddTicker={handleAddTicker}
            onDeleteTicker={handleDeleteTicker}
            onToggleActive={handleToggleActive}
            onRecalculate={handleRecalculateEvaluations}
            isRecalculating={isRecalculating}
          />
        )}

        {activeTab === 'backtest' && (
          <BacktestView
            summary={backtestSummary}
            allSignals={signals}
            onSelectTicker={(t) => handleOpenSymbolDetail(t, 'overview')}
            onOpenBackfillModal={() => setIsBackfillModalOpen(true)}
          />
        )}

        {activeTab === 'classification' && (
          <ClassificationView
            evaluations={evaluations}
            onSelectTicker={(t) => handleOpenSymbolDetail(t, 'overview')}
            onSaveOverride={handleSaveOverride}
            onResetOverride={handleResetOverride}
          />
        )}

        {activeTab === 'runs' && (
          <ScanRunsView
            runs={runs}
            onTriggerScan={() => setIsScanModalOpen(true)}
          />
        )}
      </main>

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
        />
      )}

      {/* Database Settings Modal */}
      {isDbModalOpen && (
        <DatabaseSettingsModal
          isOpen={isDbModalOpen}
          onClose={() => setIsDbModalOpen(false)}
          onRefreshAllData={loadAllData}
          onShowToast={showToast}
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
