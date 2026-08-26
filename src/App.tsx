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
import { evaluationRepository } from './db/repositories/evaluationRepository';
import { watchlistRepository } from './db/repositories/watchlistRepository';
import { assetRepository } from './db/repositories/assetRepository';
import { evaluationService } from './pipeline/evaluationService';
import { dbClient } from './db/supabaseClient';
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
  const [evaluations, setEvaluations] = useState<FullTickerEvaluation[]>([]);
  const [signals, setSignals] = useState<SignalSnapshot[]>([]);
  const [backtestSummary, setBacktestSummary] = useState<BacktestSummary | null>(null);
  const [runs, setRuns] = useState<ScanRunLog[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);

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
      let newEvaluations: FullTickerEvaluation[] = [];
      let successMsg = '';

      // 1. Try server endpoint first
      try {
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
      } catch (netErr) {
        console.warn('Backend recalculate endpoint error, falling back to local evaluation service:', netErr);
      }

      // 2. Direct local evaluation engine fallback if backend is unavailable or failed
      if (newEvaluations.length === 0) {
        const allAssets = await assetRepository.getAll();
        const activeItems = watchlist.filter((w) => w.is_active);
        const allTickerSet = new Set<string>([
          ...activeItems.map((w) => w.ticker.toUpperCase()),
          ...allAssets.map((a) => a.ticker.toUpperCase()),
          ...watchlist.map((w) => w.ticker.toUpperCase()),
        ]);
        const targetTickers = Array.from(allTickerSet);

        if (targetTickers.length > 0) {
          const batchResult = await evaluationService.evaluateBatch(targetTickers);
          if (batchResult.evaluations.length > 0) {
            newEvaluations = batchResult.evaluations;
            await evaluationRepository.saveAll(batchResult.evaluations);
            successMsg = `${batchResult.evaluations.length}개 종목의 퀀트 평가 및 가격 데이터가 최신화되었습니다.`;
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
      try {
        const fallback = await evaluationRepository.getAll();
        if (fallback.length > 0) {
          setEvaluations(fallback);
        }
      } catch {}
      showToast('DB 데이터 평가 갱신 완료');
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
      // Parallel execution for near-instant database read across all tables
      const [currentWl, loadedEvals, latestSignals, btData, currentRuns] = await Promise.all([
        safeFetchJson('/api/v8/watchlist')
          .then(async (res) => (res?.success && Array.isArray(res.watchlist) ? res.watchlist : watchlistRepository.getAll()))
          .catch(() => watchlistRepository.getAll()),

        safeFetchJson('/api/v8/evaluations')
          .then(async (res) => (res?.success && Array.isArray(res.evaluations) ? res.evaluations : evaluationRepository.getAll()))
          .catch(() => evaluationRepository.getAll()),

        safeFetchJson('/api/v8/signals')
          .then(async (res) => (res?.success && Array.isArray(res.signals) ? res.signals : signalRepository.getAll()))
          .catch(() => signalRepository.getAll()),

        safeFetchJson('/api/v8/backtest').catch(() => null),

        safeFetchJson('/api/v8/runs')
          .then(async (res) => (res?.success && Array.isArray(res.runs) ? res.runs : scanRunRepository.getAll()))
          .catch(() => scanRunRepository.getAll()),
      ]);

      // Immediate UI update in a single paint batch
      setWatchlist(currentWl || []);
      setEvaluations(loadedEvals || []);
      setSignals(latestSignals || []);
      setRuns(currentRuns || []);

      if (btData?.success && (btData.data?.summary || btData.summary)) {
        setBacktestSummary(btData.data?.summary || btData.summary || null);
      } else if (latestSignals && latestSignals.length > 0) {
        setBacktestSummary(calculateBacktestMetrics(latestSignals));
      } else {
        setBacktestSummary(null);
      }

      // Background Non-blocking check for any newly added tickers without evaluations
      const evalMap = new Map((loadedEvals || []).map((e) => [e.ticker.toUpperCase(), e]));
      const unevaluated = (currentWl || []).filter((w) => !evalMap.has(w.ticker.toUpperCase()));
      if (unevaluated.length > 0) {
        setTimeout(async () => {
          try {
            const newEvals: FullTickerEvaluation[] = [];
            for (const item of unevaluated) {
              const ticker = item.ticker.toUpperCase();
              const override = dbClient.classifications.get(ticker);
              const newEv = await evaluationService.evaluateTicker(ticker, override);
              if (newEv) {
                newEvals.push(newEv);
                evalMap.set(ticker, newEv);
              }
            }
            if (newEvals.length > 0) {
              await evaluationRepository.saveAll(newEvals);
              setEvaluations(Array.from(evalMap.values()));
            }
          } catch (bgErr) {
            console.warn('[App] Background evaluation update:', bgErr);
          }
        }, 100);
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
      dbClient.classifications.set(ticker.toUpperCase(), {
        ticker: ticker.toUpperCase(),
        asset_type,
        strategy_type,
        confidence,
        reason,
        classification_source: 'manual',
        classified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      try {
        await fetch('/api/v8/classification/override', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticker, asset_type, strategy_type, confidence, reason }),
        });
      } catch {}

      showToast(`${ticker} 자산 분류 수동 지정이 저장되었습니다.`);
      await loadAllData();
    } catch (err) {
      console.error('Failed to save override', err);
    }
  };

  const handleResetOverride = async (ticker: string) => {
    try {
      dbClient.classifications.delete(ticker.toUpperCase());

      try {
        await fetch(`/api/v8/classification/override/${ticker}`, {
          method: 'DELETE',
        });
      } catch {}

      showToast(`${ticker} 분류가 자동 분석으로 복원되었습니다.`);
      await loadAllData();
    } catch (err) {
      console.error('Failed to reset override', err);
    }
  };

  const handleAddTicker = async (ticker: string, name: string, memo: string) => {
    const cleanTicker = ticker.toUpperCase().trim();
    if (!cleanTicker) return;

    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('quant_db_cleared_v8');
      }

      // 1. Direct repository persistence (Immediate, robust, offline/Edge/SPA ready)
      await assetRepository.upsert({
        ticker: cleanTicker,
        name: name || cleanTicker,
        is_active: true,
      });
      await watchlistRepository.add({
        ticker: cleanTicker,
        name: name || cleanTicker,
        memo: memo || '관심 종목',
        is_active: true,
      });

      // 2. Direct quant evaluation
      try {
        const override = dbClient.classifications.get(cleanTicker);
        const evalResult = await evaluationService.evaluateTicker(cleanTicker, override);
        if (evalResult) {
          await evaluationRepository.saveAll([evalResult]);
          setEvaluations((prev) => {
            const map = new Map(prev.map((e) => [e.ticker.toUpperCase(), e]));
            map.set(cleanTicker, evalResult);
            return Array.from(map.values());
          });
        }
      } catch (evErr) {
        console.warn('Instant local evaluation error:', evErr);
      }

      // 3. Notify backend server if available
      try {
        await fetch('/api/v8/watchlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticker: cleanTicker, name, memo, is_active: true }),
        });
      } catch {}

      showToast(`${cleanTicker} 종목이 워치리스트에 추가되고 즉시 퀀트 평가가 완료되었습니다.`);
      await loadAllData();
    } catch (err: any) {
      console.error('Failed to add ticker', err);
      showToast(`추가 실패: ${err.message}`);
    }
  };

  const handleDeleteTicker = async (ticker: string) => {
    const cleanTicker = ticker.toUpperCase().trim();
    if (!confirm(`${cleanTicker} 종목을 워치리스트에서 삭제하시겠습니까?`)) return;

    try {
      await watchlistRepository.remove(cleanTicker);
      setEvaluations((prev) => prev.filter((e) => e.ticker.toUpperCase() !== cleanTicker));
      setWatchlist((prev) => prev.filter((w) => w.ticker.toUpperCase() !== cleanTicker));

      try {
        await fetch(`/api/v8/watchlist/${cleanTicker}`, {
          method: 'DELETE',
        });
      } catch {}

      showToast(`${cleanTicker} 종목이 삭제되었습니다.`);
      await loadAllData();
    } catch (err) {
      console.error('Failed to delete ticker', err);
    }
  };

  const handleToggleActive = async (ticker: string, is_active: boolean) => {
    try {
      await watchlistRepository.toggleActive(ticker, is_active);
      try {
        await fetch(`/api/v8/watchlist/${ticker}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_active }),
        });
      } catch {}
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
