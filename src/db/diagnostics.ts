import { dbClient } from './supabaseClient';

export interface DiagnosticTableResult {
  tableName: string;
  initialized: boolean;
  recordCount: number;
  storageMode: 'SUPABASE' | 'DISCONNECTED';
  latencyMs: number;
  status: 'HEALTHY' | 'EMPTY' | 'NOT_INITIALIZED' | 'ERROR';
  sampleInfo?: {
    idOrKey?: string;
    updatedAt?: string;
  };
  error?: string;
}

export interface DiagnosticReport {
  timestamp: string;
  connection: {
    connected: boolean;
    storageMode: 'SUPABASE' | 'DISCONNECTED';
    url: string | null;
    pingLatencyMs: number;
  };
  summary: {
    totalTablesChecked: number;
    initializedTablesCount: number;
    missingTablesCount: number;
    totalRecordsAcrossTables: number;
    persistenceHealth: 'FULLY_INITIALIZED' | 'PARTIALLY_INITIALIZED' | 'DB_NOT_CONNECTED' | 'ERROR';
    recommendation: string;
  };
  tables: Record<string, DiagnosticTableResult>;
}

/**
 * Diagnostic tool function that checks if current Supabase tables
 * (assets, market_data_daily, fundamentals, indicator_snapshots, evaluations, signals, etc.)
 * are correctly initialized and returns record counts and health status to verify data persistence.
 */
