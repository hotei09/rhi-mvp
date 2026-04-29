-- @MX:NOTE: SPEC-RHI-001 REQ-002 — reference SQL view, not used at runtime (replica read-only).
-- @MX:SPEC: SPEC-RHI-001 REQ-002 / AC-10
--
-- Lens 4 — Director Network (signal-only) per BN.
-- last_name + first_name + initials 셋 매칭 (queries.md §6).
-- 동명이인 false positive 회피용 — fraud claim 절대 도출 금지 (AC-10 디스클레이머).

CREATE OR REPLACE VIEW rhi_lens4_director_overlap AS
WITH funded_bns AS (
  SELECT DISTINCT bn FROM cra.govt_funding_by_charity WHERE total_govt > 0
),
non_govt AS (
  SELECT DISTINCT bn
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
SELECT
  d.bn AS target_bn,
  COUNT(DISTINCT d2.bn) FILTER (WHERE d2.bn <> d.bn) AS overlap_bn_count,
  COUNT(*) FILTER (WHERE d2.bn <> d.bn) AS overlap_director_records
FROM cra.cra_directors d
JOIN cra.cra_directors d2
  ON d2.last_name = d.last_name
 AND d2.first_name = d.first_name
 AND COALESCE(d2.initials, '') = COALESCE(d.initials, '')
JOIN funded_bns f ON f.bn = d2.bn
JOIN non_govt ng ON ng.bn = d2.bn
GROUP BY d.bn;
