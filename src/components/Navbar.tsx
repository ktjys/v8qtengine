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
} from 'lucide-react';

interface NavbarProps {
  activeTab: 'dashboard' | 'watchlist' | 'backtest' | 'classification' | 'runs' | 'macro' | 'portfolio' | 'paper' | 'guide';
  setActiveTab: (tab: 'dashboard' | 'watchlist' | 'backtest' | 'classification' | 'runs' | 'macro' | 'portfolio' | 'paper' | 'guide') => void;
  onOpenScanModal: () => void;
  onOpenScheduleModal: () => void;
  onOpenDbHealthModal?: () => void;
  totalCount: number;
  signalsCount: number;
  isInitialLoading?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenScanModal,
  onOpenScheduleModal,
  onOpenDbHealthModal,
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
    id: 'dashboard' | 'watchlist' | 'backtest' | 'runs' | 'guide';
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
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800/90 text-slate-100 shadow-sm shadow-slate-950/40">
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-2">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-md shadow-cyan-500/20 shrink-0">
              <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-white stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-1.5">
                <span className="font-bold text-sm sm:text-base tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent truncate">
                  QUANT ENGINE
                </span>
                <span className="px-1.5 py-0.5 text-[9px] sm:text-[10px] font-semibold rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shrink-0">
                  LIVE
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono hidden xl:block truncate max-w-[220px]">
                Dual Quant v8.2 Matrix
              </p>
            </div>
          </div>

          {/* Desktop Navigation Tabs (Clean Responsive Layout) */}
          <nav className="hidden lg:flex items-center space-x-1 bg-slate-950/70 p-1 rounded-xl border border-slate-800/80 shrink-0">
            {mainTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`tab-${tab.id}-btn`}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setIsMoreMenuOpen(false);
                  }}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-slate-800 text-cyan-300 shadow-sm font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
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

            {/* More Menu Dropdown for Secondary Tabs */}
            <div className="relative" ref={moreMenuRef}>
              <button
                id="tab-more-menu-btn"
                onClick={() => setIsMoreMenuOpen((prev) => !prev)}
                className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                  isSecondaryActive
                    ? 'bg-slate-800 text-purple-300 shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <span>{isSecondaryActive && activeSecondaryItem ? activeSecondaryItem.label : '분석 도구'}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    isMoreMenuOpen ? 'rotate-180 text-purple-300' : 'text-slate-400'
                  }`}
                />
              </button>

              {isMoreMenuOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-xl shadow-slate-950/80 p-1.5 z-50 animate-fadeIn">
                  <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 border-b border-slate-800/80 mb-1">
                    심층 퀀트 & 자산배분 도구
                  </div>
                  {secondaryTabs.map((tab) => {
                    const isSelected = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        id={`tab-dropdown-${tab.id}-btn`}
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

          {/* Action Trigger Controls */}
          <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
            {onOpenDbHealthModal && (
              <button
                id="header-db-health-btn"
                onClick={onOpenDbHealthModal}
                className="flex items-center space-x-1 p-2 sm:px-2.5 sm:py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700/80 transition-all active:scale-95"
                title="데이터베이스 헬스체크 & DDL"
              >
                <Database className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden xl:inline">DB 헬스</span>
              </button>
            )}

            <button
              id="header-schedule-btn"
              onClick={onOpenScheduleModal}
              className="flex items-center space-x-1 p-2 sm:px-2.5 sm:py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700/80 transition-all active:scale-95"
              title="하루 2회 자동 스캔 & 텔레그램 알림 설정"
            >
              <Bell className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">자동 알림</span>
            </button>

            <button
              id="header-run-scan-btn"
              onClick={onOpenScanModal}
              className="flex items-center space-x-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs sm:text-sm font-semibold shadow-md shadow-cyan-600/30 transition-all active:scale-95"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>스캔 실행</span>
            </button>

            {/* Mobile / Tablet Drawer Toggle Button */}
            <button
              id="header-mobile-menu-btn"
              onClick={() => setIsMobileDrawerOpen((prev) => !prev)}
              className="lg:hidden p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white border border-slate-700 active:scale-95"
              aria-label="전체 메뉴 열기"
            >
              {isMobileDrawerOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Medium Screen (md) & Mobile Horizontal Scrolling Bar */}
        <div className="flex lg:hidden overflow-x-auto items-center space-x-1.5 py-2 border-t border-slate-800/80 no-scrollbar">
          {mainTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-1 px-2.5 py-1 text-xs rounded-lg whitespace-nowrap font-medium transition-all shrink-0 ${
                  isActive
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 bg-slate-950/40 hover:text-slate-200'
                }`}
              >
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    className={`text-[10px] px-1 py-0.2 rounded-full font-mono ${
                      isActive ? 'bg-slate-950/30 text-slate-950 font-bold' : 'text-slate-400'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}

          {secondaryTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-1 px-2.5 py-1 text-xs rounded-lg whitespace-nowrap font-medium transition-all shrink-0 ${
                  isActive
                    ? 'bg-purple-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 bg-slate-950/40 hover:text-slate-200'
                }`}
              >
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Mobile Full Dropdown Drawer */}
        {isMobileDrawerOpen && (
          <div className="lg:hidden border-t border-slate-800 py-3 px-2 bg-slate-900/98 rounded-b-2xl shadow-2xl animate-fadeIn space-y-2">
            <div className="text-[11px] font-semibold text-slate-400 px-2 uppercase tracking-wider">
              핵심 퀀트 메뉴
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {mainTabs.map((tab) => (
                <button
                  key={tab.id}
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

            <div className="text-[11px] font-semibold text-slate-400 px-2 uppercase tracking-wider pt-2 border-t border-slate-800/80">
              심층 분석 및 설정
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {secondaryTabs.map((tab) => (
                <button
                  key={tab.id}
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
        )}
      </div>
    </header>
  );
};
