import { SignalSnapshot } from '../types/v8';

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
