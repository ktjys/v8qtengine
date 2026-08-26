import { Router } from 'express';
import { dbClient } from '../db/supabaseClient';
import { evaluationService } from '../pipeline/evaluationService';
import { FULL_SCHEMA_SQL } from '../db/schemaSql';
import { runDatabaseDiagnostics } from '../db/diagnostics';

export const systemRouter = Router();

// GET /api/v8/system/status
systemRouter.get('/status', (req, res) => {
  const dbStatus = dbClient.getStatus();
  const dbConfig = dbClient.getConfig();
  res.json({
    success: true,
    provider: evaluationService.getProviderName(),
    db: dbStatus,
    db_config: dbConfig,
    timestamp: new Date().toISOString(),
    uptime_seconds: process.uptime(),
  });
});

// GET /api/v8/system/db/diagnostics (Full DB verification & record counts)
systemRouter.get('/db/diagnostics', async (req, res) => {
  try {
    const diagnostics = await runDatabaseDiagnostics();
    res.json({
      success: true,
      ...diagnostics,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || '진단 실행 중 오류가 발생했습니다.' });
  }
});

// GET /api/v8/system/db/status
systemRouter.get('/db/status', async (req, res) => {
  try {
    const status = dbClient.getStatus();
    const config = dbClient.getConfig();
    const tables = await dbClient.checkTableStatus();

    res.json({
      success: true,
      status,
      config,
      tables,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v8/system/db/config (Update and connect to Supabase)
systemRouter.post('/db/config', async (req, res) => {
  try {
    const { url, key } = req.body;
    if (!url || !key) {
      return res.status(400).json({ error: 'Supabase URL과 Key를 모두 전달해야 합니다.' });
    }

    const result = await dbClient.configureSupabase(url, key);
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    res.json({
      success: true,
      message: 'Supabase 데이터베이스가 성공적으로 연결되었습니다.',
      status: dbClient.getStatus(),
      tables: result.tables,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v8/system/db/disconnect (Reset connection to default production DB)
systemRouter.post('/db/disconnect', (req, res) => {
  res.json({
    success: true,
    message: 'Supabase 기본 데이터베이스 연결이 유지됩니다.',
    status: dbClient.getStatus(),
  });
});

// POST /api/v8/system/db/clear (Clear all records from DB and memory)
systemRouter.post('/db/clear', async (req, res) => {
  try {
    const result = await dbClient.clearAllData();
    const tables = await dbClient.checkTableStatus();
    res.json({
      success: true,
      message: '모든 데이터베이스 테이블 및 메모리 레코드가 성공적으로 초기화/삭제되었습니다.',
      clearedTables: result.clearedTables,
      tables,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v8/system/db/seed (Seed initial universe & signals to DB)
systemRouter.post('/db/seed', async (req, res) => {
  try {
    const result = await dbClient.seedToActiveDb();
    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    const tables = await dbClient.checkTableStatus();
    res.json({
      success: true,
      message: `기본 유니버스 및 시그널 데이터(${result.seededCount}개)가 주입되었습니다.`,
      seededCount: result.seededCount,
      tables,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v8/system/db/schema-sql (Get full migration SQL)
systemRouter.get('/db/schema-sql', (req, res) => {
  res.json({
    success: true,
    sql: FULL_SCHEMA_SQL,
  });
});

// POST /api/v8/system/provider
systemRouter.post('/provider', (req, res) => {
  const { provider } = req.body;
  if (provider === 'seed' || provider === 'yahoo') {
    evaluationService.setProvider(provider);
    res.json({ success: true, active_provider: provider });
  } else {
    res.status(400).json({ error: "Invalid provider. Must be 'yahoo' or 'seed'." });
  }
});
