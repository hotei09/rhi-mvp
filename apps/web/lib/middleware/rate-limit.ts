/**
 * Rate Limit 순수 함수 — REQ-005 Statement C / AC-8b.
 *
 * IP별 sliding-fixed-window count를 in-memory store에 추적한다.
 * Edge runtime에서 module-level Map으로 사용되며 (`middleware.ts`),
 * 본 함수 자체는 store/now/config를 인자로 받는 결정론적 순수 함수이므로
 * 단위 테스트가 가능하다.
 *
 * window 모델: fixed-window
 *  - 첫 요청 시점에 resetAt = now + windowMs 결정
 *  - 동일 윈도우 내에서는 count 누적
 *  - resetAt 도래 시 카운터 리셋 (다음 요청에서 새 윈도우 생성)
 *
 * AC-8b 검증 시나리오:
 *  - 단일 IP 60s 내 30 req: allowed=true (첫 30회)
 *  - 31번째 req: allowed=false (retryAfter 반환)
 *  - 60s 경과 후: allowed=true (재개)
 *  - 다른 IP: 독립 카운터
 */

/**
 * Per-IP 카운터 store.
 * key: IP 문자열, value: 현재 윈도우 카운트 + reset epoch (ms)
 */
export type RateLimitStore = Map<string, { count: number; resetAt: number }>;

/**
 * Rate limit 동작을 결정하는 설정값.
 */
export type RateLimitConfig = {
  /** 윈도우 내 허용 최대 요청 수 (예: 30) */
  maxRequests: number;
  /** 윈도우 길이 (ms, 예: 60_000) */
  windowMs: number;
};

/**
 * `enforceRateLimit` 결과.
 */
export type RateLimitResult = {
  /** 요청 허용 여부 */
  allowed: boolean;
  /** 남은 가용 슬롯 (allowed=true일 때만 의미 있음) */
  remaining: number;
  /** 차단 시 클라이언트가 재시도까지 대기해야 하는 초 단위 (allowed=false일 때만 채워짐) */
  retryAfter?: number;
};

/**
 * SPEC-RHI-001 plan.md §2B.4 기본값.
 * 분당 30 req per IP.
 */
export const DEFAULT_RATE_LIMIT_CONFIG: Readonly<RateLimitConfig> = Object.freeze({
  maxRequests: 30,
  windowMs: 60_000,
});

/**
 * 단일 IP의 요청을 평가해 허용/차단을 결정한다.
 *
 * @param ip - 식별 가능한 클라이언트 IP (또는 forwarded 키)
 * @param now - 현재 epoch (ms) — 테스트 결정성 확보를 위해 외부 주입
 * @param store - 외부에서 관리되는 카운터 Map (호출자가 module-level state로 보유)
 * @param config - 윈도우 길이 + 임계값 (기본값: DEFAULT_RATE_LIMIT_CONFIG)
 * @returns allowed 플래그 + 남은 슬롯 + 차단 시 retryAfter 초
 *
 * @example
 *   const store: RateLimitStore = new Map();
 *   const r = enforceRateLimit('1.2.3.4', Date.now(), store, DEFAULT_RATE_LIMIT_CONFIG);
 *   if (!r.allowed) return new Response('429', { status: 429, headers: { 'Retry-After': String(r.retryAfter) } });
 */
// @MX:ANCHOR: [AUTO] middleware + rate-limit 단위 테스트 + 향후 API consumers 가 호출 — fan_in_high
// @MX:REASON: REQ-005 Statement C 구현의 단일 진입점. 시그니처 변경 시 middleware.ts와 모든 통합/E2E 테스트 동시 갱신 필수.
// @MX:SPEC: SPEC-RHI-001 REQ-005 / AC-8b
export function enforceRateLimit(
  ip: string,
  now: number,
  store: RateLimitStore,
  config: RateLimitConfig = DEFAULT_RATE_LIMIT_CONFIG,
): RateLimitResult {
  const entry = store.get(ip);

  // 새 윈도우: 기존 항목 없거나 resetAt 도래
  if (!entry || entry.resetAt <= now) {
    store.set(ip, { count: 1, resetAt: now + config.windowMs });
    return { allowed: true, remaining: config.maxRequests - 1 };
  }

  // 윈도우 내 — 임계값 초과 시 차단
  if (entry.count >= config.maxRequests) {
    const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
    return { allowed: false, remaining: 0, retryAfter };
  }

  // 윈도우 내 카운터 증가
  entry.count += 1;
  return { allowed: true, remaining: config.maxRequests - entry.count };
}
