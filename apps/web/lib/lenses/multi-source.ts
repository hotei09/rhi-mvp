/**
 * Lens 5 — Multi-Source Funding (REQ-002 / AC-5).
 *
 * 동일 entity가 FED + AB + CRA gov-transfers 둘 이상에서 자금을 수령하는 패턴.
 * `general.entity_source_links`로 entity_id → source 행 매핑.
 *
 * F-3 회피: FED 측 합계는 `withF3Dedup` window function으로 ref_number별 최신 amendment만 선택.
 *
 * source_count: 1 / 2 / 3 (각 소스 미수령 = 0 안 셈)
 * same_year_overlap: 동일 fiscal_year에서 ≥ 2개 소스에 non-zero amount가 있는 연도 수.
 */
import { withF3Dedup } from '@/lib/data-issues/safe-queries';
import { sql } from '@/lib/db/client';

/**
 * Multi-source lens 결과.
 */
export type MultiSourceResult = {
  source_count: 0 | 1 | 2 | 3;
  fed_total: number;
  ab_total: number;
  cra_govt_total: number;
  same_year_overlap: number;
};

/**
 * entity_id에 연결된 모든 소스의 funding 합계 + same-year overlap을 계산한다.
 *
 * @MX:NOTE: [AUTO] FED 합계는 withF3Dedup 적용 — F-3 trap 회피 (queries.md §3, AC-5).
 * @MX:SPEC: SPEC-RHI-001 REQ-002 / AC-5
 *
 * @param entityId - general.entity_source_links의 entity_id (UUID)
 * @returns 소스별 합계 + same_year_overlap 카운트
 */
export async function getMultiSourceFunding(entityId: string): Promise<MultiSourceResult> {
  // FED 합계 — F-3 dedup 적용
  const fedQuery = withF3Dedup(`
    SELECT
      COALESCE(SUM(fc.agreement_value)::float8, 0) AS fed_total
    FROM dedup_fed fc
    JOIN general.entity_source_links esl
      ON (esl.source_pk->>'_id')::int = fc._id
    WHERE fc.rn = 1
      AND esl.entity_id = $1
      AND esl.source_schema = 'fed'
  `);

  // AB 합계 — dedup 불필요 (queries.md §7)
  const abQuery = `
    SELECT COALESCE(SUM(ab.amount)::float8, 0) AS ab_total
    FROM ab.ab_grants ab
    JOIN general.entity_source_links esl
      ON (esl.source_pk->>'id')::int = ab.id
    WHERE esl.entity_id = $1
      AND esl.source_schema = 'ab'
  `;

  // CRA gov-transfers 합계
  const craQuery = `
    SELECT COALESCE(SUM(g.total_govt)::float8, 0) AS cra_total
    FROM cra.govt_funding_by_charity g
    JOIN general.entity_source_links esl
      ON g.bn = esl.source_name
    WHERE esl.entity_id = $1
      AND esl.source_schema = 'cra'
  `;

  // Same-year overlap: 연도별 소스 카운트 ≥ 2인 연도 수
  const overlapQuery = withF3Dedup(`
    , fed_yearly AS (
      SELECT
        EXTRACT(YEAR FROM fc.agreement_start_date)::int AS yr
      FROM dedup_fed fc
      JOIN general.entity_source_links esl
        ON (esl.source_pk->>'_id')::int = fc._id
      WHERE fc.rn = 1
        AND esl.entity_id = $1
        AND esl.source_schema = 'fed'
        AND fc.agreement_value > 0
    ),
    ab_yearly AS (
      SELECT EXTRACT(YEAR FROM ab.payment_date)::int AS yr
      FROM ab.ab_grants ab
      JOIN general.entity_source_links esl
        ON (esl.source_pk->>'id')::int = ab.id
      WHERE esl.entity_id = $1
        AND esl.source_schema = 'ab'
        AND ab.amount > 0
    ),
    cra_yearly AS (
      SELECT g.fiscal_year::int AS yr
      FROM cra.govt_funding_by_charity g
      JOIN general.entity_source_links esl
        ON g.bn = esl.source_name
      WHERE esl.entity_id = $1
        AND esl.source_schema = 'cra'
        AND g.total_govt > 0
    ),
    yearly_sources AS (
      SELECT yr, 'fed' AS src FROM fed_yearly
      UNION
      SELECT yr, 'ab' AS src FROM ab_yearly
      UNION
      SELECT yr, 'cra' AS src FROM cra_yearly
    )
    SELECT COUNT(*)::int AS overlap_years FROM (
      SELECT yr FROM yearly_sources GROUP BY yr HAVING COUNT(DISTINCT src) >= 2
    ) overlap_set
  `);

  // 4개 쿼리 병렬 실행
  const [fedRows, abRows, craRows, overlapRows] = await Promise.all([
    sql.unsafe(fedQuery, [entityId]) as Promise<Array<{ fed_total: number }>>,
    sql.unsafe(abQuery, [entityId]) as Promise<Array<{ ab_total: number }>>,
    sql.unsafe(craQuery, [entityId]) as Promise<Array<{ cra_total: number }>>,
    sql.unsafe(overlapQuery, [entityId]) as Promise<Array<{ overlap_years: number }>>,
  ]);

  const fed_total = fedRows[0]?.fed_total ?? 0;
  const ab_total = abRows[0]?.ab_total ?? 0;
  const cra_govt_total = craRows[0]?.cra_total ?? 0;
  const same_year_overlap = overlapRows[0]?.overlap_years ?? 0;

  // source_count: non-zero 소스 수
  let count = 0;
  if (fed_total > 0) count++;
  if (ab_total > 0) count++;
  if (cra_govt_total > 0) count++;

  return {
    source_count: count as 0 | 1 | 2 | 3,
    fed_total,
    ab_total,
    cra_govt_total,
    same_year_overlap,
  };
}
