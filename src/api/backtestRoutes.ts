import { Router } from 'express';
import { runHistoricalReplay } from '../backtest/strategyReplay';
import { signalRepository } from '../db/repositories/signalRepository';
import { calculateBacktestMetrics } from '../engine/backtestEngine';
import {
  runHistoricalBackfill,
  initBackfill,
  backfillSingleTicker,
  finalizeBackfill,
} from '../engine/backfillEngine';
import { dbClient } from '../db/supabaseClient';

export const backtestRouter = Router();

// GET /api/v8/backtest
backtestRouter.get('/', async (req, res) => {
  try {
    const signals = await signalRepository.getAll();
    let summary = calculateBacktestMetrics(signals);

    // If active signals in DB have no completed trades yet, fallback to full historical replay
    if (!summary || summary.completed_signals === 0) {
      const replayResult = await runHistoricalReplay({
        startDate: (req.query.startDate as string) || '2024-01-01',
        endDate: (req.query.endDate as string) || new Date().toISOString().split('T')[0],
      });
      return res.json({
        success: true,
        summary: replayResult.summary,
        signals: replayResult.signals,
        all_signals: replayResult.signals,
        data: replayResult,
      });
    }

    res.json({
      success: true,
      summary,
      signals,
      all_signals: signals,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// POST /api/v8/backtest/backfill-init - Step 1: Initialize benchmark & get target tickers
backtestRouter.post('/backfill-init', async (req, res) => {
  try {
    const { lookbackRange, tickers } = req.body;
    const initData = await initBackfill({
      lookbackRange: lookbackRange || '1y',
      tickers,
    });
    res.json({
      success: true,
      data: initData,
    });
  } catch (err) {
    console.error('[backtestRouter] Backfill init error:', err);
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// POST /api/v8/backtest/backfill-ticker - Step 2: Backfill a single ticker
backtestRouter.post('/backfill-ticker', async (req, res) => {
  try {
    const { ticker, lookbackRange, opportunityThreshold } = req.body;
    if (!ticker) {
      return res.status(400).json({ success: false, error: 'Ticker is required' });
    }
    const result = await backfillSingleTicker(ticker, {
      lookbackRange: lookbackRange || '1y',
      opportunityThreshold: opportunityThreshold ? Number(opportunityThreshold) : 70,
    });
    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error(`[backtestRouter] Backfill ticker ${req.body?.ticker} error:`, err);
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// POST /api/v8/backtest/backfill-finalize - Step 3: Finalize backfill & compute global metrics
backtestRouter.post('/backfill-finalize', async (req, res) => {
  try {
    const {
      targetTickers,
      range,
      totalBarsIngested,
      allSignals,
      detailsByTicker,
      minDate,
      maxDate,
    } = req.body;

    const result = await finalizeBackfill(
      targetTickers || [],
      range || '1y',
      totalBarsIngested || 0,
      allSignals || [],
      detailsByTicker || {},
      minDate || '',
      maxDate || ''
    );

    const isConnected = dbClient.isSupabaseConnected && !!dbClient.supabase;

    res.json({
      success: true,
      message: isConnected
        ? `과거 ${range || '1y'} 데이터 백필 완료: Supabase DB에 ${result.totalBarsIngested}개 봉과 ${result.totalSignalsGenerated}개 시그널이 저장되었습니다.`
        : `과거 ${range || '1y'} 데이터 백필 완료: 로컬 메모리 저장소에 ${result.totalBarsIngested}개 봉과 ${result.totalSignalsGenerated}개 시그널이 적재되었습니다.`,
      supabaseConnected: isConnected,
      result,
    });
  } catch (err) {
    console.error('[backtestRouter] Backfill finalize error:', err);
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// POST /api/v8/backtest/backfill - Full batch backfill
backtestRouter.post('/backfill', async (req, res) => {
  try {
    const { lookbackRange, tickers, opportunityThreshold, replaceExisting } = req.body;
    const result = await runHistoricalBackfill({
      lookbackRange: lookbackRange || '1y',
      tickers,
      opportunityThreshold: opportunityThreshold ? Number(opportunityThreshold) : 70,
      replaceExisting: replaceExisting ?? true,
    });

    const isConnected = dbClient.isSupabaseConnected && !!dbClient.supabase;

    res.json({
      success: true,
      message: isConnected
        ? `과거 ${lookbackRange || '1y'} 데이터 백필 완료: Supabase DB에 ${result.totalBarsIngested}개 봉과 ${result.totalSignalsGenerated}개 시그널이 저장되었습니다.`
        : `과거 ${lookbackRange || '1y'} 데이터 백필 완료: 로컬 메모리 저장소에 ${result.totalBarsIngested}개 봉과 ${result.totalSignalsGenerated}개 시그널이 적재되었습니다.`,
      supabaseConnected: isConnected,
      result,
    });
  } catch (err) {
    console.error('[backtestRouter] Backfill error:', err);
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// GET /api/v8/backtest/performance & /api/v8/backtest/compare
backtestRouter.get('/performance', async (req, res) => {
  try {
    const startDate = (req.query.startDate as string) || '2024-01-01';
    const endDate = (req.query.endDate as string) || new Date().toISOString().split('T')[0];

    const replayResult = await runHistoricalReplay({
      startDate,
      endDate,
    });

    res.json({
      success: true,
      data: replayResult,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// Alias for backward compatibility
backtestRouter.get('/compare', async (req, res) => {
  try {
    const startDate = (req.query.startDate as string) || '2024-01-01';
    const endDate = (req.query.endDate as string) || new Date().toISOString().split('T')[0];

    const replayResult = await runHistoricalReplay({
      startDate,
      endDate,
    });

    res.json({
      success: true,
      data: replayResult,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// POST /api/v8/backtest/replay
backtestRouter.post('/replay', async (req, res) => {
  try {
    const { startDate, endDate, tickers, opportunityThreshold } = req.body;
    const replayResult = await runHistoricalReplay({
      startDate: startDate || '2024-01-01',
      endDate: endDate || new Date().toISOString().split('T')[0],
      tickers,
      opportunityThreshold: opportunityThreshold || 70,
    });

    res.json({
      success: true,
      data: replayResult,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});
