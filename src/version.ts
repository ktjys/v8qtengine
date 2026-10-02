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

export const APP_VERSION_INFO: AppVersionInfo = {
  version: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '8.2.4',
  commitHash: typeof __COMMIT_HASH__ !== 'undefined' ? __COMMIT_HASH__ : '14c4db1',
  commitMessage: typeof __COMMIT_MESSAGE__ !== 'undefined' ? __COMMIT_MESSAGE__ : 'fix: cloudflare subrequests limit & market isolation',
  buildTime: typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : '2026-10-03 08:45 KST',
  environment: typeof process !== 'undefined' && process.env?.NODE_ENV === 'development' ? 'development' : 'production',
};

export const RECENT_RELEASE_CHANGELOG = [
  {
    version: 'v8.2.4',
    date: '2026-10-03',
    commit: '14c4db1',
    title: 'Cloudflare Worker 서브리퀘스트 한도 초과 해결 & 국장/미장 완전 분리 스캔',
    items: [
      'Cloudflare 무료 플랜 50 subrequests 초과 문제 완벽 해결 (1회 스캔당 ~18회로 최적화)',
      'wrangler.toml [limits] subrequests = 1000 설정 지원 (유료 계정 최대 1,000건+ 허용)',
      '국내 종목 네이버 금융 다이렉트 수집으로 불필요한 야후 재시도 제거',
      'Supabase 펀더멘털 및 지표 데이터 단 1회 batch upsert로 DB 통신 압축',
      '미국장 스캔 시 국내 종목 완전 배제 및 국내장 스캔 시 미국 종목 완전 배제 (시장 격리)',
      '화면 상단(Navbar) 및 푸터에 실시간 커밋 버전 배지(#14c4db1) 및 배포 검증 모달 추가',
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
