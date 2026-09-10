import { dbClient } from '../supabaseClient';
import { AlertNotificationLog } from '../../types/v8';

// Realistic initial seed records for alert notifications
const INITIAL_ALERT_LOGS: AlertNotificationLog[] = [
  {
    id: 'alert-seed-001',
    timestamp: new Date(Date.now() - 1000 * 60 * 35).toISOString(), // 35 mins ago
    kst_time: new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date(Date.now() - 1000 * 60 * 35)),
    strategy_type: 'DUAL_SCAN_REPORT',
    title: '🚀 [정기 스캔] 듀얼 퀀트 브리핑 (전략 A 모멘텀 + 전략 B 우량주 눌림목)',
    tickers: ['NVDA', 'SPY', 'QQQ', 'AAPL'],
    signals_count: 4,
    delivery_status: 'LOCAL_LOGGED',
    delivery_target: '682****',
    message_preview: '전략 A 모멘텀 돌파 2건 & 전략 B 우량주 눌림추매 2건 (NVDA, SPY) 포착',
    message_body: `<b>🚀 퀀트 스캐너 정기 스캔 브리핑 (듀얼 전략 통합)</b>
━━━━━━━━━━━━━━━━━━━━━
• <b>총 워치리스트:</b> 8개 종목
• <b>전략 A (모멘텀 돌파):</b> 2건 포착 (QQQ, AAPL)
• <b>전략 B (우량주 눌림추매):</b> 2건 포착 (NVDA, SPY)

<b>🎯 전략 A: 모멘텀 & 추세돌파 포착 종목</b>
1. <b>QQQ</b> (Invesco QQQ Trust)
   - 현재가: $485.20 (+1.2%)
   - 기회점수: <b>85점</b> | 판정: <code>BUY</code>
   - 핵심이유: 기술적 골든크로스 및 나스닥 100 모멘텀 가속

2. <b>AAPL</b> (Apple Inc.)
   - 현재가: $232.10 (+0.8%)
   - 기회점수: <b>78점</b> | 판정: <code>BUY</code>
   - 핵심이유: 20일선 지지 후 전고점 돌파 시도

<b>🛡️ 전략 B: 우량대형주 & 지수ETF 분할적립/눌림목 포착</b>
1. <b>NVDA</b> (NVIDIA Corporation)
   - 현재가: $217.55 (+1.3%)
   - 적합도: <b>💎 S등급 초우량 독점</b> (92점)
   - 눌림타이밍: <b>84점</b> (RSI 42.0, 얕은 눌림목 -5.4%)
   - 실행신호: <b>MODERATE_DCA</b> (건전 눌림목 분할적립)
   - <b>💡 권고 분할적립 배수:</b> <b>1.5x 적극 적립 (기준금액 150%)</b>
   - 진단: 단기 얕은 조정 완료 후 20일선 안착 흐름

2. <b>SPY</b> (SPDR S&P 500 ETF Trust)
   - 현재가: $565.40 (+0.4%)
   - 적합도: <b>💎 S등급 대표 지수 ETF</b> (96점)
   - 눌림타이밍: <b>79점</b> (RSI 44.5, 고점 대비 -4.2%)
   - 실행신호: <b>MODERATE_DCA</b> (1.2x 정기 적립)
   - <b>💡 권고 분할적립 배수:</b> <b>1.2x 정기 적립 (안정 분할매수)</b>
   - 진단: S&P 500 주요 이동평균선 지지 및 분할매수 유효 구간`,
    details: {
      strategy_a_tickers: [
        { ticker: 'QQQ', score: 85, decision: 'BUY', price: 485.20, change1d: 1.2 },
        { ticker: 'AAPL', score: 78, decision: 'BUY', price: 232.10, change1d: 0.8 },
      ],
      strategy_b_tickers: [
        {
          ticker: 'NVDA',
          tier: 'S',
          dip_score: 84,
          rsi: 42.0,
          drawdown: '-5.4%',
          suggested_action: '1.5x 적극 적립 (건전 눌림목)',
        },
        {
          ticker: 'SPY',
          tier: 'S',
          dip_score: 79,
          rsi: 44.5,
          drawdown: '-4.2%',
          suggested_action: '1.2x 정기 적립 (지수 ETF)',
        },
      ],
    },
  },
  {
    id: 'alert-seed-002',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 14).toISOString(), // 14 hours ago
    kst_time: new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date(Date.now() - 1000 * 60 * 60 * 14)),
    strategy_type: 'STRATEGY_B',
    title: '🛡️ [전략 B 단독 알람] NVDA 우량주 건전 눌림목 분할적립 신호',
    tickers: ['NVDA'],
    signals_count: 1,
    delivery_status: 'SENT',
    delivery_target: '682****',
    message_preview: 'NVDA: S등급 우량주 건전 눌림목 진입 (RSI 42.0, 전고점 대비 -5.4%)',
    message_body: `<b>🛡️ [전략 B] 우량주/지수ETF 눌림목 분할적립 알림</b>
━━━━━━━━━━━━━━━━━━━━━
<b>NVDA</b> (NVIDIA Corporation)
• 현재가: $217.55
• 우량주 적합도: <b>💎 S등급 초우량주 (92점)</b>
  - 미국 증시 최상위 시가총액 및 독점적 AI 인프라 해자
• 눌림목 타이밍: <b>84점 (매력적 매수가)</b>
  - RSI 14: <b>42.0</b> (DIP_ZONE 건전 조정)
  - 고점 대비: <b>-5.4% (얕은 눌림목)</b>
  - 지지선: 50일 이동평균선 견고한 지지

<b>🎯 실행 권고: MODERATE_DCA</b>
• 권고 적립 배수: <b>1.5x 적극 분할적립 (정기적립 대비 150%)</b>
• 매매 가이드: 단기 과열 해소된 얕은 눌림목으로 세금 부담 없는 장기 보유 분할매수 최적 구간`,
    details: {
      strategy_b_tickers: [
        {
          ticker: 'NVDA',
          tier: 'S',
          dip_score: 84,
          rsi: 42.0,
          drawdown: '-5.4%',
          suggested_action: '1.5x 적극 적립',
        },
      ],
    },
  },
  {
    id: 'alert-seed-003',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(), // 36 hours ago
    kst_time: new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date(Date.now() - 1000 * 60 * 60 * 36)),
    strategy_type: 'STRATEGY_A',
    title: '🚀 [전략 A 단독 알람] QQQ 신고가 추세 돌파 매수 신호',
    tickers: ['QQQ'],
    signals_count: 1,
    delivery_status: 'SENT',
    delivery_target: '682****',
    message_preview: 'QQQ: 나스닥 100 모멘텀 가속 기회점수 85점 매수 신호 도출',
    message_body: `<b>🚀 [전략 A] 모멘텀 & 추세돌파 매수 알림</b>
━━━━━━━━━━━━━━━━━━━━━
<b>QQQ</b> (Invesco QQQ Trust)
• 현재가: $485.20 (+1.2%)
• 기회 점수: <b>85점</b> (강력 매수 구간)
• 기술적 상태: 20일-50일 골든크로스 및 MACD 양전
• 리스크 평가: <b>LOW RISK</b> (변동성 안정권)

<b>🎯 판정: BUY (목표 비중 15%)</b>
• 스탑로스: ATR 2.0x 기준 $471.50`,
    details: {
      strategy_a_tickers: [
        { ticker: 'QQQ', score: 85, decision: 'BUY', price: 485.20, change1d: 1.2 },
      ],
    },
  },
];

