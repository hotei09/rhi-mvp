/**
 * 단위 테스트 — `lib/lenses/concern-score.ts` 통합 점수 계산.
 *
 * AC-6: parametric composite score formula 검증.
 * AC-11: yaml 가중치 boot-time validation (sum = 1.0 ± 0.001).
 */
import '../setup-env';
import { describe, expect, it } from 'vitest';

describe('lib/lenses/concern-score — loadWeights (AC-11 boot-time validation)', () => {
  it('parses default yaml and validates sum = 1.0', async () => {
    const { loadWeights } = await import('@/lib/lenses/concern-score');
    const weights = loadWeights();
    expect(weights.zombie).toBeCloseTo(0.3, 3);
    expect(weights.ghost).toBeCloseTo(0.25, 3);
    expect(weights.loop).toBeCloseTo(0.2, 3);
    expect(weights.director).toBeCloseTo(0.1, 3);
    expect(weights.multi_source).toBeCloseTo(0.15, 3);
    const sum =
      weights.zombie + weights.ghost + weights.loop + weights.director + weights.multi_source;
    expect(Math.abs(sum - 1.0)).toBeLessThanOrEqual(0.001);
  });

  it('throws when yaml content has invalid weight sum (e.g., 0.95)', async () => {
    const { parseAndValidateWeights } = await import('@/lib/lenses/concern-score');
    const invalidYaml = `concern_score_weights:
  zombie:       0.30
  ghost:        0.25
  loop:         0.20
  director:     0.10
  multi_source: 0.10`; // sum = 0.95
    expect(() => parseAndValidateWeights(invalidYaml)).toThrow(/sum/i);
  });

  it('throws when yaml content has invalid weight sum (e.g., 1.05)', async () => {
    const { parseAndValidateWeights } = await import('@/lib/lenses/concern-score');
    const invalidYaml = `concern_score_weights:
  zombie:       0.40
  ghost:        0.25
  loop:         0.20
  director:     0.10
  multi_source: 0.10`; // sum = 1.05
    expect(() => parseAndValidateWeights(invalidYaml)).toThrow(/sum/i);
  });

  it('throws when yaml is missing required key', async () => {
    const { parseAndValidateWeights } = await import('@/lib/lenses/concern-score');
    const invalidYaml = `concern_score_weights:
  zombie:       0.30
  ghost:        0.25
  loop:         0.45`; // missing director, multi_source
    expect(() => parseAndValidateWeights(invalidYaml)).toThrow(/missing|required/i);
  });

  it('accepts boundary case (sum = 1.001) within tolerance', async () => {
    const { parseAndValidateWeights } = await import('@/lib/lenses/concern-score');
    const yaml = `concern_score_weights:
  zombie:       0.301
  ghost:        0.25
  loop:         0.20
  director:     0.10
  multi_source: 0.15`; // sum = 1.001
    expect(() => parseAndValidateWeights(yaml)).not.toThrow();
  });
});

