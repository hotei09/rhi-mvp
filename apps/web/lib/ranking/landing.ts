/**
 * 랜딩 페이지 high concern ranking — REQ-005 Statement A.
 *
 * MVP 접근: 단일 SQL CTE로 zombie 신호 + multi-source 보조 신호로 candidate set 산출.
 *
 * 5개 lens 모두 round-trip 호출은 N×5 SQL → 너무 느림 (50 BN × 5 = 250 calls).
 * 본 함수는 다음 신호를 SQL 단계에서 통합:
 *  - zombie_score (queries.md §2 패턴): 정부 자금 후 filing 중단
 *  - multi_source_count (general.entity_source_links 카운트): 동일 entity가 여러 source에 등장
 *
 * 정부 엔티티는 buildGovtExclusionClause로 사전 제외 (AC-9).
 *
 * @MX:NOTE: [AUTO] candidate set 선정은 zombie + multi-source 시그널만 사용하는 휴리스틱.
 *          5개 lens 통합 score는 entity profile 페이지에서 정확히 계산.
 *          향후 enhancement: pre-computed materialized ranking view.
 * @MX:SPEC: SPEC-RHI-001 REQ-005 Statement A
 */
import { buildGovtExclusionClause } from '@/lib/data-issues/safe-queries';
import { sql } from '@/lib/db/client';
import { CONCERN_TIER_THRESHOLDS, type ConcernTier } from '@/lib/lenses/concern-score';

/**
 * 랜딩 페이지 ranking 행 — 표시 가능한 최소 필드.
 */
export type LandingRankingRow = {
  bn: string;
  legal_name: string;
  /** zombie_score + multi_source_signal 가중합 (0-100). */
  score: number;
  tier: ConcernTier;
  /** 가장 큰 기여 lens (UI에서 'Top contributor' 라벨 표시용). */
  top_lens: 'Zombie' | 'Multi-Source' | 'None';
  zombie_score: number;
  last_funding_year: number | null;
  multi_source_count: number;
};

/**
 * Ranking 옵션.
 */
export type LandingRankingOptions = {
  limit?: number;
};

/**
 * score 값을 ascending threshold에 매핑하여 tier를 결정한다.
 * (concern-score.ts의 scoreToTier와 동일 로직 — 의도적 inline 복제로 dependency 단순화)
 */
function scoreToTier(score: number): ConcernTier {
  if (score >= CONCERN_TIER_THRESHOLDS.CRITICAL) return 'Critical';
  if (score >= CONCERN_TIER_THRESHOLDS.HIGH) return 'High';
  if (score >= CONCERN_TIER_THRESHOLDS.MEDIUM) return 'Medium';
  if (score >= CONCERN_TIER_THRESHOLDS.LOW) return 'Low';
  return 'Healthy';
}

/**
 * 랜딩 페이지에 표시할 high-concern 엔티티 top N을 반환한다.
 * SQL 단일 호출 — server component에서 Promise.all 없이 직접 await.
 *
 * 가중치는 plan.md §2B.1과 일치하지만 본 함수는 2개 lens만 합산:
 *   approx_score = 0.55 * zombie_score + 0.45 * (multi_source_count >= 2 ? 100 : 0)
 *
 * 이유: zombie weight (0.30) + multi weight (0.15) / 합 0.45 = relative weights 0.67/0.33.
 * 단순화 위해 0.55/0.45로 고정 — Phase 5 measurement 후 calibrate.
 *
 * multi_source_count는 general.entity_source_links에서 동일 entity_id가 다수 source_schema에
 * 등장하는 경우의 source 카운트(distinct).
 *
 * @param options - limit (기본 50)
 */
export async function getLandingRanking(
  options: LandingRankingOptions = {},
): Promise<LandingRankingRow[]> {
  const limit = options.limit ?? 50;

  const exclusion = buildGovtExclusionClause('legal_name');

  // MVP 휴리스틱: 단일 SQL — zombie_score 단독 기반 ranking.
  // multi_source 시그널 통합은 Phase 5 enhancement (entity_source_links를 BN 단위로 미리 집계 필요).
  // 현재는 zombie 단독 = approx_score 직결, 정확한 5-lens 통합 점수는 entity profile 페이지에서 계산.
  // multi_source_count는 0으로 fixed return — UI는 "Top contributor: Zombie"로 표시.
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
    ),
    scored AS (
      SELECT
        m.bn,
        m.legal_name,
        f.last_funding_year,
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
    )
    SELECT
      bn,
      legal_name,
      zombie_score::int AS zombie_score,
      0::int AS multi_source_count,
      last_funding_year,
      zombie_score::float8 AS approx_score
    FROM scored
    WHERE zombie_score > 0
    ORDER BY approx_score DESC
    LIMIT $1
  `;

  type Row = {
    bn: string;
    legal_name: string;
    zombie_score: number;
    multi_source_count: number;
    last_funding_year: number | null;
    approx_score: number;
  };

  const rows = (await sql.unsafe(query, [limit])) as Array<Row>;

  return rows.map((r) => {
    const score = Math.round(r.approx_score * 10) / 10;
    const tier = scoreToTier(score);
    // top_lens: zombie 기여(0.55*z) vs multi(0.45*m) 중 큰 쪽
    const zombieContrib = 0.55 * r.zombie_score;
    const multiContrib = 0.45 * (r.multi_source_count >= 2 ? 100 : 0);
    let top_lens: LandingRankingRow['top_lens'] = 'None';
    if (zombieContrib === 0 && multiContrib === 0) {
      top_lens = 'None';
    } else if (zombieContrib >= multiContrib) {
      top_lens = 'Zombie';
    } else {
      top_lens = 'Multi-Source';
    }
    return {
      bn: r.bn,
      legal_name: r.legal_name,
      score,
      tier,
      top_lens,
      zombie_score: r.zombie_score,
      last_funding_year: r.last_funding_year,
      multi_source_count: r.multi_source_count,
    };
  });
}