// In-memory alert store
const inMemoryAlertLogs: Map<string, AlertNotificationLog> = new Map();
INITIAL_ALERT_LOGS.forEach((item) => inMemoryAlertLogs.set(item.id, item));

export class AlertHistoryRepository {
  async getAll(): Promise<AlertNotificationLog[]> {
    if (dbClient.isTableAvailable('alert_notifications') && dbClient.supabase) {
      try {
        const { data, error } = await dbClient.supabase
          .from('alert_notifications')
          .select('*')
          .order('timestamp', { ascending: false });

        if (error) {
          dbClient.handleDbError('alert_notifications', 'getAll', error);
        } else if (Array.isArray(data) && data.length > 0) {
          const mapped: AlertNotificationLog[] = data.map((r: any) => ({
            id: r.id,
            timestamp: r.timestamp,
            kst_time: r.kst_time,
            strategy_type: r.strategy_type,
            title: r.title,
            tickers: r.tickers || [],
            signals_count: r.signals_count || 0,
            delivery_status: r.delivery_status,
            delivery_target: r.delivery_target,
            message_preview: r.message_preview,
            message_body: r.message_body,
            details: r.details,
          }));
          mapped.forEach((item) => inMemoryAlertLogs.set(item.id, item));
          return mapped;
        }
      } catch (err) {
        dbClient.handleDbError('alert_notifications', 'getAll', err);
      }
    }

    // Return in-memory logs sorted desc
    return Array.from(inMemoryAlertLogs.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  async getByTicker(ticker: string): Promise<AlertNotificationLog[]> {
    const all = await this.getAll();
    const clean = ticker.toUpperCase().trim();
    return all.filter((log) => log.tickers.map((t) => t.toUpperCase()).includes(clean));
  }

  async save(log: AlertNotificationLog): Promise<AlertNotificationLog> {
    if (!log.id) {
      log.id = `alert-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    }

    if (!log.kst_time) {
      log.kst_time = new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(new Date(log.timestamp || Date.now()));
    }

    inMemoryAlertLogs.set(log.id, log);

    if (dbClient.isTableAvailable('alert_notifications') && dbClient.supabase) {
      try {
        const payload = {
          id: log.id,
          timestamp: log.timestamp,
          kst_time: log.kst_time,
          strategy_type: log.strategy_type,
          title: log.title,
          tickers: log.tickers,
          signals_count: log.signals_count,
          delivery_status: log.delivery_status,
          delivery_target: log.delivery_target,
          message_preview: log.message_preview,
          message_body: log.message_body,
          details: log.details,
        };

        const { error } = await dbClient.supabase
          .from('alert_notifications')
          .insert(payload);

        if (error) {
          dbClient.handleDbError('alert_notifications', 'save', error);
        }
      } catch (err) {
        dbClient.handleDbError('alert_notifications', 'save', err);
      }
    }

    return log;
  }

  async clearAll(): Promise<void> {
    inMemoryAlertLogs.clear();
    if (dbClient.isTableAvailable('alert_notifications') && dbClient.supabase) {
      try {
        await dbClient.supabase.from('alert_notifications').delete().neq('id', '___NONE___');
      } catch (err) {
        console.warn('[AlertHistoryRepository] Failed to clear DB table:', err);
      }
    }
  }
}

export const alertHistoryRepository = new AlertHistoryRepository();
