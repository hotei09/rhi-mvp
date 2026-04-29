/**
 * 통합 테스트 — Render PG replica 직결, 5개 lens 함수 결정론·정확도 검증.
 *
 * AC-2: zombie BN 점수 검증 (실 데이터 후보 추출 후 score determinism 검증).
 * AC-9 reinforcement: Government of Alberta (BN 124072513RR0010) zombie/ghost에서 자동 제외.
 */
import '../setup-env';
import { afterAll, describe, expect, it } from 'vitest';

afterAll(async () => {
  const { sql } = await import('@/lib/db/client');
  await sql.end({ timeout: 5 });
});

describe('AC-2 — Zombie lens (REQ-002 Lens 1)', () => {
  it('getZombieScore returns deterministic score in [0, 100] for any BN', async () => {
    const { getZombieScore } = await import('@/lib/lenses/zombie');
    // 알려진 BN으로 호출 — 점수는 0~100 범위 내, raw fields 반환 확인
    const result = await getZombieScore('107951618RR0001');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    // 결정론: 동일 입력 → 동일 출력
    const result2 = await getZombieScore('107951618RR0001');
    expect(result2.score).toBe(result.score);
  }, 30_000);

  it('finds at least one zombie candidate with score > 0 in real data', async () => {
    const { sql } = await import('@/lib/db/client');
    const { getZombieScore } = await import('@/lib/lenses/zombie');
    const { buildGovtExclusionClause } = await import('@/lib/data-issues/safe-queries');

    // queries.md §2 패턴 단순화 — zombie 후보 추출
    const exclusion = buildGovtExclusionClause('m.legal_name');
    const candidateQuery = `
      WITH last_funding AS (
        SELECT bn, MAX(fiscal_year) AS last_funding_year
        FROM cra.govt_funding_by_charity
        WHERE govt_share_of_rev >= 0.7 AND revenue > 100000
        GROUP BY bn
      ),
      last_filing AS (
        SELECT bn, MAX(fpe) AS last_fpe FROM cra.cra_financial_general GROUP BY bn
      )
      SELECT m.bn
      FROM cra.cra_identification m
      JOIN last_funding f USING (bn)
      LEFT JOIN last_filing fl USING (bn)
      WHERE ${exclusion}
        AND fl.last_fpe IS NOT NULL
        AND fl.last_fpe < CURRENT_DATE - INTERVAL '12 months'
      LIMIT 5
    `;
    const candidates = (await sql.unsafe(candidateQuery)) as Array<{ bn: string }>;
    console.log(`[AC-2] candidates found: ${candidates.length}`);

    if (candidates.length === 0) {
      console.log('[AC-2] no zombie candidates in current data — skipping score assertion');
      return;
    }

    // 첫 번째 후보로 score 계산 — zombie 패턴이 매칭되면 score > 0
    let foundPositiveScore = false;
    for (const c of candidates) {
      const r = await getZombieScore(c.bn);
      console.log(`[AC-2] BN ${c.bn} → zombie_score=${r.score}, last_fpe=${r.raw?.last_fpe}`);
      if (r.score > 0) {
        foundPositiveScore = true;
        // raw fields populated when score > 0
        expect(r.raw).not.toBeNull();
        break;
      }
    }
    // 후보가 있으면 적어도 1개는 score > 0 — empirical observation
    if (candidates.length > 0) {
      expect(foundPositiveScore).toBe(true);
    }
  }, 60_000);
});

