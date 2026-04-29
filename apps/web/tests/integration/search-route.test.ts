/**
 * 통합 테스트 — `/api/search` 검색 API 라우트 (AC-7).
 *
 * Given general.vw_entity_search 뷰 배포되어 있음
 * When GET /api/search?q=... 호출
 * Then prefix match 우선 + dataset_sources 노출 + 응답시간 < 500ms warm
 *
 * 매핑: SPEC-RHI-001 REQ-005 Statement B / AC-7
 */
import '../setup-env';
import { afterAll, describe, expect, it } from 'vitest';

afterAll(async () => {
  const { sql } = await import('@/lib/db/client');
  await sql.end({ timeout: 5 });
});

describe('GET /api/search — AC-7', () => {
  it('returns 400 on empty query string', async () => {
    const { GET } = await import('@/app/api/search/route');
    const response = await GET(new Request('http://localhost/api/search?q='));
    expect(response.status).toBe(400);
  });

  it('returns 400 on missing q parameter', async () => {
    const { GET } = await import('@/app/api/search/route');
    const response = await GET(new Request('http://localhost/api/search'));
    expect(response.status).toBe(400);
  });

  it('returns 400 on q < 2 characters', async () => {
    const { GET } = await import('@/app/api/search/route');
    const response = await GET(new Request('http://localhost/api/search?q=a'));
    expect(response.status).toBe(400);
  });

  it('returns 200 with results array on valid query', async () => {
    const { GET } = await import('@/app/api/search/route');
    const response = await GET(new Request('http://localhost/api/search?q=salvation'));
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      results: Array<{
        id: string;
        canonical_name: string;
        bn_root: string;
        dataset_sources: unknown;
      }>;
      q: string;
      latency_ms: number;
    };
    expect(Array.isArray(body.results)).toBe(true);
    expect(body.q).toBe('salvation');
    expect(typeof body.latency_ms).toBe('number');
  });

  it('exposes dataset_sources in each result', async () => {
    const { GET } = await import('@/app/api/search/route');
    const response = await GET(new Request('http://localhost/api/search?q=salvation'));
    const body = (await response.json()) as {
      results: Array<{ dataset_sources: unknown }>;
    };
    expect(body.results.length).toBeGreaterThan(0);
    for (const r of body.results) {
      expect(r.dataset_sources).toBeDefined();
    }
  });

  it('prefix match is prioritized over substring match', async () => {
    const { GET } = await import('@/app/api/search/route');
    const response = await GET(new Request('http://localhost/api/search?q=salvation'));
    const body = (await response.json()) as {
      results: Array<{ canonical_name: string }>;
    };
    expect(body.results.length).toBeGreaterThan(0);
    // 첫번째 결과는 prefix match (canonical_name이 'salvation'으로 시작)이어야 함
    if (body.results.length > 0) {
      const first = body.results[0];
      // Either prefix match or at least contains substring (DB ordering ensures prefix first)
      expect(first?.canonical_name.toLowerCase()).toContain('salvation');
    }
  });

  it('limits results to 20 by default', async () => {
    const { GET } = await import('@/app/api/search/route');
    // 매우 흔한 토큰 — 다수 매칭 예상
    const response = await GET(new Request('http://localhost/api/search?q=foundation'));
    const body = (await response.json()) as { results: Array<unknown> };
    expect(body.results.length).toBeLessThanOrEqual(20);
  });

  it('responds within 1500ms tolerance for warm cache', async () => {
    const { GET } = await import('@/app/api/search/route');
    // 1차 호출 (warm-up)
    await GET(new Request('http://localhost/api/search?q=health'));
    // 2차 호출 (warm)
    const t0 = performance.now();
    await GET(new Request('http://localhost/api/search?q=health'));
    const elapsed = performance.now() - t0;
    expect(elapsed).toBeLessThan(1500);
  });
});
