/**
 * Lens Summary — REQ-004 entity profile 5-lens summary card grid.
 *
 * Each lens renders a card with score + signal indicators + raw-row drill-down.
 * Color-coded by score level (red >= 80, orange 60-79, yellow 40-59, blue 20-39, green < 20).
 * Director card includes AC-10 disclaimer in the same parent container.
 */
import { DirectorDisclaimer } from '@/components/entity/director-disclaimer';
import { RawRowDrawer } from '@/components/entity/raw-row-drawer';
import { formatCAD } from '@/lib/format/currency';
import type { DirectorOverlap } from '@/lib/lenses/director';
import type { GhostResult } from '@/lib/lenses/ghost';
import type { LoopParticipation } from '@/lib/lenses/loop';
import type { MultiSourceResult } from '@/lib/lenses/multi-source';
import type { ZombieResult } from '@/lib/lenses/zombie';

/**
 * Lens summary card group props.
 */
export type LensSummaryProps = {
  bn: string;
  zombie: ZombieResult;
  ghost: GhostResult;
  loop: LoopParticipation;
  director: DirectorOverlap;
  multi_source: MultiSourceResult;
};

/**
 * Map a 0-100 score to a card color theme.
 */
function scoreTheme(score: number): { box: string; chip: string; label: string } {
  if (score >= 80) {
    return {
      box: 'border-red-300 bg-red-50',
      chip: 'bg-red-600 text-white',
      label: 'High',
    };
  }
  if (score >= 60) {
    return {
      box: 'border-orange-300 bg-orange-50',
      chip: 'bg-orange-500 text-white',
      label: 'Elevated',
    };
  }
  if (score >= 40) {
    return {
      box: 'border-yellow-300 bg-yellow-50',
      chip: 'bg-yellow-500 text-white',
      label: 'Notable',
    };
  }
  if (score >= 20) {
    return {
      box: 'border-blue-200 bg-blue-50',
      chip: 'bg-blue-500 text-white',
      label: 'Low',
    };
  }
  return {
    box: 'border-slate-200 bg-white',
    chip: 'bg-slate-300 text-slate-700',
    label: 'None',
  };
}

/**
 * 5-lens summary cards — Server Component.
 */