export async function runDatabaseDiagnostics(): Promise<DiagnosticReport> {
  const targetTables = [
    'assets',
    'watchlist',
    'market_data_daily',
    'fundamentals',
    'indicator_snapshots',
    'evaluations',
    'signals',
    'signal_outcomes',
    'scan_runs',
    'scan_run_items',
  ];

  const startTime = Date.now();
  let pingLatencyMs = 0;
  const isConnected = Boolean(dbClient.supabase && dbClient.isSupabaseConnected);
  const client = dbClient.supabase;

  let maskedUrl: string | null = null;
  if (dbClient.getConfig().url) {
    const rawUrl = dbClient.getConfig().url;
    try {
      const u = new URL(rawUrl);
      maskedUrl = `${u.protocol}//${u.host}`;
    } catch {
      maskedUrl = rawUrl.substring(0, 15) + '...';
    }
  }

  const tableResults: Record<string, DiagnosticTableResult> = {};
  let totalRecords = 0;
  let initializedCount = 0;
  let missingCount = 0;

  if (isConnected && client) {
    // 1. Measure general connection ping
    try {
      const pingStart = Date.now();
      await client.from('assets').select('ticker', { count: 'exact', head: true });
      pingLatencyMs = Date.now() - pingStart;
    } catch {
      pingLatencyMs = Date.now() - startTime;
    }

    // 2. Check each table individually
    for (const tableName of targetTables) {
      const tStart = Date.now();
      try {
        const { count, error, data } = await client
          .from(tableName)
          .select('*', { count: 'exact' })
          .limit(1);

        const latency = Date.now() - tStart;

        if (error) {
          dbClient.markTableMissing(tableName);
          missingCount++;
          
          // In-memory fallback count for reference
          const inMemCount = getInMemoryRecordCount(tableName);
          tableResults[tableName] = {
            tableName,
            initialized: false,
            recordCount: inMemCount,
            storageMode: 'DISCONNECTED',
            latencyMs: latency,
            status: 'NOT_INITIALIZED',
            error: error.message,
          };
        } else {
          // Table exists and query succeeded
          dbClient.missingTables.delete(tableName);
          initializedCount++;
          const recCount = count ?? 0;
          totalRecords += recCount;

          let sampleInfo: { idOrKey?: string; updatedAt?: string } | undefined;
          if (data && data.length > 0) {
            const row = data[0];
            sampleInfo = {
              idOrKey: row.ticker || row.id || row.key || undefined,
              updatedAt: row.updated_at || row.signal_date || row.date || row.created_at || undefined,
            };
          }

          tableResults[tableName] = {
            tableName,
            initialized: true,
            recordCount: recCount,
            storageMode: 'SUPABASE',
            latencyMs: latency,
            status: recCount > 0 ? 'HEALTHY' : 'EMPTY',
            sampleInfo,
          };
        }
      } catch (err: any) {
        dbClient.markTableMissing(tableName);
        missingCount++;
        const inMemCount = getInMemoryRecordCount(tableName);
        tableResults[tableName] = {
          tableName,
          initialized: false,
          recordCount: inMemCount,
          storageMode: 'DISCONNECTED',
          latencyMs: Date.now() - tStart,
          status: 'ERROR',
          error: err?.message || 'Query execution failed',
        };
      }
    }
  } else {
    // Supabase is not connected -> Disconnected State
    for (const tableName of targetTables) {
      tableResults[tableName] = {
        tableName,
        initialized: false,
        recordCount: 0,
        storageMode: 'DISCONNECTED',
        latencyMs: 0,
        status: 'NOT_INITIALIZED',
        sampleInfo: {
          idOrKey: 'db-not-connected',
          updatedAt: new Date().toISOString(),
        },
      };
    }
  }

  // Determine overall persistence health
  let persistenceHealth: 'FULLY_INITIALIZED' | 'PARTIALLY_INITIALIZED' | 'DB_NOT_CONNECTED' | 'ERROR';
  let recommendation = '';

  if (!isConnected) {
    persistenceHealth = 'DB_NOT_CONNECTED';
    recommendation = 'Supabase DB가 연결되지 않았습니다. Cloudflare 환경변수 SUPABASE_URL과 SUPABASE_KEY를 설정하거나, DB Settings에서 연결하세요.';
  } else if (missingCount === 0) {
    persistenceHealth = 'FULLY_INITIALIZED';
    recommendation = `모든 ${targetTables.length}개 테이블이 Supabase에 올바르게 초기화되어 총 ${totalRecords}개 레코드가 클라우드에 영구 저장되고 있습니다.`;
  } else if (initializedCount > 0) {
    persistenceHealth = 'PARTIALLY_INITIALIZED';
    recommendation = `${targetTables.length}개 테이블 중 ${missingCount}개 테이블이 미생성 상태입니다. DB 설정 팝업의 "DDL 스키마 SQL"을 Supabase SQL Editor에 실행해주세요.`;
  } else {
    persistenceHealth = 'ERROR';
    recommendation = 'Supabase 연결에 응답하지 않거나 테이블이 생성되지 않았습니다. 연결 정보와 스키마를 확인하세요.';
  }

  return {
    timestamp: new Date().toISOString(),
    connection: {
      connected: isConnected,
      storageMode: isConnected ? 'SUPABASE' : 'DISCONNECTED',
      url: maskedUrl,
      pingLatencyMs,
    },
    summary: {
      totalTablesChecked: targetTables.length,
      initializedTablesCount: initializedCount,
      missingTablesCount: missingCount,
      totalRecordsAcrossTables: totalRecords,
      persistenceHealth,
      recommendation,
    },
    tables: tableResults,
  };
}

function getInMemoryRecordCount(tableName: string): number {
  switch (tableName) {
    case 'assets':
      return dbClient.assets.size;
    case 'watchlist':
      return dbClient.watchlist.size;
    case 'market_data_daily':
      return dbClient.market_data_daily.size;
    case 'fundamentals':
      return dbClient.fundamentals.size;
    case 'indicator_snapshots':
      return dbClient.indicator_snapshots.size;
    case 'evaluations':
      return dbClient.evaluations.size;
    case 'signals':
      return dbClient.signals.size;
    case 'signal_outcomes':
      return Array.from(dbClient.signals.values()).filter((s) => s.return_5d !== null || s.return_20d !== null).length;
    case 'scan_runs':
      return dbClient.scan_runs.size;
    case 'scan_run_items':
      return Array.from(dbClient.scan_runs.values()).reduce((acc, r) => acc + (r.items?.length || r.evaluated_count || 0), 0);
    default:
      return 0;
  }
}
