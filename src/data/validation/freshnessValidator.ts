import { DataQualityReport } from '../../types/v8';
import { NormalizedMarketData } from '../providers/types';
import { validateMarketData } from './marketDataValidator';
import { validateFundamentals } from './fundamentalValidator';

export function evaluateDataQuality(data: NormalizedMarketData, isEtf: boolean): DataQualityReport {
  const mktValidation = validateMarketData(data.quote, data.bars);
  const fundValidation = validateFundamentals(data.fundamentals, isEtf);

  const combinedWarnings = [...mktValidation.warnings, ...fundValidation.warnings];
  const combinedScore = Math.round(
    isEtf
      ? mktValidation.score
      : mktValidation.score * 0.65 + fundValidation.score * 0.35
  );

  const fetchedTime = new Date(data.fetchedAt).getTime();
  const ageMs = Date.now() - fetchedTime;
  const ageMinutes = ageMs / (1000 * 60);

  let freshness: 'FRESH' | 'RECENT' | 'STALE' | 'OUTDATED' = 'FRESH';
  if (ageMinutes > 60 * 24 * 3) {
    freshness = 'OUTDATED';
    combinedWarnings.push('마지막 데이터 수집일이 3일 이상 경과했습니다.');
  } else if (ageMinutes > 60 * 24) {
    freshness = 'STALE';
    combinedWarnings.push('수집된 지 24시간 이상 경과한 데이터입니다.');
  } else if (ageMinutes > 60 * 4) {
    freshness = 'RECENT';
  } else {
    freshness = 'FRESH';
  }

  return {
    data_quality_score: combinedScore,
    data_freshness: freshness,
    last_updated: data.fetchedAt,
    source: data.source,
    data_warnings: combinedWarnings,
    bars_count: data.bars.length,
    has_fundamentals: !isEtf && fundValidation.score > 60,
  };
}
