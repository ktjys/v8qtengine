import { useCallback, useEffect, useRef, useState } from 'react';
import type { FullTickerEvaluation, SignalSnapshot, ScanRunLog, BacktestSummary, WatchlistItem, MarketRegion } from '../types/v8';
import { detectMarketRegion } from '../utils/marketUtils';

interface UseQuantDataOptions {
  activeMarket: MarketRegion;
  onError?: (error: Error) => void;
}

interface QuantDataState {
  evaluations: FullTickerEvaluation[];
  signals: SignalSnapshot[];
  runs: ScanRunLog[];
  watchlist: WatchlistItem[];
  backtestSummary: BacktestSummary | null;
  isLoading: boolean;
  error: Error | null;
}

const safeFetchJson = async (url: string): Promise<any> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 7000);
  try {
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
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await res.json();
    }
    const text = await res.text();
    try { return JSON.parse(text); } catch { return null; }
  } catch (e) {
    clearTimeout(timeoutId);
    console.warn(`Fetch error for ${url}:`, e);
    return null;
  }
};

export function useQuantData({ activeMarket, onError }: UseQuantDataOptions) {
  const [state, setState] = useState<QuantDataState>({
    evaluations: [],
    signals: [],
    runs: [],
    watchlist: [],
    backtestSummary: null,
    isLoading: true,
    error: null,
  });
  
  const abortControllerRef = useRef<AbortController | null>(null);

  const loadAllData = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const [currentWl, loadedEvals, latestSignals, btData, currentRuns] = await Promise.all([
        safeFetchJson('/api/v8/watchlist'),
        safeFetchJson('/api/v8/evaluations'),
        safeFetchJson('/api/v8/signals'),
        safeFetchJson(`/api/v8/backtest?market=${activeMarket}&_t=${Date.now()}`),
        safeFetchJson('/api/v8/runs'),
      ]);

      if (signal.aborted) return;

      let newWatchlist: WatchlistItem[] = [];
      if (currentWl?.success && Array.isArray(currentWl.watchlist)) {
        newWatchlist = currentWl.watchlist;
      }

      let newEvals: FullTickerEvaluation[] = [];
      const rawEvals = Array.isArray(loadedEvals?.evaluations)
        ? loadedEvals.evaluations
        : Array.isArray(loadedEvals?.data)
        ? loadedEvals.data
        : null;
      if (loadedEvals?.success && rawEvals) {
        newEvals = rawEvals;
      }

      let newSignals: SignalSnapshot[] = [];
      if (latestSignals?.success && Array.isArray(latestSignals.signals)) {
        const sigMap = new Map<string, SignalSnapshot>();
        for (const s of latestSignals.signals) {
          const key = `${s.ticker}_${s.signal_date}`;
          if (!sigMap.has(key)) sigMap.set(key, s);
        }
        newSignals = Array.from(sigMap.values()).sort((a, b) => b.signal_date.localeCompare(a.signal_date));
      }

      let newRuns: ScanRunLog[] = [];
      if (currentRuns?.success && Array.isArray(currentRuns.runs)) {
        newRuns = currentRuns.runs;
      }

      let newBacktest: BacktestSummary | null = null;
      if (btData?.success && (btData.data?.summary || btData.summary)) {
        newBacktest = btData.data?.summary || btData.summary;
      }

      setState(prev => ({
        ...prev,
        evaluations: newEvals,
        signals: newSignals,
        runs: newRuns,
        watchlist: newWatchlist,
        backtestSummary: newBacktest,
        isLoading: false,
      }));
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      console.error('Failed to load initial data', err);
      if (!signal.aborted) {
        setState(prev => ({ ...prev, isLoading: false, error: err instanceof Error ? err : new Error(String(err)) }));
        onError?.(err instanceof Error ? err : new Error(String(err)));
      }
    }
  }, [activeMarket, onError]);

  const refreshEvaluations = useCallback(async () => {
    try {
      const loadedEvals = await safeFetchJson('/api/v8/evaluations');
      const rawEvals = Array.isArray(loadedEvals?.evaluations)
        ? loadedEvals.evaluations
        : Array.isArray(loadedEvals?.data)
        ? loadedEvals.data
        : null;
      if (loadedEvals?.success && rawEvals) {
        setState(prev => ({ ...prev, evaluations: rawEvals }));
      }
    } catch (err) {
      console.error('Failed to refresh evaluations', err);
    }
  }, []);

  const refreshSignals = useCallback(async () => {
    try {
      const latestSignals = await safeFetchJson('/api/v8/signals');
      if (latestSignals?.success && Array.isArray(latestSignals.signals)) {
        const sigMap = new Map<string, SignalSnapshot>();
        for (const s of latestSignals.signals) {
          const key = `${s.ticker}_${s.signal_date}`;
          if (!sigMap.has(key)) sigMap.set(key, s);
        }
        const newSignals = Array.from(sigMap.values()).sort((a, b) => b.signal_date.localeCompare(a.signal_date));
        setState(prev => ({ ...prev, signals: newSignals }));
      }
    } catch (err) {
      console.error('Failed to refresh signals', err);
    }
  }, []);

  const refreshBacktest = useCallback(async () => {
    try {
      const btData = await safeFetchJson(`/api/v8/backtest?market=${activeMarket}&_t=${Date.now()}`);
      if (btData?.success && (btData.data?.summary || btData.summary)) {
        setState(prev => ({ ...prev, backtestSummary: btData.data?.summary || btData.summary }));
      }
    } catch (err) {
      console.error('Failed to refresh backtest', err);
    }
  }, [activeMarket]);

  useEffect(() => {
    loadAllData();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadAllData]);

  // Filter evaluations and signals by activeMarket
  const filteredEvaluations = state.evaluations.filter((e) => {
    const region = e.market_region || detectMarketRegion(e.ticker);
    return region === activeMarket;
  });

  const filteredSignals = state.signals.filter((s) => {
    const region = s.market_region || detectMarketRegion(s.ticker);
    return region === activeMarket;
  });

  return {
    ...state,
    evaluations: filteredEvaluations,
    signals: filteredSignals,
    refreshEvaluations,
    refreshSignals,
    refreshBacktest,
    refreshAll: loadAllData,
  };
}