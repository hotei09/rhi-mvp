-- @MX:NOTE: SPEC-RHI-001 REQ-003 / REQ-005 — reference SQL view, not used at runtime (replica read-only).
-- @MX:SPEC: SPEC-RHI-001 REQ-005 / AC-8
--
-- High Concern Ranking — 랜딩 페이지에서 score 내림차순 top N 표시용.

CREATE OR REPLACE VIEW rhi_high_concern_ranking AS
SELECT
  bn,
  legal_name,
  concern_score,
  tier,
  zombie_score,
  ghost_score,
  loop_signal,
  director_signal,
  multi_source_signal
FROM rhi_concern_score
WHERE concern_score >= 20
ORDER BY concern_score DESC, bn;
