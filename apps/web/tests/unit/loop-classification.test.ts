/**
 * 단위 테스트 — `lib/lenses/loop.ts` `classifyLoop` 순수 함수.
 *
 * AC-3: Salvation Army Tier A (distinct_bn_roots = 1, internal hierarchy)
 * AC-4: cross-org Tier C (plausibility flag severity >= 3)
 *
 * CASE 평가 순서 (queries.md §5):
 * 1. distinct_bn_roots = 1                          → 'A' (internal hierarchy)
 * 2. hubTouch                                       → 'A' (known hub-mediated)
 * 3. hasPlausibilityFlag (severity >= 3)            → 'C' (data-quality flagged)
 * 4. avgProgramRatio >= 0.6                         → 'B' (observed)
 * 5. else                                           → 'C' (suspicious)
 */
import '../setup-env';
import { describe, expect, it } from 'vitest';

describe('lib/lenses/loop — classifyLoop (Tier A — internal hierarchy, AC-3)', () => {
  it('Salvation Army-style loop: distinct_bn_roots = 1 → Tier A', async () => {
    const { classifyLoop } = await import('@/lib/lenses/loop');
    const result = classifyLoop({
      loop_id: 1,
      hops: 3,
      path_bns: ['107951618RR0001', '107951618RR0002', '107951618RR0003'],
      total_flow: 1_000_000,
      distinct_bn_roots: 1,
      hub_touch: false,
      has_plausibility_flag: false,
      avg_program_ratio: 0.5,
    });
    expect(result.tier).toBe('A');
    expect(result.classification_reasons).toContain(
      'all participants share BN root prefix (internal hierarchy)',
    );
  });

  it('distinct_bn_roots=1 takes precedence over plausibility flag (CASE order)', async () => {
    const { classifyLoop } = await import('@/lib/lenses/loop');
    // distinct_bn_roots=1 첫 번째 매칭이므로 Tier A — plausibility flag 무시
    const result = classifyLoop({
      loop_id: 2,
      hops: 4,
      path_bns: ['107951618RR0001', '107951618RR0002'],
      total_flow: 500_000,
      distinct_bn_roots: 1,
      hub_touch: false,
      has_plausibility_flag: true, // 가설적으로 플래그 있어도
      avg_program_ratio: 0.2,
    });
    expect(result.tier).toBe('A');
  });
});

describe('lib/lenses/loop — classifyLoop (Tier A — hub touch)', () => {
  it('cross-org with hub touch → Tier A', async () => {
    const { classifyLoop } = await import('@/lib/lenses/loop');
    const result = classifyLoop({
      loop_id: 3,
      hops: 5,
      path_bns: ['111111111RR0001', '222222222RR0001'],
      total_flow: 2_000_000,
      distinct_bn_roots: 2,
      hub_touch: true, // 알려진 hub 통과
      has_plausibility_flag: false,
      avg_program_ratio: 0.4,
    });
    expect(result.tier).toBe('A');
    expect(
      result.classification_reasons.some((r) => r.includes('donation') || r.includes('hub')),
    ).toBe(true);
  });
});

describe('lib/lenses/loop — classifyLoop (Tier C — plausibility flag, AC-4)', () => {
  it('cross-org with plausibility flag (severity >= 3) → Tier C', async () => {
    const { classifyLoop } = await import('@/lib/lenses/loop');
    const result = classifyLoop({
      loop_id: 4,
      hops: 4,
      path_bns: ['333333333RR0001', '444444444RR0001'],
      total_flow: 800_000,
      distinct_bn_roots: 2,
      hub_touch: false,
      has_plausibility_flag: true, // T3010 플래그
      avg_program_ratio: 0.5,
    });
    expect(result.tier).toBe('C');
    expect(result.classification_reasons).toContain(
      'participant has T3010 plausibility flag (severity >= 3)',
    );
  });
});

describe('lib/lenses/loop — classifyLoop (Tier B — observed)', () => {
  it('cross-org with high avg_program_ratio (>= 0.6) → Tier B', async () => {
    const { classifyLoop } = await import('@/lib/lenses/loop');
    const result = classifyLoop({
      loop_id: 5,
      hops: 3,
      path_bns: ['555555555RR0001', '666666666RR0001'],
      total_flow: 1_500_000,
      distinct_bn_roots: 2,
      hub_touch: false,
      has_plausibility_flag: false,
      avg_program_ratio: 0.7, // 건강한 program 비율
    });
    expect(result.tier).toBe('B');
    expect(
      result.classification_reasons.some((r) => r.includes('cross-org') || r.includes('program')),
    ).toBe(true);
  });
});

describe('lib/lenses/loop — classifyLoop (Tier C — suspicious fallback)', () => {
  it('cross-org with low program ratio, no hub, no flag → Tier C', async () => {
    const { classifyLoop } = await import('@/lib/lenses/loop');
    const result = classifyLoop({
      loop_id: 6,
      hops: 4,
      path_bns: ['777777777RR0001', '888888888RR0001'],
      total_flow: 600_000,
      distinct_bn_roots: 2,
      hub_touch: false,
      has_plausibility_flag: false,
      avg_program_ratio: 0.3, // 낮은 program 비율
    });
    expect(result.tier).toBe('C');
    expect(result.classification_reasons.length).toBeGreaterThan(0);
  });

  it('cross-org with null avg_program_ratio (no overhead data) → Tier C', async () => {
    const { classifyLoop } = await import('@/lib/lenses/loop');
    const result = classifyLoop({
      loop_id: 7,
      hops: 3,
      path_bns: ['999999999RR0001', '110000000RR0001'],
      total_flow: 400_000,
      distinct_bn_roots: 2,
      hub_touch: false,
      has_plausibility_flag: false,
      avg_program_ratio: null,
    });
    expect(result.tier).toBe('C');
  });
});

describe('lib/lenses/loop — classifyLoop (deterministic)', () => {
  it('same input → same output', async () => {
    const { classifyLoop } = await import('@/lib/lenses/loop');
    const input = {
      loop_id: 100,
      hops: 4,
      path_bns: ['100000001RR0001', '100000002RR0001'],
      total_flow: 1_000_000,
      distinct_bn_roots: 2,
      hub_touch: false,
      has_plausibility_flag: true,
      avg_program_ratio: 0.4,
    };
    const r1 = classifyLoop(input);
    const r2 = classifyLoop(input);
    expect(r1.tier).toBe(r2.tier);
    expect(r1.classification_reasons).toEqual(r2.classification_reasons);
  });

  it('preserves loop_id and avg_program_ratio in output', async () => {
    const { classifyLoop } = await import('@/lib/lenses/loop');
    const result = classifyLoop({
      loop_id: 42,
      hops: 3,
      path_bns: ['100000001RR0001'],
      total_flow: 100_000,
      distinct_bn_roots: 1,
      hub_touch: false,
      has_plausibility_flag: false,
      avg_program_ratio: 0.5,
    });
    expect(result.loop_id).toBe(42);
    expect(result.avg_program_ratio).toBe(0.5);
  });
});
