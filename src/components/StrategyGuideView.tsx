import React, { useState } from 'react';
import {
  BookOpen,
  TrendingUp,
  ShieldAlert,
  Zap,
  CheckCircle2,
  AlertCircle,
  Calculator,
  Compass,
  ArrowRight,
  Sparkles,
  HelpCircle,
  DollarSign,
  Scale,
  Clock,
  Crosshair,
  Flame,
  Layers,
  ChevronRight,
  ShieldCheck,
  CheckSquare,
  Square,
  Repeat,
  ExternalLink,
  Target,
  ArrowUpRight,
  Percent,
} from 'lucide-react';
import { FullTickerEvaluation } from '../types/v8';
import { formatStockPrice, formatChangePercent } from '../utils/formatters';
import { ensureDipEvaluation } from '../engine/dipBuyEngine';

interface StrategyGuideViewProps {
  evaluations?: FullTickerEvaluation[];
  onSelectTicker?: (ticker: string, initialTab?: 'overview' | 'chart' | 'dip_buy') => void;
  onNavigateToWatchlist?: (mode?: 'MOMENTUM' | 'DCA_DIP') => void;
  onNavigateToMacro?: () => void;
  onNavigateToPaper?: () => void;
}

type GuideStrategyType = 'momentum' | 'dca' | 'macro' | 'sizing';

