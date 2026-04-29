/**
 * Lens Summary — REQ-004 entity profile 5개 lens 요약 카드 그리드.
 *
 * 각 lens당 카드 1개 + 점수/카운트 + raw drill-down 트리거 (Client Component drawer).
 * Director 카드는 AC-10 디스클레이머를 함께 렌더 (동일 부모 컨테이너 보장).
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
 * Lens summary 카드 묶음 props.
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
 * 5개 lens 요약 카드 — Server Component.
 */
export function LensSummary({ bn, zombie, ghost, loop, director, multi_source }: LensSummaryProps) {
  return (
    <section
      data-testid="lens-summary"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      {/* Zombie */}
      <article className="rounded-lg border bg-card p-4" data-lens="zombie">
        <h3 className="text-sm font-semibold uppercase tracking-wide">Zombie</h3>
        <p className="mt-2 text-3xl font-bold tabular-nums">{zombie.score}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {zombie.raw?.last_fpe ? `last fpe: ${zombie.raw.last_fpe}` : 'no recent filing data'}
        </p>
        <div className="mt-2">
          <RawRowDrawer label="View raw rows" bn={bn} lens="zombie" />
        </div>
      </article>

      {/* Ghost */}
      <article className="rounded-lg border bg-card p-4" data-lens="ghost">
        <h3 className="text-sm font-semibold uppercase tracking-wide">Ghost</h3>
        <p className="mt-2 text-3xl font-bold tabular-nums">{ghost.score}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {ghost.raw?.program_ratio !== null && ghost.raw?.program_ratio !== undefined
            ? `program ratio: ${(ghost.raw.program_ratio * 100).toFixed(1)}%`
            : 'no overhead data'}
        </p>
        <div className="mt-2">
          <RawRowDrawer label="View raw rows" bn={bn} lens="ghost" />
        </div>
      </article>

      {/* Loop */}
      <article className="rounded-lg border bg-card p-4" data-lens="loop">
        <h3 className="text-sm font-semibold uppercase tracking-wide">Loop</h3>
        <p className="mt-2 text-3xl font-bold tabular-nums">{loop.max_tier ?? '—'}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {loop.loop_count > 0
            ? `${loop.loop_count} loops • A:${loop.tiers.A} B:${loop.tiers.B} C:${loop.tiers.C}`
            : 'no loops'}
        </p>
        <div className="mt-2">
          <RawRowDrawer label="View raw rows" bn={bn} lens="loop" />
        </div>
      </article>

      {/* Director — AC-10 disclaimer 동일 카드 내 위치 보장 */}
      <article
        className="rounded-lg border bg-card p-4"
        data-testid="director-card"
        data-lens="director"
      >
        <h3 className="text-sm font-semibold uppercase tracking-wide">Director</h3>
        <p className="mt-2 text-3xl font-bold tabular-nums">{director.overlap_count}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {director.matches.length > 0
            ? `${director.matches.length} matching director(s)`
            : 'no overlap'}
        </p>
        <DirectorDisclaimer />
        <div className="mt-2">
          <RawRowDrawer label="View raw rows" bn={bn} lens="director" />
        </div>
      </article>

      {/* Multi-Source */}
      <article className="rounded-lg border bg-card p-4" data-lens="multi-source">
        <h3 className="text-sm font-semibold uppercase tracking-wide">Multi-Source</h3>
        <p className="mt-2 text-3xl font-bold tabular-nums">{multi_source.source_count}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          FED {formatCAD(multi_source.fed_total, { compact: true })} • AB{' '}
          {formatCAD(multi_source.ab_total, { compact: true })} • CRA{' '}
          {formatCAD(multi_source.cra_govt_total, { compact: true })}
        </p>
        <div className="mt-2">
          <RawRowDrawer label="View raw rows" bn={bn} lens="multi-source" />
        </div>
      </article>
    </section>
  );
}
