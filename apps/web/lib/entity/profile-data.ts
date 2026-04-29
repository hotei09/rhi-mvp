/**
 * Entity Profile 데이터 페처 — REQ-004 / AC-6 / AC-12.
 *
 * 단일 BN을 받아 다음 데이터를 병렬 fetch + 통합 점수 산출하여 반환:
 *  - identity (cra_identification 행)
 *  - 5개 lens 결과 (Promise.all 병렬 — AC-6 요구사항)
 *  - composite Concern Score (computeConcernScore)
 *  - funding timeline (FED + AB + CRA per fiscal_year, 최근 10년)
 *
 * Page (Server Component)와 통합 테스트가 동시에 사용하므로 별도 모듈로 분리.
 */
import { withF3Dedup } from '@/lib/data-issues/safe-queries';
import { sql } from '@/lib/db/client';
import { normalizeBn, validateBn } from '@/lib/domain/identifiers';
import { type ConcernScoreResult, computeConcernScore } from '@/lib/lenses/concern-score';
import { type DirectorOverlap, getDirectorOverlap } from '@/lib/lenses/director';
import { type GhostResult, getGhostScore } from '@/lib/lenses/ghost';
import { type LoopParticipation, getLoopParticipation } from '@/lib/lenses/loop';
import { type MultiSourceResult, getMultiSourceFunding } from '@/lib/lenses/multi-source';
import { type ZombieResult, getZombieScore } from '@/lib/lenses/zombie';

/**
 * Entity profile 페이지에 필요한 통합 데이터 셰이프.
 */
export type EntityProfileData = {
  identity: {
    bn: string;
    legal_name: string;
    category: string | null;
    designation: string | null;
    registration_date: string | null;
    address_line_1: string | null;
    city: string | null;
    province: string | null;
  };
  lenses: {
    zombie: ZombieResult;
    ghost: GhostResult;
    loop: LoopParticipation;
    director: DirectorOverlap;
    multi_source: MultiSourceResult;
  };
  concern: ConcernScoreResult;
  funding_timeline: Array<{
    fiscal_year: number;
    fed: number;
    ab: number;
    cra_govt: number;
  }>;
};

/**
 * BN 으로 cra_identification 행을 1건 조회한다 (가장 최근 fiscal_year).
 */
async function fetchIdentity(bn: string): Promise<EntityProfileData['identity'] | null> {
  const rows = (await sql.unsafe(
    `SELECT DISTINCT ON (bn)
       bn,
       legal_name,
       category,
       designation,
       registration_date,
       address_line_1,
       city,
       province
     FROM cra.cra_identification
     WHERE bn = $1
     ORDER BY bn, fiscal_year DESC
     LIMIT 1`,
    [bn],
  )) as Array<{
    bn: string;
    legal_name: string;
    category: string | null;
    designation: string | null;
    registration_date: string | null;
    address_line_1: string | null;
    city: string | null;
    province: string | null;
  }>;

  if (rows.length === 0) return null;
  const row = rows[0];
  if (!row) return null;

  return {
    bn: row.bn,
    legal_name: row.legal_name,
    category: row.category,
    designation: row.designation,
    registration_date: row.registration_date ? String(row.registration_date) : null,
    address_line_1: row.address_line_1,
    city: row.city,
    province: row.province,
  };
}

/**
 * BN을 entity_id (UUID)로 매핑한다 (general.entity_source_links 기반).
 * Multi-source funding lens는 entity_id가 필요하므로 BN → UUID 룩업 단계가 필수.
 *
 * @returns 매핑 성공 시 entity_id, 미존재 시 null
 */
async function lookupEntityId(bn: string): Promise<string | null> {
  const rows = (await sql.unsafe(
    `SELECT DISTINCT entity_id
     FROM general.entity_source_links
     WHERE source_name = $1 AND source_schema = 'cra'
     LIMIT 1`,
    [bn],
  )) as Array<{ entity_id: string }>;
  return rows[0]?.entity_id ?? null;
}

/**
 * 빈 multi_source 결과 — entity_id 매핑 미존재 시 fallback.
 */
const EMPTY_MULTI_SOURCE: MultiSourceResult = {
  source_count: 0,
  fed_total: 0,
  ab_total: 0,
  cra_govt_total: 0,
  same_year_overlap: 0,
};

/**
 * 최근 10년 funding timeline을 fetch한다 (FED + AB + CRA per fiscal_year).
 * FED 측은 F-3 dedup 적용 (queries.md §3 / AC-5).
 *
 * @param bn - CRA BN
 * @param entityId - general.entity_source_links 매핑 entity_id (null 가능)
 */
