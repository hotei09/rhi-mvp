/**
 * Lens 모듈 barrel export — REQ-002 5개 lens + REQ-003 concern score.
 *
 * 사용:
 *   import { getZombieScore, getGhostScore, computeConcernScore } from '@/lib/lenses';
 */
export { computeConcernScore, loadWeights, CONCERN_TIER_THRESHOLDS } from './concern-score';
export type {
  ConcernScoreResult,
  ConcernTier,
  ConcernWeights,
  LensSignals,
} from './concern-score';

export { getZombieScore } from './zombie';
export type { ZombieResult, ZombieRow } from './zombie';

export { getGhostScore } from './ghost';
export type { GhostResult, GhostRow } from './ghost';

export { classifyLoop, getLoopClassification, getLoopParticipation } from './loop';
export type {
  LoopClassification,
  LoopMetaInput,
  LoopParticipation,
  LoopTier,
} from './loop';

export { getDirectorOverlap } from './director';
export type { DirectorMatch, DirectorOverlap } from './director';

export { getMultiSourceFunding } from './multi-source';
export type { MultiSourceResult } from './multi-source';