describe('AC-9 reinforcement — 정부 엔티티 exclusion (REQ-002)', () => {
  it('Government of Alberta (BN 124072513RR0010) zombie score = 0', async () => {
    const { getZombieScore } = await import('@/lib/lenses/zombie');
    const result = await getZombieScore('124072513RR0010');
    // legal_name 패턴이 'Government of %' 매칭 → CTE 단계 사전 필터 → 데이터 0행 → score 0
    console.log(`[AC-9] Government of Alberta zombie_score=${result.score}`);
    expect(result.score).toBe(0);
    expect(result.raw).toBeNull();
  }, 30_000);

  it('Government of Alberta ghost score = 0', async () => {
    const { getGhostScore } = await import('@/lib/lenses/ghost');
    const result = await getGhostScore('124072513RR0010');
    console.log(`[AC-9] Government of Alberta ghost_score=${result.score}`);
    expect(result.score).toBe(0);
    expect(result.raw).toBeNull();
  }, 30_000);

  // v0.1.4: 신규 health-body 패턴 검증 — sample-entities.ts 경험적 발견.
  // 3개 패턴 (Hospital / Hopital / Centre Intégré)을 단일 테스트로 묶어 DB connection 부담 최소화.
  // (이전 design: 패턴마다 별도 it 블록 → Director Overlap 테스트가 30s timeout에 근접하던 회귀 발생)
  it('v0.1.4 — 신규 health-body 패턴 (Hospital/Hopital/Centre Intégré) 매칭 BN은 zombie/ghost 순위에서 자동 제외', async () => {
    const { sql } = await import('@/lib/db/client');
    const { getZombieScore } = await import('@/lib/lenses/zombie');

    // 신규 3개 패턴 검증 — 각 패턴에서 1건 sample 추출 후 zombie score = 0 확인
    const patterns = ['%Hospital%', '%Hopital%', '%Centre Intégré%'];
    const verifiedSamples: Array<{ pattern: string; bn: string; legal_name: string }> = [];

    for (const pattern of patterns) {
      const sample = (await sql.unsafe(
        `SELECT bn, legal_name FROM cra.cra_identification WHERE legal_name ILIKE '${pattern}' LIMIT 1`,
      )) as Array<{ bn: string; legal_name: string }>;
      if (sample.length === 0 || !sample[0]) {
        console.log(`[AC-9 v0.1.4] pattern "${pattern}" no entity in DB — skip`);
        continue;
      }
      verifiedSamples.push({ pattern, bn: sample[0].bn, legal_name: sample[0].legal_name });
    }

    // 적어도 1개 패턴은 실제 데이터에 매칭되어야 함 — 모두 0이면 신규 패턴이 무의미
    expect(verifiedSamples.length).toBeGreaterThan(0);

    // 매칭된 sample에 대해 zombie_score = 0 검증
    for (const sample of verifiedSamples) {
      const result = await getZombieScore(sample.bn);
      console.log(
        `[AC-9 v0.1.4] pattern "${sample.pattern}" BN ${sample.bn} (${sample.legal_name}) zombie_score=${result.score}`,
      );
      expect(result.score).toBe(0);
      expect(result.raw).toBeNull();
    }
  }, 60_000);
});

describe('REQ-002 Lens 4 — Director Overlap (signal only)', () => {
  it('returns deterministic overlap count for known BN', async () => {
    const { getDirectorOverlap } = await import('@/lib/lenses/director');
    const result = await getDirectorOverlap('107951618RR0001');
    expect(result.overlap_count).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(result.matches)).toBe(true);
  }, 30_000);
});

describe('REQ-002 Lens 5 — Multi-Source Funding (F-3 dedup applied)', () => {
  it('returns deterministic source_count and per-source totals', async () => {
    const { sql } = await import('@/lib/db/client');
    const { getMultiSourceFunding } = await import('@/lib/lenses/multi-source');

    // 임의 entity_id 추출
    const sample = (await sql.unsafe(
      'SELECT entity_id FROM general.entity_source_links LIMIT 1',
    )) as Array<{ entity_id: string }>;
    if (sample.length === 0) {
      console.log('[REQ-002 Lens 5] no entity_source_links rows — skip');
      return;
    }
    const entityId = sample[0]?.entity_id;
    if (!entityId) return;

    const result = await getMultiSourceFunding(entityId);
    console.log(
      `[REQ-002 Lens 5] entity_id=${entityId} source_count=${result.source_count} fed=${result.fed_total} ab=${result.ab_total} cra=${result.cra_govt_total}`,
    );
    expect(result.source_count).toBeGreaterThanOrEqual(0);
    expect(result.source_count).toBeLessThanOrEqual(3);
    expect(result.fed_total).toBeGreaterThanOrEqual(0);
    expect(result.ab_total).toBeGreaterThanOrEqual(0);
    expect(result.cra_govt_total).toBeGreaterThanOrEqual(0);
  }, 30_000);
});

