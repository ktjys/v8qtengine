import React from 'react';
import {
  Activity,
  Bell,
  Clock,
  Database,
  Layers,
  ListFilter,
  RefreshCw,
  Sliders,
  TrendingUp,
} from 'lucide-react';

interface NavbarProps {
  activeTab: 'dashboard' | 'watchlist' | 'backtest' | 'classification' | 'runs';
  setActiveTab: (tab: 'dashboard' | 'watchlist' | 'backtest' | 'classification' | 'runs') => void;
  onOpenScanModal: () => void;
  onOpenDbModal: () => void;
  onOpenScheduleModal: () => void;
  totalCount: number;
  signalsCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenScanModal,
  onOpenDbModal,
  onOpenScheduleModal,
  totalCount,
  signalsCount,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Activity className="w-5 h-5 text-white stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                  QUANT DECISION ENGINE
                </span>
                <span className="px-2 py-0.5 text-xs font-semibold rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  LIVE
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono hidden sm:block">
                Classification → Opportunity → Risk Constraint → Decision Matrix
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center space-x-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80">
            <button
              id="tab-dashboard-btn"
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-slate-800 text-cyan-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>대시보드</span>
            </button>

            <button
              id="tab-watchlist-btn"
              onClick={() => setActiveTab('watchlist')}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'watchlist'
                  ? 'bg-slate-800 text-cyan-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
              }`}
            >
              <ListFilter className="w-4 h-4" />
              <span>워치리스트 ({totalCount})</span>
            </button>

            <button
              id="tab-backtest-btn"
              onClick={() => setActiveTab('backtest')}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'backtest'
                  ? 'bg-slate-800 text-cyan-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>백테스트 성과 분석</span>
            </button>

            <button
              id="tab-classification-btn"
              onClick={() => setActiveTab('classification')}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'classification'
                  ? 'bg-slate-800 text-cyan-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>자산 분류 관리</span>
            </button>

            <button
              id="tab-runs-btn"
              onClick={() => setActiveTab('runs')}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'runs'
                  ? 'bg-slate-800 text-cyan-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>실행 로그</span>
            </button>
          </nav>

          {/* Action Trigger */}
          <div className="flex items-center space-x-2.5">
            <button
              id="header-schedule-btn"
              onClick={onOpenScheduleModal}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium border border-slate-700 transition-all active:scale-95"
              title="하루 3회 자동 스캔 & 텔레그램 알림 설정"
            >
              <Bell className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">자동 알림</span>
            </button>

            <button
              id="header-db-settings-btn"
              onClick={onOpenDbModal}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium border border-slate-700 transition-all active:scale-95"
              title="데이터베이스 설정 및 마이그레이션"
            >
              <Database className="w-4 h-4 text-cyan-400" />
              <span className="hidden sm:inline">DB 설정</span>
            </button>

            <button
              id="header-run-scan-btn"
              onClick={onOpenScanModal}
              className="flex items-center space-x-2 px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold shadow-md shadow-cyan-600/30 transition-all active:scale-95"
            >
              <RefreshCw className="w-4 h-4" />
              <span>스캔 실행</span>
            </button>
          </div>
        </div>

        {/* Mobile Tab Bar */}
        <div className="flex md:hidden overflow-x-auto space-x-2 py-2 border-t border-slate-800/80 no-scrollbar">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-3 py-1 text-xs rounded-md whitespace-nowrap ${
              activeTab === 'dashboard' ? 'bg-cyan-500 text-white font-semibold' : 'text-slate-400'
            }`}
          >
            대시보드
          </button>
          <button
            onClick={() => setActiveTab('watchlist')}
            className={`px-3 py-1 text-xs rounded-md whitespace-nowrap ${
              activeTab === 'watchlist' ? 'bg-cyan-500 text-white font-semibold' : 'text-slate-400'
            }`}
          >
            워치리스트 ({totalCount})
          </button>
          <button
            onClick={() => setActiveTab('backtest')}
            className={`px-3 py-1 text-xs rounded-md whitespace-nowrap ${
              activeTab === 'backtest' ? 'bg-cyan-500 text-white font-semibold' : 'text-slate-400'
            }`}
          >
            백테스트 분석
          </button>
          <button
            onClick={() => setActiveTab('classification')}
            className={`px-3 py-1 text-xs rounded-md whitespace-nowrap ${
              activeTab === 'classification' ? 'bg-cyan-500 text-white font-semibold' : 'text-slate-400'
            }`}
          >
            자산 분류
          </button>
          <button
            onClick={() => setActiveTab('runs')}
            className={`px-3 py-1 text-xs rounded-md whitespace-nowrap ${
              activeTab === 'runs' ? 'bg-cyan-500 text-white font-semibold' : 'text-slate-400'
            }`}
          >
            실행 이력
          </button>
          <button
            onClick={onOpenDbModal}
            className="px-3 py-1 text-xs rounded-md whitespace-nowrap bg-slate-800 text-cyan-400 font-semibold border border-slate-700"
          >
            DB 설정
          </button>
        </div>
      </div>
    </header>
  );
};
