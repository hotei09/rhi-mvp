-- @MX:NOTE: SPEC-RHI-001 REQ-002 — reference SQL view, not used at runtime (replica read-only).
-- @MX:SPEC: SPEC-RHI-001 REQ-002 / AC-3 / AC-4
--
-- Lens 3 — Loop Classification (Tier A/B/C).
-- CASE 평가 순서가 critical (queries.md §5 lines 239-245):
--   1. distinct_bn_roots = 1                              → 'A' (internal hierarchy)
--   2. loop touches identified_hubs                       → 'A' (known hub-mediated)
--   3. loop has plausibility flag (severity >= 3)         → 'C' (data-quality flagged)
--   4. avg_program_ratio >= 0.6                           → 'B' (observed)
--   5. else                                               → 'C' (suspicious)

CREATE OR REPLACE VIEW rhi_lens3_loop_classified AS
WITH loop_meta AS (
  SELECT
    l.id AS loop_id,
    l.hops, l.path_bns, l.path_display,
    l.total_flow, l.bottleneck_amt,
    l.min_year, l.max_year,
    cardinality(
      (SELECT array_agg(DISTINCT substr(p, 1, 9)) FROM unnest(l.path_bns) p)
    ) AS distinct_bn_roots
  FROM cra.loops l
),
hub_touch AS (
  SELECT DISTINCT lp.loop_id
  FROM cra.loop_participants lp
  JOIN cra.identified_hubs h ON h.bn = lp.bn
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
    ) AS avg_program_ratio
  FROM cra.loop_participants lp
  LEFT JOIN cra.overhead_by_charity o ON o.bn = lp.bn
  GROUP BY lp.loop_id
),
plausibility AS (
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
    WHEN m.distinct_bn_roots = 1                              THEN 'A'
    WHEN m.loop_id IN (SELECT loop_id FROM hub_touch)         THEN 'A'
    WHEN m.loop_id IN (SELECT loop_id FROM plausibility)      THEN 'C'
    WHEN ph.avg_program_ratio >= 0.6                          THEN 'B'
    ELSE 'C'
  END AS tier,
  ARRAY_REMOVE(ARRAY[
    CASE WHEN m.distinct_bn_roots = 1 THEN 'all participants share BN root prefix (internal hierarchy)' END,
    CASE WHEN m.loop_id IN (SELECT loop_id FROM hub_touch) THEN 'passes through known donation/aggregation hub' END,
    CASE WHEN m.loop_id IN (SELECT loop_id FROM plausibility) THEN 'participant has T3010 plausibility flag (severity >= 3)' END,
    CASE WHEN ph.avg_program_ratio < 0.4 THEN 'low average program expenditure ratio across participants' END,
    CASE WHEN m.distinct_bn_roots >= 2 AND ph.avg_program_ratio < 0.3 THEN 'cross-organization with low program ratio' END
  ], NULL) AS classification_reasons
FROM loop_meta m
LEFT JOIN program_health ph USING (loop_id);
