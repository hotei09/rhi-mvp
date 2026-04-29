/**
 * 통합 테스트 — AC-1 (`GET /api/healthz`).
 *
 * Given Render PG replica reachable + Next.js Route handler 정상 빌드
 * When `GET /api/healthz` 호출
 * Then 200 + body `{ ok: true, ts: <ISO-8601> }` + DB ping 결과 반영 + 응답시간 1000ms 이하
 *
 * 참고: AC-1 명시 목표는 < 200ms warm / < 500ms cold이지만 vitest cold 측정 환경 변수성
 * 고려하여 1000ms tolerance로 검증한다 (실제 prod 게이트는 Playwright E2E에서 별도 측정).
 */
import '../setup-env';
import { afterAll, describe, expect, it } from 'vitest';

afterAll(async () => {
  const { sql } = await import('@/lib/db/client');
  await sql.end({ timeout: 5 });
});

describe('GET /api/healthz — AC-1', () => {
  it('returns 200 OK with { ok: true, ts: <ISO-8601> }', async () => {
    const { GET } = await import('@/app/api/healthz/route');
    const response = await GET(new Request('http://localhost/api/healthz'));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { ok: boolean; ts: string };
    expect(body.ok).toBe(true);
    expect(typeof body.ts).toBe('string');
    // ISO-8601 형식 (Z suffix)
    expect(body.ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    // Date 객체로 파싱 가능
    const parsed = new Date(body.ts);
    expect(Number.isNaN(parsed.getTime())).toBe(false);
  });

  it('responds within 1000ms tolerance (DB ping latency)', async () => {
    const { GET } = await import('@/app/api/healthz/route');
    const t0 = performance.now();
    const response = await GET(new Request('http://localhost/api/healthz'));
    const elapsed = performance.now() - t0;
    expect(response.status).toBe(200);
    expect(elapsed).toBeLessThan(1000);
  });

  it('sets Content-Type to application/json', async () => {
    const { GET } = await import('@/app/api/healthz/route');
    const response = await GET(new Request('http://localhost/api/healthz'));
    const contentType = response.headers.get('content-type') ?? '';
    expect(contentType).toContain('application/json');
  });

  it('exports dynamic = "force-dynamic" (no caching)', async () => {
    const mod = await import('@/app/api/healthz/route');
    expect(mod.dynamic).toBe('force-dynamic');
  });

  it('exports runtime = "nodejs" (postgres.js requires Node)', async () => {
    const mod = await import('@/app/api/healthz/route');
    expect(mod.runtime).toBe('nodejs');
  });
});