describe('lib/lenses/concern-score — computeConcernScore (AC-6 parametric)', () => {
  it('computes deterministic score with default weights', async () => {
    const { computeConcernScore } = await import('@/lib/lenses/concern-score');
    // AC-6 parametric input: zombie=60, ghost=40, loop_signal=50, director_overlap=5, multi_source_count=2
    // expected: 0.30*60 + 0.25*40 + 0.20*50 + 0.10*min(5*10,100) + 0.15*100
    //         = 18 + 10 + 10 + 5 + 15 = 58.0
    const result = computeConcernScore({
      zombie_score: 60,
      ghost_score: 40,
      loop_signal: 50,
      director_overlap: 5,
      multi_source_count: 2,
    });
    expect(result.score).toBeCloseTo(58.0, 1);
    expect(result.tier).toBe('Medium');
  });

  it('returns identical result for identical input (determinism)', async () => {
    const { computeConcernScore } = await import('@/lib/lenses/concern-score');
    const input = {
      zombie_score: 80,
      ghost_score: 60,
      loop_signal: 100,
      director_overlap: 3,
      multi_source_count: 3,
    };
    const r1 = computeConcernScore(input);
    const r2 = computeConcernScore(input);
    expect(r1.score).toBe(r2.score);
    expect(r1.tier).toBe(r2.tier);
  });

  it('returns components breakdown', async () => {
    const { computeConcernScore } = await import('@/lib/lenses/concern-score');
    const result = computeConcernScore({
      zombie_score: 60,
      ghost_score: 40,
      loop_signal: 50,
      director_overlap: 5,
      multi_source_count: 2,
    });
    expect(result.components).toBeDefined();
    expect(result.components.zombie).toBeCloseTo(18.0, 1);
    expect(result.components.ghost).toBeCloseTo(10.0, 1);
    expect(result.components.loop).toBeCloseTo(10.0, 1);
    expect(result.components.director).toBeCloseTo(5.0, 1);
    expect(result.components.multi_source).toBeCloseTo(15.0, 1);
  });

  it('caps director_overlap signal at 100 when count is large', async () => {
    const { computeConcernScore } = await import('@/lib/lenses/concern-score');
    // director_overlap = 20 → min(200, 100) = 100 → 0.10*100 = 10.0
    const result = computeConcernScore({
      zombie_score: 0,
      ghost_score: 0,
      loop_signal: 0,
      director_overlap: 20,
      multi_source_count: 0,
    });
    expect(result.components.director).toBeCloseTo(10.0, 1);
  });

  it('multi_source signal = 100 when count >= 2, else 0', async () => {
    const { computeConcernScore } = await import('@/lib/lenses/concern-score');
    // count=2 → signal=100 → component=15.0
    const r2 = computeConcernScore({
      zombie_score: 0,
      ghost_score: 0,
      loop_signal: 0,
      director_overlap: 0,
      multi_source_count: 2,
    });
    expect(r2.components.multi_source).toBeCloseTo(15.0, 1);
    // count=1 → signal=0 → component=0
    const r1 = computeConcernScore({
      zombie_score: 0,
      ghost_score: 0,
      loop_signal: 0,
      director_overlap: 0,
      multi_source_count: 1,
    });
    expect(r1.components.multi_source).toBeCloseTo(0.0, 1);
  });
});

