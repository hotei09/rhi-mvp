# Query Patterns — Recipient Health Index 5 Lenses

5개 렌즈의 핵심 SQL 패턴 + 데이터 함정 회피 패턴 + 검색·랭킹 쿼리.

> 모든 쿼리는 `apps/web/lib/lenses/*.ts` 가 `postgres.js`의 tagged template으로 호출하며,
> 파라미터는 자동 바인딩된다 (SQL injection 방지). 복잡한 CTE는 `sql/views/*.sql`에 별도 파일로 둔다.

---

## 1. 정부 엔티티 제외 헬퍼

여러 쿼리에서 공통 사용. SQL CTE로 작성하거나 어플리케이션 단에서 적용.

```sql
-- CTE 형태
WITH non_govt_charities AS (
  SELECT bn, legal_name, category
  FROM cra.cra_identification
  WHERE NOT (
       legal_name ILIKE 'Government of %'
    OR legal_name ILIKE '%Health Authority%'
    OR legal_name ILIKE '%Crown Corporation%'
    OR legal_name ILIKE 'City of %'
    OR legal_name ILIKE 'Town of %'
    OR legal_name ILIKE 'Municipality of %'
  )
)
```

---

## 2. Lens 1 — Zombie Recipient

```sql
-- Purpose: 마지막 funding 후 12개월 이내 filing 중단 + govt_share >= 70%
-- Parameters: $1 = limit (default 50)
-- Returns: 후보 BN과 zombie_score

WITH last_funding AS (
  SELECT
    bn,
    MAX(fiscal_year) AS last_funding_year,
    SUM(total_govt) FILTER (WHERE govt_share_of_rev >= 0.7) AS heavy_govt_funding,
    AVG(govt_share_of_rev) AS avg_govt_share
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
  SELECT DISTINCT ON (bn) bn, legal_name, category, registration_date
  FROM cra.cra_identification
  WHERE NOT (
       legal_name ILIKE 'Government of %'
    OR legal_name ILIKE '%Health Authority%'
    OR legal_name ILIKE '%Crown Corporation%'
    OR legal_name ILIKE 'City of %'
    OR legal_name ILIKE 'Town of %'
    OR legal_name ILIKE 'Municipality of %'
  )
  ORDER BY bn, fiscal_year DESC
)
SELECT
  m.bn,
  m.legal_name,
  m.category,
  f.last_funding_year,
  f.heavy_govt_funding,
  ROUND(f.avg_govt_share::numeric, 3) AS avg_govt_share,
  fl.last_fpe,
  EXTRACT(MONTH FROM AGE(CURRENT_DATE, fl.last_fpe))
    + 12 * EXTRACT(YEAR FROM AGE(CURRENT_DATE, fl.last_fpe)) AS months_since_filing,
  CASE
    WHEN fl.last_fpe IS NULL                              THEN 0
    WHEN fl.last_fpe < CURRENT_DATE - INTERVAL '36 months'
      AND f.last_funding_year >= EXTRACT(YEAR FROM fl.last_fpe) - 1 THEN 100
    WHEN fl.last_fpe < CURRENT_DATE - INTERVAL '24 months' THEN 80
    WHEN fl.last_fpe < CURRENT_DATE - INTERVAL '18 months' THEN 60
    WHEN fl.last_fpe < CURRENT_DATE - INTERVAL '12 months' THEN 30
    ELSE 0
  END AS zombie_score
FROM charity_meta m
JOIN last_funding f USING (bn)
LEFT JOIN last_filing fl USING (bn)
WHERE f.heavy_govt_funding > 0
ORDER BY zombie_score DESC, f.heavy_govt_funding DESC
LIMIT $1;
```

---

## 3. F-3 회피 패턴 — 연방 자금 합계

`fed.grants_contributions.agreement_value`는 누적값. naive SUM이 트리플 카운트하는 함정.
`vw_agreement_current` 뷰는 배포 안 됨 → window 함수로 직접 처리.

```sql
-- Purpose: 연방 자금의 "현재 commitment" 정확 합계 (F-3 회피)
-- Pattern: ref_number별 최신 amendment 한 행만 사용

WITH dedup_fed AS (
  SELECT
    fc.*,
    ROW_NUMBER() OVER (
      PARTITION BY
        fc.ref_number,
        COALESCE(fc.recipient_business_number, fc.recipient_legal_name, fc._id::text)
      ORDER BY
        COALESCE(NULLIF(fc.amendment_number, '')::int, 0) DESC NULLS LAST,
        fc.amendment_date DESC NULLS LAST,
        fc._id DESC                                              -- F-2 tiebreaker
    ) AS rn
  FROM fed.grants_contributions fc
  WHERE fc.ref_number IS NOT NULL
)
SELECT
  recipient_business_number,
  recipient_legal_name,
  SUM(agreement_value) AS true_commitment_total
FROM dedup_fed
WHERE rn = 1
GROUP BY recipient_business_number, recipient_legal_name
ORDER BY true_commitment_total DESC NULLS LAST;
```

