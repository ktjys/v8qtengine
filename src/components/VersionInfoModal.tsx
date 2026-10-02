import React, { useState, useEffect } from 'react';
import {
  X,
  GitCommit,
  Clock,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  Copy,
  Server,
  Cpu,
  ShieldCheck,
  AlertTriangle,
  RotateCw,
} from 'lucide-react';
import { APP_VERSION_INFO, RECENT_RELEASE_CHANGELOG } from '../version';

interface VersionInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (msg: string) => void;
}

export const VersionInfoModal: React.FC<VersionInfoModalProps> = ({
  isOpen,
  onClose,
  onShowToast,
}) => {
  const [copiedHash, setCopiedHash] = useState(false);
  const [isHardReloading, setIsHardReloading] = useState(false);
  const [backendStatus, setBackendStatus] = useState<{
    loading: boolean;
    online: boolean;
    commitHash?: string;
    buildTime?: string;
    provider?: string;
    dbConnected?: boolean;
    error?: string;
  }>({
    loading: true,
    online: false,
  });

  // ESC key handler for accessibility (P0-3)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // Body scroll lock
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  // Fetch backend version & health
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setBackendStatus((prev) => ({ ...prev, loading: true }));

    fetch('/api/health?_t=' + Date.now())
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!isMounted) return;
        setBackendStatus({
          loading: false,
          online: true,
          commitHash: data.commit_hash || APP_VERSION_INFO.commitHash,
          buildTime: data.build_time || APP_VERSION_INFO.buildTime,
          provider: data.provider || 'yahoo',
          dbConnected: data.db_connected !== false,
        });
      })
      .catch((err) => {
        if (!isMounted) return;
        setBackendStatus({
          loading: false,
          online: false,
          error: err.message || '서버 통신 실패',
        });
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopyCommitHash = () => {
    navigator.clipboard.writeText(APP_VERSION_INFO.commitHash);
    setCopiedHash(true);
    onShowToast(`커밋 해시(#${APP_VERSION_INFO.commitHash})가 클립보드에 복사되었습니다.`);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const handleHardRefresh = async () => {
    setIsHardReloading(true);
    onShowToast('브라우저 캐시를 무효화하고 최신 코드로 강력 새로고침합니다...');

    try {
      // Clear CacheStorage if available
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      }
      // Clear sessionStorage (keep localStorage for API tokens & preferences)
      sessionStorage.clear();
    } catch (e) {
      console.warn('Cache clearing warning:', e);
    }

    setTimeout(() => {
      // Force reload ignoring cache
      window.location.reload();
    }, 600);
  };

  const isSyncMatch = backendStatus.online && backendStatus.commitHash === APP_VERSION_INFO.commitHash;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="version-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-800/80 bg-slate-950/50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <GitCommit className="w-4 h-4" />
            </div>
            <div>
              <h3 id="version-modal-title" className="text-sm sm:text-base font-bold text-slate-100 flex items-center space-x-2">
                <span>시스템 배포 및 버전 정보</span>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  v{APP_VERSION_INFO.version}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                현재 화면에 로드된 코드의 커밋 버전과 배포 반영 상태를 확인합니다.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            aria-label="닫기 (ESC)"
            title="닫기 (ESC)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 no-scrollbar">
          {/* Main Version Badge Card */}
          <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">현재 브라우저 커밋 버전</span>
              <button
                type="button"
                onClick={handleCopyCommitHash}
                className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-mono transition-all border border-slate-700 active:scale-95"
                title="커밋 해시 복사"
              >
                {copiedHash ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-bold">복사됨!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    <span>#{APP_VERSION_INFO.commitHash} 복사</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex items-baseline space-x-3">
              <span className="text-2xl sm:text-3xl font-mono font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-sky-200 to-white">
                #{APP_VERSION_INFO.commitHash}
              </span>
              <span className="text-xs text-cyan-400/90 font-mono font-semibold">
                (v{APP_VERSION_INFO.version})
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-[11px] text-slate-400 font-mono">
              <div className="flex items-center space-x-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>빌드 일시: <strong className="text-slate-200">{APP_VERSION_INFO.buildTime}</strong></span>
              </div>
              <div className="flex items-center space-x-1.5">
                <Cpu className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>실행 환경: <strong className="text-slate-200 uppercase">{APP_VERSION_INFO.environment}</strong></span>
              </div>
            </div>

            <div className="text-[11px] text-slate-400 bg-slate-950/80 p-2.5 rounded-lg border border-slate-800/80">
              <span className="text-slate-500 font-semibold block mb-0.5">커밋 메시지:</span>
              <code className="text-slate-300 font-mono text-[10px] sm:text-[11px]">
                {APP_VERSION_INFO.commitMessage}
              </code>
            </div>
          </div>

          {/* Backend Sync Verification Card */}
          <div className="bg-slate-950/60 p-3.5 sm:p-4 rounded-xl border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-200">
                <Server className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>서버 / 백엔드 동기화 검증</span>
              </div>
              <div>
                {backendStatus.loading ? (
                  <span className="text-[10px] text-slate-500 flex items-center space-x-1 font-mono">
                    <RotateCw className="w-3 h-3 animate-spin" />
                    <span>확인 중...</span>
                  </span>
                ) : isSyncMatch ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center space-x-1 font-mono">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>최신 커밋 일치</span>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center space-x-1 font-mono">
                    <AlertTriangle className="w-3 h-3" />
                    <span>캐시 불일치 가능</span>
                  </span>
                )}
              </div>
            </div>

            <div className="text-[11px] text-slate-400 space-y-1">
              <div className="flex justify-between">
                <span>서버 응답 커밋:</span>
                <span className="font-mono text-slate-200">
                  {backendStatus.loading
                    ? '확인 중...'
                    : backendStatus.online
                    ? `#${backendStatus.commitHash}`
                    : '서버 오프라인'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Supabase DB 연결:</span>
                <span className="font-mono text-slate-200">
                  {backendStatus.loading
                    ? '확인 중...'
                    : backendStatus.dbConnected
                    ? '🟢 연결 정상'
                    : '🔴 미연결'}
                </span>
              </div>
            </div>

            {/* Hard Reload Action */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
              <p className="text-[10px] sm:text-[11px] text-slate-400 leading-tight">
                배포 직후 이전 화면이 남아있는 경우 강력 새로고침을 실행하세요.
              </p>
              <button
                type="button"
                onClick={handleHardRefresh}
                disabled={isHardReloading}
                className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-cyan-600/30 flex items-center space-x-1.5 transition-all shrink-0 active:scale-95"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isHardReloading ? 'animate-spin' : ''}`} />
                <span>강력 새로고침</span>
              </button>
            </div>
          </div>

          {/* Recent Release Changelog */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>최근 배포 반영 내역 (Release Changelog)</span>
            </h4>
            <div className="space-y-2.5">
              {RECENT_RELEASE_CHANGELOG.map((rel) => (
                <div
                  key={rel.version}
                  className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-cyan-300">{rel.version}</span>
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                        #{rel.commit}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">{rel.date}</span>
                  </div>
                  <div className="text-[11px] font-semibold text-slate-200">
                    {rel.title}
                  </div>
                  <ul className="text-[10px] sm:text-[11px] text-slate-400 space-y-1 list-disc list-inside pl-1">
                    {rel.items.map((item, idx) => (
                      <li key={idx} className="leading-relaxed">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 border-t border-slate-800/80 bg-slate-950/60 flex items-center justify-between text-[11px] text-slate-500">
          <span>단독 퀀트 의사결정 플랫폼 (v{APP_VERSION_INFO.version})</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};
