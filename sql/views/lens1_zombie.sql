-- @MX:NOTE: SPEC-RHI-001 REQ-002 — reference SQL view, not used at runtime (replica read-only).
-- @MX:SPEC: SPEC-RHI-001 REQ-002 / AC-2 / AC-9
--
-- Lens 1 — Zombie Recipient ranking view.
-- 정부 자금 (govt_share_of_rev >= 0.7) 수령 후 filing 중단 패턴 탐지.
-- 단계별 점수: 0 / 30 / 60 / 80 / 100 (queries.md §2 + tech.md §4.1).
-- 정부 엔티티는 legal_name 패턴 사전 제외 (AC-9).

CREATE OR REPLACE VIEW rhi_lens1_zombie AS
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
WHERE f.heavy_govt_funding > 0;
