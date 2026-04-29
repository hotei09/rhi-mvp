/**
 * 렌즈별 ranking 함수 — REQ-005 Statement A.
 *
 * 정부 엔티티 자동 제외 (AC-9). 각 SQL은 inline CTE로 합법성 패턴 필터링.
 *
 * 매핑: SPEC-RHI-001 REQ-005 / AC-9
 */
import { buildGovtExclusionClause } from '@/lib/data-issues/safe-queries';
import { sql } from '@/lib/db/client';

/**
 * Zombie ranking 행.
 */
export type ZombieRankingRow = {
  bn: string;
  legal_name: string;
  zombie_score: number;
  last_funding_year: number | null;
  last_fpe: string | null;
  total_funding: number | null;
};

/**
 * Top zombie BNs — score >= 30 정렬 후 limit.
 */
export async function getZombieRanking(
  options: { limit?: number } = {},
): Promise<ZombieRankingRow[]> {
  const limit = options.limit ?? 50;
  const exclusion = buildGovtExclusionClause('legal_name');

  const query = `
    WITH last_funding AS (
      SELECT
        bn,
        MAX(fiscal_year) AS last_funding_year,
        SUM(total_govt) AS total_funding
      FROM cra.govt_funding_by_charity
      WHERE govt_share_of_rev >= 0.7 AND revenue > 100000
      GROUP BY bn
    ),
    last_filing AS (
      SELECT bn, MAX(fpe) AS last_fpe
      FROM cra.cra_financial_general
      GROUP BY bn
    ),
    charity_meta AS (
      SELECT DISTINCT ON (bn) bn, legal_name
      FROM cra.cra_identification
      WHERE ${exclusion}
      ORDER BY bn, fiscal_year DESC
    )
    SELECT
      m.bn,
      m.legal_name,
      f.last_funding_year,
      f.total_funding::float8 AS total_funding,
      fl.last_fpe,
      CASE
        WHEN fl.last_fpe IS NULL                              THEN 0
        WHEN fl.last_fpe < CURRENT_DATE - INTERVAL '24 months'
          AND f.last_funding_year >= EXTRACT(YEAR FROM fl.last_fpe) - 1 THEN 100
        WHEN fl.last_fpe < CURRENT_DATE - INTERVAL '18 months' THEN 80
        WHEN fl.last_fpe < CURRENT_DATE - INTERVAL '12 months' THEN 60
        WHEN fl.last_fpe < CURRENT_DATE - INTERVAL '6 months'  THEN 30
        ELSE 0
      END AS zombie_score
    FROM charity_meta m
    JOIN last_funding f USING (bn)
    LEFT JOIN last_filing fl USING (bn)
    WHERE
      CASE
        WHEN fl.last_fpe IS NULL                              THEN 0
        WHEN fl.last_fpe < CURRENT_DATE - INTERVAL '24 months' THEN 100
        WHEN fl.last_fpe < CURRENT_DATE - INTERVAL '18 months' THEN 80
        WHEN fl.last_fpe < CURRENT_DATE - INTERVAL '12 months' THEN 60
        WHEN fl.last_fpe < CURRENT_DATE - INTERVAL '6 months'  THEN 30
        ELSE 0
      END >= 30
    ORDER BY zombie_score DESC, total_funding DESC NULLS LAST
    LIMIT $1
  `;

  type Row = {
    bn: string;
    legal_name: string;
    zombie_score: number;
    last_funding_year: number | null;
    last_fpe: string | Date | null;
    total_funding: number | null;
  };

  const rows = (await sql.unsafe(query, [limit])) as Array<Row>;

  return rows.map((r) => ({
    bn: r.bn,
    legal_name: r.legal_name,
    zombie_score: r.zombie_score,
    last_funding_year: r.last_funding_year,
    last_fpe: r.last_fpe ? String(r.last_fpe) : null,
    total_funding: r.total_funding,
  }));
}

/**
 * Ghost ranking 행.
 */
export type GhostRankingRow = {
  bn: string;
  legal_name: string;
  ghost_score: number;
  program_ratio: number | null;
  govt_share: number | null;
};

/**
 * Top ghost BNs — program_ratio < 0.5 + govt_share >= 0.7 + 12mo+ entity.
 *
 * queries.md §4 패턴 — 신생 단체 (등록일 < 12mo) 제외.
 */
