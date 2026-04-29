-- @MX:NOTE: SPEC-RHI-001 REQ-002 — reference SQL view, not used at runtime (replica read-only).
-- @MX:WARN: F-3 dedup 적용 (window function) — agreement_value 누적 트리플 카운트 회피 (queries.md §3).
-- @MX:REASON: PARTITION BY ref_number, recipient + ORDER BY amendment tiebreaker가 critical. 변경 시 raw SUM 대비 ~11% overcounting 재현.
-- @MX:SPEC: SPEC-RHI-001 REQ-002 / AC-5
--
-- Lens 5 — Multi-Source Funding per entity_id.
-- general.entity_source_links로 entity → FED/AB/CRA 소스 매핑.

CREATE OR REPLACE VIEW rhi_lens5_multi_source AS
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
        fc._id DESC
    ) AS rn
  FROM fed.grants_contributions fc
  WHERE fc.ref_number IS NOT NULL
),
fed_agg AS (
  SELECT
    esl.entity_id,
    SUM(fc.agreement_value) AS fed_total
  FROM dedup_fed fc
  JOIN general.entity_source_links esl
    ON (esl.source_pk->>'_id')::int = fc._id
  WHERE fc.rn = 1
    AND esl.source_schema = 'fed'
  GROUP BY esl.entity_id
),
ab_agg AS (
  SELECT
    esl.entity_id,
    SUM(ab.amount) AS ab_total
  FROM ab.ab_grants ab
  JOIN general.entity_source_links esl
    ON (esl.source_pk->>'id')::int = ab.id
  WHERE esl.source_schema = 'ab'
  GROUP BY esl.entity_id
),
cra_agg AS (
  SELECT
    esl.entity_id,
    SUM(g.total_govt) AS cra_govt_total
  FROM cra.govt_funding_by_charity g
  JOIN general.entity_source_links esl
    ON g.bn = esl.source_name
  WHERE esl.source_schema = 'cra'
  GROUP BY esl.entity_id
)
SELECT
  COALESCE(f.entity_id, a.entity_id, c.entity_id) AS entity_id,
  COALESCE(f.fed_total, 0) AS fed_total,
  COALESCE(a.ab_total, 0) AS ab_total,
  COALESCE(c.cra_govt_total, 0) AS cra_govt_total,
  (CASE WHEN COALESCE(f.fed_total, 0) > 0 THEN 1 ELSE 0 END
   + CASE WHEN COALESCE(a.ab_total, 0) > 0 THEN 1 ELSE 0 END
   + CASE WHEN COALESCE(c.cra_govt_total, 0) > 0 THEN 1 ELSE 0 END) AS source_count
FROM fed_agg f
FULL OUTER JOIN ab_agg a USING (entity_id)
FULL OUTER JOIN cra_agg c USING (entity_id);