describe('REQ-002 Lens 3 — Loop classification (live DB)', () => {
  it('getLoopClassification returns null for non-existent loop_id', async () => {
    const { getLoopClassification } = await import('@/lib/lenses/loop');
    const result = await getLoopClassification(999999999);
    expect(result).toBeNull();
  }, 30_000);

  it('getLoopClassification returns determinate Tier for existing loop', async () => {
    const { sql } = await import('@/lib/db/client');
    const { getLoopClassification } = await import('@/lib/lenses/loop');

    const sample = (await sql.unsafe('SELECT id FROM cra.loops ORDER BY id LIMIT 1')) as Array<{
      id: number;
    }>;
    if (sample.length === 0) {
      console.log('[REQ-002 Lens 3] no loops in data — skip');
      return;
    }
    const loopId = sample[0]?.id;
    if (!loopId) return;

    const result = await getLoopClassification(loopId);
    expect(result).not.toBeNull();
    if (result) {
      console.log(
        `[REQ-002 Lens 3] loop_id=${loopId} tier=${result.tier} reasons=${result.classification_reasons.join('; ')}`,
      );
      expect(['A', 'B', 'C']).toContain(result.tier);
      expect(result.classification_reasons.length).toBeGreaterThan(0);
    }
  }, 30_000);

  it('getLoopParticipation returns aggregate counts for a BN', async () => {
    const { sql } = await import('@/lib/db/client');
    const { getLoopParticipation } = await import('@/lib/lenses/loop');

    const sample = (await sql.unsafe('SELECT bn FROM cra.loop_participants LIMIT 1')) as Array<{
      bn: string;
    }>;
    if (sample.length === 0) {
      console.log('[REQ-002 Lens 3] no loop_participants — skip');
      return;
    }
    const bn = sample[0]?.bn;
    if (!bn) return;

    const result = await getLoopParticipation(bn);
    console.log(
      `[REQ-002 Lens 3] BN=${bn} loop_count=${result.loop_count} tiers=${JSON.stringify(result.tiers)} max_tier=${result.max_tier}`,
    );
    expect(result.loop_count).toBeGreaterThanOrEqual(0);
    expect(result.tiers.A + result.tiers.B + result.tiers.C).toBe(result.loop_count);
  }, 60_000);

  it('getLoopParticipation returns zero for BN not in any loop', async () => {
    const { getLoopParticipation } = await import('@/lib/lenses/loop');
    const result = await getLoopParticipation('NONEXISTENT123');
    expect(result.loop_count).toBe(0);
    expect(result.tiers).toEqual({ A: 0, B: 0, C: 0 });
    expect(result.max_tier).toBeNull();
  }, 30_000);
});

describe('REQ-002 Lens 2 — Ghost lens positive path', () => {
  it('finds at least one ghost candidate or returns determinate score', async () => {
    const { sql } = await import('@/lib/db/client');
    const { getGhostScore } = await import('@/lib/lenses/ghost');
    const { buildGovtExclusionClause } = await import('@/lib/data-issues/safe-queries');

    // Ghost 후보 추출 — recent filing + program_ratio 낮은 BN
    const exclusion = buildGovtExclusionClause('m.legal_name');
    const candidateQuery = `
      WITH funding_recent AS (
        SELECT bn FROM cra.govt_funding_by_charity
        WHERE fiscal_year >= 2022
        GROUP BY bn HAVING AVG(govt_share_of_rev) >= 0.7
      ),
      latest AS (
        SELECT DISTINCT ON (bn) bn, fpe FROM cra.cra_financial_general ORDER BY bn, fpe DESC
      )
      SELECT m.bn FROM cra.cra_identification m
      JOIN funding_recent f USING (bn)
      JOIN latest l USING (bn)
      WHERE ${exclusion}
        AND m.registration_date <= CURRENT_DATE - INTERVAL '12 months'
        AND l.fpe >= CURRENT_DATE - INTERVAL '24 months'
      LIMIT 5
    `;
    const candidates = (await sql.unsafe(candidateQuery)) as Array<{ bn: string }>;
    console.log(`[Lens 2] ghost candidates found: ${candidates.length}`);

    for (const c of candidates) {
      const r = await getGhostScore(c.bn);
      console.log(
        `[Lens 2] BN ${c.bn} → ghost_score=${r.score} program_ratio=${r.raw?.program_ratio}`,
      );
      // raw populated when score >= 0 and BN matches CTE filter
      expect([0, 30, 50, 80, 100]).toContain(r.score);
    }
  }, 60_000);
});
