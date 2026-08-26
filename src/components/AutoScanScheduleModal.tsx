import React, { useState, useEffect } from 'react';
import {
  Bell,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Flame,
  Loader2,
  Radio,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';

interface AutoScanScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (msg: string) => void;
}

export const AutoScanScheduleModal: React.FC<AutoScanScheduleModalProps> = ({
  isOpen,
  onClose,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<'schedule' | 'telegram' | 'cron_setup'>('schedule');
  const [isRunning, setIsRunning] = useState(false);
  const [isTestingTelegram, setIsTestingTelegram] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [telegramStatus, setTelegramStatus] = useState<any>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const schedules = [
    {
      slot: 'POST_MARKET',
      title: '1회차: 정규장 마감 브리핑',
      timeKST: '06:30 KST (화~토)',
      cronUTC: '30 21 * * 1-5',
      desc: '미국 정규장 종가 확정 후 4대 팩터(기술/모멘텀/펀더/밸류) 최종 집계 및 일봉 확정 시그널 도출',
      badge: '종가 확정',
      badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
      icon: '🌅',
    },
    {
      slot: 'PRE_MARKET',
      title: '2회차: 프리마켓 갭 & 관심종목 압축',
      timeKST: '22:00 KST (월~금)',
      cronUTC: '00 13 * * 1-5',
      desc: '프리마켓 갭상승/하락 변동성 반영, 당일 진입 유효 후보군 압축 및 포트폴리오 비중 브리핑',
      badge: '장전 전략',
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      icon: '🌃',
    },
    {
      slot: 'INTRADAY',
      title: '3회차: 장중 급변 & 모멘텀 감시',
      timeKST: '02:00 KST (화~토)',
      cronUTC: '00 17 * * 1-5',
      desc: '장중 거래량 폭증 및 변동성 브레이크아웃 급변 종목 포착 시 실시간 긴급 신호 발송',
      badge: '장중 브레이크아웃',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      icon: '🌙',
    },
  ];

  const fetchTelegramStatus = async () => {
    try {
      const res = await fetch('/api/v8/telegram/status');
      const data = await res.json();
      setTelegramStatus(data);
    } catch {}
  };

  useEffect(() => {
    if (isOpen) {
      fetchTelegramStatus();
      setScanResult(null);
    }
  }, [isOpen]);

  const handleRunScanNow = async () => {
    setIsRunning(true);
    setScanResult(null);
    try {
      const res = await fetch('/api/v8/cron-scan', { method: 'POST' });
      const data = await res.json();
      setScanResult(data);
      if (data.success) {
        onShowToast(`자동 스캔 완료: ${data.actionable_signals_count}개 시그널 포착`);
      } else {
        onShowToast(`스캔 오류: ${data.error}`);
      }
    } catch (err: any) {
      onShowToast(`스캔 요청 실패: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleTestTelegram = async () => {
    setIsTestingTelegram(true);
    try {
      const res = await fetch('/api/v8/telegram/test-broadcast', { method: 'POST' });
      const data = await res.json();
      if (data.previewOnly) {
        onShowToast('텔레그램 프리뷰 테스트 완료 (Cloudflare 환경변수 설정 시 실제 전송)');
      } else if (data.success) {
        onShowToast('텔레그램 봇으로 실제 테스트 메시지가 전송되었습니다!');
      } else {
        onShowToast(`발송 오류: ${data.message || '전송 실패'}`);
      }
    } catch (err: any) {
      onShowToast(`오류: ${err.message}`);
    } finally {
      setIsTestingTelegram(false);
    }
  };

  const cronEndpointUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/v8/cron-scan` : '/api/v8/cron-scan';

  const handleCopyEndpoint = () => {
    navigator.clipboard.writeText(cronEndpointUrl);
    setCopiedUrl(true);
    onShowToast('스캔 엔드포인트 URL이 클립보드에 복사되었습니다.');
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto no-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-bold text-slate-100">자동 스캔 & 알림 시스템</h3>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  하루 3회 자동화
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Cloudflare Pages Functions + Telegram Bot 백엔드 파이프라인
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
          <button
            onClick={() => setActiveTab('schedule')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'schedule'
                ? 'bg-slate-800 text-cyan-400 border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ⏰ 3회 스캔 스케줄 & 즉시 실행
          </button>
          <button
            onClick={() => setActiveTab('telegram')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'telegram'
                ? 'bg-slate-800 text-cyan-400 border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            💬 텔레그램 봇 연동 상태
          </button>
          <button
            onClick={() => setActiveTab('cron_setup')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'cron_setup'
                ? 'bg-slate-800 text-cyan-400 border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ⚙️ 클라우드플레어 Cron 연동 가이드
          </button>
        </div>

        {/* Tab 1: Schedules & Run Now */}
        {activeTab === 'schedule' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3">
              {schedules.map((s, idx) => (
                <div
                  key={idx}
                  className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 space-y-2 hover:border-slate-700 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">{s.icon}</span>
                      <span className="text-sm font-bold text-slate-200">{s.title}</span>
                      <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${s.badgeColor}`}>
                        {s.badge}
                      </span>
                    </div>
                    <div className="text-xs font-mono font-semibold text-cyan-400 bg-cyan-950/30 px-2.5 py-1 rounded-lg border border-cyan-500/20">
                      {s.timeKST}
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{s.desc}</p>
                  <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500 font-mono">
                    <span>Cron 표현식 (UTC): <code className="text-slate-300 bg-slate-900 px-1.5 py-0.5 rounded">{s.cronUTC}</code></span>
                    <span className="text-emerald-400 flex items-center space-x-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>자동화 등록 대기</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Run Scan Now Action Box */}
            <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 p-4.5 rounded-2xl border border-cyan-500/30 space-y-3 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-200 flex items-center space-x-1.5">
                    <Zap className="w-4 h-4 text-cyan-400" />
                    <span>지금 즉시 스캔 & 텔레그램 알림 발송 테스트</span>
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    스케줄 시간까지 기다리지 않고 지금 즉시 퀀트 엔진을 가동하여 결과를 확인합니다.
                  </p>
                </div>
                <button
                  onClick={handleRunScanNow}
                  disabled={isRunning}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-cyan-600/30 flex items-center space-x-1.5 transition-all"
                >
                  {isRunning ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>스캔 중...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>지금 실행하기</span>
                    </>
                  )}
                </button>
              </div>

              {/* Scan Result Output */}
              {scanResult && (
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-2 animate-fadeIn font-mono">
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-emerald-400 font-bold">✅ {scanResult.slot || '스캔 완료'}</span>
                    <span className="text-slate-500 text-[11px]">소요 시간: {scanResult.duration_ms}ms</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-center pt-1">
                    <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                      <div className="text-[10px] text-slate-400">평가 종목수</div>
                      <div className="text-sm font-bold text-cyan-400">{scanResult.evaluated_count}개</div>
                    </div>
                    <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                      <div className="text-[10px] text-slate-400">진입 신호 포착</div>
                      <div className="text-sm font-bold text-amber-400">{scanResult.actionable_signals_count}건</div>
                    </div>
                  </div>
                  {scanResult.actionable_signals && scanResult.actionable_signals.length > 0 && (
                    <div className="text-[11px] text-slate-300 space-y-1 pt-1">
                      <div className="text-slate-400">🎯 포착 종목:</div>
                      {scanResult.actionable_signals.map((sig: any) => (
                        <div key={sig.ticker} className="flex items-center justify-between bg-slate-950 px-2.5 py-1 rounded">
                          <span><b>{sig.ticker}</b> (${sig.price?.toFixed(1)})</span>
                          <span className="text-amber-400 font-bold">{sig.decision} ({sig.opportunity_score}점)</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Telegram Settings */}
        {activeTab === 'telegram' && (
          <div className="space-y-4">
            <div className="bg-slate-950 p-4.5 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Bell className="w-4 h-4 text-cyan-400" />
                  <h4 className="text-sm font-bold text-slate-200">텔레그램 봇 연결 상태</h4>
                </div>
                <button
                  onClick={handleTestTelegram}
                  disabled={isTestingTelegram}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-semibold border border-slate-700 flex items-center space-x-1.5 transition-all"
                >
                  {isTestingTelegram ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>테스트 알림 발송</span>
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-400">TELEGRAM_BOT_TOKEN</span>
                  <span className={`font-mono font-semibold ${telegramStatus?.botTokenConfigured ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {telegramStatus?.botTokenConfigured ? '✅ 환경변수 등록됨' : '⚠️ 미등록 (프리뷰 모드 동작)'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-400">TELEGRAM_CHAT_ID</span>
                  <span className={`font-mono font-semibold ${telegramStatus?.chatIdConfigured ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {telegramStatus?.chatIdConfigured ? `✅ 등록됨 (${telegramStatus?.targetChatIdMasked || 'ID'})` : '⚠️ 미등록'}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1.5 leading-relaxed">
                <div className="font-semibold text-slate-300">💡 텔레그램 알림을 실제로 내 폰으로 받는 방법:</div>
                <ol className="list-decimal list-inside space-y-1 pl-1">
                  <li>텔레그램에서 <code>@BotFather</code>에게 메시지를 보내 봇을 생성하고 <b>Token</b>을 받습니다.</li>
                  <li><code>@userinfobot</code>에게 메시지를 보내 나의 <b>Chat ID</b>(숫자)를 확인합니다.</li>
                  <li>Cloudflare 대시보드 ➡️ <b>Pages</b> ➡️ <b>Settings</b> ➡️ <b>Environment variables</b>에 아래 두 변수를 등록하면 끝!
                    <div className="bg-slate-950 p-2 rounded-lg font-mono text-[10px] text-cyan-300 mt-1">
                      TELEGRAM_BOT_TOKEN = "내_봇_토큰"<br />
                      TELEGRAM_CHAT_ID = "내_챗_아이디"
                    </div>
                  </li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Cloudflare Cron Setup Guide */}
        {activeTab === 'cron_setup' && (
          <div className="space-y-4">
            <div className="bg-slate-950 p-4.5 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-200">자동 스캔 웹훅 엔드포인트 URL</h4>
                <button
                  onClick={handleCopyEndpoint}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono flex items-center space-x-1 transition-all"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedUrl ? '복사됨!' : 'URL 복사'}</span>
                </button>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-cyan-300 break-all">
                {cronEndpointUrl}
              </div>

              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-2 leading-relaxed">
                <div className="font-semibold text-slate-200">🛠️ 무료 외부 크론 트리거(예: cron-job.org) 연동 3단계:</div>
                <ol className="list-decimal list-inside space-y-1.5 pl-1 text-[11px]">
                  <li><a href="https://cron-job.org" target="_blank" rel="noreferrer" className="text-cyan-400 underline inline-flex items-center">cron-job.org <ExternalLink className="w-3 h-3 ml-0.5" /></a> (무료)에 가입합니다.</li>
                  <li><b>Create Cronjob</b>을 누르고 위 URL을 붙여넣습니다.</li>
                  <li>실행 주기를 <b>한국 시간 06:30, 22:00, 02:00</b>로 설정하면, 내가 웹을 켜두지 않아도 24시간 자동으로 스캔하고 텔레그램으로 알림을 쏴줍니다!</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};
