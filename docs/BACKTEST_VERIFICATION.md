# 백테스트 결과 검증 가이드

V8 엔진의 백테스트(`runHistoricalReplay`) 결과를 신뢰할 수 있는지 검증하는 절차와 체크리스트입니다.

검증은 크게 3개 축으로 나뉩니다:

| 축 | 목적 | 질문 |
| :-- | :-- | :-- |
| ① 결정성/무결성 | look-ahead bias, 재현성 | 같은 입력이면 항상 같은 결과인가? 미래 정보를 쓰지 않았나? |
| ② 정합성 | 수치 정확도 | 결과가 실제 데이터와 손으로 계산한 값과 일치하나? |
| ③ 현실성 | 실전 유효성 | 샘플이 충분하고, 수치가 실전에 쓰기 타당한가? |

---

## 0. 실행 방법

### 자동 테스트 (권장, 매 커밋)

```bash
cd v8qtengine
npx vitest run            # 전체 스위트 (strategyReplay 테스트 포함)
```

`src/backtest/strategyReplay.test.ts`가 ① 축(재현성/PIT)과 ② 축(수동 대조)을 자동으로 검증합니다.

### 실제 데이터 백테스트 (Yahoo)

```bash
# .env 없이 실행하더라도 Yahoo 프로바이더는 실시간 네트워크 조회 시도
npx tsx -e "
import { runHistoricalReplay } from './src/backtest/strategyReplay';
runHistoricalReplay({ startDate:'2025-07-01', endDate:'2026-08-29', tickers:['AAPL','MSFT','NVDA','JPM'], opportunityThreshold:70 })
  .then(r => { const s=r.summary;
    console.log('signals=',s.total_signals,'win20=',s.win_rate_20d,'avg20=',s.avg_return_20d,
      'PF=',s.profit_factor,'expectancy=',s.expectancy,'MDD=',s.max_drawdown);
  });
"
```

> ⚠️ **중요**: `.env`가 없으면 Supabase DB는 로컬 메모리 저장소로 폴백되고,
> 전체 유니버스가 **seed(합성) 데이터**를 쓸 수 있습니다. **현실성(③축) 판단은
> 반드시 실제 Yahoo OHLCV로 검증하세요.** 아래 1번 항목으로 실데이터 사용 여부를
> 먼저 확인하십시오.

---

## ① 결정성 / 무결성 (look-ahead bias)

### [A1] 재현성 — 같은 입력 → 같은 결과
```ts
const cfg = { startDate:'2024-01-01', endDate:'2024-06-30', tickers:['AAPL','MSFT','NVDA'] };
const a = await runHistoricalReplay(cfg);
const b = await runHistoricalReplay(cfg);
expect(a.summary).toEqual(b.summary);
expect(a.signals).toEqual(b.signals);
```
**통과 기준**: 두 실행이 완전 동일. (이미 `strategyReplay.test.ts` "재현성"으로 고정.)
실데이터에서도 하루 안의 반복 실행은 동일해야 함.

### [A2] PIT — endDate를 늘려도 과거 시그널의 미래 수익률 불변
```ts
const early = await runHistoricalReplay({ ...cfg, endDate:'2024-03-01' });
const later = await runHistoricalReplay({ ...cfg, endDate:'2024-06-30' });
// early의 시그널이 later에서도 동일해야 하고, 그 return20d는 동일 bars 기준으로 동일해야 함
```
**통과 기준**: endDate를 늘려도 기존 시그널의 `return5d/10d/20d`가 변하지 않는다.
변한다면 = look-ahead bias (미래 봉을 미리 봤다는 증거).

### [A3] PIT 슬라이스 — 미래 봉 비노출
`getPointInTimeSlice(bars, i)`가 정확히 `i`까지(`i+1`개)만 반환.
`getForwardOutcomes`가 `i+5/+10/+20` 봉이 범위를 벗어나면 `null`을 반환.

### [A4] PIT 분류/펀더멘털
- 수동 override는 `effective_date` 이후부터만 적용 (`classificationRepository.getAsOf`)
- 펀더멘털은 `as_of_date <= barDate`만 사용 (`getHistoryAsOf`)
- 벤치마크는 `b.date <= barDate`만 사용

---

## ② 정합성 (수동 대조)

