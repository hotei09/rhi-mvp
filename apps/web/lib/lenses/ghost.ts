/**
 * Lens 2 — Ghost Capacity (REQ-002 / AC-9).
 *
 * 살아있되 (recent filing) 프로그램 활동 미미한 단체 탐지.
 * 필터:
 *  - program_ratio < 0.5
 *  - govt_share >= 0.7
 *  - registration_date <= CURRENT_DATE - 12 months (신생 단체 제외)
 *  - 정부 엔티티 자동 제외 (legal_name 패턴, AC-9)
 *
 * 단계별 점수 (queries.md §4):
 *  - program_ratio < 0.20 AND govt_share >= 0.85: 100
 *  - program_ratio < 0.30 AND govt_share >= 0.80: 80
 *  - program_ratio < 0.40 AND govt_share >= 0.75: 50
 *  - program_ratio < 0.50 AND govt_share >= 0.70: 30
 *  - else:                                        0
 */
import { buildGovtExclusionClause } from '@/lib/data-issues/safe-queries';
import { sql } from '@/lib/db/client';

/**
 * Ghost lens raw row.
 */
export type GhostRow = {
  bn: string;
  legal_name: string;
  govt_share: number | null;
  govt_sum: number | null;
  program_ratio: number | null;
  last_fpe: string | null;
  registration_date: string | null;
};

/**
 * Ghost lens 결과.
 */
export type GhostResult = {
  score: 0 | 30 | 50 | 80 | 100;
  raw: GhostRow | null;
};

/**
 * 단일 BN의 Ghost 점수를 계산한다.
 * 정부 엔티티 + 신생 단체 (12개월 미만)는 사전 제외된다.
 *
 * @param bn - 자선단체 BN
 * @returns score + raw row
 */
export async function getGhostScore(bn: string): Promise<GhostResult> {
  const exclusion = buildGovtExclusionClause('legal_name');

  const query = `
    WITH latest_filing AS (
      SELECT DISTINCT ON (bn) bn, fpe
      FROM cra.cra_financial_general
      ORDER BY bn, fpe DESC
    ),
    funding_recent AS (
      SELECT bn,
             AVG(govt_share_of_rev)::float8 AS share,
             SUM(total_govt)::float8 AS govt_sum
      FROM cra.govt_funding_by_charity
      WHERE fiscal_year >= 2022
      GROUP BY bn
      HAVING AVG(govt_share_of_rev) >= 0.7
    ),
    overhead AS (
      -- program_ratio = programs / total_expenditures (overhead_by_charity 스키마는 strict_overhead_pct만 보유)
      -- 컬럼: programs, total_expenditures, strict_overhead_pct, broad_overhead_pct
      SELECT
        bn,
        AVG(
          CASE
            WHEN total_expenditures > 0 THEN programs::float8 / total_expenditures::float8
            ELSE NULL
          END
        )::float8 AS program_ratio
      FROM cra.overhead_by_charity
      GROUP BY bn
    ),
    charity_meta AS (
      SELECT DISTINCT ON (bn) bn, legal_name, registration_date
      FROM cra.cra_identification
      WHERE ${exclusion}
        AND registration_date <= CURRENT_DATE - INTERVAL '12 months'
      ORDER BY bn, fiscal_year DESC
    )
    SELECT
      m.bn,
      m.legal_name,
      m.registration_date,
      f.share AS govt_share,
      f.govt_sum,
      o.program_ratio,
      lf.fpe AS last_fpe,
      CASE
        WHEN o.program_ratio < 0.20 AND f.share >= 0.85 THEN 100
        WHEN o.program_ratio < 0.30 AND f.share >= 0.80 THEN 80
        WHEN o.program_ratio < 0.40 AND f.share >= 0.75 THEN 50
        WHEN o.program_ratio < 0.50 AND f.share >= 0.70 THEN 30
        ELSE 0
      END AS ghost_score
    FROM charity_meta m
    JOIN funding_recent f USING (bn)
    LEFT JOIN latest_filing lf USING (bn)
    LEFT JOIN overhead o USING (bn)
    WHERE m.bn = $1
      AND lf.fpe IS NOT NULL
      AND lf.fpe >= CURRENT_DATE - INTERVAL '24 months'
    LIMIT 1
  `;

  const rows = (await sql.unsafe(query, [bn])) as Array<{
    bn: string;
    legal_name: string;
    registration_date: string | null;
    govt_share: number | null;
    govt_sum: number | null;
    program_ratio: number | null;
    last_fpe: string | null;
    ghost_score: number;
  }>;

  if (rows.length === 0) {
    return { score: 0, raw: null };
  }

  const row = rows[0];
  if (!row) return { score: 0, raw: null };

  return {
    score: row.ghost_score as 0 | 30 | 50 | 80 | 100,
    raw: {
      bn: row.bn,
      legal_name: row.legal_name,
      govt_share: row.govt_share,
      govt_sum: row.govt_sum,
      program_ratio: row.program_ratio,
      last_fpe: row.last_fpe ? String(row.last_fpe) : null,
      registration_date: row.registration_date ? String(row.registration_date) : null,
    },
  };
}