---

## 4. Lens 2 — Ghost Capacity

```sql
-- Purpose: 살아있되 직원·프로그램 활동 미미한 단체
-- Parameters: $1 = limit
-- Returns: ghost_score 후보

WITH latest_filing AS (
  SELECT DISTINCT ON (bn) bn, fpe, field_5862, field_5863, field_5864, field_5841
  FROM cra.cra_financial_general
  ORDER BY bn, fpe DESC
),
funding_recent AS (
  SELECT bn, MAX(fiscal_year) AS yr, AVG(govt_share_of_rev) AS share, SUM(total_govt) AS govt_sum
  FROM cra.govt_funding_by_charity
  WHERE fiscal_year >= 2022
  GROUP BY bn
  HAVING AVG(govt_share_of_rev) >= 0.7
),
overhead AS (
  SELECT bn, AVG(program_ratio) AS program_ratio
  FROM cra.overhead_by_charity
  GROUP BY bn
),
charity_meta AS (
  SELECT DISTINCT ON (bn) bn, legal_name, category, registration_date
  FROM cra.cra_identification
  WHERE NOT (
       legal_name ILIKE 'Government of %'
    OR legal_name ILIKE '%Health Authority%'
    OR legal_name ILIKE '%Crown Corporation%'
  )
    AND registration_date <= CURRENT_DATE - INTERVAL '12 months'  -- 신생 제외
  ORDER BY bn, fiscal_year DESC
)
SELECT
  m.bn, m.legal_name, m.category,
  f.yr AS funding_year,
  f.govt_sum,
  ROUND(f.share::numeric, 3) AS govt_share,
  lf.fpe AS last_fpe,
  o.program_ratio,
  COALESCE(lf.field_5864, 0) AS top_compensation,
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
WHERE lf.fpe IS NOT NULL
  AND lf.fpe >= CURRENT_DATE - INTERVAL '24 months'  -- 살아있는 단체만 (filing 진행 중)
ORDER BY ghost_score DESC, f.govt_sum DESC NULLS LAST
LIMIT $1;
```

---

## 5. Lens 3 — Loop Classification (Tier A/B/C)

```sql
-- Purpose: 사이클을 합법(A)/관찰(B)/의심(C)로 분류
-- Returns: 5,808 loops with tier + classification reasons

WITH loop_meta AS (
  SELECT
    l.id AS loop_id,
    l.hops, l.path_bns, l.path_display,
    l.total_flow, l.bottleneck_amt,
    l.min_year, l.max_year,
    -- 동일 BN root 9자리 prefix 모두 같은가
    cardinality(
      (SELECT array_agg(DISTINCT substr(p, 1, 9)) FROM unnest(l.path_bns) p)
    ) AS distinct_bn_roots
  FROM cra.loops l
),
hub_touch AS (
  -- 알려진 도네이션 플랫폼/연합자선 허브 통과
  SELECT DISTINCT lp.loop_id
  FROM cra.loop_participants lp
  JOIN cra.identified_hubs h ON h.bn = lp.bn
),
program_health AS (
  -- 참여 BN의 평균 program_expenditure ratio
  SELECT
    lp.loop_id,
    AVG(COALESCE(o.program_ratio, 0)) AS avg_program_ratio,
    MIN(COALESCE(o.program_ratio, 0)) AS min_program_ratio
  FROM cra.loop_participants lp
  LEFT JOIN cra.overhead_by_charity o ON o.bn = lp.bn
  GROUP BY lp.loop_id
),
plausibility AS (
  -- 데이터 품질 플래그 매칭
  SELECT DISTINCT lp.loop_id
  FROM cra.loop_participants lp
  JOIN cra.t3010_plausibility_flags pf
    ON pf.bn = lp.bn AND pf.severity >= 3
)
SELECT
  m.loop_id, m.hops, m.path_display, m.total_flow,
  m.distinct_bn_roots,
  ph.avg_program_ratio,
  CASE
    WHEN m.distinct_bn_roots = 1                              THEN 'A'  -- internal hierarchy
    WHEN m.loop_id IN (SELECT loop_id FROM hub_touch)         THEN 'A'  -- known hub-mediated
    WHEN m.loop_id IN (SELECT loop_id FROM plausibility)      THEN 'C'  -- data-quality flagged
    WHEN ph.avg_program_ratio >= 0.6                          THEN 'B'  -- observed
    ELSE 'C'                                                            -- suspicious
  END AS tier,
  -- 분류 근거 narrative
  ARRAY_REMOVE(ARRAY[
    CASE WHEN m.distinct_bn_roots = 1 THEN 'all participants share BN root prefix (internal hierarchy)' END,
    CASE WHEN m.loop_id IN (SELECT loop_id FROM hub_touch) THEN 'passes through known donation/foundation hub' END,
    CASE WHEN m.loop_id IN (SELECT loop_id FROM plausibility) THEN 'participant has T3010 plausibility flag (severity >= 3)' END,
    CASE WHEN ph.avg_program_ratio < 0.4 THEN 'low average program expenditure ratio across participants' END,
    CASE WHEN m.distinct_bn_roots >= 2 AND ph.avg_program_ratio < 0.3 THEN 'cross-organization with low program ratio' END
  ], NULL) AS classification_reasons
FROM loop_meta m
LEFT JOIN program_health ph USING (loop_id)
ORDER BY m.total_flow DESC NULLS LAST;
```

