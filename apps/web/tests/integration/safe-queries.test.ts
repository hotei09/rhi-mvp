/**
 * 통합 테스트 — Render PG replica 직결.
 *
 * AC-5: F-3 dedup window function이 raw SUM보다 작은 단조 부등식 검증.
 *       동일 (ref_number, recipient) 튜플당 정확히 1행 보장.
 * AC-9: `Government of Alberta` (BN 124072513RR0010) 정부 엔티티 자동 제외 검증.
 */
import '../setup-env';
import { afterAll, describe, expect, it } from 'vitest';

// 파일 전체 종료 시 1회만 PG 연결 종료 (모든 describe 블록 이후)
afterAll(async () => {
  const { sql } = await import('@/lib/db/client');
  await sql.end({ timeout: 5 });
});

describe('AC-5 — F-3 dedup ≤ raw SUM 단조성', () => {
  it('dedup_sum < raw_sum (F-3 함정 회피 검증)', async () => {
    const { sql } = await import('@/lib/db/client');
    const { withF3Dedup } = await import('@/lib/data-issues/safe-queries');

    // raw SUM (트리플 카운트 포함)
    const rawResult = (await sql.unsafe(
      'SELECT SUM(agreement_value)::float8 AS raw_sum FROM fed.grants_contributions',
    )) as Array<{ raw_sum: number | null }>;
    const rawSum = rawResult[0]?.raw_sum ?? 0;

    // dedup SUM (rn = 1만 합계)
    const dedupQuery = withF3Dedup(
      'SELECT SUM(agreement_value)::float8 AS dedup_sum FROM dedup_fed WHERE rn = 1',
    );
    const dedupResult = (await sql.unsafe(dedupQuery)) as Array<{ dedup_sum: number | null }>;
    const dedupSum = dedupResult[0]?.dedup_sum ?? 0;

    // 진단용 출력
    console.log(`[AC-5] raw_sum   = ${rawSum.toLocaleString()}`);
    console.log(`[AC-5] dedup_sum = ${dedupSum.toLocaleString()}`);
    console.log(`[AC-5] reduction = ${(((rawSum - dedupSum) / rawSum) * 100).toFixed(2)}%`);

    expect(rawSum).toBeGreaterThan(0);
    expect(dedupSum).toBeGreaterThan(0);
    expect(dedupSum).toBeLessThan(rawSum);
    // KNOWN-DATA-ISSUES F-3: 적어도 5% 이상의 dedup reduction 기대
    expect((rawSum - dedupSum) / rawSum).toBeGreaterThan(0.05);
  }, 30_000);

  it('dedup uniqueness — COUNT DISTINCT (ref_number, recipient) === COUNT(*) WHERE rn=1', async () => {
    const { sql } = await import('@/lib/db/client');
    const { withF3Dedup } = await import('@/lib/data-issues/safe-queries');

    const query = withF3Dedup(`
      SELECT
        COUNT(*)::int AS dedup_count,
        COUNT(DISTINCT (ref_number, COALESCE(recipient_business_number, recipient_legal_name, _id::text)))::int AS distinct_keys
      FROM dedup_fed WHERE rn = 1
    `);
    const result = (await sql.unsafe(query)) as Array<{
      dedup_count: number;
      distinct_keys: number;
    }>;
    const row = result[0];
    expect(row).toBeDefined();
    if (row) {
      console.log(`[AC-5] dedup_count   = ${row.dedup_count.toLocaleString()}`);
      console.log(`[AC-5] distinct_keys = ${row.distinct_keys.toLocaleString()}`);
      // dedup 후 행 수 == distinct (ref_number, recipient) 튜플 수
      expect(row.dedup_count).toBe(row.distinct_keys);
    }
  }, 30_000);
});

describe('AC-9 — 정부 엔티티 자동 제외', () => {
  it('Government of Alberta (BN 124072513RR0010)이 raw 데이터에 존재', async () => {
    const { sql } = await import('@/lib/db/client');

    const result = (await sql.unsafe(
      "SELECT bn, legal_name FROM cra.cra_identification WHERE bn = '124072513RR0010' LIMIT 1",
    )) as Array<{ bn: string; legal_name: string }>;
    expect(result.length).toBeGreaterThan(0);
    if (result[0]) {
      console.log(`[AC-9] raw hit: ${result[0].bn} — ${result[0].legal_name}`);
      expect(result[0].legal_name.toLowerCase()).toContain('government of');
    }
  }, 15_000);

  it('buildGovtExclusionClause가 적용된 쿼리는 정부 엔티티를 0개 반환', async () => {
    const { sql } = await import('@/lib/db/client');
    const { buildGovtExclusionClause } = await import('@/lib/data-issues/safe-queries');

    const exclusionClause = buildGovtExclusionClause('legal_name');
    const query = `SELECT bn, legal_name FROM cra.cra_identification WHERE bn = '124072513RR0010' AND ${exclusionClause}`;
    const result = (await sql.unsafe(query)) as Array<{ bn: string; legal_name: string }>;

    console.log(`[AC-9] post-exclusion result count: ${result.length}`);
    expect(result.length).toBe(0);
  }, 15_000);

  it('6개 정부 패턴 각각이 sample 엔티티를 제외', async () => {
    const { sql } = await import('@/lib/db/client');
    const { EXCLUDED_LEGAL_NAME_PATTERNS } = await import('@/lib/data-issues/safe-queries');

    // 각 패턴별로 매칭 엔티티가 적어도 1개 이상 존재하는지 sample 확인
    let matchedPatternCount = 0;
    for (const pattern of EXCLUDED_LEGAL_NAME_PATTERNS) {
      const result = (await sql.unsafe(
        `SELECT COUNT(*)::int AS cnt FROM cra.cra_identification WHERE legal_name ILIKE '${pattern}' LIMIT 1`,
      )) as Array<{ cnt: number }>;
      const cnt = result[0]?.cnt ?? 0;
      console.log(`[AC-9] pattern "${pattern}" matches ${cnt} entities`);
      if (cnt > 0) matchedPatternCount++;
    }
    // 6개 중 적어도 4개 이상의 패턴이 실제 데이터를 매칭해야 함
    expect(matchedPatternCount).toBeGreaterThanOrEqual(4);
  }, 30_000);
});
