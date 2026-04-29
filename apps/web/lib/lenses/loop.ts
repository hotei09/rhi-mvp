/**
 * Lens 3 — Loop Classification (Tier A/B/C).
 *
 * REQ-002: queries.md §5 패턴 기반 사이클 분류 + queries.md §5의 CASE 순서 보존.
 *
 * Tier 평가 순서 (CASE — queries.md §5 lines 239-245):
 *  1. distinct_bn_roots = 1                                  → 'A' (internal hierarchy)
 *  2. loop touches identified_hubs (degree_top_n/donation)   → 'A' (known hub-mediated)
 *  3. loop has plausibility flag (severity >= 3)             → 'C' (data-quality flagged)
 *  4. avg_program_ratio >= 0.6                               → 'B' (observed)
 *  5. else                                                   → 'C' (suspicious)
 *
 * Concern Score 환산 (plan.md §2B.3):
 *  - tier 'A' or null → loop_signal = 0
 *  - tier 'B'         → loop_signal = 50
 *  - tier 'C'         → loop_signal = 100
 */
import { sql } from '@/lib/db/client';

/**
 * Loop tier 종류.
 */
export type LoopTier = 'A' | 'B' | 'C';

/**
 * classifyLoop의 입력 메타데이터.
 */
export type LoopMetaInput = {
  loop_id: number;
  hops: number;
  path_bns: string[];
  total_flow: number;
  distinct_bn_roots: number;
  hub_touch: boolean;
  has_plausibility_flag: boolean;
  avg_program_ratio: number | null;
};

/**
 * classifyLoop의 결과.
 */
export type LoopClassification = {
  loop_id: number;
  hops: number;
  path_bns: string[];
  total_flow: number;
  tier: LoopTier;
  classification_reasons: string[];
  avg_program_ratio: number | null;
};

/**
 * BN별 loop 참여 요약.
 */
export type LoopParticipation = {
  loop_count: number;
  tiers: { A: number; B: number; C: number };
  max_tier: LoopTier | null;
};

/**
 * Loop 메타데이터를 받아 Tier(A/B/C) + 분류 근거 narrative를 결정하는 순수 함수.
 *
 * CASE 평가 순서가 critical — queries.md §5 ordering 정확히 보존.
 *
 * @param meta - loop 메타 + hub/플래그/program 시그널
 * @returns LoopClassification (tier + reasons)
 *
 * @MX:WARN: [AUTO] CASE 평가 순서가 critical (A → A → C → B → C). 순서 변경 시 합법/의심 오분류 위험.
 * @MX:REASON: queries.md §5 SQL CASE statement의 정확한 순서를 TS 코드에 보존. distinct_bn_roots=1 우선 매칭이 Salvation Army false positive 회피의 단일 메커니즘 (AC-3). 순서 변경 시 plausibility flag 누락 또는 hub 통과 case 누락.
 * @MX:SPEC: SPEC-RHI-001 REQ-002 / AC-3 / AC-4
 */
export function classifyLoop(meta: LoopMetaInput): LoopClassification {
  const reasons: string[] = [];
  let tier: LoopTier;

  // 1. distinct_bn_roots = 1 → Tier A (internal hierarchy)
  if (meta.distinct_bn_roots === 1) {
    tier = 'A';
    reasons.push('all participants share BN root prefix (internal hierarchy)');
  } else if (meta.hub_touch) {
    // 2. hub touch → Tier A (known hub-mediated)
    tier = 'A';
    reasons.push('passes through known donation/aggregation hub');
  } else if (meta.has_plausibility_flag) {
    // 3. plausibility flag → Tier C (data-quality flagged)
    tier = 'C';
    reasons.push('participant has T3010 plausibility flag (severity >= 3)');
  } else if (meta.avg_program_ratio !== null && meta.avg_program_ratio >= 0.6) {
    // 4. high avg_program_ratio → Tier B (observed)
    tier = 'B';
    reasons.push('cross-organization loop with healthy average program ratio (>= 0.6)');
  } else {
    // 5. else → Tier C (suspicious)
    tier = 'C';
    reasons.push('cross-organization loop with low/null program ratio (no hub, no flag)');
  }

  return {
    loop_id: meta.loop_id,
    hops: meta.hops,
    path_bns: meta.path_bns,
    total_flow: meta.total_flow,
    tier,
    classification_reasons: reasons,
    avg_program_ratio: meta.avg_program_ratio,
  };
}

