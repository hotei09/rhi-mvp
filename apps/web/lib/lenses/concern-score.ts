/**
 * Concern Score 통합 점수 계산 — REQ-003 / AC-6 / AC-11.
 *
 * 가중치는 `.moai/project/db/concern-score-weights.yaml`의 canonical seed (plan.md §2B.1)에서
 * boot 시 1회 로드되며, sum이 1.0 ± 0.001을 만족해야 한다 (AC-11).
 *
 * 5개 lens signal에 가중합을 적용해 0-100 점수를 산출하고, ascending threshold로 tier에 매핑한다:
 *  - score >= 80      → Critical
 *  - 60 <= score < 80 → High
 *  - 40 <= score < 60 → Medium
 *  - 20 <= score < 40 → Low
 *  - score < 20       → Healthy
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * 5개 lens 가중치 — sum = 1.0 ± 0.001.
 * canonical source: .moai/project/db/concern-score-weights.yaml
 */
export type ConcernWeights = {
  zombie: number;
  ghost: number;
  loop: number;
  director: number;
  multi_source: number;
};

/**
 * Lens 결과를 raw signal로 변환한 형태.
 * - zombie_score, ghost_score, loop_signal: 0-100 (이미 변환됨)
 * - director_overlap: 매칭 카운트 (가중치 적용 시 min(count*10, 100)으로 변환)
 * - multi_source_count: 1/2/3 (가중치 적용 시 count >= 2 ? 100 : 0으로 변환)
 */
export type LensSignals = {
  zombie_score: number;
  ghost_score: number;
  loop_signal: number;
  director_overlap: number;
  multi_source_count: number;
};

/**
 * Concern Score tier 종류.
 */
export type ConcernTier = 'Critical' | 'High' | 'Medium' | 'Low' | 'Healthy';

/**
 * Concern Score 계산 결과.
 */
export type ConcernScoreResult = {
  score: number;
  tier: ConcernTier;
  components: {
    zombie: number;
    ghost: number;
    loop: number;
    director: number;
    multi_source: number;
  };
};

/**
 * Tier 임계값 (ascending). plan.md §2B.2.
 *
 * @MX:NOTE: [AUTO] tier 임계값은 plan.md §2B.2의 canonical reference. 변경 시 yaml/test 동시 갱신 필요.
 * @MX:SPEC: SPEC-RHI-001 REQ-003
 */
export const CONCERN_TIER_THRESHOLDS = {
  CRITICAL: 80,
  HIGH: 60,
  MEDIUM: 40,
  LOW: 20,
  HEALTHY: 0,
} as const;

/**
 * 가중치 yaml 파일의 canonical 위치 (project root 기준).
 * Vitest는 working directory가 apps/web이므로 ../../에서 시작.
 */
const WEIGHTS_YAML_PATH = resolve(
  process.cwd(),
  '../../.moai/project/db/concern-score-weights.yaml',
);

/**
 * 5개 가중치 키 — 누락 검증에 사용.
 */
const REQUIRED_WEIGHT_KEYS = ['zombie', 'ghost', 'loop', 'director', 'multi_source'] as const;

/**
 * yaml 문자열에서 concern_score_weights 블록을 파싱하고 sum을 검증한다.
 * 5개 키 누락 또는 sum != 1.0 ± 0.001 시 throw.
 *
 * 외부 의존성을 회피하기 위해 30줄 minimal regex 파서 사용 — yaml 구조가 단순(5개 numeric key).
 *
 * @param content - yaml 파일 내용
 * @returns 검증된 ConcernWeights 객체
 * @throws Error - 키 누락 또는 sum 검증 실패 시
 */
