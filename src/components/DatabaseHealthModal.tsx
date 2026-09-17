import React, { useState, useEffect } from 'react';
import {
  Database,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Copy,
  Check,
  Shield,
  ShieldAlert,
  Server,
  Activity,
  X,
  FileCode,
  Zap,
  ExternalLink,
} from 'lucide-react';

interface DatabaseHealthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast?: (msg: string) => void;
}

export interface TableStatusItem {
  name: string;
  exists: boolean;
  count: number;
  status?: string;
  latencyMs?: number;
  storageMode?: string;
  error?: string;
}

export const ALERT_NOTIFICATIONS_DDL_ONLY = `-- 11. Alert Notifications History
CREATE TABLE IF NOT EXISTS alert_notifications (
  id VARCHAR(100) PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL,
  kst_time VARCHAR(50) NOT NULL,
  strategy_type VARCHAR(50) NOT NULL,
  title TEXT NOT NULL,
  tickers TEXT[] NOT NULL DEFAULT '{}',
  signals_count INT DEFAULT 0,
  delivery_status VARCHAR(30) NOT NULL DEFAULT 'SENT',
  delivery_target VARCHAR(100),
  message_preview TEXT,
  message_body TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 보안 해제 및 모든 역할(anon, authenticated) 권한 부여
ALTER TABLE IF EXISTS alert_notifications DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all alert_notifications" ON alert_notifications;
CREATE POLICY "Allow all alert_notifications" ON alert_notifications FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON TABLE alert_notifications TO anon, authenticated, service_role;
CREATE INDEX IF NOT EXISTS idx_alert_notifications_time ON alert_notifications(timestamp DESC);`;

export const ALERT_NOTIFICATIONS_RLS_FIX_SQL = `-- alert_notifications RLS 권한 즉시 해제 (기존 테이블 유지, 쓰기 권한 활성화)
ALTER TABLE IF EXISTS alert_notifications DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all alert_notifications" ON alert_notifications;
CREATE POLICY "Allow all alert_notifications" ON alert_notifications FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON TABLE alert_notifications TO anon, authenticated, service_role;`;

