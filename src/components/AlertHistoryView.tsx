import React, { useState, useEffect } from 'react';
import {
  Bell,
  CheckCircle2,
  Clock,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Filter,
  RefreshCw,
  Search,
  Send,
  Shield,
  ShieldAlert,
  Trash2,
  Zap,
  Layers,
  AlertCircle,
  Info,
  PlusCircle,
} from 'lucide-react';
import { AlertNotificationLog, AlertStrategyType, AlertDeliveryStatus, MarketRegion } from '../types/v8';
import { ALERT_NOTIFICATIONS_RLS_FIX_SQL } from './DatabaseHealthModal';

interface AlertHistoryViewProps {
  onSelectTicker?: (ticker: string, tab?: string) => void;
  onTriggerScan?: () => void;
  initialTickerFilter?: string;
  refreshKey?: number;
  activeMarket?: MarketRegion;
}

export const AlertHistoryView: React.FC<AlertHistoryViewProps> = ({
  onSelectTicker,
  onTriggerScan,
  initialTickerFilter = '',
  refreshKey,
  activeMarket = 'US',
}) => {
  const [alerts, setAlerts] = useState<AlertNotificationLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState(initialTickerFilter);
  const [selectedStrategy, setSelectedStrategy] = useState<string>('ALL');
  const [selectedDelivery, setSelectedDelivery] = useState<string>('ALL');
  const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null);
  const [copiedAlertId, setCopiedAlertId] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [isRlsBlocked, setIsRlsBlocked] = useState(false);
  const [copiedRlsSql, setCopiedRlsSql] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCreatingTestAlert, setIsCreatingTestAlert] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>('');

  const fetchAlerts = async () => {
    setIsLoading(true);
    try {
      const url = activeMarket ? `/api/v8/alerts?market=${activeMarket}` : '/api/v8/alerts';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success && Array.isArray(data.alerts)) {
        setAlerts(data.alerts);
        setLastRefreshedAt(
          new Intl.DateTimeFormat('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          }).format(new Date())
        );
        if (data.rlsBlocked != null) {
          setIsRlsBlocked(Boolean(data.rlsBlocked));
        }
      }

      // Check diagnostics to ensure accurate RLS status
      try {
        const diagRes = await fetch('/api/v8/system/db/diagnostics');
        if (diagRes.ok) {
          const diagData = await diagRes.json();
          if (diagData?.tables?.alert_notifications?.status === 'RLS_BLOCKED') {
            setIsRlsBlocked(true);
          } else if (diagData?.tables?.alert_notifications?.status === 'HEALTHY') {
            setIsRlsBlocked(false);
          }
        }
      } catch {
        // Ignore diagnostic probe error
      }
    } catch (err) {
      console.error('Failed to load alert history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [refreshKey, activeMarket]);

  useEffect(() => {
    const handleGlobalAlertUpdate = () => {
      fetchAlerts();
    };

    window.addEventListener('quant-alerts-updated', handleGlobalAlertUpdate);
    window.addEventListener('quant-scan-completed', handleGlobalAlertUpdate);

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        fetchAlerts();
      }
    };
    window.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      window.removeEventListener('quant-alerts-updated', handleGlobalAlertUpdate);
      window.removeEventListener('quant-scan-completed', handleGlobalAlertUpdate);
      window.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, []);

  const handleCopyRlsSql = () => {
    navigator.clipboard.writeText(ALERT_NOTIFICATIONS_RLS_FIX_SQL);
    setCopiedRlsSql(true);
    setTimeout(() => setCopiedRlsSql(false), 2500);
  };

  const handleSyncToDb = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/v8/alerts/sync', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setIsRlsBlocked(false);
        await fetchAlerts();
      } else if (data.error?.includes('42501') || data.error?.includes('RLS')) {
        setIsRlsBlocked(true);
      }
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCreateTestAlert = async () => {
    setIsCreatingTestAlert(true);
    try {
      const res = await fetch('/api/v8/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: '[수동 검증] 알람 발송 및 실시간 DB 기록 확인',
          timestamp: new Date().toISOString(),
          strategy_type: 'STRATEGY_B',
          tickers: ['NVDA', 'AAPL'],
          signals_count: 2,
          delivery_status: 'LOCAL_LOGGED',
          delivery_target: '로컬 시스템 즉시 기록',
          message_preview: '[전략 B 우량주] NVDA (이격도 97.2%), AAPL (이격도 98.1%)',
          message_body: '알림 발송 이력 시스템이 정상적으로 새로운 알람을 감지 및 기록하였습니다.',
          details: {
            strategy_b_tickers: [
              { ticker: 'NVDA', company_name: 'NVIDIA Corp', rsi14: 38.5, disparity20: 97.2 },
              { ticker: 'AAPL', company_name: 'Apple Inc', rsi14: 41.2, disparity20: 98.1 },
            ],
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchAlerts();
      }
    } catch (err) {
      console.error('Failed to create test alert:', err);
    } finally {
      setIsCreatingTestAlert(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAlertId(id);
    setTimeout(() => setCopiedAlertId(null), 2000);
  };

  const [isConfirmingClear, setIsConfirmingClear] = useState(false);

  const handleClearHistory = async () => {
    setIsClearing(true);
    try {
      const res = await fetch('/api/v8/alerts', { method: 'DELETE' });
      if (res.ok) {
        setAlerts([]);
      }
    } catch (err) {
      console.error('Failed to clear alerts:', err);
    } finally {
      setIsClearing(false);
      setIsConfirmingClear(false);
    }
  };

  // Filter alerts
  const filteredAlerts = alerts.filter((alert) => {
    if (selectedStrategy === 'STRATEGY_B') {
      const hasStrategyB =
        alert.strategy_type === 'STRATEGY_B' ||
        (alert.details?.strategy_b_tickers && alert.details.strategy_b_tickers.length > 0);
      if (!hasStrategyB) return false;
    } else if (selectedStrategy === 'STRATEGY_A') {
      const hasStrategyA =
        alert.strategy_type === 'STRATEGY_A' ||
        (alert.details?.strategy_a_tickers && alert.details.strategy_a_tickers.length > 0);
      if (!hasStrategyA) return false;
    } else if (selectedStrategy === 'DUAL_SCAN_REPORT') {
      if (alert.strategy_type !== 'DUAL_SCAN_REPORT') return false;
    } else if (selectedStrategy !== 'ALL' && alert.strategy_type !== selectedStrategy) {
      return false;
    }

    if (selectedDelivery !== 'ALL' && alert.delivery_status !== selectedDelivery) return false;

    if (searchTerm.trim()) {
      const term = searchTerm.toUpperCase().trim();
      const matchTicker = alert.tickers.some((t) => t.toUpperCase().includes(term));
      const matchTitle = alert.title.toUpperCase().includes(term);
      const matchBody = alert.message_body.toUpperCase().includes(term);
      if (!matchTicker && !matchTitle && !matchBody) return false;
    }

    return true;
  });

  // Calculate statistics
  const totalCount = alerts.length;

  // Strategy B alerts and distinct captured tickers
  const strategyBAlerts = alerts.filter(
    (a) =>
      a.strategy_type === 'STRATEGY_B' ||
      (a.details?.strategy_b_tickers && a.details.strategy_b_tickers.length > 0)
  );
  const strategyBCount = strategyBAlerts.length;
  const strategyBTickersSet = new Set<string>();
  strategyBAlerts.forEach((a) => {
    if (a.details?.strategy_b_tickers && a.details.strategy_b_tickers.length > 0) {
      a.details.strategy_b_tickers.forEach((b) => strategyBTickersSet.add(b.ticker.toUpperCase()));
    } else if (a.strategy_type === 'STRATEGY_B') {
      a.tickers.forEach((t) => strategyBTickersSet.add(t.toUpperCase()));
    }
  });
  const strategyBUniqueTickers = Array.from(strategyBTickersSet);

  // Strategy A alerts and distinct captured tickers
  const strategyAAlerts = alerts.filter(
    (a) =>
      a.strategy_type === 'STRATEGY_A' ||
      (a.details?.strategy_a_tickers && a.details.strategy_a_tickers.length > 0)
  );
  const strategyACount = strategyAAlerts.length;
  const strategyATickersSet = new Set<string>();
  strategyAAlerts.forEach((a) => {
    if (a.details?.strategy_a_tickers && a.details.strategy_a_tickers.length > 0) {
      a.details.strategy_a_tickers.forEach((item) => strategyATickersSet.add(item.ticker.toUpperCase()));
    } else if (a.strategy_type === 'STRATEGY_A') {
      a.tickers.forEach((t) => strategyATickersSet.add(t.toUpperCase()));
    }
  });
  const strategyAUniqueTickers = Array.from(strategyATickersSet);

  const sentSuccessCount = alerts.filter((a) => a.delivery_status === 'SENT').length;
  const deliveryRate = totalCount > 0 ? Math.round((sentSuccessCount / totalCount) * 100) : 0;

  const getStrategyBadge = (type: AlertStrategyType) => {
    switch (type) {
      case 'STRATEGY_B':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <Shield className="w-3 h-3 text-emerald-400" />
            <span>전략 B (우량주 눌림추매)</span>
          </span>
        );
      case 'STRATEGY_A':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30">
            <Zap className="w-3 h-3 text-blue-400" />
            <span>전략 A (모멘텀 돌파)</span>
          </span>
        );
      case 'DUAL_SCAN_REPORT':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/30">
            <Layers className="w-3 h-3 text-purple-400" />
            <span>듀얼 종합 리포트 (A+B)</span>
          </span>
        );
      case 'MANUAL_ALERT':
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <Bell className="w-3 h-3 text-amber-400" />
            <span>테스트 / 수동 알림</span>
          </span>
        );
    }
  };

  const getDeliveryStatusBadge = (status: AlertDeliveryStatus) => {
    switch (status) {
      case 'SENT':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            <span>텔레그램 전송 완료</span>
          </span>
        );
      case 'PREVIEW_ONLY':
      case 'LOCAL_LOGGED':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
            <Clock className="w-3 h-3 text-slate-400" />
            <span>로컬 시스템 기록</span>
          </span>
        );
      case 'FAILED':
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertCircle className="w-3 h-3" />
            <span>전송 실패</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Header Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 sm:p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
            <span className="flex items-center space-x-1">
              <span>총 알림 발송 ({activeMarket === 'KR' ? '국내장' : '미국장'})</span>
            </span>
            <Bell className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white font-mono">{totalCount}건</div>
          <div className="text-[11px] text-slate-500 mt-1">{activeMarket === 'KR' ? 'KOSPI / KOSDAQ 전송 누적' : 'NYSE / NASDAQ 전송 누적'}</div>
        </div>

        <div className="bg-slate-900/90 border border-emerald-900/40 rounded-xl p-3.5 sm:p-4 shadow-sm">
          <div className="flex items-center justify-between text-emerald-400 text-xs mb-1.5">
            <span className="font-medium">전략 B 우량주 눌림목 알림</span>
            <Shield className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline space-x-1.5">
            <span className="text-xl sm:text-2xl font-bold text-emerald-400 font-mono">
              {strategyBCount}회 발송
            </span>
            <span className="text-xs text-emerald-300/80 font-medium">
              ({strategyBUniqueTickers.length}개 종목)
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
            <span>포착 우량주:</span>
            <span className="text-emerald-300 font-mono font-semibold truncate max-w-[120px] text-right" title={strategyBUniqueTickers.join(', ')}>
              {strategyBUniqueTickers.length > 0 ? strategyBUniqueTickers.join(', ') : '없음'}
            </span>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-blue-900/40 rounded-xl p-3.5 sm:p-4 shadow-sm">
          <div className="flex items-center justify-between text-blue-400 text-xs mb-1.5">
            <span className="font-medium">전략 A 모멘텀 돌파 알림</span>
            <Zap className="w-4 h-4 text-blue-400" />
          </div>
          <div className="flex items-baseline space-x-1.5">
            <span className="text-xl sm:text-2xl font-bold text-blue-400 font-mono">
              {strategyACount}회 발송
            </span>
            <span className="text-xs text-blue-300/80 font-medium">
              ({strategyAUniqueTickers.length}개 종목)
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
            <span>포착 모멘텀:</span>
            <span className="text-blue-300 font-mono font-semibold truncate max-w-[120px] text-right" title={strategyAUniqueTickers.join(', ')}>
              {strategyAUniqueTickers.length > 0 ? strategyAUniqueTickers.join(', ') : '없음'}
            </span>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 sm:p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
            <span>텔레그램 실제 전송</span>
            <Send className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-purple-300 font-mono">
            {sentSuccessCount}건 <span className="text-xs text-slate-400 font-normal">({deliveryRate}%)</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">연동 봇 수신 계정 발송 완료</div>
        </div>
      </div>

      {/* RLS Warning Banner if Blocked */}
      {isRlsBlocked && (
        <div className="bg-rose-950/30 border border-rose-500/40 rounded-xl p-4 text-rose-200 space-y-2.5 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center space-x-2 font-bold text-rose-300 text-xs sm:text-sm">
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
              <span>Supabase RLS(행 수준 보안)로 인해 새 알람의 원격 DB 저장이 차단 중입니다</span>
            </div>
            <div className="flex items-center space-x-2 self-start sm:self-auto">
              <button
                onClick={handleCopyRlsSql}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-md shadow-rose-950 transition-all cursor-pointer"
              >
                {copiedRlsSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedRlsSql ? '복사됨!' : '⚡ RLS 해제 SQL 복사'}</span>
              </button>
              <button
                onClick={handleSyncToDb}
                disabled={isSyncing}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>동기화 확인</span>
              </button>
            </div>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            현재 발생한 알림은 시스템 메모리에 안전하게 보관 중이며, Supabase SQL Editor에서 <b>[⚡ RLS 해제 SQL]</b>을 실행하시면 원격 영구 저장이 활성화되고 모든 알람이 DB로 자동 동기화됩니다.
          </p>
        </div>
      )}

      {/* Informative Guidance Banner */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-lg px-3.5 py-2.5 flex items-start space-x-2.5 text-xs text-slate-400">
        <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span className="text-slate-200 font-semibold">알림 통계 기준 안내:</span> 상단 카드의 <b>'N회 발송'</b>은 정기 스캔 리포트 및 단독 알림이 발송·기록된 <b>총 알림 메시지 횟수</b>입니다. 같은 우량주(예: NVDA, SPY)가 복수의 정기 스캔에서 연속 포착되면 알림 발송 횟수가 누적 집계됩니다.
        </div>
      </div>

      {/* Control Bar: Filters, Search, Actions */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Strategy Pills */}
          <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setSelectedStrategy('ALL')}
              className={`px-2.5 py-1 rounded font-medium transition-all ${
                selectedStrategy === 'ALL'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              전체
            </button>
            <button
              onClick={() => setSelectedStrategy('STRATEGY_B')}
              className={`px-2.5 py-1 rounded font-medium transition-all flex items-center space-x-1 ${
                selectedStrategy === 'STRATEGY_B'
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/50 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Shield className="w-3 h-3" />
              <span>전략 B (눌림목)</span>
            </button>
            <button
              onClick={() => setSelectedStrategy('STRATEGY_A')}
              className={`px-2.5 py-1 rounded font-medium transition-all flex items-center space-x-1 ${
                selectedStrategy === 'STRATEGY_A'
                  ? 'bg-blue-950 text-blue-300 border border-blue-700/50 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Zap className="w-3 h-3" />
              <span>전략 A (모멘텀)</span>
            </button>
            <button
              onClick={() => setSelectedStrategy('DUAL_SCAN_REPORT')}
              className={`px-2.5 py-1 rounded font-medium transition-all flex items-center space-x-1 ${
                selectedStrategy === 'DUAL_SCAN_REPORT'
                  ? 'bg-purple-950 text-purple-300 border border-purple-700/50 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3 h-3" />
              <span>듀얼 종합</span>
            </button>
          </div>

          {/* Delivery Status Select */}
          <select
            value={selectedDelivery}
            onChange={(e) => setSelectedDelivery(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">모든 전송상태</option>
            <option value="SENT">🟢 텔레그램 전송 완료</option>
            <option value="LOCAL_LOGGED">🟡 로컬 시스템 기록</option>
            <option value="FAILED">🔴 전송 실패</option>
          </select>
        </div>

        {/* Right side: Search & Refresh */}
        <div className="flex items-center space-x-2">
          <div className="relative flex-1 md:w-48">
            <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="티커 검색 (예: NVDA, SPY)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <button
            onClick={fetchAlerts}
            disabled={isLoading}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs border border-slate-700 transition-all active:scale-95 disabled:opacity-50"
            title="새로고침"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">새로고침</span>
            {lastRefreshedAt && (
              <span className="hidden lg:inline text-[10px] text-cyan-400/80 font-mono ml-1">
                ({lastRefreshedAt})
              </span>
            )}
          </button>

          <button
            onClick={handleCreateTestAlert}
            disabled={isCreatingTestAlert}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-xs border border-cyan-500/30 transition-all active:scale-95 disabled:opacity-50"
            title="새 알람 발송 기록 테스트 생성"
          >
            <PlusCircle className={`w-3.5 h-3.5 ${isCreatingTestAlert ? 'animate-spin' : ''}`} />
            <span className="hidden md:inline">테스트 기록</span>
          </button>

          {alerts.length > 0 && (
            isConfirmingClear ? (
              <div className="flex items-center space-x-1.5 animate-fadeIn">
                <span className="text-[11px] text-rose-400 font-semibold">전체 비우기?</span>
                <button
                  onClick={handleClearHistory}
                  disabled={isClearing}
                  className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-semibold transition-all active:scale-95 disabled:opacity-50"
                >
                  {isClearing ? '비우는 중...' : '확인'}
                </button>
                <button
                  onClick={() => setIsConfirmingClear(false)}
                  disabled={isClearing}
                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold transition-all"
                >
                  취소
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsConfirmingClear(true)}
                className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-rose-950 hover:text-rose-300 text-slate-400 text-xs border border-slate-800 transition-all active:scale-95"
                title="알림 기록 전체 비우기"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )
          )}
        </div>
      </div>

      {/* Alert List */}
      {filteredAlerts.length === 0 ? (
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-12 text-center">
          <Bell className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-300 mb-1">
            {searchTerm
              ? `'${searchTerm}' 관련 알림 내역이 없습니다.`
              : activeMarket === 'KR'
              ? '국내장(KOSPI/KOSDAQ) 발송 알림 내역이 없습니다.'
              : '미국장(NYSE/NASDAQ) 발송 알림 내역이 없습니다.'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
            {activeMarket === 'KR'
              ? '국내 워치리스트 종목에 대해 정기 스캔이 실행되거나 매수/청산 신호가 포착되면 텔레그램 발송 내역과 메시지 전문이 이곳에 자동 기록됩니다.'
              : '정기 스캔이 실행되거나 전략 B 우량주 눌림목/전략 A 모멘텀 신호가 포착되면 텔레그램 발송 내역과 메시지 전문이 이곳에 자동 기록됩니다.'}
          </p>
          {onTriggerScan && (
            <button
              onClick={onTriggerScan}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md transition-all active:scale-95"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{activeMarket === 'KR' ? '국내 퀀트 스캔 실행' : '미국 퀀트 스캔 실행'}</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map((alert) => {
            const isExpanded = expandedAlertId === alert.id;
            const hasStrategyB =
              alert.strategy_type === 'STRATEGY_B' ||
              (alert.details?.strategy_b_tickers && alert.details.strategy_b_tickers.length > 0);
            const hasStrategyA =
              alert.strategy_type === 'STRATEGY_A' ||
              (alert.details?.strategy_a_tickers && alert.details.strategy_a_tickers.length > 0);

            return (
              <div
                key={alert.id}
                className={`bg-slate-900 border transition-all rounded-xl overflow-hidden ${
                  hasStrategyB
                    ? 'border-slate-800 hover:border-emerald-500/40'
                    : 'border-slate-800 hover:border-cyan-500/40'
                }`}
              >
                {/* Header Row */}
                <div className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {getStrategyBadge(alert.strategy_type)}
                      {getDeliveryStatusBadge(alert.delivery_status)}
                      <span className="text-[11px] text-slate-400 font-mono flex items-center space-x-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>{alert.kst_time || alert.timestamp} KST</span>
                      </span>
                      {alert.delivery_target && (
                        <span className="text-[10px] text-slate-500 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                          수신ID: {alert.delivery_target}
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm font-semibold text-slate-100 truncate flex items-center space-x-2">
                      <span>{alert.title}</span>
                    </h4>

                    {/* Quick Tickers Chips */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <span className="text-[11px] text-slate-500">포착 종목:</span>
                      {alert.tickers.length === 0 ? (
                        <span className="text-[11px] text-slate-600">포착 종목 없음</span>
                      ) : (
                        alert.tickers.map((ticker) => {
                          // Check if Strategy B info is available for this ticker
                          const bInfo = alert.details?.strategy_b_tickers?.find(
                            (b) => b.ticker.toUpperCase() === ticker.toUpperCase()
                          );
                          const aInfo = alert.details?.strategy_a_tickers?.find(
                            (a) => a.ticker.toUpperCase() === ticker.toUpperCase()
                          );

                          return (
                            <button
                              key={ticker}
                              onClick={() =>
                                onSelectTicker &&
                                onSelectTicker(
                                  ticker,
                                  bInfo ? 'dip_buy' : 'overview'
                                )
                              }
                              className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-mono font-medium transition-all ${
                                bInfo
                                  ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/60 hover:bg-emerald-900/80 hover:border-emerald-500'
                                  : 'bg-cyan-950/70 text-cyan-300 border border-cyan-800/60 hover:bg-cyan-900/80 hover:border-cyan-500'
                              }`}
                              title={`${ticker} 상세 분석 모달 열기`}
                            >
                              <span>{ticker}</span>
                              {bInfo && (
                                <span className="text-[10px] text-emerald-400 font-sans">
                                  ({bInfo.tier}등급 | {bInfo.dip_score}점)
                                </span>
                              )}
                              {aInfo && !bInfo && (
                                <span className="text-[10px] text-cyan-400 font-sans">
                                  ({aInfo.score}점 {aInfo.decision})
                                </span>
                              )}
                              <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Actions right */}
                  <div className="flex items-center space-x-2 self-end sm:self-center shrink-0">
                    <button
                      onClick={() => handleCopy(alert.id, alert.message_body)}
                      className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-all active:scale-95"
                      title="텔레그램 메시지 전문 복사"
                    >
                      {copiedAlertId === alert.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400 font-medium">복사완료</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-400" />
                          <span>전문 복사</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => setExpandedAlertId(isExpanded ? null : alert.id)}
                      className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 transition-all"
                    >
                      <span>{isExpanded ? '접기' : '전문 보기'}</span>
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Strategy B Highlight Banner if present */}
                {alert.details?.strategy_b_tickers && alert.details.strategy_b_tickers.length > 0 && (
                  <div className="bg-emerald-950/30 border-t border-emerald-900/30 px-4 py-2.5 text-xs flex flex-wrap items-center gap-x-4 gap-y-1.5 text-emerald-300/90">
                    <span className="font-semibold flex items-center space-x-1 text-emerald-400">
                      <Shield className="w-3.5 h-3.5" />
                      <span>전략 B 우량주 눌림목 포착 핵심 요약:</span>
                    </span>
                    {alert.details.strategy_b_tickers.map((b) => (
                      <span key={b.ticker} className="font-mono text-emerald-200">
                        <b>{b.ticker}</b>: {b.tier}등급 | 딥스코어 <b>{b.dip_score}점</b> | RSI {b.rsi} | 고점대비 {b.drawdown} → <b>{b.suggested_action}</b>
                      </span>
                    ))}
                  </div>
                )}

                {/* Expanded Full Message Body Accordion */}
                {isExpanded && (
                  <div className="border-t border-slate-800 bg-slate-950 p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="font-semibold text-slate-300">
                        텔레그램 발송 메시지 원문 (HTML 렌더링 미리보기)
                      </span>
                      <button
                        onClick={() => handleCopy(alert.id, alert.message_body)}
                        className="text-cyan-400 hover:text-cyan-300 flex items-center space-x-1"
                      >
                        <Copy className="w-3 h-3" />
                        <span>텍스트로 복사</span>
                      </button>
                    </div>

                    <div
                      className="bg-slate-900 border border-slate-800 rounded-lg p-3.5 text-xs text-slate-200 font-sans leading-relaxed whitespace-pre-wrap selection:bg-cyan-500"
                      dangerouslySetInnerHTML={{ __html: alert.message_body }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