describe('lib/lenses/concern-score — tier mapping', () => {
  it('score >= 80 → Critical', async () => {
    const { computeConcernScore } = await import('@/lib/lenses/concern-score');
    const r = computeConcernScore({
      zombie_score: 100,
      ghost_score: 100,
      loop_signal: 100,
      director_overlap: 10,
      multi_source_count: 3,
    });
    // 0.30*100 + 0.25*100 + 0.20*100 + 0.10*100 + 0.15*100 = 100
    expect(r.score).toBeCloseTo(100, 1);
    expect(r.tier).toBe('Critical');
  });

  it('score in [60, 80) → High', async () => {
    const { computeConcernScore } = await import('@/lib/lenses/concern-score');
    // zombie=80, ghost=80, loop=80 → 0.30*80 + 0.25*80 + 0.20*80 = 60
    const r = computeConcernScore({
      zombie_score: 80,
      ghost_score: 80,
      loop_signal: 80,
      director_overlap: 0,
      multi_source_count: 0,
    });
    expect(r.score).toBeCloseTo(60.0, 1);
    expect(r.tier).toBe('High');
  });

  it('score in [40, 60) → Medium', async () => {
    const { computeConcernScore } = await import('@/lib/lenses/concern-score');
    // 58.0 → Medium (검증: AC-6 parametric)
    const r = computeConcernScore({
      zombie_score: 60,
      ghost_score: 40,
      loop_signal: 50,
      director_overlap: 5,
      multi_source_count: 2,
    });
    expect(r.tier).toBe('Medium');
  });

  it('score in [20, 40) → Low', async () => {
    const { computeConcernScore } = await import('@/lib/lenses/concern-score');
    // zombie=80, ghost=0, loop=0 → 0.30*80 = 24
    const r = computeConcernScore({
      zombie_score: 80,
      ghost_score: 0,
      loop_signal: 0,
      director_overlap: 0,
      multi_source_count: 0,
    });
    expect(r.score).toBeCloseTo(24.0, 1);
    expect(r.tier).toBe('Low');
  });

  it('score < 20 → Healthy', async () => {
    const { computeConcernScore } = await import('@/lib/lenses/concern-score');
    // zombie=30, others 0 → 0.30*30 = 9
    const r = computeConcernScore({
      zombie_score: 30,
      ghost_score: 0,
      loop_signal: 0,
      director_overlap: 0,
      multi_source_count: 0,
    });
    expect(r.score).toBeCloseTo(9.0, 1);
    expect(r.tier).toBe('Healthy');
  });

  it('boundary: score exactly 80 → Critical', async () => {
    const { computeConcernScore } = await import('@/lib/lenses/concern-score');
    // 0.30*80 + 0.25*80 + 0.20*80 + 0.10*100 + 0.15*100 = 24+20+16+10+15 = 85
    // → 다른 조합 시도: zombie=80, ghost=80, loop=80, director=10, multi=2 → 60 + 10 + 15 = 85
    // 정확히 80 만들기: zombie=80 (24) + ghost=80 (20) + loop=80 (16) + director=20 (2) + multi=2 (15) = 77
    // 정확히 80: zombie=100 (30) + ghost=80 (20) + loop=80 (16) + director=4 (4) + multi=2 (15) = 85
    // 정확히 80: zombie=100 (30) + ghost=100 (25) + loop=0 (0) + director=10 (10) + multi=2 (15) = 80 ✓
    const r = computeConcernScore({
      zombie_score: 100,
      ghost_score: 100,
      loop_signal: 0,
      director_overlap: 10,
      multi_source_count: 2,
    });
    expect(r.score).toBeCloseTo(80.0, 1);
    expect(r.tier).toBe('Critical');
  });

  it('boundary: score 79.9 → High', async () => {
    const { computeConcernScore } = await import('@/lib/lenses/concern-score');
    // zombie=99 → 29.7 + ghost=100 → 25 + loop=0 + director=10 → 10 + multi=2 → 15 = 79.7 ≈ 79.7
    const r = computeConcernScore({
      zombie_score: 99,
      ghost_score: 100,
      loop_signal: 0,
      director_overlap: 10,
      multi_source_count: 2,
    });
    expect(r.score).toBeLessThan(80);
    expect(r.score).toBeGreaterThanOrEqual(60);
    expect(r.tier).toBe('High');
  });

  it('boundary: score exactly 0 → Healthy', async () => {
    const { computeConcernScore } = await import('@/lib/lenses/concern-score');
    const r = computeConcernScore({
      zombie_score: 0,
      ghost_score: 0,
      loop_signal: 0,
      director_overlap: 0,
      multi_source_count: 0,
    });
    expect(r.score).toBe(0);
    expect(r.tier).toBe('Healthy');
  });
});

describe('lib/lenses/concern-score — CONCERN_TIER_THRESHOLDS const', () => {
  it('exposes ascending threshold constants', async () => {
    const { CONCERN_TIER_THRESHOLDS } = await import('@/lib/lenses/concern-score');
    expect(CONCERN_TIER_THRESHOLDS.CRITICAL).toBe(80);
    expect(CONCERN_TIER_THRESHOLDS.HIGH).toBe(60);
    expect(CONCERN_TIER_THRESHOLDS.MEDIUM).toBe(40);
    expect(CONCERN_TIER_THRESHOLDS.LOW).toBe(20);
    expect(CONCERN_TIER_THRESHOLDS.HEALTHY).toBe(0);
  });
});
