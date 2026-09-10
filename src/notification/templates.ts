import { DipBuyEvaluation, SignalSnapshot } from '../types/v8';

export function buildDipBuyTelegramMessage(dip: DipBuyEvaluation): string {
  const arrow = (dip.change1d ?? 0) >= 0 ? '🔺' : '🔻';
  const changeStr = `${(dip.change1d ?? 0) >= 0 ? '+' : ''}${(dip.change1d ?? 0).toFixed(1)}%`;

  return `🛡️ [우량주 장기적립 & 눌림목 추매 알림]
━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 <b>${dip.ticker}</b> (${dip.name})
• 현재가: $${dip.price.toFixed(2)} (${arrow} ${changeStr})
• 신호 판정: <b>${dip.signalLabel}</b>
• 추매 권고 비중: <code>${dip.suggestedDcaRatio}</code>

💎 <b>우량대형주 적합도 (안전성)</b>
• 체급 등급: <b>${dip.suitability.tierLabel}</b> (${dip.suitability.score}점 / 100)
• 지수/ETF 지위: ${dip.suitability.breakdown.indexStatusScore}/30점
• 시가총액 규모: ${dip.suitability.breakdown.marketCapScore}/25점
• 재무/해자 건전성: ${dip.suitability.breakdown.qualityScore}/25점
• 하방 안정성: ${dip.suitability.breakdown.stabilityScore}/20점

📉 <b>현재 눌림목 타이밍 (할인율)</b>
• 타이밍 점수: <b>${dip.timing.score}점</b> / 100
• RSI (14일): ${dip.timing.rsi.toFixed(1)} (${dip.timing.rsiZone})
• 고점 대비 조정폭: ${dip.timing.drawdownLabel}
• 지지선 상태: ${dip.timing.supportLevel}

💡 <b>적립 가이드:</b>
"${dip.guidanceMessage}"
━━━━━━━━━━━━━━━━━━━━━━━━━━
양도소득세 절세형 장기 복리 적립 엔진 (Strategy B)`;
}

export function buildSignalTelegramMessage(snapshot: SignalSnapshot): string {
  const fundText =
    snapshot.fundamental_score !== null ? `${snapshot.fundamental_score} pt` : 'N/A (ETF/지수)';
  const valText =
    snapshot.valuation_score !== null ? `${snapshot.valuation_score} pt` : 'N/A';

  return `🚨 [V8 QUANT SIGNAL ALERT]
━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 ${snapshot.ticker} (${snapshot.name})
• Asset Type: ${snapshot.asset_type.toUpperCase()}
• Strategy: ${snapshot.strategy_type}
• Decision: 🎯 ${snapshot.decision}
• Entry Target Price: $${snapshot.signal_price.toFixed(2)}

📊 Score Breakdown
• Opportunity Score: ${snapshot.opportunity_score} / 100
• Risk Level: ${snapshot.risk_level} (Score: ${snapshot.risk_score})
• Signal Confidence: ${(snapshot.signal_confidence * 100).toFixed(0)}%
${
  snapshot.position_size_pct !== undefined
    ? `• Suggested Position: ${snapshot.position_size_pct}% of portfolio\n`
    : ''
}
⚙️ Multi-Factor Sub-Scores
• Technical: ${snapshot.technical_score} pt (RSI14: ${snapshot.rsi.toFixed(1)}, DD: ${snapshot.drawdown.toFixed(1)}%)
• Momentum: ${snapshot.momentum_score} pt
• Fundamental: ${fundText}
• Valuation: ${valText}

💡 Core Rationale:
"${snapshot.components.decision_reason}"

⚠️ Key Risk Factors:
${snapshot.components.risk_reasons.map((r) => `• ${r}`).join('\n')}
━━━━━━━━━━━━━━━━━━━━━━━━━━
V8 Live Engine • Immutable Snapshot Id: ${snapshot.id}`;
}

export function buildScanSummaryTelegramMessage(
  evaluatedCount: number,
  signalCount: number,
  failureCount: number
): string {
  return `📊 [V8 Daily Scan Complete]
• Evaluated Universe: ${evaluatedCount} tickers
• New Actionable Signals: ${signalCount} items
• API/Data Failures: ${failureCount} items
• Timestamp: ${new Date().toISOString()}`;
}
