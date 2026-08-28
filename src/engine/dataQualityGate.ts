import { DataQualityReport } from '../types/v8';

/**
 * 데이터 소스 신뢰성 계약.
 *
 * - `isFallback`이 true이면 실제 데이터 수집이 실패하고 허용된 폴백(seed 등)으로
 *   대체되었음을 의미한다. 이런 입력은 절대 매수/액션 신호를 생성해서는 안 된다.
 * - `source`는 데이터의 실제 출처를 정직하게 기록한다 (yahoo / seed / database / custom).
 */
export interface DataProvenance {
  source: string;
  isFallback: boolean;
}

/** 신호 생성 허용 최소 데이터 품질 점수 (진입 신뢰성 문턱). */
export const MIN_SIGNAL_DATA_QUALITY = 70;

/**
 * 불량/신뢰할 수 없는 데이터가 트레이딩 신호를 생성하는 것을 차단하는 순수 게이트.
 *
 * 입력 데이터가 다음 조건 중 하나라도 충족하면 신호 후보에서 제외한다:
 * - 폴백(seed 등) 데이터인 경우 (`isFallback === true`)
 * - 데이터 품질 점수가 문턱 미만인 경우
 *
 * 결정적이고 부수 효과가 없어 Live/Backtest 공통으로 안전하게 사용할 수 있다.
 */
export function isSignalEligible(
  provenance: DataProvenance,
  dataQuality?: DataQualityReport | null
): boolean {
  if (provenance.isFallback) {
    return false;
  }

  if (dataQuality && dataQuality.data_quality_score < MIN_SIGNAL_DATA_QUALITY) {
    return false;
  }

  return true;
}
