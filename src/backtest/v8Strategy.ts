import { OHLCVBar } from '../data/providers/types';
import { evaluateStrategy, StrategyEvaluationResult } from './quantStrategy';

export type V8EvaluationResult = StrategyEvaluationResult;

// v8Strategy와 quantStrategy는 동일 로직을 사용한다.
// 단일 소스(evaluateStrategy → evaluateV8)를 유지하기 위해 이 모듈은
// quantStrategy의 구현을 그대로 노출한다. 두 이름 모두 외부 API로 유지된다.
export function evaluateV8Strategy(
  ticker: string,
  barsSlice: OHLCVBar[],
  benchmarkSlice?: OHLCVBar[],
  opportunityThreshold = 70
): V8EvaluationResult {
  return evaluateStrategy(ticker, barsSlice, benchmarkSlice, opportunityThreshold);
}