### [B1] forward return 수동 대조
`getForwardOutcomes(bars, i)`의 `return20d`를 직접 검증:
```ts
const entry = bars[i].close;
const p20 = bars[i+20].close;
const expected = Math.round(((p20 - entry)/entry)*100*100)/100;
expect(outcomes.return20d).toBe(expected);
```
(이미 `strategyReplay.test.ts` "수동 대조"로 고정.)

### [B2] 실제 시그널 하나를 실데이터와 대조
실데이터 백테스트 로그에서 시그널 1건의 `entryDate`(예: `2026-06-01`)를 잡아
해당 티커의 Yahoo OHLCV를 다시 받아 20봉 뒤 종가로 수익률을 재계산해 일치 확인.

### [B3] 샘플 크기
`summary.completed_signals`가 **30개 미만**이면 통계적으로 신뢰 불가 → 결론 보류.

---

## ③ 현실성 (실전 타당성)

검증 통과 기준 (일반적인 현실 레드플래그):

| 지표 | 정상 범위 | 문제 신호 |
| :-- | :-- | :-- |
| `win_rate_20d` | 45~70% | **>90%**: look-ahead/과최적화 거의 확실 |
| `avg_return_20d` | ±0~5% | >10%는 의심 |
| `profit_factor` | 1.0~3.0 | <1.0 = 기대값 음수, >5 = 의심 |
| `expectancy` | >0 | <0 = 손실 전략 |
| `max_drawdown` | <40% | >50%는 포지션 사이징 과다 |
| `by_risk.HIGH` | 승률 < LOW | HIGH가 LOW보다 높으면 리스크 게이트 무력화 의심 |

### [C1] 리스크 게이트 동작 확인
`by_risk`에서 LOW 승률이 MEDIUM/HIGH보다 높아야 정상 (리스크 높을수록 성과 낮음).
HIGH 시그널이 아예 없다면 게이트가 과하게 보수적일 수 있음 — 판단 필요.

### [C2] 벤치마크 초과 수익
`equityCurve`의 누적 수익률 vs `benchmarkReturn(SPY)`을 기간말에 비교.
전략이 SPY를 **꾸준히** 상회하는가? (수익률, MDD 함께 봐야 함)

### [C3] 종목/기간 과적합
- 특정 소수 종목 하나가 전체 성과를 끌어올리는지 (`signals` 분해)
- 여러 기간(상승/하락장)에서 일관된지

---

## 3축 전체 요약 체크리스트

- [ ] ① [A1] 동일 입력 재실행 → 결과 동일
- [ ] ① [A2] endDate 확장 → 과거 시그널 수익률 불변
- [ ] ① [A3] PIT 슬라이스 미래 봉 비노출
- [ ] ① [A4] 분류/펀더멘털/벤치마크 PIT 적용
- [ ] ② [B1] forward 수익률 수동 대조 일치
- [ ] ② [B2] 실데이터 시그널 1건 대조 일치
- [ ] ② [B3] completed_signals ≥ 30
- [ ] ③ [C1] 리스크 게이트 정상 동작 (LOW > MEDIUM > HIGH 승률)
- [ ] ③ [C2] SPY 초과 수익 양호
- [ ] ③ [C3] 종목/기간 과적합 없음

## 2026-08-29 실데이터 기준 참고 결과 (10 대형주, 2025-07-01 ~ 2026-08-29)

| 지표 | 값 | 판정 |
| :-- | :-- | :-- |
| total / completed | 335 / 308 | ✅ 샘플 충분 |
| win_rate_5d/10d/20d | 58.1 / 53.1 / 58.4% | ✅ 정상 범위 (<90) |
| avg_return_20d / median | 1.4% / 1.2% | ✅ 양호 |
| profit_factor | 1.65 | ✅ 긍정적 엣지 |
| expectancy | +1.36% | ✅ >0 |
| max_drawdown | 22.6% | ✅ 현실적 |
| by_risk LOW / MEDIUM | 60.1% / 47.5% 승률 | ✅ 게이트 정상 (LOW 우위) |

**결론(해당 실행 기준)**: look-ahead/과최적화 의심 신호 없음, 유의미한 샘플,
리스크 게이트 정상 동작, 작지만 긍정적 엣지(+1.36%/거래). 단, 단일 실행이므로
[C2]/[C3]의 벤치마크 초과·기간/종목 과적합은 추가 기간 실행으로 확정 필요.
