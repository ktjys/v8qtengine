import { OHLCVBar } from '../data/providers/types';
import { calculateTechnicalIndicators } from '../data/indicators/technicalIndicators';
import { calculateMomentumIndicators } from '../data/indicators/momentumIndicators';

export interface V7EvaluationResult {
  isSignal: boolean;
  score: number;
  reason: string;
}

export function evaluateV7Strategy(
  barsSlice: OHLCVBar[],
  threshold = 65
): V7EvaluationResult {
  if (barsSlice.length < 50) {
    return { isSignal: false, score: 0, reason: 'Insufficient bars' };
  }

  const tech = calculateTechnicalIndicators(barsSlice);
  const mom = calculateMomentumIndicators(barsSlice);

  // V7: Basic unweighted formula
  let v7Score = 50;

  if (tech.priceAboveMa20) v7Score += 10;
  if (tech.ma20Above50) v7Score += 10;

  if (tech.rsi14 >= 40 && tech.rsi14 <= 65) v7Score += 15;
  else if (tech.rsi14 > 70) v7Score -= 10;

  if (mom.return1M > 0.02) v7Score += 10;
  if (tech.macdHistogramPositive) v7Score += 5;

  const score = Math.max(10, Math.min(95, v7Score));
  const isSignal = score >= threshold;

  return {
    isSignal,
    score,
    reason: isSignal ? `V7 기준 ${threshold}점 이상 충족 (${score}점)` : 'V7 기준 미달',
  };
}
