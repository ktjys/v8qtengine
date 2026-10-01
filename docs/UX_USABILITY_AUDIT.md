# UI 사용성 감사 리포트

기준 커밋: `14c4db1` (`refactor: improve mobile layout responsiveness`)

## 조사 범위

- `src/App.tsx` + `src/components/` 30개 컴포넌트 + `src/index.css` (약 22,000줄)
- React 19 / Tailwind CSS 4 / Recharts / D3

## 조사 방법과 정확도 원칙

이 문서의 수치는 모두 저장소에서 직접 `grep` / `Read`로 확인한 값입니다.

- **측정 항목** — 정확한 개수와 `파일:라인`을 제시했습니다.
- **판단 항목** — 색상 대비율, 한글 최소 폰트 크기 같은 UX 판단은 원본 코드로 근거를 제시하되, 실제 측정값이 아님을 `[판단]`으로 표시했습니다.

체크섬을 함께 기록하면 감사 시점을 재현할 수 있습니다.

| 항목 | 측정값 |
| :-- | :-- |
| `focus:outline-none` | 45건 / 14개 파일 |
| `<input>` | 47건 (`type="number"` 9건) |
| `text-[9px]` / `[10px]` / `[11px]` | 66 / 407 / 302건 (총 775건) |
| `text-slate-500` / `text-slate-600` | 186건 / 29개 파일 |
| `aria-label` | 1건 |
| `role="dialog"` / `aria-modal` / `aria-live` | 각각 0건 |
| `aria-expanded` / `aria-sort` / `aria-invalid` / `aria-describedby` | 각각 0건 |
| `:focus-visible` / `prefers-reduced-motion` | 각각 0건 |
| `htmlFor` | 0건 |
| `tabIndex` / `role="button"` | 0건 |
| `onKeyDown` / `onKeyUp` / `onKeyPress` | 1건 |
| 라우팅 (`pushState` / `replaceState` / `react-router` 등) | 0건 |
| `Brush` (recharts 줌) | 0건 |
| 페이지네이션 | 0건 |
| 모달 오버레이(`fixed inset-0`) | 9개 파일 |
| `Escape` 키 처리 | 1개 모달 |
| 미존재 Tailwind 클래스 | 7건 |
| 인라인 `.toFixed()` | 83건 |

---

## P0 — 즉시 개선 필요

### P0-1. 포커스 인지가 불가능함

`focus:outline-none` 45건이 `src/index.css`에 `:focus-visible` 스타일 0건인 상태에서 사용됩니다.

포커스 시 남는 것은 색 테두리(`focus:border-cyan-400`)뿐이라, **포커스 위치와 모양을 외부에서 식별할 수 없습니다.** 입력 필드는 회색 블록 위에 아웃라인만 남아 어디에 커서가 있는지 파악이 어렵습니다.

해당 파일: `WatchlistView.tsx` 10건, `ExitSignalDashboardView.tsx` 8건, `PaperTradingView.tsx` 5건, `SymbolDetailModal.tsx` 3건, `DipBuyMatrix.tsx` 3건, `ClassificationView.tsx` 3건, `AutoScanScheduleModal.tsx` 2건, `ScanRunsView.tsx` 2건, `PortfolioAllocationView.tsx` 2건, `AlertHistoryView.tsx` 2건, `PositionSizingCalculator.tsx` 2건, `SectorPerformanceTreemap.tsx` 1건, `BacktestView.tsx` 1건, `MacroEarningsView.tsx` 1건.

**개선안** — `index.css`에 전역 규칙 1개를 추가하면 45건이 동시에 해결됩니다.

```css
@layer base {
  :focus-visible {
    outline: 2px solid var(--color-cyan-400);
    outline-offset: 2px;
  }
}
```

### P0-2. 키보드로 조작할 수 없는 인터랙티브 요소

전체 앱에서 키보드 이벤트 핸들러는 1건뿐입니다 — `PortfolioAllocationView.tsx:188`의 `handleApplyCapital` Enter 단축키.

`tabIndex` 0건이므로 다음 요소는 **마우스로만 조작 가능합니다.**

| 요소 | 위치 | 현황 |
| :-- | :-- | :-- |
| 테이블 정렬 헤더 | `SortableHeader.tsx:29-30` | `<th onClick>`. 버튼이 아니며 `role`/`aria-sort` 없음 |
| `SymbolDetailModal` 탭 | `SymbolDetailModal.tsx` | `role="tablist"` / `role="tab"` / `role="tabpanel"` 0건, 좌우 화살키 미지원 |
| Treemap 노드 | `SectorPerformanceTreemap.tsx` | D3 요소, 키보드 탐색 불가 |

**개선안** — `SortableHeader`를 `<th>` 안의 `<button>`으로 교체하면 정렬 헤더만으로 전 테이블의 키보드 접근성이 확보됩니다.

### P0-3. 모달 9개에 ARIA 시맨틱 없음

`role="dialog"`, `aria-modal`, `aria-labelledby` 전부 0건이며, `Escape` 처리는 `DatabaseHealthModal.tsx:83` 1곳뿐입니다.