export const DatabaseHealthModal: React.FC<DatabaseHealthModalProps> = ({
  isOpen,
  onClose,
  onShowToast,
}) => {
  const [diagnostics, setDiagnostics] = useState<any | null>(null);
  const [schemaSql, setSchemaSql] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'status' | 'sql'>('status');
  const [copiedSql, setCopiedSql] = useState<boolean>(false);
  const [copiedAlertSql, setCopiedAlertSql] = useState<boolean>(false);
  const [copiedRlsSql, setCopiedRlsSql] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const fetchDiagnostics = async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const res = await fetch('/api/v8/system/db/diagnostics');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      setDiagnostics(data);
    } catch (err: any) {
      console.error('Failed to load DB diagnostics:', err);
      setFetchError(err?.message || 'DB 진단 정보를 불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSchemaSql = async () => {
    try {
      const res = await fetch('/api/v8/system/db/schema-sql');
      const data = await res.json();
      if (data.success && data.sql) {
        setSchemaSql(data.sql);
      }
    } catch (err) {
      console.error('Failed to load schema SQL:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDiagnostics();
      fetchSchemaSql();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Safely parse tables whether backend returns an Array or a Dictionary Object
  const parseTableList = (): TableStatusItem[] => {
    if (!diagnostics || !diagnostics.tables) return [];
    const raw = diagnostics.tables;

    if (Array.isArray(raw)) {
      return raw.map((item: any) => ({
        name: item.tableName || item.name || 'unknown',
        exists: Boolean(item.initialized ?? item.exists ?? true),
        count: typeof item.recordCount === 'number' ? item.recordCount : (item.count ?? 0),
        status: item.status,
        latencyMs: item.latencyMs,
        storageMode: item.storageMode,
        error: item.error,
      }));
    }

    if (typeof raw === 'object') {
      return Object.entries(raw).map(([key, val]: [string, any]) => ({
        name: val.tableName || key,
        exists: Boolean(val.initialized ?? val.exists ?? false),
        count: typeof val.recordCount === 'number' ? val.recordCount : (val.count ?? 0),
        status: val.status,
        latencyMs: val.latencyMs,
        storageMode: val.storageMode,
        error: val.error,
      }));
    }

    return [];
  };

  const tables = parseTableList();
  const missingTables = tables.filter((t) => !t.exists);
  const existingTables = tables.filter((t) => t.exists);
  const rlsBlockedTables = tables.filter((t) => t.status === 'RLS_BLOCKED');

  const isConnected = Boolean(
    diagnostics?.connection?.connected ?? (diagnostics?.status === 'HEALTHY' || diagnostics?.success)
  );
  const pingLatencyMs = diagnostics?.connection?.pingLatencyMs ?? diagnostics?.pingLatencyMs;
  const maskedHost = diagnostics?.connection?.url ?? diagnostics?.maskedHost ?? 'Supabase Cloud';
  const totalRecordsAcrossTables =
    diagnostics?.summary?.totalRecordsAcrossTables ??
    existingTables.reduce((acc, t) => acc + (t.count || 0), 0);

  const handleCopyFullSql = () => {
    if (!schemaSql) return;
    navigator.clipboard.writeText(schemaSql);
    setCopiedSql(true);
    if (onShowToast) {
      onShowToast('Supabase 전체 스키마 DDL이 복사되었습니다.');
    }
    setTimeout(() => setCopiedSql(false), 2500);
  };

  const handleCopyAlertSqlOnly = () => {
    navigator.clipboard.writeText(ALERT_NOTIFICATIONS_DDL_ONLY);
    setCopiedAlertSql(true);
    if (onShowToast) {
      onShowToast('alert_notifications 생성 SQL이 복사되었습니다.');
    }
    setTimeout(() => setCopiedAlertSql(false), 2500);
  };

  const handleCopyRlsFixSql = () => {
    navigator.clipboard.writeText(ALERT_NOTIFICATIONS_RLS_FIX_SQL);
    setCopiedRlsSql(true);
    if (onShowToast) {
      onShowToast('alert_notifications RLS 해제 SQL이 복사되었습니다. Supabase SQL Editor에 실행해주세요.');
    }
    setTimeout(() => setCopiedRlsSql(false), 2500);
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-fadeIn"
    >
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-100">
                  데이터베이스 헬스체크 & DDL
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  Supabase DB
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
                운영 DB 연결 상태, 11개 핵심 테이블 모니터링 및 DDL 마이그레이션 스크립트
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={fetchDiagnostics}
              disabled={isLoading}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors disabled:opacity-50"
              title="새로고침"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              title="닫기 (ESC)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="px-4 sm:px-6 py-2.5 border-b border-slate-800 bg-slate-950/20 flex items-center justify-between shrink-0">
          <div className="flex space-x-2">
            <button
              onClick={() => setActiveTab('status')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'status'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              📊 테이블 헬스체크 {tables.length > 0 && `(${existingTables.length}/${tables.length})`}
            </button>
            <button
              onClick={() => setActiveTab('sql')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'sql'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              📜 테이블 생성 DDL (SQL)
            </button>
          </div>

          {missingTables.length > 0 && (
            <span className="hidden sm:inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-950/40 text-amber-300 border border-amber-500/30">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              <span>{missingTables.length}개 테이블 미생성</span>
            </span>
          )}
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6 flex-1 text-xs">
          {fetchError && (
            <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-500/30 text-rose-300 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <XCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{fetchError}</span>
              </div>
              <button
                onClick={fetchDiagnostics}
                className="px-2.5 py-1 rounded-lg bg-rose-900/50 hover:bg-rose-900 text-rose-200 text-[11px] font-semibold"
              >
                재시도
              </button>
            </div>
          )}

          {activeTab === 'status' && (
            <div className="space-y-4">
              {/* Overall Connection Status Card */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 flex items-center space-x-3">
                  <Server className="w-5 h-5 text-cyan-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[10px] text-slate-500 font-mono">DB 연결 모드</div>
                    <div className="text-xs font-bold text-slate-200 truncate">
                      {isConnected ? '🟢 Supabase 연결됨' : '🟡 인메모리 / 준비 중'}
                    </div>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 flex items-center space-x-3">
                  <Activity className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div>
                    <div className="text-[10px] text-slate-500 font-mono">DB 핑 응답속도</div>
                    <div className="text-xs font-bold text-emerald-400 font-mono">
                      {pingLatencyMs != null ? `${pingLatencyMs}ms` : '-'}
                    </div>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 flex items-center space-x-3">
                  <Shield className="w-5 h-5 text-purple-400 shrink-0" />
                  <div>
                    <div className="text-[10px] text-slate-500 font-mono">전체 저장 레코드</div>
                    <div className="text-xs font-bold text-slate-200">
                      <span className="text-emerald-400 font-mono">
                        {totalRecordsAcrossTables.toLocaleString()}
                      </span>
                      <span className="text-slate-500 font-mono"> 건</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* RLS Blocked tables warning */}
              {rlsBlockedTables.length > 0 && (
                <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-500/40 text-rose-200 space-y-3 animate-fadeIn">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center space-x-2 font-bold text-rose-300">
                      <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
                      <span>RLS 행 보안 쓰기 차단 감지 ({rlsBlockedTables.map((t) => t.name).join(', ')})</span>
                    </div>
                    <button
                      onClick={handleCopyRlsFixSql}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-lg shadow-rose-950 transition-all self-start sm:self-auto cursor-pointer"
                    >
                      {copiedRlsSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedRlsSql ? '복사 완료!' : '⚡ RLS 해제 SQL 복사 (즉시 해결)'}</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    테이블은 생성되어 있으나 Supabase 기본 Row Level Security(RLS) 정책으로 인해 앱에서 알림을 INSERT(쓰기)할 수 없습니다 (에러코드 42501).
                    위 <b className="text-rose-300">[⚡ RLS 해제 SQL 복사]</b> 버튼을 누른 후, Supabase 콘솔 &gt; <b>SQL Editor</b>에 붙여넣고 [Run]하시면 즉시 알람이 원격 DB에 영구 저장됩니다.
                  </p>
                </div>
              )}

              {/* Missing tables warning if any */}
              {missingTables.length > 0 && (
                <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 text-amber-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 font-bold text-amber-300">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>미생성 테이블 {missingTables.length}개 발견 (해당 테이블 인메모리 폴백)</span>
                    </div>
                    {missingTables.some((m) => m.name === 'alert_notifications') && (
                      <button
                        onClick={handleCopyAlertSqlOnly}
                        className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-[11px] font-semibold flex items-center space-x-1 transition-all"
                      >
                        {copiedAlertSql ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-amber-300" />
                        )}
                        <span>{copiedAlertSql ? '복사됨!' : 'alert_notifications SQL 복사'}</span>
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    다음 테이블이 Supabase 원격 DB에 아직 생성되지 않았습니다:{' '}
                    <code className="text-amber-300 font-mono bg-slate-950 px-1.5 py-0.5 rounded text-[11px]">
                      {missingTables.map((m) => m.name).join(', ')}
                    </code>
                    <br />
                    상단의 <b>[📜 테이블 생성 DDL]</b> 탭에서 SQL을 복사하여 Supabase Dashboard &gt; SQL Editor에 실행하시면 원격 영구 저장이 즉시 활성화됩니다.
                  </p>
                </div>
              )}

              {/* Table List Grid */}
              <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
                <div className="p-3 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between text-[11px] font-semibold text-slate-300">
                  <span>모니터링 테이블 목록 ({tables.length}개)</span>
                  <span>상태 / 레코드 수 / 지연시간</span>
                </div>
                <div className="divide-y divide-slate-800/60 max-h-72 overflow-y-auto">
                  {tables.length === 0 && isLoading ? (
                    <div className="p-8 text-center text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-cyan-400" />
                      <span>테이블 상태 확인 중...</span>
                    </div>
                  ) : tables.length === 0 ? (
                    <div className="p-6 text-center text-slate-500">
                      테이블 진단 정보를 불러올 수 없습니다.
                    </div>
                  ) : (
                    tables.map((t) => (
                      <div
                        key={t.name}
                        className="p-3 flex items-center justify-between hover:bg-slate-900/30 transition-colors"
                      >
                        <div className="flex items-center space-x-2.5">
                          {t.status === 'RLS_BLOCKED' ? (
                            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                          ) : t.exists ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          ) : (
                            <XCircle className="w-4 h-4 text-amber-400 shrink-0" />
                          )}
                          <span className="font-mono text-xs text-slate-200 font-semibold">
                            {t.name}
                          </span>
                          {t.name === 'alert_notifications' && (
                            <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                              NEW
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-3">
                          {t.latencyMs != null && t.exists && (
                            <span className="text-[10px] text-slate-500 font-mono">
                              {t.latencyMs}ms
                            </span>
                          )}
                          {t.status === 'RLS_BLOCKED' ? (
                            <span className="text-[10px] text-rose-300 bg-rose-950/60 px-2 py-0.5 rounded border border-rose-500/40">
                              RLS 쓰기 차단 (42501)
                            </span>
                          ) : t.exists ? (
                            <span className="text-[11px] text-slate-300 font-mono">
                              <b className="text-emerald-300 font-bold">{t.count.toLocaleString()}</b>
                              <span className="text-slate-500">개 행</span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-500/30">
                              미생성
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'sql' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-200 text-xs">
                    Supabase PostgreSQL 전체 스키마 DDL (11개 테이블)
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Supabase Dashboard &gt; SQL Editor에 복사하여 붙여넣고 [Run]을 누르시면 모든 테이블, 인덱스, RLS 해제가 일괄 적용됩니다.
                  </p>
                </div>
                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    onClick={handleCopyRlsFixSql}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center space-x-1.5 transition-all"
                  >
                    {copiedRlsSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>RLS 해제 SQL만 복사</span>
                  </button>
                  {missingTables.some((m) => m.name === 'alert_notifications') && (
                    <button
                      onClick={handleCopyAlertSqlOnly}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center space-x-1.5 transition-all"
                    >
                      {copiedAlertSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>alert_notifications만 복사</span>
                    </button>
                  )}
                  <button
                    onClick={handleCopyFullSql}
                    className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md shadow-cyan-600/30 flex items-center space-x-1.5 transition-all"
                  >
                    {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedSql ? '복사 완료!' : '전체 SQL 복사'}</span>
                  </button>
                </div>
              </div>

              <div className="relative rounded-xl bg-slate-950 border border-slate-800 p-3 font-mono text-[11px] text-cyan-300/90 overflow-x-auto max-h-96 whitespace-pre-wrap selection:bg-cyan-500">
                {schemaSql || 'SQL 스키마 로딩 중...'}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500 font-mono truncate max-w-xs sm:max-w-md">
            Host: {maskedHost}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};
