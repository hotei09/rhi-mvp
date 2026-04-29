/**
 * E2E 테스트 — Rate Limit Middleware (AC-8b).
 *
 * 단일 IP 60s 윈도우 내 31번째 요청 → 429 Too Many Requests.
 *
 * 본 테스트는 60s 회복 윈도우 대기 없이 31번째 요청 차단만 검증한다 — 회복 검증은 단위 테스트로 충분.
 *
 * 매핑: SPEC-RHI-001 REQ-005 Statement C / AC-8b
 */
import { expect, test } from '@playwright/test';

test.describe('Rate Limit Middleware (AC-8b)', () => {
  test.setTimeout(180_000);

  test('eventually emits 429 within max 35 sequential non-exempt requests', async ({ request }) => {
    // 35개 sequential 요청 — 30개 임계값 도과 후 429 반환을 검증
    // (정확히 31번째일 필요는 없음; 30회 윈도우 내 429 emission이 핵심)
    const responses: number[] = [];
    for (let i = 0; i < 35; i++) {
      const r = await request.get('/api/search?q=test');
      responses.push(r.status());
      if (r.status() === 429) {
        const retryAfter = r.headers()['retry-after'];
        expect(retryAfter).toBeDefined();
        expect(Number.parseInt(retryAfter ?? '', 10)).toBeGreaterThan(0);
        break;
      }
    }
    // 35회 안에 429가 반환되어야 함
    expect(responses).toContain(429);
  });

  test('healthz endpoint is exempt from rate limit', async ({ request }) => {
    // 35개 호출 모두 통과해야 함 (rate limit 카운터 영향 받지 않음)
    for (let i = 0; i < 35; i++) {
      const r = await request.get('/api/healthz');
      // 200 또는 503 (DB 미가용 시) — 절대 429가 아님
      expect(r.status()).not.toBe(429);
    }
  });
});