async function fetchFundingTimeline(
  bn: string,
  entityId: string | null,
): Promise<EntityProfileData['funding_timeline']> {
  // CRA-only timeline: BN으로 직접 조회 (entity_id 매핑 없어도 가능)
  if (!entityId) {
    const craOnly = (await sql.unsafe(
      `SELECT g.fiscal_year::int AS fiscal_year, SUM(g.total_govt)::float8 AS cra_govt
       FROM cra.govt_funding_by_charity g
       WHERE g.bn = $1
         AND g.fiscal_year >= EXTRACT(YEAR FROM CURRENT_DATE)::int - 10
       GROUP BY g.fiscal_year
       ORDER BY g.fiscal_year`,
      [bn],
    )) as Array<{ fiscal_year: number; cra_govt: number }>;
    return craOnly.map((r) => ({
      fiscal_year: r.fiscal_year,
      fed: 0,
      ab: 0,
      cra_govt: r.cra_govt,
    }));
  }

  // Full timeline — FED dedup + AB + CRA UNION
  const query = withF3Dedup(`
    , fed_yearly AS (
      SELECT EXTRACT(YEAR FROM fc.agreement_start_date)::int AS yr,
             SUM(fc.agreement_value)::float8 AS fed
      FROM dedup_fed fc
      JOIN general.entity_source_links esl
        ON (esl.source_pk->>'_id')::int = fc._id
      WHERE fc.rn = 1
        AND esl.entity_id = $1
        AND esl.source_schema = 'fed'
        AND fc.agreement_start_date IS NOT NULL
      GROUP BY 1
    ),
    ab_yearly AS (
      SELECT EXTRACT(YEAR FROM ab.payment_date)::int AS yr,
             SUM(ab.amount)::float8 AS ab
      FROM ab.ab_grants ab
      JOIN general.entity_source_links esl
        ON (esl.source_pk->>'id')::int = ab.id
      WHERE esl.entity_id = $1
        AND esl.source_schema = 'ab'
        AND ab.payment_date IS NOT NULL
      GROUP BY 1
    ),
    cra_yearly AS (
      SELECT g.fiscal_year::int AS yr,
             SUM(g.total_govt)::float8 AS cra_govt
      FROM cra.govt_funding_by_charity g
      WHERE g.bn = $2
      GROUP BY 1
    ),
    all_years AS (
      SELECT yr FROM fed_yearly
      UNION SELECT yr FROM ab_yearly
      UNION SELECT yr FROM cra_yearly
    )
    SELECT
      ay.yr AS fiscal_year,
      COALESCE(f.fed, 0)::float8 AS fed,
      COALESCE(a.ab, 0)::float8 AS ab,
      COALESCE(c.cra_govt, 0)::float8 AS cra_govt
    FROM all_years ay
    LEFT JOIN fed_yearly f USING (yr)
    LEFT JOIN ab_yearly a USING (yr)
    LEFT JOIN cra_yearly c USING (yr)
    WHERE ay.yr >= EXTRACT(YEAR FROM CURRENT_DATE)::int - 10
    ORDER BY ay.yr
  `);

  const rows = (await sql.unsafe(query, [entityId, bn])) as Array<{
    fiscal_year: number;
    fed: number;
    ab: number;
    cra_govt: number;
  }>;

  return rows.map((r) => ({
    fiscal_year: Number(r.fiscal_year),
    fed: Number(r.fed),
    ab: Number(r.ab),
    cra_govt: Number(r.cra_govt),
  }));
}

/**
 * 단일 BN의 entity profile 데이터를 통합 fetch한다.
 *
 * 5개 lens는 Promise.all로 병렬 실행 (AC-6 요구사항). 합산 시간 ≈ max(개별 시간).
 * BN이 cra_identification에 없으면 null 반환 (호출 측에서 notFound() 처리).
 *
 * @param entityIdInput - BN 입력 (raw, 예: "107951618RR0001")
 * @returns EntityProfileData 또는 null (BN 미존재 시)
 *
 * @MX:ANCHOR: [AUTO] fan_in_high — entity profile page + 통합 테스트 + (향후) /api/entity/* 라우트.
 * @MX:REASON: REQ-004 단일 데이터 페처. 5개 lens 함수 + 가중합 + identity + timeline 모두 본 함수에 수렴. 시그너처 변경 시 page.tsx, integration test, e2e test 모두 영향. AC-6 parallel fetch 보장의 단일 진입점.
 * @MX:SPEC: SPEC-RHI-001 REQ-004 / AC-6 / AC-12
 */
export async function fetchEntityData(entityIdInput: string): Promise<EntityProfileData | null> {
  if (!validateBn(entityIdInput)) return null;
  const bn = normalizeBn(entityIdInput);

  // 사전 식별 검증 + entity_id 매핑 — 두 쿼리는 독립적으로 병렬 가능
  const [identity, entityId] = await Promise.all([fetchIdentity(bn), lookupEntityId(bn)]);
  if (!identity) return null;

  // AC-6 parallel fetch — 5개 lens + funding timeline.
  // multi_source는 entityId가 있을 때만 fetch, 없으면 EMPTY fallback.
  const [zombie, ghost, loop, director, multi_source, funding_timeline] = await Promise.all([
    getZombieScore(bn),
    getGhostScore(bn),
    getLoopParticipation(bn),
    getDirectorOverlap(bn),
    entityId ? getMultiSourceFunding(entityId) : Promise.resolve(EMPTY_MULTI_SOURCE),
    fetchFundingTimeline(bn, entityId),
  ]);

  // Concern Score 통합 — Lens → Signal 변환 후 가중합
  const loop_signal = loop.max_tier === 'C' ? 100 : loop.max_tier === 'B' ? 50 : 0;
  const concern = computeConcernScore({
    zombie_score: zombie.score,
    ghost_score: ghost.score,
    loop_signal,
    director_overlap: director.overlap_count,
    multi_source_count: multi_source.source_count,
  });

  return {
    identity,
    lenses: { zombie, ghost, loop, director, multi_source },
    concern,
    funding_timeline,
  };
}
