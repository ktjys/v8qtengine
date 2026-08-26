// GET /api/v8/schedule/info
export async function onRequestGet(context: any) {
  const { request } = context;
  const url = new URL(request.url);

  const schedules = [
    {
      slot: 'POST_MARKET',
      name: '미국 정규장 마감 브리핑 (종가 확정)',
      timeKST: '06:30 KST (평일 화~토)',
      cronUTC: '30 21 * * 1-5', // 21:30 UTC = 06:30 KST next day
      purpose: '전일 종가 기준 4대 팩터(기술/모멘텀/펀더/밸류) 최종 집계 및 일봉 확정 시그널 도출',
      priority: 'HIGH',
    },
    {
      slot: 'PRE_MARKET',
      name: '프리마켓 갭 분석 & 당일 관심종목 압축',
      timeKST: '22:00 KST (평일 월~금)',
      cronUTC: '00 13 * * 1-5', // 13:00 UTC = 22:00 KST
      purpose: '프리마켓 변동성 및 뉴스 반영, 당일 진입 유효 후보군 압축 및 포트폴리오 비중 브리핑',
      priority: 'MEDIUM',
    },
    {
      slot: 'INTRADAY',
      name: '장중 급변 & 모멘텀 브레이크아웃 감시',
      timeKST: '02:00 KST (평일 화~토)',
      cronUTC: '00 17 * * 1-5', // 17:00 UTC = 02:00 KST
      purpose: '장중 거래량 폭증 및 변동성 브레이크아웃 종목 포착 시 실시간 긴급 신호 발송',
      priority: 'MEDIUM',
    },
  ];

  return new Response(
    JSON.stringify({
      success: true,
      total_schedules: schedules.length,
      schedules,
      cron_endpoint: `${url.origin}/api/v8/cron-scan`,
      methods_supported: ['Cloudflare Cron Triggers', 'cron-job.org (무료)', 'GitHub Actions Workflow', '웹 대시보드 원클릭 즉시 실행'],
      timezone: 'Asia/Seoul (KST)',
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}
