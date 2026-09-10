import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Copy,
  DollarSign,
  ExternalLink,
  Layers,
  PieChart,
  RefreshCw,
  Scale,
  Shield,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import {
  CorrelationPair,
  DynamicStrategySplit,
  MacroMarketRegime,
  MarketSector,
  PortfolioPosition,
  PortfolioRebalanceState,
  SectorExposure,
} from '../types/v8';
import { PortfolioEngine, UNIVERSE_TICKERS, SECTOR_CAPS } from '../engine/portfolioEngine';
import { MacroEarningsEngine } from '../engine/macroEarningsEngine';

interface PortfolioAllocationViewProps {
  onSelectTicker?: (ticker: string) => void;
}

export const PortfolioAllocationView: React.FC<PortfolioAllocationViewProps> = ({
  onSelectTicker,
}) => {
  const [totalCapital, setTotalCapital] = useState<number>(100000);
  const [capitalInput, setCapitalInput] = useState<string>('100000');
  const [macroRegime, setMacroRegime] = useState<MacroMarketRegime | null>(null);
  const [rebalanceState, setRebalanceState] = useState<PortfolioRebalanceState | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copiedTelegram, setCopiedTelegram] = useState<boolean>(false);
  const [selectedCorrelationTicker, setSelectedCorrelationTicker] = useState<string | null>(null);
  const [sectorFilter, setSectorFilter] = useState<string>('ALL');

  const loadData = async (capital: number = totalCapital) => {
    setIsLoading(true);
    try {
      let regime: MacroMarketRegime | null = null;
      try {
        regime = await MacroEarningsEngine.getMacroMarketRegime();
        setMacroRegime(regime);
      } catch {
        // fallback
      }

      // Compute state
      const state = PortfolioEngine.calculatePortfolioState(capital, regime || undefined);
      setRebalanceState(state);
    } catch (err) {
      console.error('[PortfolioAllocationView] Error loading state:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData(totalCapital);
  }, [totalCapital]);

  const handleApplyCapital = () => {
    const val = Number(capitalInput.replace(/[^0-9]/g, ''));
    if (!isNaN(val) && val > 0) {
      setTotalCapital(val);
    }
  };

  const handleCopyTelegram = () => {
    if (!rebalanceState) return;
    const text = PortfolioEngine.buildRebalanceTelegramSummary(rebalanceState);
    navigator.clipboard.writeText(text);
    setCopiedTelegram(true);
    setTimeout(() => setCopiedTelegram(false), 2000);
  };

  const filteredPositions = useMemo(() => {
    if (!rebalanceState) return [];
    if (sectorFilter === 'ALL') return rebalanceState.positions;
    return rebalanceState.positions.filter((p) => p.sector === sectorFilter);
  }, [rebalanceState, sectorFilter]);

  const filteredCorrelationPairs = useMemo(() => {
    if (!rebalanceState) return [];
    if (!selectedCorrelationTicker) return rebalanceState.highCorrelationPairs;
    return rebalanceState.highCorrelationPairs.filter(
      (p) => p.ticker1 === selectedCorrelationTicker || p.ticker2 === selectedCorrelationTicker
    );
  }, [rebalanceState, selectedCorrelationTicker]);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900/80 border border-slate-800 p-5 rounded-2xl">
        <div className="flex items-start space-x-3.5">
          <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 mt-1">
            <Scale className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                포트폴리오 자산 배분 & 동적 리밸런싱
              </h1>
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/30">
                Phase 2 엔진 가동
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              시장 매크로 체제에 맞춘 전략 A/B 동적 자금 분배, 섹터 과밀집 상한선 가드, 10대 핵심 자산 상관계수 매트릭스
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3 self-end sm:self-auto">
          <button
            id="portfolio-copy-telegram-btn"
            onClick={handleCopyTelegram}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 text-xs sm:text-sm font-medium border border-cyan-500/30 transition-all active:scale-95"
          >
            <Copy className="w-4 h-4" />
            <span>{copiedTelegram ? '리포트 복사됨!' : '리밸런싱 텔레그램 복사'}</span>
          </button>
          <button
            id="portfolio-refresh-btn"
            onClick={() => loadData(totalCapital)}
            disabled={isLoading}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-medium border border-slate-700 transition-all active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-purple-400' : ''}`} />
            <span>재계산</span>
          </button>
        </div>
      </div>

      {/* 2. Capital Adjustment & Dynamic Strategy Split Banner */}
      {rebalanceState && (
        <div className="bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 pb-6 border-b border-slate-800">
            {/* Capital Control */}
            <div className="space-y-2">
              <div className="text-xs text-slate-400 font-mono flex items-center space-x-2">
                <span>TOTAL ASSET MANAGEMENT</span>
                <span>•</span>
                <span>운용 총자본 설정</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <DollarSign className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={capitalInput}
                    onChange={(e) => setCapitalInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleApplyCapital()}
                    className="bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xl font-bold font-mono text-white focus:outline-none focus:border-purple-500 w-48"
                  />
                </div>
                <button
                  onClick={handleApplyCapital}
                  className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-all active:scale-95"
                >
                  적용
                </button>
                <div className="flex items-center space-x-1.5 pl-2">
                  {[50000, 100000, 250000, 500000].map((cap) => (
                    <button
                      key={cap}
                      onClick={() => {
                        setCapitalInput(String(cap));
                        setTotalCapital(cap);
                      }}
                      className={`px-2.5 py-1 text-[11px] rounded-lg border font-mono transition-all ${
                        totalCapital === cap
                          ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 font-bold'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      ${cap / 1000}k
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center space-x-4 text-xs text-slate-400 font-mono pt-1">
                <span>투자 자산: <b className="text-white">${rebalanceState.totalInvested.toLocaleString()}</b></span>
                <span>•</span>
                <span>현금 잔고: <b className="text-emerald-400">${rebalanceState.cashBalance.toLocaleString()}</b> ({rebalanceState.cashWeightPct}%)</span>
              </div>
            </div>

            {/* Dynamic Strategy Split Gauge */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 lg:w-[460px] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-bold text-white">동적 전략 자금 배분 비율</span>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-medium">
                  {rebalanceState.strategySplit.regimeName}
                </span>
              </div>

              {/* Progress split bar */}
              <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden flex shadow-inner">
                <div
                  className="bg-cyan-500 h-full transition-all duration-500"
                  style={{ width: `${rebalanceState.strategySplit.strategyA_MomentumPct}%` }}
                  title={`전략 A: ${rebalanceState.strategySplit.strategyA_MomentumPct}%`}
                />
                <div
                  className="bg-amber-500 h-full transition-all duration-500"
                  style={{ width: `${rebalanceState.strategySplit.strategyB_DipDcaPct}%` }}
                  title={`전략 B: ${rebalanceState.strategySplit.strategyB_DipDcaPct}%`}
                />
                <div
                  className="bg-emerald-500 h-full transition-all duration-500"
                  style={{ width: `${rebalanceState.strategySplit.cashBufferPct}%` }}
                  title={`현금 버퍼: ${rebalanceState.strategySplit.cashBufferPct}%`}
                />
              </div>

              {/* Legend */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                  <div className="text-[10px] text-cyan-300">전략 A (모멘텀)</div>
                  <div className="text-sm font-bold text-white">{rebalanceState.strategySplit.strategyA_MomentumPct}%</div>
                </div>
                <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <div className="text-[10px] text-amber-300">전략 B (눌림적립)</div>
                  <div className="text-sm font-bold text-white">{rebalanceState.strategySplit.strategyB_DipDcaPct}%</div>
                </div>
                <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <div className="text-[10px] text-emerald-300">현금 버퍼</div>
                  <div className="text-sm font-bold text-white">{rebalanceState.strategySplit.cashBufferPct}%</div>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                {rebalanceState.strategySplit.adjustmentReason}
              </p>
            </div>
          </div>

          {/* Sector Concentration Overview Cards */}
          <div className="pt-6 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <PieChart className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold text-white">섹터별 비중 현황 & 과밀집 리스크 상한선(Cap) 가드</h3>
              </div>
              {rebalanceState.maxConcentrationAlert && (
                <div className="text-xs text-rose-400 font-semibold flex items-center space-x-1 animate-pulse">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>{rebalanceState.maxConcentrationAlert}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {rebalanceState.sectorExposures.map((sec) => {
                const isBreach = sec.status === 'OVERWEIGHT_BREACH';
                const isElevated = sec.status === 'ELEVATED';

                return (
                  <div
                    key={sec.sector}
                    onClick={() => setSectorFilter(sectorFilter === sec.sector ? 'ALL' : sec.sector)}
                    className={`cursor-pointer p-3 rounded-xl border transition-all ${
                      sectorFilter === sec.sector
                        ? 'border-purple-500 bg-purple-950/20 ring-1 ring-purple-500/50'
                        : isBreach
                        ? 'bg-rose-950/20 border-rose-500/40 hover:border-rose-500/60'
                        : isElevated
                        ? 'bg-amber-950/20 border-amber-500/30 hover:border-amber-500/50'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-300 truncate max-w-[100px]" title={sec.sector}>
                        {sec.sector}
                      </span>
                      {isBreach ? (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/30 text-rose-300 border border-rose-500/40">
                          초과
                        </span>
                      ) : isElevated ? (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/30 text-amber-300 border border-amber-500/40">
                          경계
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500 font-mono">{sec.tickerCount}개</span>
                      )}
                    </div>

                    <div className="flex items-baseline space-x-1.5 mt-2">
                      <span className="text-lg font-bold font-mono text-white">
                        {sec.currentWeightPct}%
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        / {sec.maxCapPct}%
                      </span>
                    </div>

                    {/* Progress */}
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-2">
                      <div
                        className={`h-full ${
                          isBreach ? 'bg-rose-500' : isElevated ? 'bg-amber-500' : 'bg-purple-500'
                        }`}
                        style={{
                          width: `${Math.min(100, (sec.currentWeightPct / sec.maxCapPct) * 100)}%`,
                        }}
                      />
                    </div>

                    <div className="text-[10px] text-slate-500 truncate mt-2 font-mono">
                      {sec.tickers.join(', ')}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 3. Rebalance Orders & Position Weight Calculator Table */}
      {rebalanceState && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center space-x-2">
                <BarChart3 className="w-5 h-5 text-cyan-400" />
                <h2 className="text-lg sm:text-xl font-bold text-white">
                  포지션별 목표 비중 & 리밸런싱 주문 가이드
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                종목별 현재 평가 비중과 퀀트 엔진 목표 비중의 차이(Delta)를 계산하여 즉시 실행 가능한 주수 단위 매매 권고를 제공합니다.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-400">섹터 필터:</span>
              <select
                value={sectorFilter}
                onChange={(e) => setSectorFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
              >
                <option value="ALL">전체 섹터 보기</option>
                {rebalanceState.sectorExposures.map((s) => (
                  <option key={s.sector} value={s.sector}>
                    {s.sector} ({s.tickerCount})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="border border-slate-800 rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-medium">
                  <th className="py-3 px-4">종목 (Ticker)</th>
                  <th className="py-3 px-4">섹터 / 배정 전략</th>
                  <th className="py-3 px-4">보유 수량 / 현재가</th>
                  <th className="py-3 px-4">현재 평가금 (비중)</th>
                  <th className="py-3 px-4">목표 비중 (Delta)</th>
                  <th className="py-3 px-4">리밸런싱 액션</th>
                  <th className="py-3 px-4">권고 매매 주문</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                {filteredPositions.map((pos) => {
                  const isIncrease = pos.rebalanceAction === 'INCREASE';
                  const isTrim = pos.rebalanceAction === 'TRIM';

                  return (
                    <tr
                      key={pos.ticker}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        isTrim ? 'bg-rose-500/[0.03]' : isIncrease ? 'bg-cyan-500/[0.03]' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => onSelectTicker?.(pos.ticker)}
                            className="font-bold font-mono text-cyan-400 hover:text-cyan-300 hover:underline flex items-center space-x-1"
                          >
                            <span>{pos.ticker}</span>
                            <ExternalLink className="w-3 h-3 opacity-60" />
                          </button>
                          <span className="text-xs text-slate-400 truncate max-w-[120px]">
                            {pos.companyName}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="text-slate-300 text-xs font-medium">{pos.sector}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {pos.strategyAssigned === 'STRATEGY_A'
                            ? '🚀 전략 A (모멘텀 돌파)'
                            : pos.strategyAssigned === 'STRATEGY_B'
                            ? '💎 전략 B (우량주 눌림적립)'
                            : '🏛️ 코어 인덱스 방어'}
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono text-slate-300">
                        <div>{pos.shares}주</div>
                        <div className="text-[10px] text-slate-500">${pos.currentPrice.toFixed(2)}</div>
                      </td>

                      <td className="py-3 px-4 font-mono">
                        <div className="text-white font-semibold">${pos.marketValue.toLocaleString()}</div>
                        <div className="text-xs text-slate-400">{pos.currentWeightPct}%</div>
                      </td>

                      <td className="py-3 px-4 font-mono">
                        <div className="text-white">{pos.targetWeightPct}%</div>
                        <div
                          className={`text-xs font-medium ${
                            pos.weightDeltaPct > 0
                              ? 'text-cyan-400'
                              : pos.weightDeltaPct < 0
                              ? 'text-rose-400'
                              : 'text-slate-500'
                          }`}
                        >
                          {pos.weightDeltaPct > 0 ? '+' : ''}
                          {pos.weightDeltaPct}%
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        {isIncrease ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                            <ArrowUpRight className="w-3.5 h-3.5 text-cyan-400" />
                            <span>비중 확대 (Add)</span>
                          </span>
                        ) : isTrim ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                            <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" />
                            <span>비중 축소 (Trim)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            <span>적정 균형 (Hold)</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 font-mono text-xs">
                        {isIncrease ? (
                          <div className="text-cyan-300 font-semibold">
                            +{pos.recommendedSharesDelta}주 매수 (+$
                            {pos.recommendedCashDelta.toLocaleString()})
                          </div>
                        ) : isTrim ? (
                          <div className="text-rose-300 font-semibold">
                            {pos.recommendedSharesDelta}주 매도 (-$
                            {Math.abs(pos.recommendedCashDelta).toLocaleString()})
                          </div>
                        ) : (
                          <div className="text-slate-500">조정 불필요 (오차 범위 내)</div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Asset Correlation Heatmap & Diversification Matrix */}
      {rebalanceState && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center space-x-2">
                <Layers className="w-5 h-5 text-emerald-400" />
                <h2 className="text-lg sm:text-xl font-bold text-white">
                  10대 핵심 자산 간 수익률 상관계수(Correlation) 매트릭스
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                상관계수가 <b>0.80 이상인 고상관 자산</b>은 시장 하락 시 동시에 급락하므로 과밀 편입을 경계하고, <b>0.55 이하 분산 자산</b>과의 결합을 지향합니다.
              </p>
            </div>

            {selectedCorrelationTicker && (
              <button
                onClick={() => setSelectedCorrelationTicker(null)}
                className="text-xs text-cyan-400 hover:underline self-start sm:self-auto"
              >
                전체 매트릭스 보기 ({selectedCorrelationTicker} 필터 해제)
              </button>
            )}
          </div>

          {/* 10x10 Matrix Grid Table */}
          <div className="border border-slate-800 rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full text-center text-xs font-mono border-collapse">
              <thead>
                <tr className="bg-slate-950 text-slate-400">
                  <th className="py-2.5 px-3 text-left font-sans">Ticker</th>
                  {UNIVERSE_TICKERS.map((t) => (
                    <th key={t} className="py-2.5 px-2 font-bold text-slate-200">
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/50">
                {UNIVERSE_TICKERS.map((rowTicker, rowIdx) => (
                  <tr key={rowTicker} className="hover:bg-slate-800/30">
                    <td className="py-2 px-3 text-left font-bold text-cyan-400 bg-slate-950/60">
                      <button
                        onClick={() =>
                          setSelectedCorrelationTicker(
                            selectedCorrelationTicker === rowTicker ? null : rowTicker
                          )
                        }
                        className="hover:underline"
                      >
                        {rowTicker}
                      </button>
                    </td>
                    {UNIVERSE_TICKERS.map((colTicker, colIdx) => {
                      const corr = rebalanceState.correlationMatrix.matrix[rowIdx][colIdx];
                      const isSelf = rowIdx === colIdx;

                      // Color based on correlation intensity
                      let cellClass = 'text-slate-300';
                      let bgClass = 'bg-transparent';

                      if (isSelf) {
                        cellClass = 'text-slate-500 font-normal';
                        bgClass = 'bg-slate-950/40';
                      } else if (corr >= 0.85) {
                        cellClass = 'text-rose-300 font-bold';
                        bgClass = 'bg-rose-500/20';
                      } else if (corr >= 0.75) {
                        cellClass = 'text-amber-300 font-semibold';
                        bgClass = 'bg-amber-500/15';
                      } else if (corr < 0.55) {
                        cellClass = 'text-emerald-300 font-semibold';
                        bgClass = 'bg-emerald-500/15';
                      }

                      return (
                        <td
                          key={colTicker}
                          className={`py-2 px-2 border-l border-slate-800/40 ${cellClass} ${bgClass}`}
                          title={`${rowTicker} ↔ ${colTicker}: ${corr.toFixed(2)}`}
                        >
                          {corr.toFixed(2)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* High Correlation Warning Cards */}
          <div className="space-y-2.5 pt-2">
            <div className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {selectedCorrelationTicker
                  ? `${selectedCorrelationTicker} 관련 주요 상관성 분석`
                  : '포트폴리오 내 주요 상관관계 분석'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {filteredCorrelationPairs.slice(0, 8).map((pair, idx) => {
                const isHigh = pair.level === 'HIGH_CORRELATION';
                const isDiversified = pair.level === 'DIVERSIFIED';

                return (
                  <div
                    key={`${pair.ticker1}-${pair.ticker2}`}
                    className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                      isHigh
                        ? 'bg-rose-950/15 border-rose-500/30 text-rose-200'
                        : isDiversified
                        ? 'bg-emerald-950/15 border-emerald-500/30 text-emerald-200'
                        : 'bg-slate-950/50 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="font-mono font-bold text-sm">
                        <span>{pair.ticker1}</span>
                        <span className="text-slate-500 mx-1.5">↔</span>
                        <span>{pair.ticker2}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{pair.label}</div>
                    </div>

                    <div className="text-right">
                      <div className="font-mono font-bold text-base">
                        {pair.correlation.toFixed(2)}
                      </div>
                      <div className="text-[9px] font-mono">
                        {isHigh ? '🚨 고동조화' : isDiversified ? '🛡️ 우수 분산' : '적정'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
