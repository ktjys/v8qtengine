import React, { useEffect, useState } from 'react';
import {
  BacktestSummary,
  FullTickerEvaluation,
  ScanRunLog,
  SignalSnapshot,
  WatchlistItem,
} from './types/v8';
import { Navbar } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { WatchlistView } from './components/WatchlistView';
import { BacktestView } from './components/BacktestView';
import { ClassificationView } from './components/ClassificationView';
import { ScanRunsView } from './components/ScanRunsView';
import { SymbolDetailModal } from './components/SymbolDetailModal';
import { ScanRunnerModal } from './components/ScanRunnerModal';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'watchlist' | 'backtest' | 'classification' | 'runs'>('dashboard');
  const [evaluations, setEvaluations] = useState<FullTickerEvaluation[]>([]);
  const [signals, setSignals] = useState<SignalSnapshot[]>([]);
  const [v8Backtest, setV8Backtest] = useState<BacktestSummary | null>(null);
  const [v7Backtest, setV7Backtest] = useState<BacktestSummary | null>(null);
  const [runs, setRuns] = useState<ScanRunLog[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);

  // Modals
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const loadAllData = async () => {
    try {
      // 1. Fetch live evaluations
      const evalRes = await fetch('/api/v8/evaluations');
      const evalData = await evalRes.json();
      if (evalData.success) {
        setEvaluations(evalData.evaluations);
      }

      // 2. Fetch signals
      const sigRes = await fetch('/api/v8/signals');
      const sigData = await sigRes.json();
      if (sigData.success) {
        setSignals(sigData.signals);
      }

      // 3. Fetch backtest
      const btRes = await fetch('/api/v8/backtest');
      const btData = await btRes.json();
      if (btData.success) {
        setV8Backtest(btData.v8);
        setV7Backtest(btData.v7);
      }

      // 4. Fetch runs
      const runRes = await fetch('/api/v8/runs');
      const runData = await runRes.json();
      if (runData.success) {
        setRuns(runData.runs);
      }

      // 5. Fetch watchlist
      const wlRes = await fetch('/api/v8/watchlist');
      const wlData = await wlRes.json();
      if (wlData.success) {
        setWatchlist(wlData.watchlist);
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
    try {
      const res = await fetch('/api/v8/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker, name, memo }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`${ticker} 종목이 워치리스트에 추가되고 즉시 V8 평가 완료되었습니다.`);
        await loadAllData();
      } else {
        showToast(`추가 실패: ${data.error}`);
      }
    } catch (err) {
      console.error('Failed to add ticker', err);
    }
  };

  const handleDeleteTicker = async (ticker: string) => {
    if (!confirm(`${ticker} 종목을 워치리스트에서 삭제하시겠습니까?`)) return;
    try {
      const res = await fetch(`/api/v8/watchlist/${ticker}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        showToast(`${ticker} 종목이 삭제되었습니다.`);
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
    showToast('전체 21종목 V8 퀀트 파이프라인 평가 및 스냅샷 저장이 완료되었습니다.');
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
        totalCount={evaluations.length}
        signalsCount={signals.filter((s) => s.score_version === 'V8.0').length}
      />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && (
          <DashboardView
            evaluations={evaluations}
            recentSignals={signals}
            v8Backtest={v8Backtest}
            v7Backtest={v7Backtest}
            onSelectTicker={(t) => setSelectedTicker(t)}
            onPreviewTelegram={(t) => setSelectedTicker(t)}
            onNavigateToWatchlist={() => setActiveTab('watchlist')}
          />
        )}

        {activeTab === 'watchlist' && (
          <WatchlistView
            evaluations={evaluations}
            onSelectTicker={(t) => setSelectedTicker(t)}
            onPreviewTelegram={(t) => setSelectedTicker(t)}
            onAddTicker={handleAddTicker}
            onDeleteTicker={handleDeleteTicker}
            onToggleActive={handleToggleActive}
          />
        )}

        {activeTab === 'backtest' && (
          <BacktestView
            v8Summary={v8Backtest}
            v7Summary={v7Backtest}
            allSignals={signals}
            onSelectTicker={(t) => setSelectedTicker(t)}
          />
        )}

        {activeTab === 'classification' && (
          <ClassificationView
            evaluations={evaluations}
            onSelectTicker={(t) => setSelectedTicker(t)}
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
