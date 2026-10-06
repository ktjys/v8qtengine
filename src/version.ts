/**
 * Application Version & Build Metadata
 */

export interface AppVersionInfo {
  version: string;
  commitHash: string;
  commitMessage: string;
  buildTime: string;
  environment: string;
}

// Injected by Vite define at build/bundle time
declare const __APP_VERSION__: string | undefined;
declare const __COMMIT_HASH__: string | undefined;
declare const __COMMIT_MESSAGE__: string | undefined;
declare const __BUILD_TIME__: string | undefined;

export const FALLBACK_COMMIT_HASH = 'ac4e772';
export const FALLBACK_COMMIT_MESSAGE = '버전 변경 히스토리 자동 기록 시스템 구축';
export const FALLBACK_BUILD_TIME = '2026. 10. 6. PM 9:20:02 KST';

const resolveCommitHash = (fallback = FALLBACK_COMMIT_HASH): string => {
  if (typeof __COMMIT_HASH__ !== 'undefined' && __COMMIT_HASH__) return __COMMIT_HASH__;
  if (typeof process !== 'undefined' && process.env) {
    const envSha = process.env.CF_PAGES_COMMIT_SHA || process.env.GITHUB_SHA || process.env.COMMIT_SHA;
    if (envSha) return envSha.slice(0, 7);
  }
  return fallback;
};

const resolveCommitMessage = (fallback = FALLBACK_COMMIT_MESSAGE): string => {
  if (typeof __COMMIT_MESSAGE__ !== 'undefined' && __COMMIT_MESSAGE__) return __COMMIT_MESSAGE__;
  if (typeof process !== 'undefined' && process.env?.GITHUB_COMMIT_MESSAGE) {
    return process.env.GITHUB_COMMIT_MESSAGE.slice(0, 80);
  }
  return fallback;
};

const resolveBuildTime = (fallback = FALLBACK_BUILD_TIME): string => {
  if (typeof __BUILD_TIME__ !== 'undefined' && __BUILD_TIME__) return __BUILD_TIME__;
  return fallback;
};

export const APP_VERSION_INFO: AppVersionInfo = {
  version: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '8.2.6',
  commitHash: resolveCommitHash(),
  commitMessage: resolveCommitMessage(),
  buildTime: resolveBuildTime(),
  environment: typeof process !== 'undefined' && process.env?.NODE_ENV === 'development' ? 'development' : 'production',
};

export const RECENT_RELEASE_CHANGELOG = [
  {
    version: 'v8.2.6',
    date: '2026-10-06',
    commit: 'ac4e772',
    title: '버전 변경 히스토리 자동 기록 시스템 구축',
    items: [
      'Git 커밋 및 단일 CLI 기반 자동 체인지로그 생성',
      'package.json 및 vite.config.ts 버전 자동 동기화 지원',
    ],
  },
  {
    version: 'v8.2.5',
    date: '2026-10-05',
    commit: '7b91e0a',
    title: '국내 ETF 공식 종목명 전수(1,171개) 매핑 & 매도/청산 매수가 기준 투명화',
    items: [
      '국내 ETF 전수(1,171종목) 공식 마스터 딕셔너리 구축 (KODEX, TIGER, ACE 등 "국내종목" 표기 원천 제거)',
      '매도/청산 신호 매수가 기준 3단계 명확화 (실계좌 등록 평단가 / 모의투자 체결가 / 미등록 관심종목 기술적 감시)',
      '평단가 미등록 종목에 대해 가짜 ₩0 표기 대신 "기술적 추세 이탈만 감시"로 명확히 분리 및 원클릭 평단가 등록 제공',
      '텔레그램 정기 스캔 리포트 및 대시보드 카드에 매수가 출처 및 기준일자(YYYY-MM-DD) 투명 공개',
      '트레일링 스탑(-7%) 발동 기준을 "진입 후 최고점(Peak Price) 대비 하락률"로 상세 안내',
    ],
  },
  {
    version: 'v8.2.4',
    date: '2026-10-03',
    commit: 'c6e04de',
    title: 'Cloudflare Worker 서브리퀘스트 한도 초과 해결 & 국장/미장 완전 분리 스캔',
    items: [
      'Cloudflare 무료 플랜 50 subrequests 초과 문제 완벽 해결 (1회 스캔당 ~18회로 최적화)',
      'wrangler.toml [limits] subrequests = 1000 설정 지원 (유료 계정 최대 1,000건+ 허용)',
      '국내 종목 네이버 금융 다이렉트 수집으로 불필요한 야후 재시도 제거',
      'Supabase 펀더멘털 및 지표 데이터 단 1회 batch upsert로 DB 통신 압축',
      '미국장 스캔 시 국내 종목 완전 배제 및 국내장 스캔 시 미국 종목 완전 배제 (시장 격리)',
      '화면 상단(Navbar) 2단 반응형 헤더 구조 적용 및 데스크탑 가로 넘침 완벽 해소',
      '파비콘(favicon.ico, favicon.svg) 404 에러 원천 해결 및 캐시 동기화 검증 개선',
    ],
  },
  {
    version: 'v8.2.3',
    date: '2026-10-02',
    commit: '09e32a1',
    title: '모바일 반응형 레이아웃 100vw 스크롤바 넘침 해소 및 사용성 개선',
    items: [
      '모바일 브라우저 수평 스크롤바(100vw) 버그 전역 제거',
      'WatchlistView, AlertHistoryView, ExitSignal 카드 배지 flex-wrap 줄바꿈 적용',
      '전역 :focus-visible 키보드 포커스 링 스타일 복원 (P0-1 개선)',
      'Tailwind 비규격 클래스(slate-750/850) 규격화 (P1-2 개선)',
    ],
  },
];