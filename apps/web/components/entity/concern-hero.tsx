/**
 * Concern Hero — top band on entity profile page.
 *
 * Replaces the smaller ConcernCard with a larger, judge-friendly summary that
 * shows the score, tier, and an auto-generated "why this score" sentence
 * derived from the highest-contributing lens components.
 *
 * Server Component — pure presentational.
 *
 * @MX:SPEC: SPEC-RHI-001 REQ-004 (entity profile hero)
 */
import type { ConcernTier } from '@/lib/lenses/concern-score';

type LensKey = 'zombie' | 'ghost' | 'loop' | 'director' | 'multi_source';

const LENS_LABEL: Record<LensKey, string> = {
  zombie: 'Zombie',
  ghost: 'Ghost',
  loop: 'Loop',
  director: 'Director',
  multi_source: 'Multi-Source',
};

const TIER_STYLES: Record<
  ConcernTier,
  { box: string; badge: string; bar: string; description: string }
> = {
  Critical: {
    box: 'bg-red-50 border-red-300',
    badge: 'bg-red-600 text-white',
    bar: 'bg-red-500',
    description: 'Multiple lenses fire concurrently — needs human review.',
  },
  High: {
    box: 'bg-orange-50 border-orange-300',
    badge: 'bg-orange-600 text-white',
    bar: 'bg-orange-500',
    description: 'Strong signal in one or two lenses. Worth investigating.',
  },
  Medium: {
    box: 'bg-yellow-50 border-yellow-300',
    badge: 'bg-yellow-600 text-white',
    bar: 'bg-yellow-500',
    description: 'Notable signal — borderline.',
  },
  Low: {
    box: 'bg-blue-50 border-blue-300',
    badge: 'bg-blue-600 text-white',
    bar: 'bg-blue-500',
    description: 'Minor signal — likely benign.',
  },
  Healthy: {
    box: 'bg-green-50 border-green-300',
    badge: 'bg-green-600 text-white',
    bar: 'bg-green-500',
    description: 'No concerning patterns detected.',
  },
};

/**
 * Pick the top 2 contributing lenses to summarize in plain English.
 */
function topContributors(components: Record<LensKey, number>): LensKey[] {
  return (Object.keys(components) as LensKey[])
    .filter((k) => components[k] > 0)
    .sort((a, b) => components[b] - components[a])
    .slice(0, 2);
}

export type ConcernHeroProps = {
  legalName: string;
  bn: string;
  city: string | null;
  province: string | null;
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

export function ConcernHero({
  legalName,
  bn,
  city,
  province,
  score,
  tier,
  components,
}: ConcernHeroProps) {
  const style = TIER_STYLES[tier];
  const top = topContributors(components);
  const reasonText =
    top.length === 0
      ? 'No lens contributed a positive signal.'
      : top.length === 1
        ? `Driven by the ${LENS_LABEL[top[0] as LensKey]} signal.`
        : `Driven primarily by ${LENS_LABEL[top[0] as LensKey]} and ${LENS_LABEL[top[1] as LensKey]} signals.`;

  const displayScore = Math.round(score);
  const location = [city, province].filter(Boolean).join(', ');

  return (
    <section
      data-testid="concern-hero"
      data-tier={tier.toLowerCase()}
      className={`rounded-2xl border ${style.box} p-6 sm:p-8`}
    >
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        {/* LEFT — identity + reason */}
        <div className="min-w-0 flex-1">
          <span
            className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${style.badge}`}
          >
            Tier · {tier}
          </span>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {legalName}
          </h1>
          <p className="mt-1 font-mono text-sm text-slate-600">
            BN {bn}
            {location ? ` · ${location}` : ''}
          </p>
          <p className="mt-4 max-w-xl text-base text-slate-800">
            <span className="font-semibold">Why this score:</span> {reasonText} {style.description}
          </p>
        </div>

        {/* RIGHT — big score */}
        <div className="flex shrink-0 flex-col items-center sm:items-end">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Concern score
          </p>
          <p className="mt-1 text-7xl font-bold leading-none tabular-nums text-slate-900 sm:text-8xl">
            {displayScore}
          </p>
          <p className="mt-1 text-xs text-slate-500">out of 100</p>
        </div>
      </div>

      {/* Component breakdown bar */}
      <div className="mt-6 border-t border-slate-200/70 pt-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Component contribution (weighted)
        </p>
        <ul className="mt-3 space-y-2">
          {(Object.keys(components) as LensKey[]).map((key) => {
            const value = components[key];
            const pct = Math.min(100, value * 1.5); // scaled for visual differentiation
            return (
              <li key={key} className="grid grid-cols-[110px_1fr_50px] items-center gap-3">
                <span className="text-sm font-medium text-slate-700">{LENS_LABEL[key]}</span>
                <div className="h-2 rounded-full bg-slate-200">
                  <div
                    className={`h-2 rounded-full ${style.bar}`}
                    style={{ width: `${pct}%` }}
                    aria-hidden="true"
                  />
                </div>
                <span className="text-right text-sm tabular-nums text-slate-700">
                  {value.toFixed(1)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
