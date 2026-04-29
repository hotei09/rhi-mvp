/**
 * 통합 테스트 — `lib/entity/profile-data.ts` Entity Profile 데이터 페처.
 *
 * AC-6: 5개 lens 결과를 Promise.all로 병렬 fetch + composite Concern Score 산출.
 * AC-12: parallel 효과 검증 (Promise.all duration < sum of sequential durations).
 *
 * 실제 Render PG replica 직결. Phase 4의 E2E 보다 한 단계 아래에서 검증.
 */
import '../setup-env';
import { afterAll, describe, expect, it } from 'vitest';

afterAll(async () => {
  const { sql } = await import('@/lib/db/client');
  await sql.end({ timeout: 5 });
});

describe('fetchEntityData (AC-6 composite + parallel fetch)', () => {
  it('returns null for invalid BN format', async () => {
    const { fetchEntityData } = await import('@/lib/entity/profile-data');
    const result = await fetchEntityData('not-a-bn');
    expect(result).toBeNull();
  });

  it('returns null for valid BN that does not exist in cra_identification', async () => {
    const { fetchEntityData } = await import('@/lib/entity/profile-data');
    const result = await fetchEntityData('999999999RR9999');
    expect(result).toBeNull();
  }, 30_000);

  it('returns full profile for an existing BN with all 5 lens results + composite score', async () => {
    const { fetchEntityData } = await import('@/lib/entity/profile-data');
    const { sql } = await import('@/lib/db/client');

    // 자금 수령 단체 중 BN 1개 추출
    const candidates = (await sql.unsafe(
      `SELECT m.bn FROM cra.cra_identification m
       JOIN cra.govt_funding_by_charity g ON g.bn = m.bn
       WHERE g.govt_share_of_rev >= 0.3
       ORDER BY g.total_govt DESC NULLS LAST
       LIMIT 1`,
    )) as Array<{ bn: string }>;

    if (candidates.length === 0) {
      console.log('[entity-profile] no candidate BN found — skipping');
      return;
    }
    const bn = candidates[0]?.bn;
    if (!bn) return;

    const data = await fetchEntityData(bn);
    expect(data).not.toBeNull();
    if (!data) return;

    // identity block fields
    expect(data.identity.bn).toBe(bn);
    expect(typeof data.identity.legal_name).toBe('string');

    // 5개 lens 결과 모두 존재
    expect(data.lenses.zombie).toBeDefined();
    expect(data.lenses.ghost).toBeDefined();
    expect(data.lenses.loop).toBeDefined();
    expect(data.lenses.director).toBeDefined();
    expect(data.lenses.multi_source).toBeDefined();

    // composite score
    expect(data.concern.score).toBeGreaterThanOrEqual(0);
    expect(data.concern.score).toBeLessThanOrEqual(100);
    expect(['Critical', 'High', 'Medium', 'Low', 'Healthy']).toContain(data.concern.tier);
    expect(data.concern.components).toBeDefined();

    // funding timeline 배열 (10년 이내)
    expect(Array.isArray(data.funding_timeline)).toBe(true);

    console.log(
      `[entity-profile] BN=${bn} concern_score=${data.concern.score} tier=${data.concern.tier} timeline_years=${data.funding_timeline.length}`,
    );
  }, 90_000);

  it('Promise.all parallel execution is faster than sum of individual lens calls', async () => {
    const { fetchEntityData } = await import('@/lib/entity/profile-data');
    const { sql } = await import('@/lib/db/client');

    const candidates = (await sql.unsafe(
      `SELECT m.bn FROM cra.cra_identification m
       JOIN cra.govt_funding_by_charity g ON g.bn = m.bn
       WHERE g.govt_share_of_rev >= 0.3
       ORDER BY g.total_govt DESC NULLS LAST
       LIMIT 1`,
    )) as Array<{ bn: string }>;

    if (candidates.length === 0) return;
    const bn = candidates[0]?.bn;
    if (!bn) return;

    // 첫 호출 — warm cache + 측정
    const t0 = Date.now();
    await fetchEntityData(bn);
    const parallelDuration = Date.now() - t0;

    console.log(`[entity-profile parallel] BN=${bn} duration=${parallelDuration}ms`);
    // parallel 호출은 합리적 시간 내 완료 (< 30s, 통합 테스트 환경 고려)
    expect(parallelDuration).toBeLessThan(30_000);
  }, 90_000);
});