---

## 6. Lens 4 — Director Network (lite signal)

```sql
-- Purpose: BN별 이사 중 다른 funded BN 이사와 동명인 수 (시그널 only)
-- Parameters: $1 = target_bn
-- Returns: overlap count + sample names

WITH target_directors AS (
  SELECT DISTINCT
    last_name, first_name, COALESCE(initials, '') AS initials
  FROM cra.cra_directors
  WHERE bn = $1
),
funded_bns AS (
  -- 정부 자금 수령 이력 있는 BN만
  SELECT DISTINCT bn FROM cra.govt_funding_by_charity WHERE total_govt > 0
),
overlapping AS (
  SELECT
    d.bn,
    d.last_name || ', ' || d.first_name ||
      CASE WHEN d.initials IS NOT NULL AND d.initials <> '' THEN ' (' || d.initials || ')' ELSE '' END
      AS director_full
  FROM cra.cra_directors d
  JOIN target_directors td
    ON td.last_name = d.last_name
   AND td.first_name = d.first_name
   AND td.initials = COALESCE(d.initials, '')
  JOIN funded_bns f ON f.bn = d.bn
  WHERE d.bn <> $1
)
SELECT
  count(DISTINCT bn) AS overlap_bn_count,
  count(*) AS overlap_director_records,
  array_agg(DISTINCT director_full ORDER BY director_full) FILTER (WHERE director_full IS NOT NULL)
    AS sample_directors,
  array_agg(DISTINCT bn ORDER BY bn) FILTER (WHERE bn IS NOT NULL)
    AS sample_other_bns
FROM overlapping;
```

> **주의**: 동명이인 위양성 가능. 본 시그널은 단순 카운트로만 표시하고, 강한 결론(부정 행위) 도출 금지. methodology.md에 명시.

---

## 7. Lens 5 — Multi-Source Funding (lite signal)

```sql
-- Purpose: 동일 entity가 FED + AB + CRA gov-transfers 둘 이상에서 자금 수령
-- Parameters: $1 = entity_id
-- Returns: per-source totals + same_year_overlap

WITH source_funding AS (
  -- FED (F-3 회피)
  SELECT
    'fed'::text AS source,
    EXTRACT(YEAR FROM fc.agreement_start_date)::int AS funding_year,
    SUM(fc.agreement_value) AS amount
  FROM general.entity_source_links esl
  JOIN fed.grants_contributions fc ON fc._id = (esl.source_pk->>'_id')::int
  WHERE esl.entity_id = $1
    AND esl.source_schema = 'fed'
  GROUP BY 1, 2
  UNION ALL
  -- AB
  SELECT
    'ab'::text AS source,
    EXTRACT(YEAR FROM ab.payment_date)::int AS funding_year,
    SUM(ab.amount) AS amount
  FROM general.entity_source_links esl
  JOIN ab.ab_grants ab ON ab.id = (esl.source_pk->>'id')::int
  WHERE esl.entity_id = $1
    AND esl.source_schema = 'ab'
  GROUP BY 1, 2
  UNION ALL
  -- CRA gov-transfers (자선단체가 정부 transfer 받은 경우)
  SELECT
    'cra_govt'::text AS source,
    g.fiscal_year AS funding_year,
    SUM(g.total_govt) AS amount
  FROM general.entity_source_links esl
  JOIN cra.govt_funding_by_charity g ON g.bn = esl.source_name
  WHERE esl.entity_id = $1
    AND esl.source_schema = 'cra'
  GROUP BY 1, 2
)
SELECT
  COUNT(DISTINCT source) AS source_count,
  jsonb_object_agg(source, COALESCE(per_source_sum, 0)) AS per_source_total,
  COUNT(*) FILTER (
    WHERE funding_year IN (
      SELECT funding_year FROM source_funding GROUP BY funding_year HAVING COUNT(DISTINCT source) >= 2
    )
  ) AS same_year_overlap_records
FROM (
  SELECT source, SUM(amount) AS per_source_sum
  FROM source_funding
  GROUP BY source
) agg
CROSS JOIN source_funding;
```

