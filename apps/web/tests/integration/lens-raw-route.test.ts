/**
 * 통합 테스트 — `/api/entity/[entityId]/lens-raw` Route handler.
 *
 * 5개 lens 식별자 + BN 검증 + raw row 반환을 모두 커버한다.
 */
import '../setup-env';
import { afterAll, describe, expect, it } from 'vitest';

afterAll(async () => {
  const { sql } = await import('@/lib/db/client');
  await sql.end({ timeout: 5 });
});

/**
 * NextRequest mock helper — query string + URL을 받아 GET 호출에 적합한 객체를 만든다.
 */
function makeRequest(url: string): unknown {
  // NextRequest는 기본적으로 nextUrl만 사용하므로 최소 mock으로 충분.
  return {
    nextUrl: new URL(url),
  };
}

describe('GET /api/entity/[entityId]/lens-raw', () => {
  it('returns 400 for invalid BN format', async () => {
    const { GET } = await import('@/app/api/entity/[entityId]/lens-raw/route');
    const req = makeRequest('http://x/api/entity/not-a-bn/lens-raw?lens=zombie');
    const res = (await GET(req as never, {
      params: Promise.resolve({ entityId: 'not-a-bn' }),
    })) as Response;
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/invalid bn/i);
  });

  it('returns 400 for invalid lens parameter', async () => {
    const { GET } = await import('@/app/api/entity/[entityId]/lens-raw/route');
    const req = makeRequest('http://x/api/entity/107951618RR0001/lens-raw?lens=invalid-lens');
    const res = (await GET(req as never, {
      params: Promise.resolve({ entityId: '107951618RR0001' }),
    })) as Response;
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/invalid lens/i);
  });

  it('returns rows + sql trace for zombie lens', async () => {
    const { GET } = await import('@/app/api/entity/[entityId]/lens-raw/route');
    const req = makeRequest('http://x/api/entity/107951618RR0001/lens-raw?lens=zombie');
    const res = (await GET(req as never, {
      params: Promise.resolve({ entityId: '107951618RR0001' }),
    })) as Response;
    expect(res.status).toBe(200);
    const body = (await res.json()) as { rows: unknown[]; sql: string; lens: string };
    expect(body.lens).toBe('zombie');
    expect(typeof body.sql).toBe('string');
    expect(Array.isArray(body.rows)).toBe(true);
  }, 30_000);

  it('accepts each of the 5 valid lens ids', async () => {
    const { GET } = await import('@/app/api/entity/[entityId]/lens-raw/route');
    const lenses = ['zombie', 'ghost', 'loop', 'director', 'multi-source'] as const;
    for (const lens of lenses) {
      const req = makeRequest(`http://x/api/entity/107951618RR0001/lens-raw?lens=${lens}`);
      const res = (await GET(req as never, {
        params: Promise.resolve({ entityId: '107951618RR0001' }),
      })) as Response;
      expect(res.status).toBe(200);
      const body = (await res.json()) as { lens: string };
      expect(body.lens).toBe(lens);
    }
  }, 60_000);
});
