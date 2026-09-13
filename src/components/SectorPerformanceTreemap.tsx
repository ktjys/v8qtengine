import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import {
  Layers,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Maximize2,
  Minimize2,
  Filter,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
} from 'lucide-react';
import { FullTickerEvaluation } from '../types/v8';
import { groupEvaluationsBySector, SectorGroup, SectorItem } from '../utils/sectorUtils';
import { formatStockPrice, formatChangePercent } from '../utils/formatters';

interface SectorPerformanceTreemapProps {
  evaluations: FullTickerEvaluation[];
  onSelectTicker: (ticker: string) => void;
}

type SizingMetric = 'marketCap' | 'opportunity' | 'equal';
type ColorMetric = 'change1d' | 'opportunity' | 'rsi';

interface TreemapDatum {
  name: string;
  isLeaf?: boolean;
  sectorGroup?: SectorGroup;
  item?: SectorItem;
  value?: number;
  children?: TreemapDatum[];
}

export const SectorPerformanceTreemap: React.FC<SectorPerformanceTreemapProps> = ({
  evaluations,
  onSelectTicker,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 900,
    height: 480,
  });

  const [sizingMetric, setSizingMetric] = useState<SizingMetric>('marketCap');
  const [colorMetric, setColorMetric] = useState<ColorMetric>('change1d');
  const [selectedSectorFilter, setSelectedSectorFilter] = useState<string>('ALL');
  const [hoveredItem, setHoveredItem] = useState<{
    item: SectorItem;
    x: number;
    y: number;
  } | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // Group data by sector
  const sectorGroups = useMemo(() => {
    return groupEvaluationsBySector(evaluations || []);
  }, [evaluations]);

  // Filtered sector groups
  const displayedSectorGroups = useMemo(() => {
    if (selectedSectorFilter === 'ALL') {
      return sectorGroups;
    }
    return sectorGroups.filter((g) => g.sector === selectedSectorFilter);
  }, [sectorGroups, selectedSectorFilter]);

  // Overall Market Return Average
  const marketAverage1d = useMemo(() => {
    if (!evaluations || evaluations.length === 0) return 0;
    const total = evaluations.reduce((acc, curr) => acc + (curr.change1d || 0), 0);
    return Math.round((total / evaluations.length) * 100) / 100;
  }, [evaluations]);

  // Resize Observer for responsive canvas sizing
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const entry = entries[0];
      const newWidth = Math.max(320, Math.floor(entry.contentRect.width));
      const targetHeight = isExpanded ? 640 : Math.max(380, Math.min(520, Math.floor(newWidth * 0.48)));
      setDimensions({ width: newWidth, height: targetHeight });
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, [isExpanded]);

  // Value getter for treemap sizing
  const getItemValue = (item: SectorItem): number => {
    switch (sizingMetric) {
      case 'marketCap':
        // Cap min at 15 to ensure smaller stocks like OKLO remain clickable & visible
        return Math.max(15, Math.sqrt(item.marketCapBillions) * 12);
      case 'opportunity':
        return Math.max(10, item.opportunityScore);
      case 'equal':
        return 100;
    }
  };

  // Build D3 Hierarchy and Treemap Layout
  const treemapLayout = useMemo(() => {
    const rootData: TreemapDatum = {
      name: 'Market',
      children: displayedSectorGroups.map((group) => ({
        name: group.sector,
        sectorGroup: group,
        children: group.items.map((it) => ({
          name: it.ticker,
          isLeaf: true,
          item: it,
          value: getItemValue(it),
        })),
      })),
    };

    const root = d3
      .hierarchy<TreemapDatum>(rootData)
      .sum((d) => d.value || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    const treemap = d3
      .treemap<TreemapDatum>()
      .size([dimensions.width, dimensions.height])
      .tile(d3.treemapSquarify.ratio(1.3))
      .paddingTop(26)
      .paddingInner(3)
      .paddingOuter(4)
      .round(true);

    treemap(root);

    return root;
  }, [displayedSectorGroups, sizingMetric, dimensions.width, dimensions.height]);

  // Color functions
  const getItemFillColor = (item: SectorItem): string => {
    if (colorMetric === 'change1d') {
      const change = item.change1d;
      if (change >= 4.0) return '#047857'; // emerald-700
      if (change >= 2.5) return '#059669'; // emerald-600
      if (change >= 1.0) return '#10b981'; // emerald-500
      if (change >= 0.2) return '#0d9488'; // teal-600
      if (change > -0.2 && change < 0.2) return '#1e293b'; // slate-800
      if (change <= -4.0) return '#881337'; // rose-900
      if (change <= -2.5) return '#9f1239'; // rose-800
      if (change <= -1.0) return '#be123c'; // rose-700
      if (change <= -0.2) return '#e11d48'; // rose-600
      return '#1e293b';
    }

    if (colorMetric === 'opportunity') {
      const score = item.opportunityScore;
      if (score >= 80) return '#065f46'; // strong emerald
      if (score >= 70) return '#0f766e'; // teal
      if (score >= 60) return '#0369a1'; // sky
      if (score >= 50) return '#1e293b'; // slate-800
      return '#334155'; // slate-700
    }

    if (colorMetric === 'rsi') {
      const rsi = item.rsi;
      if (rsi <= 30) return '#047857'; // Deep oversold buy zone
      if (rsi <= 40) return '#0f766e';
      if (rsi >= 70) return '#9f1239'; // Overbought warning
      if (rsi >= 60) return '#881337';
      return '#1e293b';
    }

    return '#1e293b';
  };

  const getBorderColor = (item: SectorItem): string => {
    if (item.decision === 'STRONG_OPPORTUNITY' || item.actionable) {
      return '#34d399'; // emerald-400
    }
    if (item.riskLevel === 'HIGH') {
      return '#f43f5e'; // rose-500
    }
    return '#334155'; // slate-700
  };

  // Sectors list for filter buttons
  const allSectors = useMemo(() => {
    return sectorGroups.map((g) => g.sector);
  }, [sectorGroups]);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xl space-y-5">
      {/* 1. Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <span className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Layers className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>섹터별 성과 트리맵 (Sector Performance Treemap)</span>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-bold border ${
                    marketAverage1d >= 0
                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                      : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                  }`}
                >
                  시장 평균 {marketAverage1d >= 0 ? '+' : ''}
                  {marketAverage1d}%
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                현재 평가 종목({evaluations.length}개)의 산업 섹터 클러스터 및 1일 실시간 등락률, 시가총액 비중을 D3 트리맵으로 시각화합니다.
              </p>
            </div>
          </div>
        </div>

        {/* Metric Toggles */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          {/* Sizing metric */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <span className="text-[11px] text-slate-500 px-2 font-medium">크기:</span>
            <button
              onClick={() => setSizingMetric('marketCap')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                sizingMetric === 'marketCap'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              시총 가중
            </button>
            <button
              onClick={() => setSizingMetric('opportunity')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                sizingMetric === 'opportunity'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              기회점수
            </button>
            <button
              onClick={() => setSizingMetric('equal')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                sizingMetric === 'equal'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              균등
            </button>
          </div>

          {/* Color metric */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <span className="text-[11px] text-slate-500 px-2 font-medium">색상:</span>
            <button
              onClick={() => setColorMetric('change1d')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                colorMetric === 'change1d'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              1D 등락
            </button>
            <button
              onClick={() => setColorMetric('opportunity')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                colorMetric === 'opportunity'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              기회점수
            </button>
            <button
              onClick={() => setColorMetric('rsi')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                colorMetric === 'rsi'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              RSI 과매도
            </button>
          </div>

          {/* Expand toggle */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-all"
            title={isExpanded ? '기본 크기로 축소' : '트리맵 확장'}
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 2. Sector Filter Chips */}
      <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
        <button
          onClick={() => setSelectedSectorFilter('ALL')}
          className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all flex items-center space-x-1.5 ${
            selectedSectorFilter === 'ALL'
              ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm shadow-cyan-500/20'
              : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          <span>전체 섹터</span>
          <span className="text-[10px] opacity-75 font-mono">({evaluations.length})</span>
        </button>

        {sectorGroups.map((g) => {
          const isSelected = selectedSectorFilter === g.sector;
          const isPos = g.avgChange1d >= 0;
          return (
            <button
              key={g.sector}
              onClick={() => setSelectedSectorFilter(isSelected ? 'ALL' : g.sector)}
              className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all flex items-center space-x-2 border ${
                isSelected
                  ? 'bg-slate-800 text-white border-cyan-400/80 font-bold shadow-sm'
                  : 'bg-slate-950/80 text-slate-400 hover:text-slate-200 border-slate-800/80 hover:border-slate-700'
              }`}
            >
              <span className="truncate max-w-[140px]">{g.sector}</span>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-semibold ${
                  isPos ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'
                }`}
              >
                {isPos ? '+' : ''}
                {g.avgChange1d}%
              </span>
            </button>
          );
        })}
      </div>

      {/* 3. D3 SVG Treemap Container */}
      <div
        ref={containerRef}
        className="relative bg-slate-950 border border-slate-800/90 rounded-2xl overflow-hidden select-none"
        style={{ height: dimensions.height }}
      >
        <svg
          width={dimensions.width}
          height={dimensions.height}
          className="w-full h-full block"
        >
          <defs>
            <filter id="card-shadow" x="-5%" y="-5%" width="110%" height="110%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.3" />
            </filter>
          </defs>

          {/* Sector Groups (depth 1) */}
          {treemapLayout.children?.map((sectorNode, sIdx) => {
            const sectorWidth = sectorNode.x1 - sectorNode.x0;
            const sectorHeight = sectorNode.y1 - sectorNode.y0;
            const sectorData = sectorNode.data.sectorGroup;

            if (sectorWidth < 8 || sectorHeight < 8) return null;

            return (
              <g
                key={`sector-${sectorNode.data.name}-${sIdx}`}
                transform={`translate(${sectorNode.x0}, ${sectorNode.y0})`}
              >
                {/* Sector Container Boundary */}
                <rect
                  width={sectorWidth}
                  height={sectorHeight}
                  fill="#0b0f19"
                  stroke="#1e293b"
                  strokeWidth="1.5"
                  rx="8"
                />

                {/* Sector Header Banner */}
                {sectorWidth > 55 && sectorHeight > 30 && (
                  <g transform="translate(6, 4)">
                    <rect
                      x="0"
                      y="0"
                      width={Math.min(sectorWidth - 12, 220)}
                      height="18"
                      fill="#0f172a"
                      rx="4"
                      opacity="0.85"
                    />
                    <text
                      x="6"
                      y="13"
                      fill="#94a3b8"
                      fontSize="11"
                      fontWeight="bold"
                      className="font-sans select-none pointer-events-none"
                    >
                      {sectorNode.data.name.length > 20 && sectorWidth < 180
                        ? sectorNode.data.name.slice(0, 16) + '…'
                        : sectorNode.data.name}
                      {sectorData && (
                        <tspan
                          dx="5"
                          fill={sectorData.avgChange1d >= 0 ? '#34d399' : '#fb7185'}
                          fontSize="10"
                          fontWeight="normal"
                          fontFamily="monospace"
                        >
                          {sectorData.avgChange1d >= 0 ? '+' : ''}
                          {sectorData.avgChange1d}%
                        </tspan>
                      )}
                    </text>
                  </g>
                )}

                {/* Stock Leaf Nodes (depth 2) */}
                {sectorNode.children?.map((leafNode, lIdx) => {
                  const leafWidth = leafNode.x1 - leafNode.x0;
                  const leafHeight = leafNode.y1 - leafNode.y0;
                  const item = leafNode.data.item;
                  if (!item || leafWidth < 4 || leafHeight < 4) return null;

                  const localX = leafNode.x0 - sectorNode.x0;
                  const localY = leafNode.y0 - sectorNode.y0;
                  const fillColor = getItemFillColor(item);
                  const strokeColor = getBorderColor(item);
                  const isHovered = hoveredItem?.item.ticker === item.ticker;

                  return (
                    <g
                      key={`leaf-${item.ticker}-${lIdx}`}
                      transform={`translate(${localX}, ${localY})`}
                      className="cursor-pointer transition-transform duration-100"
                      onClick={() => onSelectTicker(item.ticker)}
                      onMouseEnter={(e) => {
                        const rect = containerRef.current?.getBoundingClientRect();
                        const clientX = e.clientX - (rect?.left || 0);
                        const clientY = e.clientY - (rect?.top || 0);
                        setHoveredItem({ item, x: clientX, y: clientY });
                      }}
                      onMouseMove={(e) => {
                        const rect = containerRef.current?.getBoundingClientRect();
                        const clientX = e.clientX - (rect?.left || 0);
                        const clientY = e.clientY - (rect?.top || 0);
                        setHoveredItem({ item, x: clientX, y: clientY });
                      }}
                      onMouseLeave={() => setHoveredItem(null)}
                    >
                      {/* Leaf Box */}
                      <rect
                        width={leafWidth}
                        height={leafHeight}
                        fill={fillColor}
                        stroke={isHovered ? '#38bdf8' : strokeColor}
                        strokeWidth={isHovered ? 2.5 : item.actionable ? 1.5 : 0.75}
                        rx="6"
                        className="transition-all hover:brightness-125"
                      />

                      {/* Content inside Box if size allows */}
                      {leafWidth >= 32 && leafHeight >= 26 && (
                        <g transform={`translate(${leafWidth / 2}, ${leafHeight / 2})`}>
                          {/* Ticker text */}
                          <text
                            textAnchor="middle"
                            y={leafHeight >= 46 ? -6 : 4}
                            fill="#ffffff"
                            fontSize={leafWidth > 80 && leafHeight > 60 ? 15 : leafWidth > 50 ? 12 : 10}
                            fontWeight="bold"
                            fontFamily="monospace"
                            className="select-none pointer-events-none drop-shadow"
                          >
                            {item.ticker}
                          </text>

                          {/* Sub-label: 1D Change */}
                          {leafHeight >= 42 && (
                            <text
                              textAnchor="middle"
                              y={12}
                              fill={item.change1d >= 0 ? '#6ee7b7' : '#fda4af'}
                              fontSize={leafWidth > 80 ? 11 : 9}
                              fontWeight="600"
                              fontFamily="monospace"
                              className="select-none pointer-events-none drop-shadow"
                            >
                              {item.change1d >= 0 ? '+' : ''}
                              {item.change1d}%
                            </text>
                          )}

                          {/* Opportunity or Price label if box is large */}
                          {leafWidth >= 85 && leafHeight >= 75 && (
                            <text
                              textAnchor="middle"
                              y={26}
                              fill="#94a3b8"
                              fontSize={9}
                              className="select-none pointer-events-none"
                            >
                              점수 {item.opportunityScore}점
                            </text>
                          )}
                        </g>
                      )}

                      {/* Status indicator pip on top-right */}
                      {leafWidth >= 40 && leafHeight >= 30 && item.actionable && (
                        <circle
                          cx={leafWidth - 6}
                          cy={6}
                          r={3}
                          fill="#34d399"
                          className="animate-pulse"
                        />
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>

        {/* 4. Interactive Floating Tooltip */}
        {hoveredItem && (
          <div
            className="absolute z-30 pointer-events-none transition-all duration-75"
            style={{
              left: Math.min(Math.max(10, hoveredItem.x + 12), dimensions.width - 270),
              top: Math.min(Math.max(10, hoveredItem.y + 12), dimensions.height - 210),
            }}
          >
            <div className="w-64 bg-slate-900/95 backdrop-blur-md border border-slate-700/90 rounded-2xl p-3.5 shadow-2xl space-y-2 text-xs">
              {/* Header */}
              <div className="flex items-start justify-between pb-2 border-b border-slate-800">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-bold text-base text-white">
                      {hoveredItem.item.ticker}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono">
                      {hoveredItem.item.strategyType}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 truncate max-w-[150px]">
                    {hoveredItem.item.name}
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-mono font-bold text-white">
                    {formatStockPrice(hoveredItem.item.price, hoveredItem.item.ticker)}
                  </div>
                  <div
                    className={`font-mono font-semibold text-[11px] ${
                      hoveredItem.item.change1d >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {formatChangePercent(hoveredItem.item.change1d)}
                  </div>
                </div>
              </div>

              {/* Sector & Industry */}
              <div className="text-[11px] text-slate-300 flex justify-between">
                <span className="text-slate-500">섹터/산업:</span>
                <span className="text-cyan-300 font-medium truncate max-w-[150px]">
                  {hoveredItem.item.sector}
                </span>
              </div>

              {/* Quant Metrics Grid */}
              <div className="grid grid-cols-2 gap-1.5 bg-slate-950/80 p-2 rounded-xl border border-slate-800/80 font-mono text-[11px]">
                <div>
                  <span className="text-[9px] text-slate-500 block">기회 점수</span>
                  <span className="font-bold text-emerald-400">
                    {hoveredItem.item.opportunityScore}점
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 block">리스크 등급</span>
                  <span
                    className={`font-bold ${
                      hoveredItem.item.riskLevel === 'LOW'
                        ? 'text-emerald-400'
                        : hoveredItem.item.riskLevel === 'MEDIUM'
                        ? 'text-amber-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {hoveredItem.item.riskLevel}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 block">RSI (14)</span>
                  <span className="text-slate-200">{hoveredItem.item.rsi.toFixed(1)}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 block">1M 모멘텀</span>
                  <span
                    className={
                      hoveredItem.item.return1M >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }
                  >
                    {hoveredItem.item.return1M >= 0 ? '+' : ''}
                    {hoveredItem.item.return1M.toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Action Decision */}
              <div className="flex items-center justify-between text-[11px] pt-1">
                <span className="text-slate-500">판단:</span>
                <span className="font-semibold text-white">
                  {hoveredItem.item.decision}
                </span>
              </div>

              <div className="text-[10px] text-cyan-400 text-center font-medium pt-1 border-t border-slate-800/80">
                💡 클릭하여 상세 분석 및 차트 열기
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5. Color Legend & Quick Quant Guide */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-xs text-slate-400">
        <div className="flex items-center space-x-2">
          <span className="text-slate-500 font-medium">등락률 범례:</span>
          <div className="flex items-center space-x-1">
            <span className="px-1.5 py-0.5 rounded bg-[#881337] text-white text-[10px] font-mono">
              -4%↓
            </span>
            <span className="px-1.5 py-0.5 rounded bg-[#be123c] text-white text-[10px] font-mono">
              -2%
            </span>
            <span className="px-1.5 py-0.5 rounded bg-[#1e293b] text-slate-300 text-[10px] font-mono">
              0%
            </span>
            <span className="px-1.5 py-0.5 rounded bg-[#059669] text-white text-[10px] font-mono">
              +2%
            </span>
            <span className="px-1.5 py-0.5 rounded bg-[#047857] text-white text-[10px] font-mono">
              +4%↑
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-4 text-[11px]">
          <span className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-sm border-2 border-emerald-400 bg-emerald-500/20 inline-block"></span>
            <span>기회 신호 (Actionable)</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-sm border-2 border-rose-500 bg-rose-500/20 inline-block"></span>
            <span>고위험 제약 (Risk High)</span>
          </span>
        </div>
      </div>
    </div>
  );
};