export async function getGhostRanking(
  options: { limit?: number } = {},
): Promise<GhostRankingRow[]> {
  const limit = options.limit ?? 50;
  const exclusion = buildGovtExclusionClause('legal_name');

  const query = `
    WITH funding AS (
      SELECT
        bn,
        AVG(govt_share_of_rev) AS avg_govt_share
      FROM cra.govt_funding_by_charity
      WHERE govt_share_of_rev >= 0.7
      GROUP BY bn
    ),
    overhead AS (
      SELECT DISTINCT ON (bn)
        bn,
        CASE
          WHEN total_expenditures > 0
            THEN programs::float8 / total_expenditures::float8
          ELSE NULL
        END AS program_ratio
      FROM cra.overhead_by_charity
      ORDER BY bn, fiscal_year DESC
    ),
    charity_meta AS (
      SELECT DISTINCT ON (bn)
        bn,
        legal_name,
        registration_date
      FROM cra.cra_identification
      WHERE ${exclusion}
        AND registration_date <= CURRENT_DATE - INTERVAL '12 months'
      ORDER BY bn, fiscal_year DESC
    )
    SELECT
      m.bn,
      m.legal_name,
      o.program_ratio::float8 AS program_ratio,
      f.avg_govt_share::float8 AS govt_share,
      CASE
        WHEN o.program_ratio IS NULL                THEN 0
        WHEN o.program_ratio < 0.3                  THEN 100
        WHEN o.program_ratio < 0.4                  THEN 80
        WHEN o.program_ratio < 0.5                  THEN 60
        ELSE 0
      END AS ghost_score
    FROM charity_meta m
    JOIN funding f USING (bn)
    LEFT JOIN overhead o USING (bn)
    WHERE
      CASE
        WHEN o.program_ratio IS NULL THEN 0
        WHEN o.program_ratio < 0.5   THEN 1
        ELSE 0
      END = 1
    ORDER BY ghost_score DESC, govt_share DESC NULLS LAST
    LIMIT $1
  `;

  type Row = {
    bn: string;
    legal_name: string;
    ghost_score: number;
    program_ratio: number | null;
    govt_share: number | null;
  };

  return (await sql.unsafe(query, [limit])) as Array<Row>;
}

/**
 * Loop ranking 행 — Tier 분류 포함.
 */
export type LoopRankingRow = {
  loop_id: number;
  hops: number;
  total_flow: number;
  tier: 'A' | 'B' | 'C';
  classification_reasons: string[];
  path_bns: string[];
};

/**
 * Top loops by total_flow — Tier 분류 포함.
 */
export async function getLoopRanking(options: { limit?: number } = {}): Promise<LoopRankingRow[]> {
  const limit = options.limit ?? 50;

  // queries.md §5 inline 분류 — 단일 SQL로 Tier A/B/C 결정
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
    ),
    hub_touch AS (
      SELECT
        lp.loop_id,
        BOOL_OR(EXISTS (
          SELECT 1 FROM cra.identified_hubs h WHERE h.bn = lp.bn
        )) AS hub_touch
      FROM cra.loop_participants lp
      GROUP BY lp.loop_id
    ),
    plausibility AS (
      SELECT
        lp.loop_id,
        BOOL_OR(EXISTS (
          SELECT 1 FROM cra.t3010_plausibility_flags pf
          WHERE pf.bn = lp.bn AND pf.severity >= 3
        )) AS has_plausibility_flag
      FROM cra.loop_participants lp
      GROUP BY lp.loop_id
    ),
    program_health AS (
      SELECT
        lp.loop_id,
        AVG(
          COALESCE(
            CASE WHEN o.total_expenditures > 0
                 THEN o.programs::float8 / o.total_expenditures::float8
                 ELSE 0 END,
            0
          )
        )::float8 AS avg_program_ratio
      FROM cra.loop_participants lp
      LEFT JOIN cra.overhead_by_charity o ON o.bn = lp.bn
      GROUP BY lp.loop_id
    )
    SELECT
      m.loop_id,
      m.hops,
      m.total_flow::float8 AS total_flow,
      m.path_bns,
      m.distinct_bn_roots,
      ht.hub_touch,
      pl.has_plausibility_flag,
      ph.avg_program_ratio
    FROM loop_meta m
    LEFT JOIN hub_touch ht USING (loop_id)
    LEFT JOIN plausibility pl USING (loop_id)
    LEFT JOIN program_health ph USING (loop_id)
    ORDER BY m.total_flow DESC NULLS LAST
    LIMIT $1
  `;

  type Row = {
    loop_id: number;
    hops: number;
    total_flow: number;
    path_bns: string[];
    distinct_bn_roots: number;
    hub_touch: boolean | null;
    has_plausibility_flag: boolean | null;
    avg_program_ratio: number | null;
  };

  const rows = (await sql.unsafe(query, [limit])) as Array<Row>;

  return rows.map((r) => {
    let tier: 'A' | 'B' | 'C';
    const reasons: string[] = [];

    if (r.distinct_bn_roots === 1) {
      tier = 'A';
      reasons.push('all participants share BN root prefix (internal hierarchy)');
    } else if (r.hub_touch) {
      tier = 'A';
      reasons.push('passes through known donation/aggregation hub');
    } else if (r.has_plausibility_flag) {
      tier = 'C';
      reasons.push('participant has T3010 plausibility flag (severity >= 3)');
    } else if (r.avg_program_ratio !== null && r.avg_program_ratio >= 0.6) {
      tier = 'B';
      reasons.push('cross-organization loop with healthy average program ratio (>= 0.6)');
    } else {
      tier = 'C';
      reasons.push('cross-organization loop with low/null program ratio (no hub, no flag)');
    }

    return {
      loop_id: r.loop_id,
      hops: r.hops,
      total_flow: r.total_flow,
      tier,
      classification_reasons: reasons,
      path_bns: r.path_bns,
    };
  });
}