| 모달 | 파일 | ESC |
| :-- | :-- | :-- |
| `SymbolDetailModal` | `components/SymbolDetailModal.tsx` | ❌ |
| `BackfillModal` | `components/BackfillModal.tsx` | ❌ |
| `ScanRunnerModal` | `components/ScanRunnerModal.tsx` | ❌ |
| `StrategyOptimizationModal` | `components/StrategyOptimizationModal.tsx` | ❌ |
| `AutoScanScheduleModal` | `components/AutoScanScheduleModal.tsx` | ❌ |
| `ExitSignalDashboardView` | `components/ExitSignalDashboardView.tsx` | ❌ |
| `PaperTradingView` | `components/PaperTradingView.tsx` | ❌ |
| `WatchlistView` | `components/WatchlistView.tsx` | ❌ |
| `DatabaseHealthModal` | `components/DatabaseHealthModal.tsx` | ✅ |

ESC 미지원 8개 모달에서 마우스 없이 닫을 수 없습니다. 포커스 트랩, body 스크롤락, 닫기 후 포커스 복원도 전부 0건입니다.

**개선안** — 공용 `<Modal onClose>` 컴포넌트 1개로 9개를 이관하면 ARIA·ESC·스크롤락·포커스 트랩이 한 번에 해결됩니다. P0-1과 함께 가장 ROI가 높은 항목입니다.

### P0-4. 폼 라벨 연결 전무

`<input>` 47개 전부에 대해 `htmlFor` 0건, `aria-describedby` 0건, `aria-invalid` 0건입니다.

`type="number"`는 9건뿐이며 나머지 38건은 텍스트 입력이라, 모바일에서 숫자 키패드가 표시되지 않습니다. 오류 문구가 있어도 입력 필드와 연결되지 않아 스크린리더 사용자는 오류가 어디에 발생했는지 알 수 없습니다.

### P0-5. URL 라우팅 부재

`App.tsx:38`의 `activeTab`이 `useState`로만 관리됩니다. `pushState` / `replaceState` / `react-router` 등 0건입니다.

- 새로고침 시 항상 대시보드로 복귀 — 종목 상세 분석 중 입력값 소실
- 화면을 링크로 공유할 수 없음
- 브라우저 뒤로/앞으로가 동작하지 않음

**개선안** — `?tab=watchlist&ticker=NVDA` 형태의 해시 쿼리 동기화로 외부 라이브러리 없이 가능합니다.

---

## P1 — 사용 흐름 저해

### P1-1. 데이터 신선도 계산은 되지만 표시되지 않음

`evaluateDataQuality`가 `marketDataService.ts:304`에서 호출되고 결과가 `types/v8.ts:143`의 `data_freshness`로 정의되지만, **어떤 `.tsx`에서도 `data_freshness`를 참조하지 않습니다.**

즉 `FRESH` / `RECENT` / `STALE` / `OUTDATED` 판정 로직이 완전한 상태에서 UI로 출력되지 않고 있습니다. 사용자는 화면의 수치가 실시간인지 캐시된 값인지 알 수 없습니다. 금융 도구에서 신뢰도에 직결되는 항목입니다.

**개선안** — `<DataFreshnessBadge evaluatedAt={...} />`를 만들어 헤더에 배치합니다.

### P1-2. 미존재 Tailwind 클래스 7건

`slate-750`과 `slate-850`은 Tailwind 기본 스케일에 없어 클래스명이 그대로 출력되거나 무시됩니다. 린터가 잡아주지 않는 silent failure입니다.

| 파일:라인 | 클래스 | 실제 의도 |
| :-- | :-- | :-- |
| `ScanRunsView.tsx:143` | `hover:bg-slate-750` | `slate-700` |
| `Navbar.tsx:427`, `:438` | `border-slate-750` | `slate-700` |
| `WatchlistView.tsx:573`, `:589`, `:616` | `hover:bg-slate-750` | `slate-700` |
| `BackfillModal.tsx:535` | `divide-slate-850` | `slate-800` |

모바일 드로어의 보조 액션 버튼과 백필 로그 테이블 구분선에 영향을 줍니다.

### P1-3. 네이티브 `confirm()` 2곳

- `ExitSignalDashboardView.tsx:121` — 보유 종목 해제
- `WatchlistView.tsx:585` — 기본 종목 복원

OS 기본 다이얼로그가 표시되어 다크 테마와 다른 Button 문구로 렌더링됩니다. 공용 모달(`P0-3`)로 교체 대상입니다.

### P1-4. 로딩·에러 상태 미비

빈 상태 화면은 9개 뷰 전반에 컨텍스트 메시지와 함께 잘 구현되어 있습니다. 반면 **로딩 스켈레톤과 에러 상태 + 재시도 버튼이 대부분 없습니다.** 데이터 요청이 실패해도 사용자는 "데이터가 없다"로 오인합니다.

### P1-5. 페이지네이션 부재

`alerts` / `signals` / `scan_runs` 계열 테이블이 전체 행을 렌더합니다. 워치리스트는 `src/constants/limits.ts`의 시장별 30종목 제한으로 상한이 있지만, 알림 이력은 누적되어 점진적으로 무거워집니다.