export function LensSummary({ bn, zombie, ghost, loop, director, multi_source }: LensSummaryProps) {
  // Loop signal: A=0, B=50, C=100
  const loopSignal = loop.max_tier === 'C' ? 100 : loop.max_tier === 'B' ? 50 : 0;
  // Director synthetic score: min(count*10, 100) for theme matching
  const directorSyntheticScore = Math.min(director.overlap_count * 10, 100);
  // Multi-source synthetic score: 100 if 2+ sources else 0
  const multiSyntheticScore = multi_source.source_count >= 2 ? 100 : 0;

  const zombieTheme = scoreTheme(zombie.score);
  const ghostTheme = scoreTheme(ghost.score);
  const loopTheme = scoreTheme(loopSignal);
  const directorTheme = scoreTheme(directorSyntheticScore);
  const multiTheme = scoreTheme(multiSyntheticScore);

  return (
    <section
      data-testid="lens-summary"
      aria-label="Five lens summary"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      {/* Zombie */}
      <article className={`rounded-xl border p-5 ${zombieTheme.box}`} data-lens="zombie">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Zombie</h3>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${zombieTheme.chip}`}
          >
            {zombieTheme.label}
          </span>
        </div>
        <p className="mt-3 text-4xl font-bold tabular-nums text-slate-900">{zombie.score}</p>
        <p className="mt-1 text-xs text-slate-500">stale-filing score (0/30/60/80/100)</p>
        <div className="mt-3 space-y-1 text-xs text-slate-700">
          {zombie.raw?.last_fpe ? (
            <p>
              <span className="font-semibold">Last filing:</span> {zombie.raw.last_fpe}
            </p>
          ) : (
            <p className="text-slate-500">No recent filing data.</p>
          )}
          {zombie.raw?.months_since_filing != null ? (
            <p>
              <span className="font-semibold">Months since:</span>{' '}
              {Math.round(zombie.raw.months_since_filing)}
            </p>
          ) : null}
          {zombie.raw?.total_funding != null ? (
            <p>
              <span className="font-semibold">Total govt funding:</span>{' '}
              {formatCAD(zombie.raw.total_funding, { compact: true })}
            </p>
          ) : null}
        </div>
        <div className="mt-3">
          <RawRowDrawer label="View raw rows →" bn={bn} lens="zombie" />
        </div>
      </article>

      {/* Ghost */}
      <article className={`rounded-xl border p-5 ${ghostTheme.box}`} data-lens="ghost">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Ghost</h3>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${ghostTheme.chip}`}
          >
            {ghostTheme.label}
          </span>
        </div>
        <p className="mt-3 text-4xl font-bold tabular-nums text-slate-900">{ghost.score}</p>
        <p className="mt-1 text-xs text-slate-500">overhead-vs-program score</p>
        <div className="mt-3 text-xs text-slate-700">
          {ghost.raw?.program_ratio !== null && ghost.raw?.program_ratio !== undefined ? (
            <p>
              <span className="font-semibold">Program ratio:</span>{' '}
              {(ghost.raw.program_ratio * 100).toFixed(1)}%
            </p>
          ) : (
            <p className="text-slate-500">No overhead data.</p>
          )}
        </div>
        <div className="mt-3">
          <RawRowDrawer label="View raw rows →" bn={bn} lens="ghost" />
        </div>
      </article>

      {/* Loop */}
      <article className={`rounded-xl border p-5 ${loopTheme.box}`} data-lens="loop">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Loop</h3>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${loopTheme.chip}`}
          >
            {loop.max_tier ? `Tier ${loop.max_tier}` : 'None'}
          </span>
        </div>
        <p className="mt-3 text-4xl font-bold tabular-nums text-slate-900">
          {loop.max_tier ?? '—'}
        </p>
        <p className="mt-1 text-xs text-slate-500">highest-tier cycle membership</p>
        <div className="mt-3 text-xs text-slate-700">
          {loop.loop_count > 0 ? (
            <>
              <p>
                <span className="font-semibold">{loop.loop_count}</span> loop participation(s)
              </p>
              <p className="mt-1 text-slate-500">
                Tier A: {loop.tiers.A} · Tier B: {loop.tiers.B} · Tier C: {loop.tiers.C}
              </p>
            </>
          ) : (
            <p className="text-slate-500">No loop participation.</p>
          )}
        </div>
        <div className="mt-3">
          <RawRowDrawer label="View raw rows →" bn={bn} lens="loop" />
        </div>
      </article>

      {/* Director — AC-10 disclaimer in same parent container */}
      <article
        className={`rounded-xl border p-5 ${directorTheme.box}`}
        data-testid="director-card"
        data-lens="director"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Director</h3>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${directorTheme.chip}`}
          >
            {directorTheme.label}
          </span>
        </div>
        <p className="mt-3 text-4xl font-bold tabular-nums text-slate-900">
          {director.overlap_count}
        </p>
        <p className="mt-1 text-xs text-slate-500">overlap count across funded BNs</p>
        <div className="mt-3 text-xs text-slate-700">
          {director.matches.length > 0 ? (
            <p>
              <span className="font-semibold">{director.matches.length}</span> matching director(s)
            </p>
          ) : (
            <p className="text-slate-500">No overlap detected.</p>
          )}
        </div>
        <DirectorDisclaimer />
        <div className="mt-3">
          <RawRowDrawer label="View raw rows →" bn={bn} lens="director" />
        </div>
      </article>

      {/* Multi-Source */}
      <article className={`rounded-xl border p-5 ${multiTheme.box}`} data-lens="multi-source">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
            Multi-Source
          </h3>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${multiTheme.chip}`}
          >
            {multi_source.source_count}/3 sources
          </span>
        </div>
        <p className="mt-3 text-4xl font-bold tabular-nums text-slate-900">
          {multi_source.source_count}
        </p>
        <p className="mt-1 text-xs text-slate-500">distinct funding sources</p>
        <div className="mt-3 space-y-0.5 text-xs text-slate-700">
          <p>
            <span className="inline-block w-10 font-semibold">FED:</span>{' '}
            {formatCAD(multi_source.fed_total, { compact: true })}
          </p>
          <p>
            <span className="inline-block w-10 font-semibold">AB:</span>{' '}
            {formatCAD(multi_source.ab_total, { compact: true })}
          </p>
          <p>
            <span className="inline-block w-10 font-semibold">CRA:</span>{' '}
            {formatCAD(multi_source.cra_govt_total, { compact: true })}
          </p>
        </div>
        <div className="mt-3">
          <RawRowDrawer label="View raw rows →" bn={bn} lens="multi-source" />
        </div>
      </article>
    </section>
  );
}
