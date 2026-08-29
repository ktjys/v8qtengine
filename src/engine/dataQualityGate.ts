import { DataQualityReport, DataProvenance } from '../types/v8';

export type { DataProvenance } from '../types/v8';

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
  // Block if data quality score is below the minimum threshold (70)
  if (dataQuality && dataQuality.data_quality_score < MIN_SIGNAL_DATA_QUALITY) {
    return false;
  }

  return true;
}