/**
 * loop_id로 단일 loop를 조회하고 Tier 분류 결과를 반환한다.
 * `cra.loops` + `cra.loop_participants` + `cra.identified_hubs` + `cra.t3010_plausibility_flags`
 * + `cra.overhead_by_charity`를 inline CTE로 조인 (replica read-only이므로 view 생성 불가).
 *
 * @param loopId - cra.loops.id
 * @returns LoopClassification 또는 null (loop_id 미존재 시)
 */
export async function getLoopClassification(loopId: number): Promise<LoopClassification | null> {
  // queries.md §5의 CTE 구조 — loop_meta + hub_touch + plausibility + program_health 조인
  const query = `
    WITH loop_meta AS (
      SELECT
        l.id AS loop_id,
        l.hops,
        l.path_bns,
        l.total_flow,
        cardinality(
          (SELECT array_agg(DISTINCT substr(p, 1, 9)) FROM unnest(l.path_bns) p)
        ) AS distinct_bn_roots
      FROM cra.loops l
      WHERE l.id = $1
    ),
    hub_touch AS (
      SELECT EXISTS (
        SELECT 1
        FROM cra.loop_participants lp
        JOIN cra.identified_hubs h ON h.bn = lp.bn
        WHERE lp.loop_id = $1
      ) AS hub_touch
    ),
    plausibility AS (
      SELECT EXISTS (
        SELECT 1
        FROM cra.loop_participants lp
        JOIN cra.t3010_plausibility_flags pf
          ON pf.bn = lp.bn AND pf.severity >= 3
        WHERE lp.loop_id = $1
      ) AS has_plausibility_flag
    ),
    program_health AS (
      -- program_ratio = programs / total_expenditures (queries.md §5에서 'program_ratio' 표기는 의사 컬럼)
      SELECT AVG(
        COALESCE(
          CASE WHEN o.total_expenditures > 0
               THEN o.programs::float8 / o.total_expenditures::float8
               ELSE 0 END,
          0
        )
      )::float8 AS avg_program_ratio
      FROM cra.loop_participants lp
      LEFT JOIN cra.overhead_by_charity o ON o.bn = lp.bn
      WHERE lp.loop_id = $1
    )
    SELECT
      m.loop_id, m.hops, m.path_bns, m.total_flow::float8 AS total_flow,
      m.distinct_bn_roots,
      ht.hub_touch,
      pl.has_plausibility_flag,
      ph.avg_program_ratio
    FROM loop_meta m
    CROSS JOIN hub_touch ht
    CROSS JOIN plausibility pl
    CROSS JOIN program_health ph
  `;

  const rows = (await sql.unsafe(query, [loopId])) as Array<{
    loop_id: number;
    hops: number;
    path_bns: string[];
    total_flow: number;
    distinct_bn_roots: number;
    hub_touch: boolean;
    has_plausibility_flag: boolean;
    avg_program_ratio: number | null;
  }>;

  if (rows.length === 0) return null;
  const row = rows[0];
  if (!row) return null;

  return classifyLoop({
    loop_id: row.loop_id,
    hops: row.hops,
    path_bns: row.path_bns,
    total_flow: row.total_flow,
    distinct_bn_roots: row.distinct_bn_roots,
    hub_touch: row.hub_touch,
    has_plausibility_flag: row.has_plausibility_flag,
    avg_program_ratio: row.avg_program_ratio,
  });
}

/**
 * 특정 BN이 참여하는 모든 loop를 분류해 요약한다.
 *
 * @param bn - 자선단체 BN
 * @returns loop 참여 카운트 + tier별 카운트 + 최고 tier
 */
export async function getLoopParticipation(bn: string): Promise<LoopParticipation> {
  // BN이 참여하는 loop_id 목록 조회
  const loopIdRows = (await sql.unsafe(
    'SELECT DISTINCT loop_id FROM cra.loop_participants WHERE bn = $1',
    [bn],
  )) as Array<{ loop_id: number }>;

  if (loopIdRows.length === 0) {
    return { loop_count: 0, tiers: { A: 0, B: 0, C: 0 }, max_tier: null };
  }

  // 각 loop를 분류 — 병렬 호출
  const classifications = await Promise.all(
    loopIdRows.map((r) => getLoopClassification(r.loop_id)),
  );

  const tiers = { A: 0, B: 0, C: 0 };
  for (const c of classifications) {
    if (c) tiers[c.tier]++;
  }

  // 최고 tier (C > B > A 순)
  let max_tier: LoopTier | null = null;
  if (tiers.C > 0) max_tier = 'C';
  else if (tiers.B > 0) max_tier = 'B';
  else if (tiers.A > 0) max_tier = 'A';

  return {
    loop_count: classifications.filter((c) => c !== null).length,
    tiers,
    max_tier,
  };
}
