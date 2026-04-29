-- @MX:NOTE: SPEC-RHI-001 REQ-003 — reference SQL view, not used at runtime (replica read-only).
-- @MX:SPEC: SPEC-RHI-001 REQ-003 / AC-6
--
-- Concern Score — 5개 lens view를 BN 단위로 조인하여 가중합 산출.
-- 가중치 (plan.md §2B.1 default seed):
--   zombie 0.30 / ghost 0.25 / loop 0.20 / director 0.10 / multi_source 0.15
--
-- Note: 실제 runtime은 apps/web/lib/lenses/concern-score.ts가 처리 (yaml 가중치 사용).
-- 본 view는 SQL 디버깅·재현성 용도.

CREATE OR REPLACE VIEW rhi_concern_score AS
WITH per_bn_scores AS (
  SELECT
    z.bn,
    z.legal_name,
    COALESCE(z.zombie_score, 0) AS zombie_score,
    COALESCE(g.ghost_score, 0) AS ghost_score,
    COALESCE((
      SELECT CASE
        WHEN MAX(CASE l.tier WHEN 'C' THEN 3 WHEN 'B' THEN 2 WHEN 'A' THEN 1 ELSE 0 END) = 3 THEN 100
        WHEN MAX(CASE l.tier WHEN 'C' THEN 3 WHEN 'B' THEN 2 WHEN 'A' THEN 1 ELSE 0 END) = 2 THEN 50
        ELSE 0
      END
      FROM rhi_lens3_loop_classified l
      JOIN cra.loop_participants lp ON lp.loop_id = l.loop_id
      WHERE lp.bn = z.bn
    ), 0) AS loop_signal,
    COALESCE(LEAST(d.overlap_bn_count * 10, 100), 0) AS director_signal,
    COALESCE((
      SELECT CASE WHEN MAX(ms.source_count) >= 2 THEN 100 ELSE 0 END
      FROM rhi_lens5_multi_source ms
      JOIN general.entity_source_links esl
        ON esl.entity_id = ms.entity_id
      WHERE esl.source_name = z.bn
    ), 0) AS multi_source_signal
  FROM rhi_lens1_zombie z
  LEFT JOIN rhi_lens2_ghost g USING (bn)
  LEFT JOIN rhi_lens4_director_overlap d ON d.target_bn = z.bn
)
SELECT
  bn,
  legal_name,
  zombie_score,
  ghost_score,
  loop_signal,
  director_signal,
  multi_source_signal,
  ROUND(
    (0.30 * zombie_score
     + 0.25 * ghost_score
     + 0.20 * loop_signal
     + 0.10 * director_signal
     + 0.15 * multi_source_signal)::numeric,
    1
  ) AS concern_score,
  CASE
    WHEN (0.30 * zombie_score + 0.25 * ghost_score + 0.20 * loop_signal
        + 0.10 * director_signal + 0.15 * multi_source_signal) >= 80 THEN 'Critical'
    WHEN (0.30 * zombie_score + 0.25 * ghost_score + 0.20 * loop_signal
        + 0.10 * director_signal + 0.15 * multi_source_signal) >= 60 THEN 'High'
    WHEN (0.30 * zombie_score + 0.25 * ghost_score + 0.20 * loop_signal
        + 0.10 * director_signal + 0.15 * multi_source_signal) >= 40 THEN 'Medium'
    WHEN (0.30 * zombie_score + 0.25 * ghost_score + 0.20 * loop_signal
        + 0.10 * director_signal + 0.15 * multi_source_signal) >= 20 THEN 'Low'
    ELSE 'Healthy'
  END AS tier
FROM per_bn_scores;