### P1-6. 스캔 실행 상세로 진입 불가

`ScanRunsView`는 행 클릭 시 상세 화면이 없습니다. 스캔 실패 원인은 `error_summary` 텍스트를 직접 읽어야만 확인할 수 있습니다.

### P1-7. 숫자 포맷 로직 파편화

`src/utils/formatters.ts`는 33줄·함수 3개인 반면, 컴포넌트 인라인 `.toFixed()`는 83건입니다. 동일 값이 화면마다 다른 소수점 자릿수로 표시될 수 있습니다. 금액 단위(`만` / `억`) 표기도 화면별로 혼용됩니다.

### P1-8. 실시간 갱신이 스크린리더에 전달되지 않음

스캔 진행률, 백필 로그, 모의거래 P&L이 실시간으로 갱신되지만 `aria-live` 영역이 0건이라 시각 사용자만 정보를 얻습니다. 토스트도 `App.tsx:797`에서 마크업되지만 `role="status"`가 없습니다.

---

## P2 — 다듬기

| 항목 | 위치 | 내용 |
| :-- | :-- | :-- |
| 한글 최소 폰트 크기 `[판단]` | 전역 775건 | `text-[9px]` 66건 포함. 한글은 획이 복잡해 동일 크기에서 판독성이 크게 떨어집니다. `text-xs`(12px) 하한 검토 |
| 색상 대비 `[판단]` | 29개 파일 186건 | `text-slate-500` / `text-slate-600`이 다크 배경에 사용됩니다. WCAG AA 4.5:1 충족 여부는 측정 필요 |
| 모션 미존중 `[판단]` | `index.css` | `prefers-reduced-motion` 0건. 스피너·페이드 애니메이션이 전역에 적용됩니다 |
| 모바일 내비게이션 중복 | `Navbar.tsx` | 수평 스크롤바와 드로어가 동시 제공되어 어느 쪽이 주 경로인지 불명확합니다 |
| 시계열 차트 줌 부재 | `EquityCurveChart.tsx` 등 | recharts `Brush` 0건. 전체 구간만 조회 가능합니다 |
| 히딩 구조 | `components/` | `<h1>` 4개로 뷰마다 개수가 제각각입니다 |
| 숫자 입력 | 47개 중 9개 | 나머지 38건의 텍스트 입력에 `inputMode="decimal"` 미적용 |

> 색상 대비와 폰트 크기는 실제 측정(대비율 계산기, 렌더링 캡처)이 없어 코드 근거만 제시했습니다. 확정 우선순위를 정하기 전 측치를 권장합니다.

---

## 양호한 구현 (유지 권장)

- 빈 상태 UI가 9개 뷰 전반에 컨텍스트 메시지와 함께 구현됨
- 워치리스트 용량 제한을 사전 안내 (`WatchlistView.tsx:299-301`, `:552`, `:1363`)
- 차트 커스텀 툴팁, Legend, ReferenceLine 적용
- 설정값 `localStorage` 영속화 (`App.tsx:41-101`)
- 검색 입력 250ms 디바운스
- 리스크 배지에 색상 외 텍스트 라벨 병기 — 색상 단독 신호가 아님
- `ErrorBoundary` 존재

---

## 권장 실행 순서

| 순서 | 작업 | 기대 효과 |
| :-- | :-- | :-- |
| 1 | `index.css`에 `:focus-visible` 전역 규칙 추가 | 45건 동시 해결 (P0-1) |
| 2 | `SortableHeader`를 `<button>` 구조로 교체 | 전 테이블 키보드 접근성 (P0-2) |
| 3 | 공용 `<Modal>` 추상화 후 9개 이관 | ARIA + ESC + 스크롤락 동시 해결 (P0-3) |
| 4 | URL 해시와 `activeTab` 동기화 | 새로고침·공유·뒤로가기 (P0-5) |
| 5 | `DataFreshnessBadge` 구현 및 헤더 배치 | 데이터 신뢰도 (P1-1) |
| 6 | 입력 `htmlFor` + `aria-invalid` 연결 | 폼 접근성 (P0-4) |
| 7 | 미존재 Tailwind 클래스 7건 수정 | 렌더링 오류 (P1-2) |
| 8 | 로딩 스켈레톤 + 에러 재시도 | 실패 시 오인 방지 (P1-4) |

1~3번은 각각 파일 1개 단위의 변경으로 높은 효과를 얻을 수 있습니다.

---

## 미해결 항목

본 감사에서 수치를 확정하지 못한 항목입니다. 우선순위 확정 전 검증이 필요합니다.

- 색상 대비율 실제 측정 (WCAG AA / AAA)
- 한글 최소 폰트 크기 — 브라우저·기기별 렌더링 확인 필요
- 차트 텍스트 대안 및 데이터 테이블 제공 여부
- 온보딩 흐름 존재 여부 (`StrategyGuideView.tsx` 진입 경로)
- 필터 기능 — 날짜 범위, 점수 임계값 등
