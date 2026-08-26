import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Database,
  ExternalLink,
  Layers,
  Loader2,
  RefreshCw,
  Server,
  ShieldCheck,
  Sparkles,
  Terminal,
  Trash2,
  X,
} from 'lucide-react';
import { dbClient } from '../db/supabaseClient';
import { runDatabaseDiagnostics } from '../db/diagnostics';
import { FULL_SCHEMA_SQL } from '../db/schemaSql';

interface TableStatusInfo {
  name: string;
  exists: boolean;
  count: number;
  error?: string;
}

interface DiagnosticReport {
  timestamp: string;
  connection: {
    connected: boolean;
    storageMode: 'SUPABASE' | 'IN_MEMORY';
    url: string | null;
    pingLatencyMs: number;
  };
  summary: {
    totalTablesChecked: number;
    initializedTablesCount: number;
    missingTablesCount: number;
    totalRecordsAcrossTables: number;
    persistenceHealth: 'FULLY_INITIALIZED' | 'PARTIALLY_INITIALIZED' | 'IN_MEMORY_ONLY' | 'ERROR';
    recommendation: string;
  };
  tables: Record<
    string,
    {
      tableName: string;
      initialized: boolean;
      recordCount: number;
      storageMode: 'SUPABASE' | 'IN_MEMORY';
      latencyMs: number;
      status: 'HEALTHY' | 'EMPTY' | 'NOT_INITIALIZED' | 'ERROR';
      sampleInfo?: {
        idOrKey?: string;
        updatedAt?: string;
      };
      error?: string;
    }
  >;
}

interface DatabaseSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshAllData: () => Promise<void>;
  onShowToast: (msg: string) => void;
}

