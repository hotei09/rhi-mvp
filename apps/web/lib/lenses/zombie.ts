/**
 * Lens 1 — Zombie Recipient (REQ-002 / AC-2 / AC-9).
 *
 * 정부 자금 (`govt_share_of_rev >= 0.7`) 수령 후 filing 중단 패턴 탐지.
 * 단계별 점수 (queries.md §2 + tech.md §4.1):
 *  - last_fpe < CURRENT_DATE - 24mo AND last_funding >= year(last_fpe) - 1: 100
 *  - last_fpe < CURRENT_DATE - 18mo: 80
 *  - last_fpe < CURRENT_DATE - 12mo: 60
 *  - last_fpe < CURRENT_DATE - 6mo:  30
 *  - else:                           0
 *
 * 정부 엔티티 사전 제외 (legal_name 패턴, AC-9): `buildGovtExclusionClause` 적용.
 */
import { buildGovtExclusionClause } from '@/lib/data-issues/safe-queries';
import { sql } from '@/lib/db/client';

/**
 * Zombie lens raw row.
 */
export type ZombieRow = {
  bn: string;
  legal_name: string;
  last_funding_year: number | null;
  total_funding: number | null;
  last_fpe: string | null;
  months_since_filing: number | null;
};

/**
 * Zombie lens 결과.
 */
export type ZombieResult = {
  score: 0 | 30 | 60 | 80 | 100;
  raw: ZombieRow | null;
};

/**
 * 단일 BN의 Zombie 점수를 계산한다.
 * 정부 엔티티는 CTE 단계 사전 필터링으로 자동 제외된다 (AC-9).
 *
 * @param bn - 자선단체 BN
 * @returns score (0/30/60/80/100) + raw row (정부 엔티티 또는 미일치 시 null)
 */
export async function getZombieScore(bn: string): Promise<ZombieResult> {
  // legal_name 패턴 사전 제외 — CTE 내부에서는 alias 없는 컬럼명 사용
  const exclusion = buildGovtExclusionClause('legal_name');

  // queries.md §2의 score CASE를 그대로 적용. 단계 임계값은 plan.md/tech.md §4.1 매핑.
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
      SELECT bn, MAX(fpe) AS last_fpe FROM cra.cra_financial_general GROUP BY bn
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
      EXTRACT(MONTH FROM AGE(CURRENT_DATE, fl.last_fpe))
        + 12 * EXTRACT(YEAR FROM AGE(CURRENT_DATE, fl.last_fpe))::float8 AS months_since_filing,
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
    WHERE m.bn = $1
    LIMIT 1
  `;

  const rows = (await sql.unsafe(query, [bn])) as Array<{
    bn: string;
    legal_name: string;
    last_funding_year: number | null;
    total_funding: number | null;
    last_fpe: string | null;
    months_since_filing: number | null;
    zombie_score: number;
  }>;

  if (rows.length === 0) {
    // 정부 엔티티 또는 funding 미수령 BN — score 0 + raw null
    return { score: 0, raw: null };
  }

  const row = rows[0];
  if (!row) return { score: 0, raw: null };

  // last_fpe가 Date 객체로 반환될 수 있음 — 문자열 표현으로 정규화
  const lastFpeStr = row.last_fpe ? String(row.last_fpe) : null;

  return {
    score: row.zombie_score as 0 | 30 | 60 | 80 | 100,
    raw: {
      bn: row.bn,
      legal_name: row.legal_name,
      last_funding_year: row.last_funding_year,
      total_funding: row.total_funding,
      last_fpe: lastFpeStr,
      months_since_filing: row.months_since_filing,
    },
  };
}