export const StrategyGuideView: React.FC<StrategyGuideViewProps> = ({
  evaluations = [],
  onSelectTicker,
  onNavigateToWatchlist,
  onNavigateToMacro,
  onNavigateToPaper,
}) => {
  const [selectedStrategy, setSelectedStrategy] = useState<GuideStrategyType>('momentum');

  // Specific stock selected for Strategy A (Momentum) Live Trading Action Plan
  const [selectedMomentumTicker, setSelectedMomentumTicker] = useState<string | null>(null);

  // Specific stock selected for Strategy B (DCA/Dip) Live Execution Plan
  const [selectedDcaTicker, setSelectedDcaTicker] = useState<string | null>(null);

  // Strategy A (Momentum) Qualified Recommendations:
  // 1. STRONG_OPPORTUNITY or OPPORTUNITY
  // 2. Or high score >= 60 with positive action
  const momentumCandidates = React.useMemo(() => {
    if (!Array.isArray(evaluations)) return [];
    return evaluations
      .filter((ev) => {
        if (!ev) return false;
        const decision = ev.decision?.decision || (ev as any).decision?.action;
        const score = ev.opportunity?.opportunity_score ?? (ev as any).opportunity?.compositeScore ?? 0;
        const isActionable =
          decision === 'STRONG_OPPORTUNITY' ||
          decision === 'OPPORTUNITY' ||
          (score >= 60 && decision !== 'AVOID' && decision !== 'SELL');
        return isActionable;
      })
      .sort((a, b) => {
        const scoreA = a.opportunity?.opportunity_score ?? (a as any).opportunity?.compositeScore ?? 0;
        const scoreB = b.opportunity?.opportunity_score ?? (b as any).opportunity?.compositeScore ?? 0;
        return scoreB - scoreA;
      });
  }, [evaluations]);

  // Strategy B (DCA / Dip Buy) Qualified Recommendations:
  // Evaluated through ensureDipEvaluation
  const dcaCandidates = React.useMemo(() => {
    if (!Array.isArray(evaluations)) return [];
    return evaluations
      .filter(Boolean)
      .map((ev) => {
        const dip = ev.dip_evaluation || ensureDipEvaluation(ev);
        return { ev, dip };
      })
      .filter(({ dip }) => {
        if (!dip) return false;
        // High quality Tier S or Tier A with dip buying suitability
        const tier = dip.suitability?.tier;
        return (
          tier === 'S' ||
          tier === 'A' ||
          dip.actionable ||
          dip.timing?.score >= 50
        );
      })
      .sort((a, b) => {
        // Sort actionable first, then by dip score
        if (a.dip.actionable !== b.dip.actionable) {
          return a.dip.actionable ? -1 : 1;
        }
        return (b.dip?.dip_score ?? 0) - (a.dip?.dip_score ?? 0);
      });
  }, [evaluations]);

  // Sync initial selection if not selected yet
  const activeMomentumItem = React.useMemo(() => {
    if (selectedMomentumTicker) {
      const found = momentumCandidates.find((c) => c.ticker === selectedMomentumTicker);
      if (found) return found;
    }
    return momentumCandidates[0] || evaluations[0] || null;
  }, [selectedMomentumTicker, momentumCandidates, evaluations]);

  const activeDcaItem = React.useMemo(() => {
    if (selectedDcaTicker) {
      const found = dcaCandidates.find((c) => c.ev.ticker === selectedDcaTicker);
      if (found) return found;
    }
    return dcaCandidates[0] || (evaluations[0] ? {
      ev: evaluations[0],
      dip: evaluations[0].dip_evaluation || ensureDipEvaluation(evaluations[0])
    } : null);
  }, [selectedDcaTicker, dcaCandidates, evaluations]);

  // Interactive Trade Sizing Calculator State
  const [calcAccountSize, setCalcAccountSize] = useState<number>(30000000); // 3천만원
  const [calcRiskPct, setCalcRiskPct] = useState<number>(1.5); // 1.5%
  const [calcStockPrice, setCalcStockPrice] = useState<number>(180); // $180
  const [calcAtr, setCalcAtr] = useState<number>(4.5); // $4.5 ATR
  const [calcAtrMult, setCalcAtrMult] = useState<number>(2.0); // 2.0x

  // Interactive Checklist State
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  const toggleCheck = (id: string) => {
    setCheckedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Calculator outputs
  const maxRiskAmountKrw = calcAccountSize * (calcRiskPct / 100);
  const stopDistance = calcAtr * calcAtrMult;
  const stopLossPrice = Math.max(0, calcStockPrice - stopDistance);
  const targetPrice1 = calcStockPrice + calcAtr * 3.5;
  const targetPrice2 = calcStockPrice + calcAtr * 5.0;
  const lossPerShare = stopDistance;
  // approximate exchange rate 1,350 KRW per USD for share sizing
  const lossPerShareKrw = lossPerShare * 1350;
  const calculatedShares = lossPerShareKrw > 0 ? Math.floor(maxRiskAmountKrw / lossPerShareKrw) : 0;
  const totalPositionKrw = calculatedShares * calcStockPrice * 1350;
  const positionPctOfAccount = calcAccountSize > 0 ? (totalPositionKrw / calcAccountSize) * 100 : 0;

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* 1. Header Hero Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-xs font-semibold">
            <Compass className="w-3.5 h-3.5" />
            <span>QUANT STRATEGY PLAYBOOK & PHILOSOPHY</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            전략별 특징·철학 & 실전 매매 가이드
          </h1>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            감정에 휘둘리지 않는 퀀트 투자의 핵심은 <b>명확한 통계적 우위(Edge)</b>와 <b>철저한 규칙의 실행</b>입니다.
            각 전략의 탄생 배경, 시장 비효율성 원리, 진입·손절·익절 공식 및 자금 관리 원칙을 상세히 안내합니다.
          </p>

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              onClick={() => onNavigateToWatchlist?.('MOMENTUM')}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md transition-all active:scale-95"
            >
              <span>모멘텀 신호 종목 보러가기</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onNavigateToWatchlist?.('DCA_DIP')}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all active:scale-95"
            >
              <span>우량주 눌림목 종목 보러가기</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 -mb-20 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* 2. Strategy Selector Tabs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
        <button
          onClick={() => setSelectedStrategy('momentum')}
          className={`p-3.5 sm:p-4 rounded-xl text-left border transition-all flex flex-col justify-between ${
            selectedStrategy === 'momentum'
              ? 'bg-cyan-500/10 border-cyan-500/50 shadow-md shadow-cyan-500/10'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400">
              <Zap className="w-4 h-4" />
            </span>
            <div className="flex items-center space-x-1.5">
              {momentumCandidates.length > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {momentumCandidates.length}개 포착
                </span>
              )}
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                selectedStrategy === 'momentum' ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-400'
              }`}>
                공격형
              </span>
            </div>
          </div>
          <div className="mt-3">
            <div className="font-bold text-sm text-slate-100">1. 모멘텀 추세추종</div>
            <div className="text-xs text-slate-400 truncate mt-0.5">상승 탄력 극대화 & 트렌드 서핑</div>
          </div>
        </button>

        <button
          onClick={() => setSelectedStrategy('dca')}
          className={`p-3.5 sm:p-4 rounded-xl text-left border transition-all flex flex-col justify-between ${
            selectedStrategy === 'dca'
              ? 'bg-emerald-500/10 border-emerald-500/50 shadow-md shadow-emerald-500/10'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </span>
            <div className="flex items-center space-x-1.5">
              {dcaCandidates.length > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {dcaCandidates.length}개 대상
                </span>
              )}
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                selectedStrategy === 'dca' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
              }`}>
                가치적립형
              </span>
            </div>
          </div>
          <div className="mt-3">
            <div className="font-bold text-sm text-slate-100">2. 우량주 눌림목 분할매수</div>
            <div className="text-xs text-slate-400 truncate mt-0.5">공포 구간 분할 적립 & 복리 가치</div>
          </div>
        </button>

        <button
          onClick={() => setSelectedStrategy('macro')}
          className={`p-3.5 sm:p-4 rounded-xl text-left border transition-all flex flex-col justify-between ${
            selectedStrategy === 'macro'
              ? 'bg-amber-500/10 border-amber-500/50 shadow-md shadow-amber-500/10'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
              <ShieldAlert className="w-4 h-4" />
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              selectedStrategy === 'macro' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400'
            }`}>
              시장방어형
            </span>
          </div>
          <div className="mt-3">
            <div className="font-bold text-sm text-slate-100">3. 매크로 리스크 가드</div>
            <div className="text-xs text-slate-400 truncate mt-0.5">VIX·금리·어닝 위험 비중 조절</div>
          </div>
        </button>

        <button
          onClick={() => setSelectedStrategy('sizing')}
          className={`p-3.5 sm:p-4 rounded-xl text-left border transition-all flex flex-col justify-between ${
            selectedStrategy === 'sizing'
              ? 'bg-purple-500/10 border-purple-500/50 shadow-md shadow-purple-500/10'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="p-2 rounded-lg bg-purple-500/20 text-purple-400">
              <Scale className="w-4 h-4" />
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              selectedStrategy === 'sizing' ? 'bg-purple-500 text-slate-950' : 'bg-slate-800 text-slate-400'
            }`}>
              자금관리
            </span>
          </div>
          <div className="mt-3">
            <div className="font-bold text-sm text-slate-100">4. 켈리 & 포지션 사이징</div>
            <div className="text-xs text-slate-400 truncate mt-0.5">계좌 리스크 1.5% 룰 & 베팅 크기</div>
          </div>
        </button>
      </div>

      {/* 3. Detailed Strategy Guide Content */}

      {/* STRATEGY 1: MOMENTUM */}
      {selectedStrategy === 'momentum' && (
        <div className="space-y-6">
          {/* Strategy Identity Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
              <div>
                <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Strategy 01</span>
                <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center space-x-2 mt-0.5">
                  <span>모멘텀 추세추종 전략 (Momentum Trend-Following)</span>
                </h2>
              </div>
              <div className="flex items-center space-x-2 text-xs font-mono">
                <span className="px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                  권장 보유기간: <b>5일 ~ 20영업일</b>
                </span>
                <span className="px-2.5 py-1 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  목표 손익비: <b>1 : 2.0 이상</b>
                </span>
              </div>
            </div>

            {/* Core Philosophy */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 space-y-2">
                <div className="flex items-center space-x-2 text-cyan-400 font-bold text-sm">
                  <Flame className="w-4 h-4" />
                  <span>핵심 철학 (Core Thesis)</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  <b>"달리는 말에 올라타고, 꺾일 때 내린다."</b> 주가는 한번 방향성을 형성하면 관성(Momentum)에 의해 같은 방향으로 지속되는 통계적 경향이 강합니다.
                  가장 강한 주도주를 골라 상승 파동을 온전히 누립니다.
                </p>
              </div>

              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 space-y-2">
                <div className="flex items-center space-x-2 text-emerald-400 font-bold text-sm">
                  <Sparkles className="w-4 h-4" />
                  <span>통계적 우위 (The Edge)</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  기관 수급과 펀더멘털 개선이 동반된 주도주는 시장 지수(SPY) 대비 지속적인 초과수익(RS)을 발생시킵니다.
                  정배열(MA20 &gt; 50 &gt; 200)과 거래량 확증은 확률 높은 승률을 보장합니다.
                </p>
              </div>

              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 space-y-2">
                <div className="flex items-center space-x-2 text-rose-400 font-bold text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>절대 원칙 (Iron Rule)</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  <b>"손실은 짧게, 수익은 길게 (Cut losses, let profits run)."</b> 판단이 틀렸음이 확인되는 손절선(ATR 2.0~2.4x)에 도달하면 일말의 미련 없이 기계적으로 손절합니다. 물타기는 엄격히 금지됩니다.
                </p>
              </div>
            </div>
          </div>

          {/* Step by Step Trading Playbook */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5">
            <h3 className="text-lg font-bold text-white flex items-center space-x-2">
              <Crosshair className="w-5 h-5 text-cyan-400" />
              <span>실전 매매 4단계 프로세스 (Step-by-Step Playbook)</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Step 1 */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 font-bold text-xs flex items-center justify-center">
                    1
                  </span>
                  <span className="text-[10px] text-cyan-400 font-mono font-bold">진입 탐색</span>
                </div>
                <div className="font-semibold text-sm text-slate-200">시그널 확증</div>
                <ul className="text-xs text-slate-400 space-y-1.5 leading-relaxed">
                  <li>• 의사결정: <b>STRONG_OPPORTUNITY</b> 또는 <b>OPPORTUNITY</b></li>
                  <li>• 기회점수 70점 이상 (권장 최적화 기준)</li>
                  <li>• MA20 &gt; MA50 &gt; MA200 정배열 확인</li>
                  <li>• RSI(14) 40~65 구간 (70 이상 과열 시 추격 금지)</li>
                </ul>
              </div>

              {/* Step 2 */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 font-bold text-xs flex items-center justify-center">
                    2
                  </span>
                  <span className="text-[10px] text-cyan-400 font-mono font-bold">주문 실행</span>
                </div>
                <div className="font-semibold text-sm text-slate-200">분할 진입</div>
                <ul className="text-xs text-slate-400 space-y-1.5 leading-relaxed">
                  <li>• <b>진입 시점</b>: 시그널 발생 당일 종가 또는 익일 장초반 분할 매수</li>
                  <li>• <b>비중</b>: 전체 계좌의 8%~15% 수준 (최대 리스크 1.5% 한도)</li>
                  <li>• <b>주문 방식</b>: 시장가 진입보다는 5일선 인근 지정가 분할 주문 권장</li>
                </ul>
              </div>

              {/* Step 3 */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 font-bold text-xs flex items-center justify-center">
                    3
                  </span>
                  <span className="text-[10px] text-cyan-400 font-mono font-bold">방어선 구축</span>
                </div>
                <div className="font-semibold text-sm text-slate-200">동적 손절선 설정</div>
                <ul className="text-xs text-slate-400 space-y-1.5 leading-relaxed">
                  <li>• <b>손절 기준</b>: 진입가 - (ATR × 2.0~2.4)</li>
                  <li>• <b>원칙</b>: 진입 즉시 HTS/MTS에 <b>Stop-Loss 주문</b> 예약</li>
                  <li>• 주가 상승 시 본전(Breakeven) 가격으로 손절선을 상향 이동(Trailing Stop)</li>
                </ul>
              </div>

              {/* Step 4 */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 font-bold text-xs flex items-center justify-center">
                    4
                  </span>
                  <span className="text-[10px] text-cyan-400 font-mono font-bold">수익 실현</span>
                </div>
                <div className="font-semibold text-sm text-slate-200">분할 익절 & 청산</div>
                <ul className="text-xs text-slate-400 space-y-1.5 leading-relaxed">
                  <li>• <b>1차 목표가</b>: 진입가 + (ATR × 3.5) 도달 시 보유 물량의 <b>50% 익절</b></li>
                  <li>• <b>잔여 물량</b>: 20일 이동평균선을 하향 이탈할 때까지 추세를 계속 홀딩</li>
                  <li>• 20영업일 경과 후 목표 미도달 시 시간 경과(Time-stop) 청산 검토</li>
                </ul>
              </div>
            </div>
          </div>

          {/* DOs and DONTs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-5 space-y-3">
              <div className="flex items-center space-x-2 text-emerald-400 font-bold text-sm">
                <CheckCircle2 className="w-4 h-4" />
                <span>모멘텀 트레이더가 반드시 지켜야 할 것 (DOs)</span>
              </div>
              <ul className="space-y-2 text-xs text-slate-300">
                <li className="flex items-start space-x-2">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span>진입 전 반드시 손절가를 정하고, 손실 규모가 계좌의 1.5%를 넘지 않게 수량을 계산하세요.</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span>1차 목표가에 도달하면 절반을 익절하여 수익을 확정 짓고 마음의 안정을 찾으세요.</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span>시장이 하락 국면(VIX &gt; 25)일 때는 신호가 나와도 포지션 크기를 평소의 50%로 축소하세요.</span>
                </li>
              </ul>
            </div>

            <div className="bg-rose-950/20 border border-rose-500/30 rounded-2xl p-5 space-y-3">
              <div className="flex items-center space-x-2 text-rose-400 font-bold text-sm">
                <AlertCircle className="w-4 h-4" />
                <span>절대 하지 말아야 할 치명적 실수 (DON'Ts)</span>
              </div>
              <ul className="space-y-2 text-xs text-slate-300">
                <li className="flex items-start space-x-2">
                  <span className="text-rose-400 font-bold">✕</span>
                  <span><b>손절선 하향 조정 금지</b>: 손절선에 닿았는데 "곧 반등하겠지"라며 손절가를 낮추는 행위는 계좌 파산의 1순위 원인입니다.</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-rose-400 font-bold">✕</span>
                  <span><b>손실 중인 모멘텀 포지션에 물타기 금지</b>: 추세가 꺾인 종목에 평단가를 낮추려 추가 매수하지 마세요.</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-rose-400 font-bold">✕</span>
                  <span><b>어닝 발표 3일 전 불나방 추격 금지</b>: 실적 발표는 동전 던지기와 같으므로 모멘텀 진입을 보류하세요.</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Real-time Strategy 1 (Momentum) Recommended Tickers & Dynamic Action Guides */}
          <div className="bg-slate-900 border border-cyan-500/40 rounded-2xl p-5 sm:p-6 space-y-5 shadow-lg shadow-cyan-950/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400">
                    <Crosshair className="w-4 h-4" />
                  </span>
                  <h3 className="text-lg font-bold text-white">
                    현재 모멘텀 포착 종목별 실전 매매 가이드 (Live Action)
                  </h3>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  모멘텀 엔진이 발굴한 유망 종목의 현재가·변동폭을 기반으로 <b>진입가 / 1차 손절선 / 1·2차 목표가 / 적정 주문 수량</b>을 자동 계산하여 안내합니다.
                </p>
              </div>

              {momentumCandidates.length > 0 && (
                <div className="text-xs font-mono text-cyan-400 bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/30 self-start sm:self-auto">
                  추천 후보 {momentumCandidates.length}개 종목
                </div>
              )}
            </div>

            {momentumCandidates.length === 0 ? (
              <div className="p-8 text-center bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
                <ShieldAlert className="w-8 h-8 text-slate-500 mx-auto" />
                <p className="text-sm font-semibold text-slate-300">현재 엄격한 모멘텀 조건을 충족하는 종목이 없습니다.</p>
                <p className="text-xs text-slate-500">지수가 횡보 또는 조정 중일 때는 현금을 비축하고 시그널이 발생할 때까지 대기하세요.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Ticker Selector Pills */}
                <div>
                  <label className="text-xs font-semibold text-slate-400 mb-2 block">
                    종목을 선택하여 맞춤형 매매 계획서를 확인하세요:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {momentumCandidates.map((cand) => {
                      const isSelected = activeMomentumItem?.ticker === cand.ticker;
                      return (
                        <button
                          key={cand.ticker}
                          onClick={() => setSelectedMomentumTicker(cand.ticker)}
                          className={`px-3 py-2 rounded-xl text-left border transition-all flex items-center space-x-2.5 ${
                            isSelected
                              ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-md shadow-cyan-500/10'
                              : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-950'
                          }`}
                        >
                          <div className="text-left">
                            <div className="flex items-center space-x-1.5">
                              <span className="font-mono font-bold text-xs">{cand.ticker}</span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-cyan-400 font-mono">
                                점수 {cand.opportunity?.opportunity_score ?? (cand as any).opportunity?.compositeScore ?? 0}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                              {formatStockPrice(cand.price ?? (cand as any).indicators?.price ?? 0, cand.ticker)}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Selected Ticker Detailed Trading Guide Card */}
                {activeMomentumItem && (() => {
                  const item = activeMomentumItem;
                  const price = Number(item.price ?? item.indicators?.price ?? 100) || 100;
                  const rawRsi = item.opportunity?.technical_details?.rsi14 ?? item.indicators?.rsi14;
                  const rsiVal = typeof rawRsi === 'number' && !isNaN(rawRsi) ? rawRsi : null;
                  const ma20Val = Number(item.opportunity?.technical_details?.priceAboveMa20 !== undefined
                    ? (item.indicators?.ma20 ?? price)
                    : (item.indicators?.ma20 ?? price)) || price;
                  // ATR proxy: estimate 2.2% of price if ATR not directly stored, or derive from volatility
                  const estimatedAtr = item.risk?.risk_score ? Math.max(0.5, price * 0.022) : Math.max(0.5, price * 0.02);
                  const stopLoss = Math.max(0, price - (estimatedAtr * 2.0));
                  const target1 = price + (estimatedAtr * 3.5);
                  const target2 = price + (estimatedAtr * 5.0);
                  const stopLossPct = price > 0 ? ((price - stopLoss) / price) * 100 : 4.4;
                  const target1Pct = price > 0 ? ((target1 - price) / price) * 100 : 7.7;
                  const target2Pct = price > 0 ? ((target2 - price) / price) * 100 : 11.0;
                  const rewardToRisk = stopLossPct > 0 ? (target1Pct / stopLossPct).toFixed(1) : '1.8';

                  // Position size recommendation: 계좌 리스크 1.5% 기준
                  const riskPerShare = Math.max(1, price - stopLoss);
                  const maxRiskKrw = calcAccountSize * 0.015; // 1.5% rule
                  const riskPerShareKrw = riskPerShare * 1350;
                  const recommendedQty = riskPerShareKrw > 0 ? Math.floor(maxRiskKrw / riskPerShareKrw) : 0;
                  const totalCapitalKrw = recommendedQty * price * 1350;
                  const accountWeightPct = calcAccountSize > 0 ? ((totalCapitalKrw / calcAccountSize) * 100).toFixed(1) : '0';

                  return (
                    <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4">
                      {/* Ticker Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/80 p-3.5 rounded-xl border border-slate-800">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center font-mono font-black text-cyan-400 text-sm">
                            {item.ticker.slice(0, 3)}
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-white text-base">{item.ticker}</span>
                              <span className="text-xs text-slate-400 truncate max-w-[180px] sm:max-w-xs">{item.name}</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-semibold">
                                {item.decision?.decision === 'STRONG_OPPORTUNITY' || (item as any).opportunity?.level === 'STRONG_OPPORTUNITY' ? '강력 추천' : '추세 신호'}
                              </span>
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5 flex items-center space-x-2">
                              <span>현재가: <b className="text-white font-mono">{formatStockPrice(price, item.ticker)}</b></span>
                              <span>•</span>
                              <span>RSI: <b className="text-slate-200 font-mono">{rsiVal ? rsiVal.toFixed(1) : 'N/A'}</b></span>
                              <span>•</span>
                              <span>20MA: <b className="text-slate-200 font-mono">{formatStockPrice(ma20Val, item.ticker)}</b></span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 self-end sm:self-auto">
                          <button
                            onClick={() => {
                              setCalcStockPrice(Number(price.toFixed(2)));
                              setCalcAtr(Number(estimatedAtr.toFixed(2)));
                              setSelectedStrategy('sizing');
                            }}
                            className="px-3 py-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 text-xs font-semibold flex items-center space-x-1.5 transition-all"
                          >
                            <Calculator className="w-3.5 h-3.5" />
                            <span>계산기로 수량 산출</span>
                          </button>
                          {onSelectTicker && (
                            <button
                              onClick={() => onSelectTicker(item.ticker, 'overview')}
                              className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-md"
                            >
                              <span>종목 상세 분석</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Tactical Execution Plan Table */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {/* 1. 진입 가이드 */}
                        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                          <div className="text-[11px] font-bold text-cyan-400 flex items-center justify-between">
                            <span>1단계: 매수 진입</span>
                            <span className="font-mono text-[10px] bg-cyan-500/10 px-1.5 py-0.5 rounded">현재가 부근</span>
                          </div>
                          <div className="text-base font-black text-white font-mono">
                            {formatStockPrice(price, item.ticker)}
                          </div>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            당일 시가 또는 20일선 지지 확인 후 즉시 분할 진입. 장중 추격 매수보다는 눌림 시 매수 권장.
                          </p>
                        </div>

                        {/* 2. 손절선 가이드 */}
                        <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-500/30 space-y-1.5">
                          <div className="text-[11px] font-bold text-rose-400 flex items-center justify-between">
                            <span>2단계: 필수 손절선</span>
                            <span className="font-mono text-[10px] bg-rose-500/10 px-1.5 py-0.5 rounded text-rose-300">
                              -{stopLossPct.toFixed(1)}%
                            </span>
                          </div>
                          <div className="text-base font-black text-rose-300 font-mono">
                            {formatStockPrice(stopLoss, item.ticker)}
                          </div>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            진입 즉시 증권사에 Stop-Loss 예약 필수. 이탈 시 이유를 불문하고 기계적으로 전량 손절.
                          </p>
                        </div>

                        {/* 3. 1차 익절 가이드 */}
                        <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-1.5">
                          <div className="text-[11px] font-bold text-emerald-400 flex items-center justify-between">
                            <span>3단계: 1차 분할 익절</span>
                            <span className="font-mono text-[10px] bg-emerald-500/10 px-1.5 py-0.5 rounded text-emerald-300">
                              +{target1Pct.toFixed(1)}% (50% 매도)
                            </span>
                          </div>
                          <div className="text-base font-black text-emerald-300 font-mono">
                            {formatStockPrice(target1, item.ticker)}
                          </div>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            목표 도달 시 50%를 익절하여 확정 수익을 챙기고, 잔여 물량의 손절선을 진입가(본전)로 상향.
                          </p>
                        </div>

                        {/* 4. 최종 목표 및 트레일링 */}
                        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                          <div className="text-[11px] font-bold text-purple-400 flex items-center justify-between">
                            <span>4단계: 최종 목표/트렌드</span>
                            <span className="font-mono text-[10px] bg-purple-500/10 px-1.5 py-0.5 rounded text-purple-300">
                              +{target2Pct.toFixed(1)}%
                            </span>
                          </div>
                          <div className="text-base font-black text-purple-300 font-mono">
                            {formatStockPrice(target2, item.ticker)}
                          </div>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            추세가 강력할 경우 20일 이동평균선 이탈 전까지 잔여 물량 홀딩. 20영업일 초과 시 시간 청산 검토.
                          </p>
                        </div>
                      </div>

                      {/* Position Sizing Recommendation for this Ticker */}
                      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 sm:p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2 text-slate-200 font-semibold">
                            <Scale className="w-3.5 h-3.5 text-cyan-400" />
                            <span><b>{item.ticker}</b> 권장 포지션 규모 (내 계좌 3천만원 기준 1.5% 리스크 한도)</span>
                          </div>
                          <p className="text-[11px] text-slate-400">
                            1주당 손실 허용액: <b>${riskPerShare.toFixed(2)}</b> (약 {(riskPerShareKrw).toLocaleString('ko-KR')}원) | 손익비 1 : {rewardToRisk}
                          </p>
                        </div>

                        <div className="flex items-center space-x-3 self-end md:self-auto font-mono">
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 block">권장 매수 수량</span>
                            <span className="text-sm font-black text-cyan-400">{recommendedQty > 0 ? `${recommendedQty} 주` : '1 주'}</span>
                          </div>
                          <div className="h-6 w-px bg-slate-800" />
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 block">포지션 투자금</span>
                            <span className="text-sm font-black text-white">{Math.round(totalCapitalKrw / 10000).toLocaleString('ko-KR')}만원 ({accountWeightPct}%)</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      )}

      {/* STRATEGY 2: DCA & DIP BUY */}
      {selectedStrategy === 'dca' && (
        <div className="space-y-6">
          {/* Strategy Identity Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
              <div>
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Strategy 02</span>
                <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center space-x-2 mt-0.5">
                  <span>우량대형주 적립 & 눌림목 분할매수 (Blue-Chip DCA & Dip Buy)</span>
                </h2>
              </div>
              <div className="flex items-center space-x-2 text-xs font-mono">
                <span className="px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                  권장 보유기간: <b>3개월 ~ 수년 (장기 복리)</b>
                </span>
                <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  대상: <b>💎 S등급 / 🥇 A등급 우량주만</b>
                </span>
              </div>
            </div>

            {/* Core Philosophy */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 space-y-2">
                <div className="flex items-center space-x-2 text-emerald-400 font-bold text-sm">
                  <Flame className="w-4 h-4" />
                  <span>워런 버핏의 철학 (Core Thesis)</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  <b>"남들이 두려워할 때 탐욕을 가져라."</b> 독점적 해자(Moat)와 막대한 잉여현금흐름(FCF)을 창출하는 초우량 기업은 일시적인 시장 공포나 단기 노이즈로 주가가 급락했을 때가 일생일대의 세일 기간입니다.
                </p>
              </div>

              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 space-y-2">
                <div className="flex items-center space-x-2 text-cyan-400 font-bold text-sm">
                  <Repeat className="w-4 h-4" />
                  <span>시간과 복리의 우위 (Edge)</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  완벽한 바닥을 맞히려는 시도는 불가능합니다. 대신 수학적으로 설계된 <b>단계별 분할 매수 스케줄</b>을 통해 평단가를 안전하게 낮추고, 시장이 정상화될 때 막대한 복리 수익을 회수합니다.
                </p>
              </div>

              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 space-y-2">
                <div className="flex items-center space-x-2 text-amber-400 font-bold text-sm">
                  <ShieldCheck className="w-4 h-4" />
                  <span>우량주 적격성 하드 필터</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  <b>잡주는 떨어지면 상장폐지되지만, 초우량주는 신고가를 갱신합니다.</b> 본 엔진의 S/A등급(시가총액 50B+ 달러, FCF 마진 15%+, 지수 편입) 기준을 통과한 기업만 추매 대상이 됩니다.
                </p>
              </div>
            </div>
          </div>

          {/* DCA Pyramid Tranche Guide */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center space-x-2">
              <Layers className="w-5 h-5 text-emerald-400" />
              <span>눌림목 3단계 분할 매수 피라미드 (Pyramid Tranche Schedule)</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300">
                    1차 매수 (30% 배정)
                  </span>
                  <span className="text-xs font-mono text-slate-400">정상 조정</span>
                </div>
                <div className="font-bold text-sm text-slate-200">고점 대비 -7% ~ -10% 조정</div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  RSI(14)가 45 이하로 진입하고 50일선 인근에서 지지 시그널이 발생할 때 최초 정찰 물량을 분할 매수합니다.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/80 border border-emerald-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                    2차 매수 (30% 배정)
                  </span>
                  <span className="text-xs font-mono text-emerald-400">적극 추매</span>
                </div>
                <div className="font-bold text-sm text-slate-200">고점 대비 -12% ~ -18% 조정</div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  RSI(14)가 35 이하의 과매도 권역에 진입하고 200일선에 도달할 때 2차 주력 물량을 투입하여 평단가를 대폭 낮춥니다.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/80 border border-amber-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300">
                    3차 매수 (40% 배정)
                  </span>
                  <span className="text-xs font-mono text-amber-400">패닉 바이</span>
                </div>
                <div className="font-bold text-sm text-slate-200">고점 대비 -20% 이상 패닉 폭락</div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  RSI(14) 30 이하 극단적 공포 구간(VIX 30+ 동반). 잔여 예비 현금을 투입하여 바닥 구간의 물량을 대거 확보합니다.
                </p>
              </div>
            </div>
          </div>

          {/* DCA Rules Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
              <div className="text-emerald-400 font-bold text-sm flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>DCA 전략의 성공 필수 조건</span>
              </div>
              <ul className="text-xs text-slate-300 space-y-2">
                <li>• <b>절대 신용/미수 사용 금지</b>: 시장이 언제 돌아설지 모르므로 100% 현금으로만 진행해야 버틸 수 있습니다.</li>
                <li>• <b>현금 버퍼 유지</b>: 총자산의 최소 20~30%는 항상 MMF나 단기채에 예비비로 남겨두세요.</li>
                <li>• <b>연간 리밸런싱</b>: 주가가 회복되어 목표 비중(20%)을 초과하면 일부를 분할 매도하여 현금을 재충전하세요.</li>
              </ul>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
              <div className="text-rose-400 font-bold text-sm flex items-center space-x-2">
                <AlertCircle className="w-4 h-4" />
                <span>DCA에서 피해야 할 함정</span>
              </div>
              <ul className="text-xs text-slate-300 space-y-2">
                <li>• <b>구조적 쇠퇴 기업에 물타기 금지</b>: 이익이 역성장하고 부채가 급증하는 기업은 눌림목이 아니라 몰락의 과정입니다.</li>
                <li>• <b>1차 하락에 조급하게 전액 몰빵</b>: 바닥 아래에 지하실이 있을 수 있으므로 반드시 분할 규칙을 지키세요.</li>
                <li>• <b>단기 손절선 설정 금지</b>: DCA는 1~2주용 트레이딩이 아니므로 잦은 손절매는 수수료와 슬리피지만 누적시킵니다.</li>
              </ul>
            </div>
          </div>

          {/* Real-time Strategy 2 (DCA / Dip Buy) Qualified Tickers & Execution Blueprint */}
          <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl p-5 sm:p-6 space-y-5 shadow-lg shadow-emerald-950/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                    <TrendingUp className="w-4 h-4" />
                  </span>
                  <h3 className="text-lg font-bold text-white">
                    현재 우량주 눌림목 적립 추천 종목별 분할매수 계획서 (Live Execution)
                  </h3>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  우량도 평가(S/A등급) 및 고점 대비 낙폭(MDD), RSI 과매도를 기반으로 <b>1차·2차·3차 분할 매수가와 비중 배분</b>을 제공합니다.
                </p>
              </div>

              {dcaCandidates.length > 0 && (
                <div className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/30 self-start sm:self-auto">
                  DCA 대상 {dcaCandidates.length}개 종목
                </div>
              )}
            </div>

            {dcaCandidates.length === 0 ? (
              <div className="p-8 text-center bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <p className="text-sm font-semibold text-slate-300">현재 우량주들이 전반적으로 고점 부근이거나 눌림목 조건에 진입하지 않았습니다.</p>
                <p className="text-xs text-slate-500">무리해서 추격 매수하지 마시고 정기 적립일 또는 조정 국면까지 기다려주세요.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Ticker Selector Pills */}
                <div>
                  <label className="text-xs font-semibold text-slate-400 mb-2 block">
                    종목을 선택하여 단계별 분할매수 가이드를 확인하세요:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {dcaCandidates.map(({ ev, dip }) => {
                      const isSelected = activeDcaItem?.ev.ticker === ev.ticker;
                      const isActionable = dip.actionable;
                      return (
                        <button
                          key={ev.ticker}
                          onClick={() => setSelectedDcaTicker(ev.ticker)}
                          className={`px-3 py-2 rounded-xl text-left border transition-all flex items-center space-x-2.5 ${
                            isSelected
                              ? 'bg-emerald-500/20 border-emerald-400 text-white shadow-md shadow-emerald-500/10'
                              : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-950'
                          }`}
                        >
                          <div className="text-left">
                            <div className="flex items-center space-x-1.5">
                              <span className="font-mono font-bold text-xs">{ev.ticker}</span>
                              {isActionable ? (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40 animate-pulse">
                                  적립 적기
                                </span>
                              ) : (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                                  {dip.suitability?.tier === 'S' ? '💎 Tier S' : '🥇 Tier A'}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                              {formatStockPrice(ev.price ?? ev.indicators?.price ?? 0, ev.ticker)}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Selected DCA Ticker Guide Card */}
                {activeDcaItem && (() => {
                  const { ev: item, dip } = activeDcaItem;
                  const price = item.price ?? item.indicators?.price ?? 100;

                  // Derive 3-tranche DCA target prices
                  // Tranche 1: Current price or mild dip (-3% to 0%)
                  // Tranche 2: -7% from current or 50MA support
                  // Tranche 3: -15% from current or 200MA deep value support
                  const t1Price = price;
                  const t2Price = price * 0.93;
                  const t3Price = price * 0.85;

                  // Allocated budget for this stock: assume 20% of account size for blue chip
                  const maxStockBudgetKrw = calcAccountSize * 0.20; // 20% rule = 6,000,000 KRW
                  const t1Krw = maxStockBudgetKrw * 0.30; // 30%
                  const t2Krw = maxStockBudgetKrw * 0.35; // 35%
                  const t3Krw = maxStockBudgetKrw * 0.35; // 35%

                  const t1Qty = Math.floor(t1Krw / (t1Price * 1350));
                  const t2Qty = Math.floor(t2Krw / (t2Price * 1350));
                  const t3Qty = Math.floor(t3Krw / (t3Price * 1350));

                  const tierName = dip.suitability?.tierLabel ||
                    (dip.suitability?.tier === 'S'
                      ? '💎 Tier S (영구 보유 초우량주)'
                      : dip.suitability?.tier === 'A'
                      ? '🥇 Tier A (산업 선도 고수익주)'
                      : 'Tier B (경기민감 대형주)');

                  const dipScoreVal = typeof dip.dip_score === 'number'
                    ? dip.dip_score
                    : (typeof (dip as any).composite_dip_score === 'number' ? (dip as any).composite_dip_score : 50);

                  const signalStageLabel = dip.signalLabel || dip.actionSignal || '정기 적립';

                  return (
                    <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4">
                      {/* Ticker Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/80 p-3.5 rounded-xl border border-slate-800">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center font-mono font-black text-emerald-400 text-sm">
                            {item.ticker.slice(0, 3)}
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-white text-base">{item.ticker}</span>
                              <span className="text-xs text-slate-400 truncate max-w-[180px] sm:max-w-xs">{item.name}</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold">
                                {tierName}
                              </span>
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5 flex items-center space-x-2">
                              <span>현재가: <b className="text-white font-mono">{formatStockPrice(price, item.ticker)}</b></span>
                              <span>•</span>
                              <span>눌림목 점수: <b className="text-emerald-400 font-mono">{dipScoreVal.toFixed(0)}점</b></span>
                              <span>•</span>
                              <span>시그널: <b className="text-slate-200 font-mono">{signalStageLabel}</b></span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 self-end sm:self-auto">
                          {onSelectTicker && (
                            <>
                              <button
                                onClick={() => onSelectTicker(item.ticker, 'dip_buy')}
                                className="px-3 py-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/40 text-xs font-semibold flex items-center space-x-1.5 transition-all"
                              >
                                <span>눌림목 분석기</span>
                                <ExternalLink className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => onSelectTicker(item.ticker, 'overview')}
                                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center space-x-1.5 transition-all border border-slate-700"
                              >
                                <span>종목 정보</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* 3-Step Tranche Execution Blueprint */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {/* 1차 분할 매수 */}
                        <div className="p-3.5 rounded-xl bg-slate-900 border border-emerald-500/30 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-emerald-400">1차 진입 (정찰/1차)</span>
                            <span className="font-mono text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-bold">
                              배분 비중: 30%
                            </span>
                          </div>
                          <div className="text-base font-black text-white font-mono">
                            {formatStockPrice(t1Price, item.ticker)}
                          </div>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            우량주가 일상적 조정 또는 20일선 부근에 위치할 때 정기 분할 적립. 권장 수량: <b className="text-white font-mono">{t1Qty}주</b> (약 {Math.round(t1Krw/10000)}만원).
                          </p>
                        </div>

                        {/* 2차 분할 매수 */}
                        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-cyan-400">2차 진입 (중기 지지선)</span>
                            <span className="font-mono text-[10px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded font-bold">
                              배분 비중: 35% (-7%)
                            </span>
                          </div>
                          <div className="text-base font-black text-white font-mono">
                            {formatStockPrice(t2Price, item.ticker)}
                          </div>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            50일 이동평균선 또는 단기 악재 뉴스로 인한 일시 급락 시 2차 추가 매수. 권장 수량: <b className="text-white font-mono">{t2Qty}주</b> (약 {Math.round(t2Krw/10000)}만원).
                          </p>
                        </div>

                        {/* 3차 분할 매수 */}
                        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-purple-400">3차 진입 (공포/딥 밸류)</span>
                            <span className="font-mono text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded font-bold">
                              배분 비중: 35% (-15%)
                            </span>
                          </div>
                          <div className="text-base font-black text-white font-mono">
                            {formatStockPrice(t3Price, item.ticker)}
                          </div>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            200일선 터치, RSI 30 미만 극단적 공포 구간에서 최종 비중 채우기. 권장 수량: <b className="text-white font-mono">{t3Qty}주</b> (약 {Math.round(t3Krw/10000)}만원).
                          </p>
                        </div>
                      </div>

                      {/* Execution Principles & Exit Guidance for this DCA stock */}
                      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 sm:p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2 text-slate-200 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span><b>{item.ticker}</b> DCA 매도 & 리밸런싱 원칙</span>
                          </div>
                          <p className="text-[11px] text-slate-400">
                            초우량주는 손절선 대신 <b>계좌 내 최대 비중 20% 한도 초과 시 1/3 부분 익절</b> 원칙을 적용합니다. 장기 복리 성장 추구.
                          </p>
                        </div>

                        <div className="flex items-center space-x-3 self-end md:self-auto font-mono">
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 block">종목 최대 투자한도</span>
                            <span className="text-sm font-black text-emerald-400">{Math.round(maxStockBudgetKrw / 10000).toLocaleString('ko-KR')}만원 (20%)</span>
                          </div>
                          <div className="h-6 w-px bg-slate-800" />
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 block">완료 시 총 수량</span>
                            <span className="text-sm font-black text-white">{t1Qty + t2Qty + t3Qty} 주</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      )}

      {/* STRATEGY 3: MACRO RISK GUARD */}
      {selectedStrategy === 'macro' && (
        <div className="space-y-6">
          {/* Strategy Identity Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
              <div>
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Strategy 03</span>
                <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center space-x-2 mt-0.5">
                  <span>시장 매크로 적응형 리스크 가드 (Macro Adaptive Risk Guard)</span>
                </h2>
              </div>
              <div className="flex items-center space-x-2 text-xs font-mono">
                <span className="px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                  트리거: <b>VIX, 10Y 국채금리, DXY, 실적일</b>
                </span>
                <span className="px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  역할: <b>계좌 MDD 방어 최우선</b>
                </span>
              </div>
            </div>

            {/* Core Philosophy */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 space-y-2">
                <div className="flex items-center space-x-2 text-amber-400 font-bold text-sm">
                  <Flame className="w-4 h-4" />
                  <span>매크로 철학 (Core Thesis)</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  <b>"밀물 때는 모든 배가 뜨고, 썰물 때는 모두 가라앉는다."</b> 아무리 개별 종목의 차트가 좋아도 지수가 폭락하는 거시적 위기 속에서는 80% 이상의 종목이 함께 무너집니다. 시장 환경을 먼저 읽고 방패를 들어야 합니다.
                </p>
              </div>

              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 space-y-2">
                <div className="flex items-center space-x-2 text-cyan-400 font-bold text-sm">
                  <ShieldCheck className="w-4 h-4" />
                  <span>VIX 변동성 3단계 필터</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  • <b>VIX &lt; 18</b> (골디락스): 주식 비중 90~100%, 공격적 모멘텀 운용<br />
                  • <b>VIX 18~25</b> (경계 구간): 주식 비중 70%, 신규 진입 비중 축소<br />
                  • <b>VIX &gt; 25</b> (고위험/패닉): 주식 비중 40% 이하, 현금 및 방어주 중심
                </p>
              </div>

              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 space-y-2">
                <div className="flex items-center space-x-2 text-rose-400 font-bold text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>실적 발표(Earnings) 가드</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  어닝 발표 D-5일 이내의 종목은 실적 쇼크 시 갭하락(-15% 이상)으로 손절선을 건너뛸 위험이 있습니다.
                  엔진은 어닝 임박 종목에 대해 <b>신규 진입 비중을 50%로 강제 축소</b>하거나 진입을 보류합니다.
                </p>
              </div>
            </div>
          </div>

          {/* Asset Allocation Matrix by Regime */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center space-x-2">
              <Scale className="w-5 h-5 text-amber-400" />
              <span>매크로 국면별 권장 자산배분 매트릭스</span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                    <th className="py-2.5 px-3">시장 국면</th>
                    <th className="py-2.5 px-3">매크로 지표 조건</th>
                    <th className="py-2.5 px-3">권장 모멘텀 주식 비중</th>
                    <th className="py-2.5 px-3">권장 안전자산(현금·채권)</th>
                    <th className="py-2.5 px-3">주요 매매 행동 가이드</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  <tr>
                    <td className="py-3 px-3 font-bold text-emerald-400">Risk-On (골디락스)</td>
                    <td className="py-3 px-3 text-slate-400">VIX &lt; 18, 금리 안정, SPY 20일선 위</td>
                    <td className="py-3 px-3 font-mono font-bold">80% ~ 90%</td>
                    <td className="py-3 px-3 font-mono text-slate-400">10% ~ 20%</td>
                    <td className="py-3 px-3 text-slate-300">주도주 모멘텀 풀 비중 가동, 트렌드 홀딩</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-3 font-bold text-cyan-400">Neutral (혼조/횡보)</td>
                    <td className="py-3 px-3 text-slate-400">VIX 18~23, 박스권 등락</td>
                    <td className="py-3 px-3 font-mono font-bold">60% ~ 70%</td>
                    <td className="py-3 px-3 font-mono text-slate-400">30% ~ 40%</td>
                    <td className="py-3 px-3 text-slate-300">신규 진입 보수적 선별, 단기 목표가 분할 익절 철저</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-3 font-bold text-amber-400">Caution (긴축/리스크오프)</td>
                    <td className="py-3 px-3 text-slate-400">VIX 23~28, 금리 급등, DXY 강세</td>
                    <td className="py-3 px-3 font-mono font-bold">30% ~ 50%</td>
                    <td className="py-3 px-3 font-mono text-slate-400">50% ~ 70%</td>
                    <td className="py-3 px-3 text-slate-300">모멘텀 신호 보류, 현금 확보, 우량주 눌림목 관찰</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-3 font-bold text-rose-400">Panic / Crisis (극단적 공포)</td>
                    <td className="py-3 px-3 text-slate-400">VIX &gt; 28, 서킷브레이커, 신용 경색</td>
                    <td className="py-3 px-3 font-mono font-bold">10% ~ 20%</td>
                    <td className="py-3 px-3 font-mono text-slate-400">80% ~ 90%</td>
                    <td className="py-3 px-3 text-slate-300">모멘텀 매수 완전 중단. S등급 우량주 3차 DCA만 집행</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* STRATEGY 4: SIZING & MONEY MANAGEMENT */}
      {selectedStrategy === 'sizing' && (
        <div className="space-y-6">
          {/* Strategy Identity Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
              <div>
                <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">Strategy 04</span>
                <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center space-x-2 mt-0.5">
                  <span>자금 관리 & 포지션 사이징 (Kelly Criterion & Risk Sizing)</span>
                </h2>
              </div>
              <div className="flex items-center space-x-2 text-xs font-mono">
                <span className="px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                  원칙: <b>1회 최대 손실 계좌의 1.0~2.0%</b>
                </span>
                <span className="px-2.5 py-1 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/30">
                  파산 위험: <b>0.00% 보장</b>
                </span>
              </div>
            </div>

            {/* Core Philosophy */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 space-y-2">
                <div className="flex items-center space-x-2 text-purple-400 font-bold text-sm">
                  <Calculator className="w-4 h-4" />
                  <span>수학적 진실 (Math Truth)</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  아마추어는 <b>"얼마나 벌 수 있을까"</b>를 고민하지만, 프로는 <b>"틀렸을 때 얼마를 잃을 것인가"</b>를 먼저 결정합니다.
                  승률이 50%라도 손익비 2:1과 엄격한 자금관리가 결합되면 계좌는 기하급수적으로 우상향합니다.
                </p>
              </div>

              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 space-y-2">
                <div className="flex items-center space-x-2 text-cyan-400 font-bold text-sm">
                  <Scale className="w-4 h-4" />
                  <span>켈리 공식 (Kelly Fraction)</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  엔진은 승률(W)과 손익비(R)를 기반으로 켈리 공식 <b>f* = (W × R - (1 - W)) / R</b>을 계산합니다.
                  변동성 충격을 흡수하기 위해 풀 켈리의 1/4 수준인 <b>쿼터 켈리(Quarter Kelly)</b>를 기본 적용합니다.
                </p>
              </div>

              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 space-y-2">
                <div className="flex items-center space-x-2 text-emerald-400 font-bold text-sm">
                  <ShieldCheck className="w-4 h-4" />
                  <span>2% 손실 한도 룰</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  1회 매매가 최악의 손절가에 도달하더라도 전체 계좌 잔고의 최대 1.5%~2.0%를 넘지 않도록 <b>매수 수량(Shares)을 역산</b>합니다. 10번 연속 손절이 나더라도 계좌 손실은 -15% 이내로 제한됩니다.
                </p>
              </div>
            </div>
          </div>

          {/* Interactive Trade Sizing Calculator */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <Calculator className="w-5 h-5 text-purple-400" />
                <span>실전 포지션 사이징 & 손절가 시뮬레이터</span>
              </h3>
              <span className="text-xs text-slate-400">실시간 역산 계산기</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Inputs */}
              <div className="lg:col-span-6 space-y-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300 flex justify-between">
                    <span>내 총 투자자산 (원화 KRW)</span>
                    <span className="font-mono text-cyan-400 font-bold">
                      {calcAccountSize.toLocaleString()}원
                    </span>
                  </label>
                  <input
                    type="range"
                    min={5000000}
                    max={200000000}
                    step={1000000}
                    value={calcAccountSize}
                    onChange={(e) => setCalcAccountSize(Number(e.target.value))}
                    className="w-full accent-cyan-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>500만원</span>
                    <span>5,000만원</span>
                    <span>1억원</span>
                    <span>2억원</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-300 flex justify-between">
                      <span>1회 리스크 한도</span>
                      <span className="font-mono text-purple-400 font-bold">{calcRiskPct}%</span>
                    </label>
                    <input
                      type="range"
                      min={0.5}
                      max={3.0}
                      step={0.1}
                      value={calcRiskPct}
                      onChange={(e) => setCalcRiskPct(Number(e.target.value))}
                      className="w-full accent-purple-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-slate-300 flex justify-between">
                      <span>손절 ATR 배수</span>
                      <span className="font-mono text-amber-400 font-bold">{calcAtrMult}x</span>
                    </label>
                    <input
                      type="range"
                      min={1.5}
                      max={3.0}
                      step={0.1}
                      value={calcAtrMult}
                      onChange={(e) => setCalcAtrMult(Number(e.target.value))}
                      className="w-full accent-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-xs text-slate-400">진입 주가 (USD $)</label>
                    <input
                      type="number"
                      value={calcStockPrice}
                      onChange={(e) => setCalcStockPrice(Math.max(1, Number(e.target.value)))}
                      className="w-full mt-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-100 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">일간 변동폭 ATR (USD $)</label>
                    <input
                      type="number"
                      step={0.1}
                      value={calcAtr}
                      onChange={(e) => setCalcAtr(Math.max(0.1, Number(e.target.value)))}
                      className="w-full mt-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-100 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Calculated Outputs */}
              <div className="lg:col-span-6 bg-slate-950 p-4 rounded-xl border border-purple-500/30 flex flex-col justify-between space-y-4">
                <div>
                  <div className="text-xs font-semibold text-purple-400 uppercase tracking-wider mb-2">
                    수학적 최적 매수 수량 및 목표가 도출 결과
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400">1회 최대 허용 손실액</span>
                      <div className="text-base font-bold text-rose-400 font-mono mt-0.5">
                        -{Math.round(maxRiskAmountKrw).toLocaleString()}원
                      </div>
                      <span className="text-[10px] text-slate-500">총자산의 {calcRiskPct}%</span>
                    </div>

                    <div className="bg-slate-900/90 p-3 rounded-lg border border-purple-500/40">
                      <span className="text-[10px] text-purple-300">권장 매수 가능 수량</span>
                      <div className="text-base font-bold text-white font-mono mt-0.5">
                        {calculatedShares.toLocaleString()} 주
                      </div>
                      <span className="text-[10px] text-slate-400">약 {Math.round(totalPositionKrw / 10000).toLocaleString()}만원 ({positionPctOfAccount.toFixed(1)}%)</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-800">
                    <div className="bg-rose-500/10 p-2.5 rounded-lg border border-rose-500/20 text-center">
                      <span className="text-[10px] text-rose-300 font-medium">손절가 (Stop)</span>
                      <div className="text-sm font-bold text-rose-400 font-mono mt-0.5">
                        ${stopLossPrice.toFixed(2)}
                      </div>
                      <span className="text-[9px] text-slate-400">(-{((stopDistance / calcStockPrice) * 100).toFixed(1)}%)</span>
                    </div>

                    <div className="bg-cyan-500/10 p-2.5 rounded-lg border border-cyan-500/20 text-center">
                      <span className="text-[10px] text-cyan-300 font-medium">1차 목표 (50% 익절)</span>
                      <div className="text-sm font-bold text-cyan-400 font-mono mt-0.5">
                        ${targetPrice1.toFixed(2)}
                      </div>
                      <span className="text-[9px] text-slate-400">(+{(((targetPrice1 - calcStockPrice) / calcStockPrice) * 100).toFixed(1)}%)</span>
                    </div>

                    <div className="bg-emerald-500/10 p-2.5 rounded-lg border border-emerald-500/20 text-center">
                      <span className="text-[10px] text-emerald-300 font-medium">2차 목표 (추세 추종)</span>
                      <div className="text-sm font-bold text-emerald-400 font-mono mt-0.5">
                        ${targetPrice2.toFixed(2)}
                      </div>
                      <span className="text-[9px] text-slate-400">(+{(((targetPrice2 - calcStockPrice) / calcStockPrice) * 100).toFixed(1)}%)</span>
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80 leading-relaxed">
                  💡 <b>자금관리 팁</b>: 주가가 ${stopLossPrice.toFixed(2)}까지 하락해도 {calculatedShares}주 전량을 손절하면 계좌 손실은 정확히 <b>{Math.round(maxRiskAmountKrw).toLocaleString()}원</b>으로 고정됩니다. 어떤 종목이든 매수 전 이 수량을 먼저 계산하세요.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Pre-Trade Operational Checklist (Always Accessible) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <CheckSquare className="w-5 h-5 text-cyan-400" />
            <h3 className="text-base sm:text-lg font-bold text-white">매수 주문 전 6대 실전 자가진단 체크리스트</h3>
          </div>
          <span className="text-xs text-slate-400">
            진입 전 아래 항목을 직접 체크하여 뇌동매매를 차단하세요.
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            {
              id: 'chk-1',
              title: '1. 정량 시그널 확인',
              desc: '엔진에서 STRONG_OPPORTUNITY 또는 OPPORTUNITY 신호가 공식 발생했는가?',
            },
            {
              id: 'chk-2',
              title: '2. 정배열 추세 확증',
              desc: '주가가 MA20, MA50선 위에 위치하며 이평선이 역배열 상태가 아닌가?',
            },
            {
              id: 'chk-3',
              title: '3. 손절 주문 사전 예약',
              desc: '진입가 대비 ATR 손절가를 계산하고 MTS/HTS에 스탑로스 주문을 걸 준비가 되었는가?',
            },
            {
              id: 'chk-4',
              title: '4. 리스크 한도 1.5% 준수',
              desc: '손절 시 총 계좌 자산 대비 손실액이 1.5% 이내가 되도록 수량을 줄였는가?',
            },
            {
              id: 'chk-5',
              title: '5. 어닝 쇼크 위험 회피',
              desc: '해당 종목의 실적 발표(Earnings)가 향후 5영업일 이내에 예정되어 있지 않은가?',
            },
            {
              id: 'chk-6',
              title: '6. 시장 매크로 VIX 안전',
              desc: '현재 시장 VIX 지수가 28 이상의 서킷브레이커·패닉 상태가 아닌가?',
            },
          ].map((item) => {
            const isChecked = !!checkedItems[item.id];
            return (
              <div
                key={item.id}
                onClick={() => toggleCheck(item.id)}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start space-x-3 ${
                  isChecked
                    ? 'bg-cyan-950/30 border-cyan-500/50 text-slate-200'
                    : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:border-slate-700'
                }`}
              >
                <button className="mt-0.5 shrink-0 text-cyan-400">
                  {isChecked ? <CheckCircle2 className="w-4 h-4 text-cyan-400" /> : <Square className="w-4 h-4 text-slate-600" />}
                </button>
                <div className="space-y-0.5">
                  <div className={`text-xs font-bold ${isChecked ? 'text-cyan-300' : 'text-slate-300'}`}>
                    {item.title}
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-400">{item.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
