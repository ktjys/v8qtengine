import React, { useState, useMemo } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Calculator,
  Check,
  CheckCircle2,
  Copy,
  DollarSign,
  Flame,
  HelpCircle,
  Percent,
  Scale,
  Shield,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { ATRRiskLevel, ATRRiskProfile, PositionSizingCalculation } from '../types/v8';
import { RiskSizingEngine } from '../engine/riskSizingEngine';
import { PaperTradingEngine } from '../engine/paperTradingEngine';

interface PositionSizingCalculatorProps {
  ticker: string;
  currentPrice: number;
  companyName?: string;
  strategyType?: string;
  initialAccountEquity?: number;
  onOrderExecuted?: () => void;
}

export const PositionSizingCalculator: React.FC<PositionSizingCalculatorProps> = ({
  ticker,
  currentPrice,
  companyName,
  strategyType,
  initialAccountEquity = 100000,
  onOrderExecuted,
}) => {
  const [riskLevel, setRiskLevel] = useState<ATRRiskLevel>('STANDARD');
  const [accountEquity, setAccountEquity] = useState<number>(initialAccountEquity);
  const [riskTolerancePct, setRiskTolerancePct] = useState<number>(1.0); // 1.0% default
  const [maxAllocationCap, setMaxAllocationCap] = useState<number>(25.0); // 25% default max
  const [customStopPrice, setCustomStopPrice] = useState<number | null>(null);

  // Execution feedback
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [executeSuccess, setExecuteSuccess] = useState<boolean>(false);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);

  // Calculate ATR Profile
  const atrProfile: ATRRiskProfile = useMemo(() => {
    return RiskSizingEngine.calculateATRRiskProfile(ticker, currentPrice, riskLevel);
  }, [ticker, currentPrice, riskLevel]);

  // Determine effective stop-loss price
  const effectiveStopPrice = customStopPrice !== null ? customStopPrice : atrProfile.stopLossPrice;

  // Calculate Position Sizing
  const sizing: PositionSizingCalculation = useMemo(() => {
    return RiskSizingEngine.calculatePositionSize({
      ticker,
      entryPrice: currentPrice,
      stopLossPrice: effectiveStopPrice,
      accountEquity,
      riskTolerancePct,
      maxAccountAllocationPct: maxAllocationCap,
    });
  }, [ticker, currentPrice, effectiveStopPrice, accountEquity, riskTolerancePct, maxAllocationCap]);

  // Execute Paper Order with Sized Shares
  const handleExecutePaperOrder = () => {
    setIsExecuting(true);
    const stratSource = strategyType === 'MOMENTUM_BREAKOUT' ? 'STRATEGY_A' : 'STRATEGY_B';
    const res = PaperTradingEngine.executeOrder({
      ticker,
      companyName,
      orderType: 'BUY',
      shares: sizing.recommendedShares,
      price: currentPrice,
      strategySource: stratSource,
      reason: `ATR ${riskLevel} (${sizing.riskTolerancePct}% 계좌리스크) 동적 사이징 주문 (${sizing.recommendedShares}주, SL $${effectiveStopPrice})`,
    });
    setIsExecuting(false);

    if (res.success) {
      setExecuteSuccess(true);
      onOrderExecuted?.();
      setTimeout(() => setExecuteSuccess(false), 3000);
    } else {
      alert(res.error || '모의투자 주문 실패');
    }
  };

  // Copy sizing summary to clipboard
  const handleCopySummary = () => {
    const text = `📐 [${ticker}] ATR 동적 손절 & 포지션 사이징 결과
• 진입 현재가: $${currentPrice.toFixed(2)}
• 14일 ATR 변동성: $${atrProfile.atr14.toFixed(2)} (${atrProfile.atrPct}%)
• 권장 손절선: $${effectiveStopPrice.toFixed(2)} (-${atrProfile.stopLossPct}%)
• 1차 목표가 (2R): $${atrProfile.takeProfit1Price.toFixed(2)} (+${atrProfile.takeProfit1Pct}%)
• 2차 목표가 (3R): $${atrProfile.takeProfit2Price.toFixed(2)} (+${atrProfile.takeProfit2Pct}%)
• 트레일링 스탑선: $${atrProfile.trailingStopPrice.toFixed(2)}
------------------------
• 계좌 자산: $${accountEquity.toLocaleString()}
• 1회 허용 위험: ${riskTolerancePct}% ($${sizing.riskAmountDollars.toLocaleString()})
• 최적 매수 수량: ${sizing.recommendedShares}주 (총 $${sizing.totalPositionCost.toLocaleString()}, 비중 ${sizing.accountAllocationPct}%)
• 손절 시 최대 손실: -$${sizing.maxLossDollars.toLocaleString()}
• 1차 도달 시 기대수익: +$${sizing.expectedGain1Dollars.toLocaleString()} (손익비 1:2.0)`;

    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-base sm:text-lg font-bold text-white">
                ATR 동적 손절 & 포지션 사이징 계산기
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                1회 리스크 고정형 (Fixed Fractional)
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              종목 고유 변동성(ATR)을 측정하여 손절폭을 차별화하고, 1회 거래 시 계좌 최대 손실액을 엄격히 통제합니다.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 self-end sm:self-auto">
          <button
            onClick={handleCopySummary}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-all active:scale-95"
          >
            {copySuccess ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copySuccess ? '복사됨!' : '계산서 복사'}</span>
          </button>
        </div>
      </div>

      {/* Grid: Left Controls, Right Results */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Risk Controls (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Volatility Indicator Badge */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400">14일 일간 변동폭 (ATR-14)</div>
              <div className="text-lg font-bold font-mono text-white mt-0.5">
                ${atrProfile.atr14.toFixed(2)}{' '}
                <span className="text-xs font-semibold text-cyan-400">
                  (주가의 {atrProfile.atrPct}%)
                </span>
              </div>
            </div>
            <div className="text-right">
              <span
                className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                  atrProfile.volatilityRank === 'LOW'
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : atrProfile.volatilityRank === 'MEDIUM'
                    ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                    : atrProfile.volatilityRank === 'HIGH'
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                }`}
              >
                {atrProfile.volatilityRank} 변동성
              </span>
              <div className="text-[10px] text-slate-500 mt-1 font-mono">
                현재가 ${currentPrice.toFixed(2)}
              </div>
            </div>
          </div>

          {/* 1. Risk Level Selector */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-2">
              손절 버퍼 강도 선택 (ATR Multiplier)
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setRiskLevel('AGGRESSIVE');
                  setCustomStopPrice(null);
                }}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  riskLevel === 'AGGRESSIVE'
                    ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div className="text-xs font-bold flex items-center justify-between">
                  <span>공격적</span>
                  <span className="text-[10px] font-mono opacity-80">1.5x</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1 truncate">
                  타이트 스윙
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setRiskLevel('STANDARD');
                  setCustomStopPrice(null);
                }}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  riskLevel === 'STANDARD'
                    ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div className="text-xs font-bold flex items-center justify-between text-cyan-300">
                  <span>스탠다드</span>
                  <span className="text-[10px] font-mono opacity-80">2.0x</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1 truncate">
                  권장 노이즈 흡수
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setRiskLevel('CONSERVATIVE');
                  setCustomStopPrice(null);
                }}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  riskLevel === 'CONSERVATIVE'
                    ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div className="text-xs font-bold flex items-center justify-between">
                  <span>보수적</span>
                  <span className="text-[10px] font-mono opacity-80">3.0x</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1 truncate">
                  여유 있는 추세
                </div>
              </button>
            </div>
          </div>

          {/* 2. Account Equity Setting */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-300">
                운용 총자본 (Account Equity)
              </label>
              <div className="flex items-center space-x-1">
                {[50000, 100000, 200000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setAccountEquity(amt)}
                    className={`px-1.5 py-0.5 text-[10px] rounded font-mono border transition-all ${
                      accountEquity === amt
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    ${amt / 1000}k
                  </button>
                ))}
              </div>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-2 text-slate-400 font-mono text-sm">$</span>
              <input
                type="number"
                step="1000"
                min="1000"
                value={accountEquity}
                onChange={(e) => setAccountEquity(Math.max(1000, Number(e.target.value)))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-7 pr-3 py-1.5 text-sm font-mono font-bold text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* 3. Risk Tolerance % per Trade Slider */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1">
                <span>1회 매매 허용 위험 (Risk %)</span>
                <HelpCircle className="w-3 h-3 text-slate-500" title="손절가에 도달했을 때 계좌에서 잃어도 되는 최대 자본 비율" />
              </label>
              <span className="text-xs font-bold font-mono text-cyan-400">
                {riskTolerancePct}% (${sizing.riskAmountDollars.toLocaleString()})
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1.5 mb-2">
              {[0.5, 1.0, 1.5, 2.0].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRiskTolerancePct(r)}
                  className={`py-1 text-xs rounded-lg font-mono font-bold border transition-all ${
                    riskTolerancePct === r
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  {r}%
                </button>
              ))}
            </div>
            <input
              type="range"
              min="0.2"
              max="3.0"
              step="0.1"
              value={riskTolerancePct}
              onChange={(e) => setRiskTolerancePct(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
          </div>

          {/* 4. Max Allocation Cap Guardrail */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-300">
                단일 종목 최대 비중 상한 (Cap %)
              </label>
              <span className="text-xs font-mono text-slate-400 font-bold">
                최대 {maxAllocationCap}%
              </span>
            </div>
            <select
              value={maxAllocationCap}
              onChange={(e) => setMaxAllocationCap(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="15">15% (매우 엄격한 분산 투자)</option>
              <option value="20">20% (보수적 분산)</option>
              <option value="25">25% (스탠다드 권장 한도)</option>
              <option value="35">35% (집중 투자 허용)</option>
            </select>
          </div>
        </div>

        {/* Right Column: Dynamic Targets & Sizing Outcome (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Target Price Ribbon (Stop, TP1, TP2, Trailing) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {/* Stop Loss */}
            <div className="bg-slate-950/80 border border-rose-500/30 rounded-xl p-3">
              <div className="text-[11px] font-semibold text-rose-400 flex items-center space-x-1">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>동적 손절선 (SL)</span>
              </div>
              <div className="text-base font-bold font-mono text-white mt-1">
                ${effectiveStopPrice.toFixed(2)}
              </div>
              <div className="text-[11px] font-mono text-rose-400 mt-0.5">
                -{atrProfile.stopLossPct}% (-${(currentPrice - effectiveStopPrice).toFixed(2)})
              </div>
            </div>

            {/* Take Profit 1 */}
            <div className="bg-slate-950/80 border border-emerald-500/30 rounded-xl p-3">
              <div className="text-[11px] font-semibold text-emerald-400 flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>1차 익절 (2R)</span>
              </div>
              <div className="text-base font-bold font-mono text-white mt-1">
                ${atrProfile.takeProfit1Price.toFixed(2)}
              </div>
              <div className="text-[11px] font-mono text-emerald-400 mt-0.5">
                +{atrProfile.takeProfit1Pct}% (손익비 1:2)
              </div>
            </div>

            {/* Take Profit 2 */}
            <div className="bg-slate-950/80 border border-cyan-500/30 rounded-xl p-3">
              <div className="text-[11px] font-semibold text-cyan-400 flex items-center space-x-1">
                <Zap className="w-3.5 h-3.5" />
                <span>2차 익절 (3R)</span>
              </div>
              <div className="text-base font-bold font-mono text-white mt-1">
                ${atrProfile.takeProfit2Price.toFixed(2)}
              </div>
              <div className="text-[11px] font-mono text-cyan-400 mt-0.5">
                +{atrProfile.takeProfit2Pct}% (손익비 1:3)
              </div>
            </div>

            {/* Trailing Stop */}
            <div className="bg-slate-950/80 border border-purple-500/30 rounded-xl p-3">
              <div className="text-[11px] font-semibold text-purple-400 flex items-center space-x-1">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>트레일링 스탑</span>
              </div>
              <div className="text-base font-bold font-mono text-white mt-1">
                ${atrProfile.trailingStopPrice.toFixed(2)}
              </div>
              <div className="text-[11px] font-mono text-purple-400 mt-0.5">
                고점 -1.5x ATR
              </div>
            </div>
          </div>

          {/* Optimal Sizing Hero Card */}
          <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-cyan-500/30 rounded-2xl p-5 shadow-lg relative overflow-hidden space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
                Fixed-Fractional Position Sizing
              </div>
              <span className="text-xs text-slate-400 font-mono">
                1주당 위험: ${sizing.riskPerShare.toFixed(2)}
              </span>
            </div>

            {/* Shares and Total Amount */}
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-b border-slate-800 pb-4">
              <div>
                <div className="text-xs text-slate-400">권장 매수 주수 (Optimal Shares)</div>
                <div className="text-3xl sm:text-4xl font-extrabold font-mono text-white mt-1">
                  {sizing.recommendedShares}{' '}
                  <span className="text-base font-semibold text-cyan-400">주</span>
                </div>
              </div>

              <div className="sm:text-right">
                <div className="text-xs text-slate-400">총 투자 금액 (비중)</div>
                <div className="text-xl sm:text-2xl font-bold font-mono text-slate-200 mt-1">
                  ${sizing.totalPositionCost.toLocaleString()}{' '}
                  <span className="text-sm font-semibold text-slate-400">
                    ({sizing.accountAllocationPct}%)
                  </span>
                </div>
              </div>
            </div>

            {/* Expected Outcomes Matrix */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-slate-900/90 border border-rose-500/20 rounded-xl p-2.5">
                <div className="text-[10px] text-rose-400 font-semibold">손절 시 최대 손실</div>
                <div className="text-sm sm:text-base font-bold font-mono text-rose-300 mt-0.5">
                  -${sizing.maxLossDollars.toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  (계좌의 {sizing.riskTolerancePct}%)
                </div>
              </div>

              <div className="bg-slate-900/90 border border-emerald-500/20 rounded-xl p-2.5">
                <div className="text-[10px] text-emerald-400 font-semibold">1차(2R) 기대 수익</div>
                <div className="text-sm sm:text-base font-bold font-mono text-emerald-300 mt-0.5">
                  +${sizing.expectedGain1Dollars.toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  (손익비 1:2.0)
                </div>
              </div>

              <div className="bg-slate-900/90 border border-cyan-500/20 rounded-xl p-2.5">
                <div className="text-[10px] text-cyan-400 font-semibold">2차(3R) 기대 수익</div>
                <div className="text-sm sm:text-base font-bold font-mono text-cyan-300 mt-0.5">
                  +${sizing.expectedGain2Dollars.toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  (손익비 1:3.0)
                </div>
              </div>
            </div>

            {/* Cap Warning if Active */}
            {sizing.isCappedByAccountLimit && sizing.capWarning && (
              <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-300 text-xs flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{sizing.capWarning}</span>
              </div>
            )}

            {/* Execute Button */}
            <div className="pt-1">
              <button
                type="button"
                onClick={handleExecutePaperOrder}
                disabled={isExecuting || sizing.recommendedShares < 1}
                className={`w-full py-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center space-x-2 transition-all shadow-lg active:scale-95 ${
                  executeSuccess
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950'
                }`}
              >
                {executeSuccess ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>가상 모의투자 계좌에 {sizing.recommendedShares}주 매수 체결 완료!</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>
                      모의투자 계좌에 이 수량({sizing.recommendedShares}주, ${sizing.totalPositionCost.toLocaleString()})으로 즉시 주문
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
