import React, { useState, useRef, useEffect } from 'react';
import {
  Activity,
  Bell,
  Database,
  Globe,
  ListFilter,
  RefreshCw,
  Sliders,
  TrendingUp,
  Scale,
  BookOpen,
  ChevronDown,
  Menu,
  X,
  LineChart,
  ShieldAlert,
  GitCommit,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import { MarketRegion, FullTickerEvaluation } from '../types/v8';
import { APP_VERSION_INFO } from '../version';
import { DataFreshnessBadge } from './DataFreshnessBadge';

interface NavbarProps {
  activeTab: 'dashboard' | 'watchlist' | 'backtest' | 'exit' | 'classification' | 'runs' | 'macro' | 'portfolio' | 'paper' | 'guide';
  setActiveTab: (tab: 'dashboard' | 'watchlist' | 'backtest' | 'exit' | 'classification' | 'runs' | 'macro' | 'portfolio' | 'paper' | 'guide') => void;
  activeMarket?: MarketRegion;
  onSelectMarket?: (market: MarketRegion) => void;
  onOpenScanModal: () => void;
  onOpenScheduleModal: () => void;
  onOpenDbHealthModal?: () => void;
  onOpenVersionModal?: () => void;
  onOpenLoginModal?: () => void;
  isAuthenticated?: boolean;
  user?: { email?: string | null } | null;
  evaluations?: FullTickerEvaluation[];
  onRefreshData?: () => void;
  isRefreshingData?: boolean;
  totalCount: number;
  signalsCount: number;
  isInitialLoading?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  activeMarket = 'US',
  onSelectMarket,
  onOpenScanModal,
  onOpenScheduleModal,
  onOpenDbHealthModal,
  onOpenVersionModal,
  onOpenLoginModal,
  isAuthenticated = false,
  user = null,
  evaluations = [],
  onRefreshData,
  isRefreshingData = false,
  totalCount,
  signalsCount,
  isInitialLoading = false,
}) => {
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setIsMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const mainTabs: {
    id: 'dashboard' | 'watchlist' | 'backtest' | 'exit' | 'runs' | 'guide';
    label: string;
    icon: React.ReactNode;
    badge?: string;
  }[] = [
    {
      id: 'dashboard',
      label: '대시보드',
      icon: <Activity className="w-4 h-4 text-cyan-400" />,
    },
    {
      id: 'watchlist',
      label: '워치리스트',
      icon: <ListFilter className="w-4 h-4 text-blue-400" />,
      badge: isInitialLoading ? '…' : `${totalCount}`,
    },
    {
      id: 'exit',
      label: '매도 & 청산',
      icon: <ShieldAlert className="w-4 h-4 text-rose-400" />,
    },
    {
      id: 'backtest',
      label: '성과 분석',
      icon: <TrendingUp className="w-4 h-4 text-indigo-400" />,
    },
    {
      id: 'runs',
      label: '알림 & 이력',
      icon: <Bell className="w-4 h-4 text-amber-400" />,
    },
    {
      id: 'guide',
      label: '매매 가이드',
      icon: <BookOpen className="w-4 h-4 text-emerald-400" />,
    },
  ];

  const secondaryTabs: {
    id: 'classification' | 'macro' | 'portfolio' | 'paper';
    label: string;
    desc: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: 'classification',
      label: '자산 분류 관리',
      desc: '우량주/지수ETF/성장주/투기주 팩터 가중치 설정',
      icon: <Sliders className="w-4 h-4 text-cyan-400" />,
    },
    {
      id: 'macro',
      label: '매크로 & 실적',
      desc: '금리, 유가, VIX 및 주요 지수 거시지표 모니터링',
      icon: <Globe className="w-4 h-4 text-emerald-400" />,
    },
    {
      id: 'portfolio',
      label: '자산 배분 모델',
      desc: '리스크 패리티 및 올웨더 최적 자산비중 산출',
      icon: <Scale className="w-4 h-4 text-purple-400" />,
    },
    {
      id: 'paper',
      label: '모의투자 & 적중률',
      desc: '과거 시그널 기반 승률 및 실시간 가상 포트폴리오',
      icon: <LineChart className="w-4 h-4 text-amber-400" />,
    },
  ];

  const isSecondaryActive = secondaryTabs.some((tab) => tab.id === activeTab);
  const activeSecondaryItem = secondaryTabs.find((tab) => tab.id === activeTab);

  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800/90 text-slate-100 shadow-sm shadow-slate-950/40 w-full max-w-full overflow-x-clip">
      {/* Tier 1: Brand & Core Utility Bar */}
      <div className="w-full max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-13 sm:h-14 gap-1 sm:gap-4 w-full max-w-full min-w-0">
          {/* Logo & Brand (compact icon on mobile, full text on sm+) */}
          <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-md shadow-cyan-500/20 shrink-0">
              <Activity className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5 text-white stroke-[2.5]" />
            </div>
            <div className="hidden sm:flex items-center space-x-1.5 sm:space-x-2">
              <span className="font-bold text-sm sm:text-base tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                QUANT ENGINE
              </span>
              <span className="hidden md:inline-flex px-1.5 py-0.5 text-[9px] sm:text-[10px] font-semibold rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shrink-0">
                LIVE
              </span>
            </div>
          </div>

          {/* Market Region Segmented Toggle (Unclipped, always crisp and fully visible) */}
          {onSelectMarket && (
            <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-xs font-semibold shadow-inner shrink-0">
              <button
                id="market-select-us-btn"
                type="button"
                onClick={() => onSelectMarket('US')}
                className={`flex items-center space-x-1 px-2 py-1 rounded-md transition-all cursor-pointer ${
                  activeMarket === 'US'
                    ? 'bg-blue-600 text-white shadow-sm font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
                title="미국 주식 & ETF (USD $ / S&P500 기준)"
              >
                <span className="text-xs leading-none">🇺🇸</span>
                <span className="text-[11px] sm:text-xs">US<span className="hidden md:inline">장</span></span>
              </button>
              <button
                id="market-select-kr-btn"
                type="button"
                onClick={() => onSelectMarket('KR')}
                className={`flex items-center space-x-1 px-2 py-1 rounded-md transition-all cursor-pointer ${
                  activeMarket === 'KR'
                    ? 'bg-emerald-600 text-white shadow-sm font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
                title="국내 주식 & ETF (KRW ₩ / KOSPI200 기준)"
              >
                <span className="text-xs leading-none">🇰🇷</span>
                <span className="text-[11px] sm:text-xs">KR<span className="hidden md:inline">장</span></span>
              </button>
            </div>
          )}

          {/* Action Trigger Controls & Tools */}
          <div className="flex items-center space-x-1 sm:space-x-2 shrink-0">
            {/* P1-1: Data Freshness Badge */}
            <DataFreshnessBadge
              evaluations={evaluations}
              onRefresh={onRefreshData}
              isRefreshing={isRefreshingData}
              className="hidden sm:inline-flex"
            />

            {/* Commit & Version Indicator (Req 3) */}
            {onOpenVersionModal && (
              <button
                id="header-version-btn"
                type="button"
                onClick={onOpenVersionModal}
                className="hidden md:flex items-center space-x-1 py-1 px-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-cyan-400 hover:text-cyan-300 border border-cyan-500/30 text-xs font-mono transition-all active:scale-95 shrink-0"
                title={`시스템 버전 v${APP_VERSION_INFO.version} (커밋 #${APP_VERSION_INFO.commitHash}) - 클릭하여 배포 세부정보 및 캐시 갱신 확인`}
              >
                <GitCommit className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="font-bold">#{APP_VERSION_INFO.commitHash}</span>
              </button>
            )}

            {/* Owner Auth Button (인증) */}
            {onOpenLoginModal && (
              <button
                id="header-auth-btn"
                type="button"
                onClick={onOpenLoginModal}
                className={`flex items-center space-x-1 py-1.5 px-2 sm:px-2.5 rounded-lg border text-xs font-semibold transition-all active:scale-95 shrink-0 shadow-sm cursor-pointer ${
                  isAuthenticated
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60 hover:bg-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-200 border-rose-500/60 hover:bg-rose-500/30 ring-1 ring-rose-500/40'
                }`}
                title={isAuthenticated ? `로그인 중: ${user?.email || '소유자'} (클릭하여 관리자 패널/로그아웃)` : '인증 필요 (보안 영역 진입)'}
              >
                {isAuthenticated ? (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                    <span className="text-[11px] font-bold">인증됨</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5 shrink-0 text-rose-300" />
                    <span className="text-[11px] font-bold">인증</span>
                  </>
                )}
              </button>
            )}

            {/* DB Health Modal Button */}
            {onOpenDbHealthModal && (
              <button
                id="header-db-health-btn"
                type="button"
                onClick={onOpenDbHealthModal}
                className="hidden md:flex items-center space-x-1 px-2 sm:px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700/80 transition-all active:scale-95 shrink-0 cursor-pointer"
                title="데이터베이스 헬스체크 & DDL"
              >
                <Database className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="hidden lg:inline">DB 헬스</span>
              </button>
            )}

            {/* Schedule Auto Alert Button */}
            <button
              id="header-schedule-btn"
              type="button"
              onClick={onOpenScheduleModal}
              className="hidden md:flex items-center space-x-1 px-2 sm:px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700/80 transition-all active:scale-95 shrink-0 cursor-pointer"
              title="하루 2회 자동 스캔 & 텔레그램 알림 설정"
            >
              <Bell className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="hidden lg:inline">자동 알림</span>
            </button>

            {/* Run Scan Button */}
            <button
              id="header-run-scan-btn"
              type="button"
              onClick={onOpenScanModal}
              className="flex items-center space-x-1 px-2 sm:px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md shadow-cyan-600/30 transition-all active:scale-95 shrink-0 cursor-pointer"
              title="실시간 퀀트 스캔 실행"
            >
              <RefreshCw className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">스캔 실행</span>
              <span className="sm:hidden text-xs">스캔</span>
            </button>

            {/* Mobile / Tablet Drawer Toggle Button */}
            <button
              id="header-mobile-menu-btn"
              type="button"
              onClick={() => setIsMobileDrawerOpen((prev) => !prev)}
              className="md:hidden p-1.5 sm:p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white border border-slate-700 active:scale-95 shrink-0 ml-0.5 cursor-pointer"
              aria-label="전체 메뉴 열기"
            >
              {isMobileDrawerOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Tier 2: Dedicated Navigation Tab Bar (Desktop & Responsive) */}
      <div className="border-t border-slate-800/80 bg-slate-950/60 backdrop-blur-sm w-full max-w-full overflow-hidden">
        <div className="w-full max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
          <nav
            role="tablist"
            aria-label="메인 내비게이션 탭"
            className="flex items-center space-x-1 sm:space-x-1.5 py-1.5 w-full max-w-full min-w-0"
          >
            {/* Scrollable Main Tabs (min-w-0 flex-1 prevents horizontal page blow-out) */}
            <div className="flex items-center space-x-1 sm:space-x-1.5 overflow-x-auto no-scrollbar whitespace-nowrap min-w-0 flex-1 py-0.5">
              {mainTabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    id={`tab-${tab.id}-btn`}
                    role="tab"
                    aria-selected={isActive}
                    aria-controls={`tabpanel-${tab.id}`}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setIsMoreMenuOpen(false);
                    }}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all shrink-0 cursor-pointer ${
                      isActive
                        ? 'bg-slate-800 text-cyan-300 shadow-sm border border-cyan-500/30 font-semibold'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/80'
                    }`}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                    {tab.badge && (
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                          isActive
                            ? 'bg-cyan-500/20 text-cyan-300'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Subtle Divider */}
            <div className="h-4 w-px bg-slate-800 shrink-0 mx-1" aria-hidden="true" />

            {/* More Menu Dropdown for Secondary Tabs (outside scrollable area) */}
            <div className="relative shrink-0" ref={moreMenuRef}>
              <button
                id="tab-more-menu-btn"
                type="button"
                aria-haspopup="true"
                aria-expanded={isMoreMenuOpen}
                onClick={() => setIsMoreMenuOpen((prev) => !prev)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all shrink-0 cursor-pointer ${
                  isSecondaryActive
                    ? 'bg-slate-800 text-purple-300 shadow-sm border border-purple-500/30 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/80'
                }`}
              >
                {isSecondaryActive && activeSecondaryItem ? (
                  <>
                    <span className="shrink-0">{activeSecondaryItem.icon}</span>
                    <span>{activeSecondaryItem.label}</span>
                  </>
                ) : (
                  <>
                    <Sliders className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <span>분석 도구</span>
                  </>
                )}
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    isMoreMenuOpen ? 'rotate-180 text-purple-300' : 'text-slate-400'
                  }`}
                />
              </button>

              {isMoreMenuOpen && (
                <div
                  role="menu"
                  className="absolute left-0 sm:right-0 sm:left-auto mt-2 w-72 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-xl shadow-slate-950/80 p-1.5 z-50 animate-fadeIn"
                >
                  <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 border-b border-slate-800/80 mb-1">
                    심층 퀀트 & 자산배분 도구
                  </div>
                  {secondaryTabs.map((tab) => {
                    const isSelected = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        id={`tab-dropdown-${tab.id}-btn`}
                        role="menuitem"
                        onClick={() => {
                          setActiveTab(tab.id);
                          setIsMoreMenuOpen(false);
                        }}
                        className={`w-full flex items-start space-x-2.5 px-3 py-2 rounded-xl text-left transition-all ${
                          isSelected
                            ? 'bg-purple-950/50 text-purple-200 border border-purple-800/40'
                            : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                        }`}
                      >
                        <div className="mt-0.5 shrink-0">{tab.icon}</div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold">{tab.label}</div>
                          <div className="text-[10px] text-slate-400 line-clamp-1">{tab.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </nav>
        </div>
      </div>

      {/* Tier 3: Mobile Urgent Auth Notice Strip (미인증 시 모바일 상단 1줄 강조 배너) */}
      {!isAuthenticated && onOpenLoginModal && (
        <div className="md:hidden bg-gradient-to-r from-rose-950/90 via-slate-900 to-rose-950/90 border-b border-rose-500/40 px-2.5 sm:px-3 py-1.5 flex items-center justify-between text-xs text-rose-200 w-full max-w-full overflow-hidden">
          <div className="flex items-center space-x-1.5 min-w-0 truncate">
            <span className="flex h-2 w-2 relative shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
            </span>
            <span className="font-semibold text-[11px] text-rose-200 truncate">
              관리자 미인증 (보안 영역 잠김)
            </span>
          </div>
          <button
            type="button"
            onClick={onOpenLoginModal}
            className="flex items-center space-x-1 text-[11px] font-bold text-white bg-rose-600 hover:bg-rose-500 px-2 py-0.5 rounded-md shadow-sm transition-all active:scale-95 cursor-pointer shrink-0"
          >
            <Lock className="w-3 h-3 shrink-0" />
            <span>지금 인증</span>
          </button>
        </div>
      )}

      {/* Mobile & Small Screen Full Drawer */}
      {isMobileDrawerOpen && (
        <div className="md:hidden border-t border-slate-800 py-3 px-3 bg-slate-900/98 rounded-b-2xl shadow-2xl animate-fadeIn space-y-3">
          {/* Mobile Auth Status & Action (소유자 인증 / 계정) */}
          {onOpenLoginModal && (
            <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div
                    className={`p-2 rounded-xl border shrink-0 ${
                      isAuthenticated
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                    }`}
                  >
                    {isAuthenticated ? <ShieldCheck className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-200 flex items-center space-x-1.5">
                      <span>{isAuthenticated ? '관리자 인증 완료' : '관리자 미인증'}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold shrink-0 ${
                          isAuthenticated
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-rose-500/20 text-rose-300'
                        }`}
                      >
                        {isAuthenticated ? '정상 세션' : '인증 필요'}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono truncate max-w-[170px] sm:max-w-[220px]">
                      {isAuthenticated ? (user?.email || '소유자') : 'DDL 및 보안 제어 잠금'}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onOpenLoginModal();
                    setIsMobileDrawerOpen(false);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all active:scale-95 shrink-0 ${
                    isAuthenticated
                      ? 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border-emerald-500/30'
                      : 'bg-rose-600 hover:bg-rose-500 text-white border-rose-500/40 shadow-sm shadow-rose-950'
                  }`}
                >
                  {isAuthenticated ? '계정 관리' : '인증하기'}
                </button>
              </div>
            </div>
          )}

          {/* Market Region Toggle in Mobile */}
          {onSelectMarket && (
            <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
              <div className="text-[10px] text-slate-400 font-semibold mb-1.5 uppercase tracking-wider">
                분석 대상 시장 선택
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    onSelectMarket('US');
                    setIsMobileDrawerOpen(false);
                  }}
                  className={`flex items-center justify-center space-x-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                    activeMarket === 'US'
                      ? 'bg-blue-600 text-white shadow-md font-bold'
                      : 'text-slate-400 bg-slate-900 hover:text-slate-200'
                  }`}
                >
                  <span>🇺🇸</span>
                  <span>미국장 (USD $)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSelectMarket('KR');
                    setIsMobileDrawerOpen(false);
                  }}
                  className={`flex items-center justify-center space-x-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                    activeMarket === 'KR'
                      ? 'bg-emerald-600 text-white shadow-md font-bold'
                      : 'text-slate-400 bg-slate-900 hover:text-slate-200'
                  }`}
                >
                  <span>🇰🇷</span>
                  <span>국내장 (KRW ₩)</span>
                </button>
              </div>
            </div>
          )}

          {/* Quick Actions (DB Health & Auto Notifications & Version) */}
          <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
            <div className="text-[10px] text-slate-400 font-semibold mb-1.5 uppercase tracking-wider">
              시스템 & 알림 관리
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {onOpenDbHealthModal && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenDbHealthModal();
                    setIsMobileDrawerOpen(false);
                  }}
                  className="flex items-center justify-center space-x-1.5 py-2 px-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs font-semibold hover:bg-slate-800 transition-colors"
                >
                  <Database className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>DB 헬스체크</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  onOpenScheduleModal();
                  setIsMobileDrawerOpen(false);
                }}
                className="flex items-center justify-center space-x-1.5 py-2 px-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs font-semibold hover:bg-slate-800 transition-colors"
              >
                <Bell className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>자동 알림 설정</span>
              </button>
              {onOpenVersionModal && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenVersionModal();
                    setIsMobileDrawerOpen(false);
                  }}
                  className="col-span-2 flex items-center justify-center space-x-1.5 py-2 px-2 rounded-lg bg-slate-900 border border-cyan-500/30 text-cyan-300 text-xs font-mono font-semibold hover:bg-slate-800 transition-colors"
                >
                  <GitCommit className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>배포 커밋: #{APP_VERSION_INFO.commitHash} (v{APP_VERSION_INFO.version})</span>
                </button>
              )}
            </div>
          </div>

          {/* Main Tabs */}
          <div>
            <div className="text-[11px] font-semibold text-slate-400 px-1 mb-1.5 uppercase tracking-wider">
              핵심 퀀트 메뉴
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {mainTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    setIsMobileDrawerOpen(false);
                  }}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-medium transition-all text-left ${
                    activeTab === tab.id
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                      : 'text-slate-300 bg-slate-950/50 hover:bg-slate-800'
                  }`}
                >
                  {tab.icon}
                  <span className="truncate">{tab.label}</span>
                  {tab.badge && <span className="text-[10px] text-slate-400">({tab.badge})</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Secondary Tabs */}
          <div>
            <div className="text-[11px] font-semibold text-slate-400 px-1 mb-1.5 uppercase tracking-wider pt-2 border-t border-slate-800/80">
              심층 분석 및 설정
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {secondaryTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    setIsMobileDrawerOpen(false);
                  }}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-medium transition-all text-left ${
                    activeTab === tab.id
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold'
                      : 'text-slate-300 bg-slate-950/50 hover:bg-slate-800'
                  }`}
                >
                  {tab.icon}
                  <span className="truncate">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
