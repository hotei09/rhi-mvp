-- @MX:NOTE: SPEC-RHI-001 REQ-002 — reference SQL view, not used at runtime (replica read-only).
-- @MX:SPEC: SPEC-RHI-001 REQ-002 / AC-9
--
-- Lens 2 — Ghost Capacity ranking view.
-- 살아있되 (recent filing) 프로그램 활동 미미한 단체 탐지.
-- 신생 단체 (12mo 이하) + 정부 엔티티 자동 제외.
--
-- program_ratio = programs / total_expenditures (overhead_by_charity 스키마는 비율 컬럼 미보유).

CREATE OR REPLACE VIEW rhi_lens2_ghost AS
WITH latest_filing AS (
  SELECT DISTINCT ON (bn) bn, fpe, field_5862, field_5863, field_5864, field_5841
  FROM cra.cra_financial_general
  ORDER BY bn, fpe DESC
),
funding_recent AS (
  SELECT bn,
         MAX(fiscal_year) AS yr,
         AVG(govt_share_of_rev) AS share,
         SUM(total_govt) AS govt_sum
  FROM cra.govt_funding_by_charity
  WHERE fiscal_year >= 2022
  GROUP BY bn
  HAVING AVG(govt_share_of_rev) >= 0.7
),
overhead AS (
  SELECT
    bn,
    AVG(
      CASE WHEN total_expenditures > 0
           THEN programs::float8 / total_expenditures::float8
           ELSE NULL
      END
    ) AS program_ratio
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
    OR legal_name ILIKE 'City of %'
    OR legal_name ILIKE 'Town of %'
    OR legal_name ILIKE 'Municipality of %'
  )
    AND registration_date <= CURRENT_DATE - INTERVAL '12 months'
  ORDER BY bn, fiscal_year DESC
)
SELECT
  m.bn,
  m.legal_name,
  m.category,
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
  AND lf.fpe >= CURRENT_DATE - INTERVAL '24 months';
