/**
 * Concern Score Card — REQ-003 / REQ-004 통합 점수 카드.
 *
 * AC-6: 5개 lens 가중합 결과를 점수 + tier 배지 + per-component breakdown으로 표시.
 *
 * Server Component (no 'use client') — 정적 렌더만 수행.
 */
import type { ConcernTier } from '@/lib/lenses/concern-score';

/**
 * Concern Score Card props.
 */
export type ConcernCardProps = {
  /** 통합 점수 (0-100, 1자리 반올림된 값). */
  score: number;
  /** Tier 분류 — Critical/High/Medium/Low/Healthy. */
  tier: ConcernTier;
  /** 5개 lens별 weighted contribution. */
  components: {
    zombie: number;
    ghost: number;
    loop: number;
    director: number;
    multi_source: number;
  };
};

/**
 * Tier별 시각적 마커 클래스 매핑.
 * Tailwind 색상 + tier 식별용 data-attribute로 시각적/의미적 구분.
 */
const TIER_VISUAL: Record<ConcernTier, { bg: string; label: string }> = {
  Critical: { bg: 'bg-red-100 text-red-900 border-red-300', label: 'Critical' },
  High: { bg: 'bg-orange-100 text-orange-900 border-orange-300', label: 'High' },
  Medium: { bg: 'bg-yellow-100 text-yellow-900 border-yellow-300', label: 'Medium' },
  Low: { bg: 'bg-blue-100 text-blue-900 border-blue-300', label: 'Low' },
  Healthy: { bg: 'bg-green-100 text-green-900 border-green-300', label: 'Healthy' },
};

/**
 * 5개 lens 컴포넌트 라벨 (Korean + English mix — UI label로 직접 노출).
 */
const COMPONENT_LABELS: Array<{ key: keyof ConcernCardProps['components']; label: string }> = [
  { key: 'zombie', label: 'Zombie' },
  { key: 'ghost', label: 'Ghost' },
  { key: 'loop', label: 'Loop' },
  { key: 'director', label: 'Director' },
  { key: 'multi_source', label: 'Multi-Source' },
];

/**
 * 통합 Concern Score 카드.
 *
 * @example
 *   <ConcernCard score={58} tier="Medium" components={{...}} />
 */
export function ConcernCard({ score, tier, components }: ConcernCardProps) {
  const tierVisual = TIER_VISUAL[tier];
  const displayScore = Math.round(score);

  return (
    <section
      data-testid="concern-card"
      data-tier={tier.toLowerCase()}
      className={`rounded-lg border p-6 ${tierVisual.bg}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm uppercase tracking-wide opacity-70">Concern Score</h2>
          <p className="mt-2 text-5xl font-bold tabular-nums">{displayScore}</p>
        </div>
        <span
          className="rounded-full border px-4 py-1 text-sm font-semibold uppercase"
          data-testid="tier-badge"
        >
          {tierVisual.label}
        </span>
      </div>

      <div className="mt-6 space-y-2">
        <h3 className="text-xs uppercase tracking-wide opacity-70">Component Breakdown</h3>
        <ul className="space-y-1">
          {COMPONENT_LABELS.map(({ key, label }) => {
            const value = components[key];
            return (
              <li key={key} className="flex items-center justify-between text-sm">
                <span>{label}</span>
                <span className="tabular-nums">{value.toFixed(1)}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