> 주의: 위 쿼리는 의사 코드 — 실제 jsonb 집계 패턴은 어플리케이션 단에서 더 깨끗하게 처리할 수 있음.
> `general.vw_entity_funding` 뷰가 있다면 우선 검토 (배포 본 확인 필요).

---

## 8. Concern Score 통합 쿼리

```sql
-- Purpose: 단일 BN의 전체 5-lens 점수 한 번에
-- Parameters: $1 = bn
-- 어플리케이션에서 5개 쿼리 병렬 (Promise.all) 실행이 더 명확.
-- 단일 SQL은 디버깅·재현성을 위해 보관.

-- (생략) — 실제 구현은 lib/lenses/concern-score.ts에서 5개 lens 병렬 호출 후 가중합.
-- DB-side 합치기는 가독성 떨어지고 캐싱 단위도 안 맞음.
```

---

## 9. High Concern Ranking (랜딩 페이지)

```sql
-- Purpose: 상위 N개 High Concern entities 랭킹
-- Parameters: $1 = limit, $2 = offset
-- 어플리케이션 캐싱: revalidate 5분
-- 사전 materialization 불가 (replica) → 매 호출 SQL 실행
-- 첫 단계: Lens 1 + Lens 2 union으로 후보군 추리고 후속 lens는 entity 페이지에서 lazy

WITH zombie_scores AS (
  -- §2 쿼리 그대로
),
ghost_scores AS (
  -- §4 쿼리 그대로
),
combined AS (
  SELECT bn, legal_name, category, zombie_score AS score, 'zombie' AS lens FROM zombie_scores WHERE zombie_score > 0
  UNION ALL
  SELECT bn, legal_name, category, ghost_score, 'ghost' FROM ghost_scores WHERE ghost_score > 0
)
SELECT
  bn, legal_name, category,
  MAX(score) AS top_lens_score,
  array_agg(DISTINCT lens) AS triggered_lenses
FROM combined
GROUP BY bn, legal_name, category
ORDER BY top_lens_score DESC
LIMIT $1 OFFSET $2;
```

> 단일 페이지 응답 시간 목표 < 800ms. 측정 후 필요 시 lens별 결과 캐싱 또는 materialized view (자체 인스턴스 도입 시).

---

## 10. 검색 쿼리 (글로벌 search box)

```sql
-- Purpose: 단체명·BN으로 entity 검색
-- Parameters: $1 = query, $2 = limit
-- Uses: general.vw_entity_search 뷰 (배포되어 있음)

SELECT id, canonical_name, bn_root, dataset_sources
FROM general.vw_entity_search
WHERE
  norm_canonical ILIKE '%' || lower($1) || '%'
  OR bn_root = $1
  OR $1 = ANY(bn_variants)
ORDER BY
  -- prefix match 우선
  CASE WHEN norm_canonical ILIKE lower($1) || '%' THEN 0 ELSE 1 END,
  source_link_count DESC NULLS LAST
LIMIT $2;
```

(`general.vw_entity_search`의 정확한 컬럼은 배포본 확인 후 조정)

---

## 11. 헬스체크

```sql
-- Purpose: /api/healthz 핸들러
-- Returns: 1 if DB is reachable
SELECT 1 AS ok;
```

---

## 12. 성능 측정

`scripts/benchmark-queries.ts` 가 본 파일의 모든 쿼리를 다음과 같이 측정:

```typescript
import { sql } from '../apps/web/lib/db/client';

const queries = [
  { name: 'lens1_zombie_top50', sql: '...', params: [50] },
  { name: 'lens2_ghost_top50', sql: '...', params: [50] },
  { name: 'lens3_loop_classified', sql: '...', params: [] },
  { name: 'fed_dedupe_total', sql: '...', params: [] },
  { name: 'high_concern_ranking', sql: '...', params: [50, 0] },
];

for (const q of queries) {
  const t0 = performance.now();
  await sql.unsafe(q.sql, q.params);
  console.log(`${q.name}: ${(performance.now() - t0).toFixed(0)}ms`);
}
```

목표:
| Query | 목표 (cold) | 목표 (warm) |
|---|---|---|
| lens1_zombie_top50 | < 800ms | < 200ms |
| lens2_ghost_top50 | < 800ms | < 200ms |
| lens3_loop_classified | < 1500ms | < 300ms |
| fed_dedupe_total | < 2000ms | < 500ms |
| high_concern_ranking | < 1000ms | < 200ms |

---

Last reviewed: 2026-04-27
Status: 의사 코드 + 구조 설계. 실 구현 시 (`/moai run`) 컬럼명·뷰명 정확성 확인 필요.
