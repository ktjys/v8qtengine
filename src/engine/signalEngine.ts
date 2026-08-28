import {
  DecisionEvaluation,
  FullTickerEvaluation,
  OpportunityEvaluation,
  RiskEvaluation,
  SignalSnapshot,
} from '../types/v8';

export function shouldGenerateSignal(
  evaluation: FullTickerEvaluation,
  existingRecentSignals: SignalSnapshot[] = []
): boolean {
  // 1. Must be actionable decision
  if (!evaluation.decision?.actionable) {
    return false;
  }

  const evalDate = evaluation.evaluated_at ? evaluation.evaluated_at.split('T')[0] : new Date().toISOString().split('T')[0];
  const now = evaluation.evaluated_at ? new Date(evaluation.evaluated_at).getTime() : Date.now();

  // 2. Prevent duplicate signal for same ticker on the same trading day OR within recent cooldown
  const duplicate = existingRecentSignals.find((s) => {
    if (s.ticker !== evaluation.ticker) return false;
    // Exact same date match
    if (s.signal_date === evalDate) return true;
    
    // Within 24-hour trading session window
    const sigTime = new Date(s.signal_date).getTime();
    const diffDays = Math.abs(now - sigTime) / (1000 * 60 * 60 * 24);
    return diffDays < 1;
  });

  if (duplicate) {
    return false;
  }

  return true;
}

export function createSignalSnapshot(
  evaluation: FullTickerEvaluation,
  idOverride?: string
): SignalSnapshot {
  const opp = evaluation.opportunity;
  const risk = evaluation.risk;
  const decision = evaluation.decision;
  const classification = evaluation.classification;
  const dateStr = evaluation.evaluated_at ? evaluation.evaluated_at.split('T')[0] : new Date().toISOString().split('T')[0];

  return {
    id: idOverride || `sig-${dateStr}-${evaluation.ticker}`,
    signal_date: dateStr,
    ticker: evaluation.ticker,
    name: evaluation.name,
    signal_price: evaluation.price,
    strategy_type: classification.strategy_type,
    asset_type: classification.asset_type,
    opportunity_score: opp.opportunity_score,
    risk_level: risk.risk_level,
    risk_score: risk.risk_score,
    decision: decision.decision,
    signal_confidence: decision.confidence,
    classification_confidence: classification.confidence,
    technical_score: opp.sub_scores.technical_score,
    momentum_score: opp.sub_scores.momentum_score,
    fundamental_score: opp.sub_scores.fundamental_score,
    valuation_score: opp.sub_scores.valuation_score,
    rsi: opp.technical_details.rsi14,
    drawdown: opp.technical_details.drawdownFromHigh,
    return_5d: null,
    return_10d: null,
    return_20d: null,
    current_return: 0,
    is_closed: false,
    components: {
      weights: opp.weights_used,
      risk_reasons: risk.risk_reasons,
      decision_reason: decision.reason,
    },
  };
}

export function formatTelegramNotification(snapshot: SignalSnapshot): string {
  const fundText =
    snapshot.fundamental_score !== null ? `${snapshot.fundamental_score} pt` : 'N/A (ETF)';
  const valText =
    snapshot.valuation_score !== null ? `${snapshot.valuation_score} pt` : 'N/A';

  return `🔔 [V8 Signal Generated]
━━━━━━━━━━━━━━━━━━━━
📌 ${snapshot.ticker} (${snapshot.name})
• Strategy: ${snapshot.strategy_type}
• Decision: 🎯 ${snapshot.decision}
• Price: $${snapshot.signal_price.toFixed(2)}

📊 Score Breakdown
• Opportunity: ${snapshot.opportunity_score} / 100
• Risk Level: ${snapshot.risk_level} (Score: ${snapshot.risk_score})
• Confidence: ${(snapshot.signal_confidence * 100).toFixed(0)}%

⚙️ Sub-Scores
• Technical: ${snapshot.technical_score} pt (RSI: ${snapshot.rsi.toFixed(1)}, DD: ${snapshot.drawdown.toFixed(1)}%)
• Momentum: ${snapshot.momentum_score} pt
• Fundamental: ${fundText}
• Valuation: ${valText}

💡 Action Rationale
"${snapshot.components.decision_reason}"
━━━━━━━━━━━━━━━━━━━━
Auto-monitored by V8 Quant Engine`;
}