export const DatabaseSettingsModal: React.FC<DatabaseSettingsModalProps> = ({
  isOpen,
  onClose,
  onRefreshAllData,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<'connect' | 'schema' | 'seed' | 'diagnostics'>('connect');
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [dbStatus, setDbStatus] = useState<any>(null);
  const [tables, setTables] = useState<Record<string, TableStatusInfo>>({});
  const [diagnostics, setDiagnostics] = useState<DiagnosticReport | null>(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [schemaSql, setSchemaSql] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const handleClearData = async () => {
    if (!confirm('⚠️ 경고: 데이터베이스의 모든 레코드(워치리스트, 자산, 시그널, 퀀트 평가, 스캔 로그)를 완전히 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      return;
    }
    setIsClearing(true);
    try {
      let clearSuccess = false;
      let errMsg = '';

      try {
        const res = await fetch('/api/v8/system/db/clear', { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          if (data?.success) {
            clearSuccess = true;
            if (data.tables) setTables(data.tables);
          } else {
            errMsg = data?.error;
          }
        }
      } catch {}

      // Always clear client-side memory and caches
      const localClear = await dbClient.clearAllData();
      if (!clearSuccess && localClear.success) {
        clearSuccess = true;
        const freshTables = await dbClient.checkTableStatus();
        setTables(freshTables);
      }

      if (clearSuccess) {
        onShowToast('데이터베이스의 모든 레코드가 성공적으로 삭제/초기화되었습니다.');
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem('quant_watchlist_cache_v8');
          window.localStorage.removeItem('quant_evaluations_cache_v8');
          window.localStorage.removeItem('v8_quant_db_snapshot_v1');
          window.localStorage.setItem('quant_db_cleared_v8', 'true');
        }
        await fetchDbStatus();
        await runDiagnostics();
        await onRefreshAllData();
      } else {
        onShowToast(`초기화 실패: ${errMsg || '데이터 삭제 중 오류가 발생했습니다.'}`);
      }
    } catch (err: any) {
      onShowToast(`초기화 실패: ${err.message}`);
    } finally {
      setIsClearing(false);
    }
  };
  const [copiedSql, setCopiedSql] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchDbStatus = async () => {
    setIsLoading(true);
    try {
      let loadedStatus = null;
      let loadedTables = null;
      let loadedUrl = '';

      try {
        const res = await fetch('/api/v8/system/db/status');
        if (res.ok) {
          const data = await res.json();
          if (data?.success) {
            loadedStatus = data.status;
            loadedUrl = data.config?.url || '';
            loadedTables = data.tables;
          }
        }
      } catch (e) {
        console.warn('API /api/v8/system/db/status failed, using local dbClient fallback', e);
      }

      if (!loadedStatus) {
        loadedStatus = dbClient.getStatus();
        const cfg = dbClient.getConfig();
        loadedUrl = cfg.url || '';
        loadedTables = await dbClient.checkTableStatus();
      }

      setDbStatus(loadedStatus);
      if (loadedUrl) {
        setSupabaseUrl(loadedUrl);
      } else {
        setSupabaseUrl('https://xuzctskacealvvwlmica.supabase.co');
      }
      if (loadedTables) {
        setTables(loadedTables);
      }

      // Schema SQL
      try {
        const sqlRes = await fetch('/api/v8/system/db/schema-sql');
        if (sqlRes.ok) {
          const sqlData = await sqlRes.json();
          if (sqlData?.success && sqlData.sql) {
            setSchemaSql(sqlData.sql);
          } else {
            setSchemaSql(FULL_SCHEMA_SQL);
          }
        } else {
          setSchemaSql(FULL_SCHEMA_SQL);
        }
      } catch {
        setSchemaSql(FULL_SCHEMA_SQL);
      }
    } catch (err: any) {
      console.error('Failed to load DB status', err);
      setSchemaSql(FULL_SCHEMA_SQL);
    } finally {
      setIsLoading(false);
    }
  };

  const runDiagnostics = async () => {
    setIsDiagnosing(true);
    try {
      let diagData: any = null;
      try {
        const res = await fetch('/api/v8/system/db/diagnostics');
        if (res.ok) {
          const data = await res.json();
          if (data?.success) {
            diagData = data;
          }
        }
      } catch (e) {
        console.warn('API /api/v8/system/db/diagnostics fetch failed, falling back to local runner', e);
      }

      if (!diagData) {
        diagData = await runDatabaseDiagnostics();
      }
      setDiagnostics(diagData);
    } catch (err: any) {
      console.error('Diagnostics failed', err);
      try {
        const fallbackDiag = await runDatabaseDiagnostics();
        setDiagnostics(fallbackDiag);
      } catch (e) {
        console.error('Local fallback diagnostics also failed', e);
      }
    } finally {
      setIsDiagnosing(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDbStatus();
      runDiagnostics();
      setConnectionMessage(null);
    }
  }, [isOpen]);

  const handleSaveConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = supabaseUrl.trim();
    const cleanKey = supabaseKey.trim();

    if (!cleanUrl || !cleanKey) {
      setConnectionMessage({ type: 'error', text: 'Supabase URL과 API Key를 모두 입력해야 합니다.' });
      return;
    }

    setIsSaving(true);
    setConnectionMessage(null);

    try {
      let success = false;
      let tablesResult: any = null;
      let errorMsg = '';

      try {
        const res = await fetch('/api/v8/system/db/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: cleanUrl, key: cleanKey }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.success) {
            success = true;
            tablesResult = data.tables;
          } else {
            errorMsg = data?.error || '연결 실패';
          }
        }
      } catch {
        // Fallback to local DB client direct connection
      }

      if (!success) {
        const clientRes = await dbClient.configureSupabase(cleanUrl, cleanKey);
        if (clientRes.success) {
          success = true;
          tablesResult = clientRes.tables;
        } else {
          errorMsg = clientRes.error || errorMsg || 'Supabase 연결에 실패했습니다.';
        }
      }

      if (success) {
        setConnectionMessage({ type: 'success', text: 'Supabase DB가 성공적으로 연결되었습니다!' });
        onShowToast('Supabase 데이터베이스가 연결되었습니다.');
        setDbStatus(dbClient.getStatus());
        if (tablesResult) setTables(tablesResult);
        await runDiagnostics();
        await onRefreshAllData();
      } else {
        setConnectionMessage({ type: 'error', text: errorMsg });
      }
    } catch (err: any) {
      setConnectionMessage({ type: 'error', text: err.message || '네트워크 요청 중 오류가 발생했습니다.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisconnect = async () => {
    setIsSaving(true);
    try {
      try {
        await fetch('/api/v8/system/db/disconnect', { method: 'POST' });
      } catch {}

      dbClient.disconnectSupabase();
      setConnectionMessage({ type: 'success', text: '로컬 영속 모드로 전환되었습니다.' });
      onShowToast('로컬 메모리 영속 모드로 전환되었습니다.');
      setSupabaseUrl('');
      setSupabaseKey('');
      setDbStatus(dbClient.getStatus());
      await fetchDbStatus();
      await runDiagnostics();
      await onRefreshAllData();
    } catch (err: any) {
      setConnectionMessage({ type: 'error', text: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSeedData = async () => {
    setIsSeeding(true);
    try {
      let seedSuccess = false;
      let seededCount = 0;
      let errMsg = '';

      try {
        const res = await fetch('/api/v8/system/db/seed', { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          if (data?.success) {
            seedSuccess = true;
            seededCount = data.seededCount || 0;
            if (data.tables) setTables(data.tables);
          } else {
            errMsg = data?.error;
          }
        }
      } catch {}

      if (!seedSuccess) {
        const localSeed = await dbClient.seedToActiveDb();
        if (localSeed.success) {
          seedSuccess = true;
          seededCount = localSeed.seededCount;
          const freshTables = await dbClient.checkTableStatus();
          setTables(freshTables);
        } else {
          errMsg = localSeed.error || errMsg;
        }
      }

      if (seedSuccess) {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem('quant_db_cleared_v8');
        }
        onShowToast(`기본 유니버스 및 시그널 데이터(${seededCount}개)가 성공적으로 주입되었습니다.`);
        await fetchDbStatus();
        await runDiagnostics();
        await onRefreshAllData();
      } else {
        onShowToast(`초기화 실패: ${errMsg || '데이터 주입 중 오류가 발생했습니다.'}`);
      }
    } catch (err: any) {
      onShowToast(`초기화 실패: ${err.message}`);
    } finally {
      setIsSeeding(false);
    }
  };

  const handleCopySql = () => {
    const textToCopy = schemaSql || FULL_SCHEMA_SQL;
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    setCopiedSql(true);
    onShowToast('전체 SQL 마이그레이션 스크립트가 클립보드에 복사되었습니다.');
    setTimeout(() => setCopiedSql(false), 2500);
  };

  if (!isOpen) return null;

  const isConnected = dbStatus?.connected === true;
  const existingTablesCount = Object.values(tables as Record<string, TableStatusInfo>).filter((t: TableStatusInfo) => t.exists).length;
  const totalTablesCount = Object.keys(tables).length || 10;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2.5 sm:p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl w-full max-w-3xl max-h-[90dvh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-800 bg-slate-950/50 shrink-0">
          <div className="flex items-center space-x-2.5 sm:space-x-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-cyan-600/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30 shrink-0">
              <Database className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5 sm:space-x-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-bold text-slate-100">데이터베이스 설정 & 진단</h3>
                <span
                  className={`px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-semibold rounded-full border ${
                    isConnected
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  }`}
                >
                  {isConnected ? 'Supabase 연결됨' : '로컬 영속 모드'}
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-400 font-mono mt-0.5 hidden sm:block">
                PostgreSQL/Supabase 10개 테이블 초기화 및 영속성 무결성 진단
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors shrink-0 ml-2"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center space-x-1 px-3 sm:px-6 pt-2 sm:pt-3 border-b border-slate-800/80 bg-slate-900/40 text-xs overflow-x-auto whitespace-nowrap no-scrollbar shrink-0">
          <button
            onClick={() => setActiveTab('connect')}
            className={`flex items-center space-x-1.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-t-xl font-medium transition-all ${
              activeTab === 'connect'
                ? 'bg-slate-800 text-cyan-400 border-t-2 border-cyan-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>1. DB 연결 설정</span>
          </button>

          <button
            onClick={() => setActiveTab('schema')}
            className={`flex items-center space-x-1.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-t-xl font-medium transition-all ${
              activeTab === 'schema'
                ? 'bg-slate-800 text-cyan-400 border-t-2 border-cyan-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>2. 테이블 DDL ({existingTablesCount}/{totalTablesCount})</span>
          </button>

          <button
            onClick={() => setActiveTab('diagnostics')}
            className={`flex items-center space-x-1.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-t-xl font-medium transition-all ${
              activeTab === 'diagnostics'
                ? 'bg-slate-800 text-cyan-400 border-t-2 border-cyan-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>3. 테이블 진단 & 검증</span>
          </button>

          <button
            onClick={() => setActiveTab('seed')}
            className={`flex items-center space-x-1.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-t-xl font-medium transition-all ${
              activeTab === 'seed'
                ? 'bg-slate-800 text-cyan-400 border-t-2 border-cyan-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>4. 기본 데이터 주입</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-4 sm:space-y-6">
          {/* TAB 1: CONNECTION CONFIG */}
          {activeTab === 'connect' && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-slate-300">현재 활성 상태</span>
                    {dbStatus?.configSource === 'UI_CONFIGURED' ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        화면 설정값 우선 적용 중
                      </span>
                    ) : dbStatus?.configSource === 'ENV_FALLBACK' ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        환경변수(.env) 기본값 적용
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        로컬 지속성 모드
                      </span>
                    )}
                  </div>
                  <button
                    onClick={fetchDbStatus}
                    className="flex items-center space-x-1 text-xs text-cyan-400 hover:underline"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                    <span>새로고침</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">엔진 모드</span>
                    <strong className={isConnected ? 'text-emerald-400' : 'text-amber-400'}>
                      {isConnected ? 'SUPABASE_PROD' : 'LOCAL_IN_MEMORY'}
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">관심종목 수</span>
                    <strong className="text-slate-200">{dbStatus?.watchlistCount || 0}개</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">평가 종목</span>
                    <strong className="text-cyan-400">{dbStatus?.evaluationsCount || 0}개</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">시그널 원장</span>
                    <strong className="text-purple-400">{dbStatus?.signalsCount || 0}건</strong>
                  </div>
                </div>
              </div>

              {/* Priority Notice Banner */}
              <div className="p-3.5 rounded-xl bg-cyan-950/30 border border-cyan-500/30 text-xs flex items-start space-x-2.5">
                <Database className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <div className="space-y-1 text-slate-300">
                  <p className="font-semibold text-cyan-300">
                    화면(UI) 설정값 최우선 적용 원칙
                  </p>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    환경 변수(<code className="text-slate-300 font-mono">.env</code>)와 화면 설정값이 상이할 경우,
                    <strong className="text-cyan-300"> 화면에서 입력 및 저장한 Supabase URL 및 Key가 시스템 전체에 최우선 적용</strong>되며
                    영구 파일(<code className="text-slate-300 font-mono">.db_config.json</code>)에 동기화되어 재부팅 후에도 지속됩니다.
                  </p>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleSaveConnection} className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-300">
                    Supabase Project URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://xyzproject.supabase.co"
                    value={supabaseUrl}
                    onChange={(e) => setSupabaseUrl(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono"
                  />
                  <span className="text-[11px] text-slate-500 block">
                    Supabase Dashboard &gt; Project Settings &gt; API &gt; Project URL
                  </span>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-300">
                    Supabase API Key (service_role 또는 anon key)
                  </label>
                  <input
                    type="password"
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    value={supabaseKey}
                    onChange={(e) => setSupabaseKey(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono"
                  />
                  <span className="text-[11px] text-slate-500 block">
                    서버 측 직접 저장을 위해 <code>service_role</code> 키 또는 RLS가 비활성화된 <code>anon</code> 키 권장
                  </span>
                </div>

                {connectionMessage && (
                  <div
                    className={`p-3 rounded-xl border text-xs flex items-center space-x-2 ${
                      connectionMessage.type === 'success'
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                    }`}
                  >
                    {connectionMessage.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <span>{connectionMessage.text}</span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  {isConnected ? (
                    <button
                      type="button"
                      onClick={handleDisconnect}
                      disabled={isSaving}
                      className="px-3.5 py-2 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 text-xs font-semibold transition-colors"
                    >
                      연결 해제 (로컬 모드로 복구)
                    </button>
                  ) : (
                    <div></div>
                  )}

                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-lg shadow-cyan-600/30 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    <span>연결 테스트 및 저장</span>
                  </button>
                </div>
              </form>

              {/* Data Management & Complete Reset Box */}
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-xs font-bold text-slate-200">
                    <Database className="w-4 h-4 text-cyan-400" />
                    <span>데이터베이스 레코드 관리 및 전체 초기화</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  테이블 내 모든 종목, 워치리스트, 실시간 퀀트 평가, 과거 시그널 및 스캔 로그를 초기화하거나 기본 테스트 데이터를 다시 주입할 수 있습니다.
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleClearData}
                    disabled={isClearing || isSeeding}
                    className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-rose-500/10 text-rose-300 border border-rose-500/30 hover:bg-rose-500/20 text-xs font-bold transition-all disabled:opacity-50"
                  >
                    {isClearing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    <span>DB 전체 레코드 삭제 (완전 초기화)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSeedData}
                    disabled={isClearing || isSeeding}
                    className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-xs font-semibold transition-all disabled:opacity-50"
                  >
                    {isSeeding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    <span>기본 데이터 주입 (Seed Data)</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SCHEMA & TABLES */}
          {activeTab === 'schema' && (
            <div className="space-y-6">
              {/* Instructions */}
              <div className="p-4 rounded-2xl bg-cyan-950/30 border border-cyan-500/30 text-xs space-y-2">
                <div className="flex items-center space-x-2 text-cyan-300 font-bold">
                  <ShieldCheck className="w-4 h-4" />
                  <span>새 데이터베이스 테이블 생성 가이드</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Supabase 대시보드(<strong>SQL Editor</strong>)로 이동하여 아래의 SQL DDL 스크립트를 붙여넣고 <strong>[Run]</strong>을 누르면 10개의 테이블과 인덱스가 즉시 생성됩니다.
                </p>
              </div>

              {/* Table Status Grid */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-300">테이블 생성 상태 ({existingTablesCount}/{totalTablesCount})</span>
                  <button
                    onClick={fetchDbStatus}
                    className="text-cyan-400 hover:underline flex items-center space-x-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>상태 다시 확인</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                  {Object.entries(tables).map(([tblName, info]) => {
                    const status = info as TableStatusInfo;
                    return (
                      <div
                        key={tblName}
                        className={`p-2.5 rounded-xl border flex items-center justify-between ${
                          status.exists
                            ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                            : 'bg-slate-950/80 border-slate-800 text-slate-400'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          {status.exists ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <div className="w-4 h-4 rounded-full border border-slate-600"></div>
                          )}
                          <span className="font-bold">{tblName}</span>
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {status.exists ? `${status.count} rows` : '미생성'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SQL Viewer & Copy */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300">전체 PostgreSQL DDL 스크립트</span>
                  <button
                    onClick={handleCopySql}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-semibold border border-slate-700 transition-colors"
                  >
                    {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedSql ? '복사 완료!' : 'SQL 전체 복사'}</span>
                  </button>
                </div>

                <pre className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-slate-300 text-[11px] font-mono overflow-x-auto max-h-56 leading-relaxed select-all">
                  {schemaSql}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 3: DIAGNOSTICS & VERIFICATION */}
          {activeTab === 'diagnostics' && (
            <div className="space-y-6">
              {/* Header Summary */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-cyan-400 font-bold text-xs">
                    <Activity className="w-4 h-4" />
                    <span>Supabase 영속성 및 레코드 무결성 진단 도구</span>
                  </div>
                  <button
                    onClick={runDiagnostics}
                    disabled={isDiagnosing}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-cyan-600/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-600/30 text-xs font-semibold transition-all disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isDiagnosing ? 'animate-spin' : ''}`} />
                    <span>진단 재실행</span>
                  </button>
                </div>

                {diagnostics && (
                  <div className="space-y-3 pt-1">
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">영속성 종합 판정:</span>
                        <span
                          className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${
                            diagnostics.summary.persistenceHealth === 'FULLY_INITIALIZED'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : diagnostics.summary.persistenceHealth === 'PARTIALLY_INITIALIZED'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {diagnostics.summary.persistenceHealth}
                        </span>
                      </div>
                      <p className="text-slate-300 text-xs leading-relaxed font-sans">
                        {diagnostics.summary.recommendation}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                      <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                        <span className="text-slate-500 text-[10px] block">저장 모드</span>
                        <strong className={diagnostics.connection.connected ? 'text-emerald-400' : 'text-amber-400'}>
                          {diagnostics.connection.storageMode}
                        </strong>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                        <span className="text-slate-500 text-[10px] block">핑 지연시간</span>
                        <strong className="text-cyan-400">{diagnostics.connection.pingLatencyMs} ms</strong>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                        <span className="text-slate-500 text-[10px] block">초기화 테이블</span>
                        <strong className="text-emerald-400">
                          {diagnostics.summary.initializedTablesCount} / {diagnostics.summary.totalTablesChecked}
                        </strong>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                        <span className="text-slate-500 text-[10px] block">총 레코드 수</span>
                        <strong className="text-purple-400">{diagnostics.summary.totalRecordsAcrossTables} 건</strong>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Table Breakdown */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-300 block">테이블별 세부 검증 결과</span>
                {diagnostics && (
                  <div className="space-y-1.5 font-mono text-xs">
                    {Object.values(diagnostics.tables).map((t: any) => (
                      <div
                        key={t.tableName}
                        className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                          t.initialized && t.storageMode === 'SUPABASE'
                            ? 'bg-emerald-950/20 border-emerald-500/20 text-slate-200'
                            : t.initialized
                            ? 'bg-slate-950/60 border-slate-800 text-slate-300'
                            : 'bg-rose-950/20 border-rose-500/20 text-rose-300'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          {t.initialized ? (
                            <CheckCircle2
                              className={`w-4 h-4 shrink-0 ${
                                t.storageMode === 'SUPABASE' ? 'text-emerald-400' : 'text-amber-400'
                              }`}
                            />
                          ) : (
                            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                          )}
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-slate-100">{t.tableName}</span>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                                  t.storageMode === 'SUPABASE'
                                    ? 'bg-emerald-500/10 text-emerald-400'
                                    : 'bg-amber-500/10 text-amber-400'
                                }`}
                              >
                                {t.storageMode}
                              </span>
                            </div>
                            {t.error ? (
                              <span className="text-[10px] text-rose-400 block mt-0.5">{t.error}</span>
                            ) : t.sampleInfo?.updatedAt ? (
                              <span className="text-[10px] text-slate-500 block mt-0.5">
                                최근 갱신: {new Date(t.sampleInfo.updatedAt).toLocaleTimeString()}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="font-bold text-cyan-400 text-sm">{t.recordCount}</span>
                          <span className="text-slate-500 text-[11px] ml-1">rows</span>
                          <span className="text-[10px] text-slate-500 block">{t.latencyMs}ms</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: SEED DATA */}
          {activeTab === 'seed' && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center space-x-2 text-cyan-400 font-bold text-xs">
                  <Sparkles className="w-4 h-4" />
                  <span>초기 유니버스 및 시그널 데이터 주입</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  새로 생성한 데이터베이스에 기본 워치리스트(NVDA, AAPL, MSFT, TSLA, SPY, QQQ, JNJ, SCHD 등)와 과거 시그널 스냅샷을 주입합니다.
                </p>
                <div className="pt-2">
                  <button
                    onClick={handleSeedData}
                    disabled={isSeeding}
                    className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-lg shadow-cyan-600/30 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isSeeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    <span>기본 퀀트 유니버스 &amp; 시그널 주입 (Seed Now)</span>
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2 text-xs text-slate-400">
                <span className="font-semibold text-slate-300 block">💡 주입되는 기본 데이터 내역</span>
                <ul className="list-disc list-inside space-y-1 font-mono text-[11px]">
                  <li>8개 핵심 마스터 자산 (NVDA, AAPL, MSFT, SPY, QQQ, TSLA, JNJ, SCHD)</li>
                  <li>7개 자산분류 프로파일 (대형 성장주, 지수 ETF, 배당 방어주 등)</li>
                  <li>최근 60일치 과거 시그널 및 5D/10D/20D 사후 수익률 데이터</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs text-slate-400 font-mono">
            <Server className="w-3.5 h-3.5 text-cyan-400" />
            <span>Target: PostgreSQL / Supabase</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