export function parseAndValidateWeights(content: string): ConcernWeights {
  const weights: Partial<ConcernWeights> = {};

  // 각 라인에서 `<indent><key>: <number>` 패턴 매칭
  // 주석(#) 라인은 자동 무시 — 매칭 실패하므로 skip
  const lineRegex = /^\s+(zombie|ghost|loop|director|multi_source):\s*([0-9]+\.?[0-9]*)\s*$/;

  for (const rawLine of content.split('\n')) {
    const line = rawLine.replace(/#.*$/, ''); // inline 주석 제거
    const match = line.match(lineRegex);
    if (match) {
      const key = match[1] as keyof ConcernWeights;
      const value = Number.parseFloat(match[2] ?? '');
      if (Number.isFinite(value)) {
        weights[key] = value;
      }
    }
  }

  // 누락 키 검증
  const missing = REQUIRED_WEIGHT_KEYS.filter((k) => weights[k] === undefined);
  if (missing.length > 0) {
    throw new Error(`concern-score-weights yaml is missing required keys: ${missing.join(', ')}`);
  }

  // sum 검증 (AC-11)
  const w = weights as ConcernWeights;
  const sum = w.zombie + w.ghost + w.loop + w.director + w.multi_source;
  if (Math.abs(sum - 1.0) > 0.001) {
    throw new Error(
      `concern-score-weights sum validation failed: sum=${sum.toFixed(4)} (expected 1.0 ± 0.001). Check .moai/project/db/concern-score-weights.yaml`,
    );
  }

  return w;
}

/**
 * yaml 파일을 디스크에서 읽어 가중치를 파싱한다.
 * Module-level cache (CACHED_WEIGHTS)가 이미 채워져 있으면 바로 반환 — boot 시 1회 IO.
 *
 * @MX:WARN: [AUTO] yaml schema mismatch 시 부팅 중 throw — sum 검증은 첫 호출 시점에 강제 실행.
 * @MX:REASON: AC-11에 따라 sum 검증은 boot-time 강제. yaml 파일 변경 후 재시작 없이는 새 값 반영 안 됨 (hot-reload 미지원, MVP 결정).
 * @MX:SPEC: SPEC-RHI-001 REQ-003 / AC-11
 */
let CACHED_WEIGHTS: ConcernWeights | undefined;

/**
 * canonical yaml 파일에서 가중치를 한 번 로드해 메모리에 캐시.
 * Hot-reload 미지원 (MVP 결정).
 *
 * @returns 검증된 ConcernWeights
 * @throws Error - 파일 읽기 실패 또는 sum 검증 실패 시
 */
export function loadWeights(): ConcernWeights {
  if (CACHED_WEIGHTS) return CACHED_WEIGHTS;
  const content = readFileSync(WEIGHTS_YAML_PATH, 'utf8');
  CACHED_WEIGHTS = parseAndValidateWeights(content);
  return CACHED_WEIGHTS;
}

/**
 * Lens raw signal을 component 점수(가중치 적용된 기여분)로 변환한다.
 *
 * - zombie/ghost/loop_signal: identity (이미 0-100 변환됨)
 * - director_overlap: min(count * 10, 100)
 * - multi_source_count: count >= 2 ? 100 : 0
 *
 * plan.md §2B.3 매핑.
 */
function signalToScore(signals: LensSignals): {
  zombie: number;
  ghost: number;
  loop: number;
  director: number;
  multi_source: number;
} {
  return {
    zombie: signals.zombie_score,
    ghost: signals.ghost_score,
    loop: signals.loop_signal,
    director: Math.min(signals.director_overlap * 10, 100),
    multi_source: signals.multi_source_count >= 2 ? 100 : 0,
  };
}

/**
 * score 값을 ascending threshold에 매핑하여 tier를 결정한다.
 */
function scoreToTier(score: number): ConcernTier {
  if (score >= CONCERN_TIER_THRESHOLDS.CRITICAL) return 'Critical';
  if (score >= CONCERN_TIER_THRESHOLDS.HIGH) return 'High';
  if (score >= CONCERN_TIER_THRESHOLDS.MEDIUM) return 'Medium';
  if (score >= CONCERN_TIER_THRESHOLDS.LOW) return 'Low';
  return 'Healthy';
}

/**
 * 5개 lens signal에 yaml 가중치를 적용해 통합 Concern Score를 산출한다.
 * 결과는 결정론적: 동일 input → 동일 output.
 *
 * 공식 (plan.md §4.1):
 *   score = w_zombie * zombie_score
 *         + w_ghost * ghost_score
 *         + w_loop * loop_signal
 *         + w_director * min(director_overlap * 10, 100)
 *         + w_multi * (multi_source_count >= 2 ? 100 : 0)
 *
 * @param signals - 5개 lens raw signal
 * @returns score (0-100, 1자리 반올림), tier, per-component breakdown
 *
 * @MX:ANCHOR: [AUTO] fan_in_high — entity profile, ranking, lens 페이지 모두 호출.
 * @MX:REASON: REQ-003 단일 진입점. 가중치/tier 임계값 변경 시 score 분포 전체에 영향. AC-6 parametric formula의 단일 source.
 * @MX:SPEC: SPEC-RHI-001 REQ-003 / AC-6 / AC-11
 */
export function computeConcernScore(signals: LensSignals): ConcernScoreResult {
  const weights = loadWeights();
  const rawSignals = signalToScore(signals);

  const components = {
    zombie: weights.zombie * rawSignals.zombie,
    ghost: weights.ghost * rawSignals.ghost,
    loop: weights.loop * rawSignals.loop,
    director: weights.director * rawSignals.director,
    multi_source: weights.multi_source * rawSignals.multi_source,
  };

  const rawScore =
    components.zombie +
    components.ghost +
    components.loop +
    components.director +
    components.multi_source;

  // 1자리 반올림 — 결정론적 비교 가능
  const score = Math.round(rawScore * 10) / 10;
  const tier = scoreToTier(score);

  return { score, tier, components };
}
