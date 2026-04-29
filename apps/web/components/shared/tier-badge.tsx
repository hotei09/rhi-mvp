/**
 * Tier 시각 배지 — 5개 페이지에서 공통 사용 (랜딩 + 렌즈별).
 *
 * 매핑: SPEC-RHI-001 REQ-005 Statement A
 */
import type { ConcernTier } from '@/lib/lenses/concern-score';

const TIER_BG: Record<ConcernTier, string> = {
  Critical: 'bg-red-100 text-red-900 border-red-300',
  High: 'bg-orange-100 text-orange-900 border-orange-300',
  Medium: 'bg-yellow-100 text-yellow-900 border-yellow-300',
  Low: 'bg-blue-100 text-blue-900 border-blue-300',
  Healthy: 'bg-green-100 text-green-900 border-green-300',
};

/**
 * Tier 배지 — span 요소.
 */
export function TierBadge({ tier }: { tier: ConcernTier }): React.ReactElement {
  return (
    <span
      data-testid="tier-badge"
      data-tier={tier.toLowerCase()}
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold uppercase ${TIER_BG[tier]}`}
    >
      {tier}
    </span>
  );
}
