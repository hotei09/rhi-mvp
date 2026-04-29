import { ConcernHero } from '@/components/entity/concern-hero';
import { DetailsGrid } from '@/components/entity/details-grid';
import { FundingTimeline } from '@/components/entity/funding-timeline';
import { IdentityBlock } from '@/components/entity/identity-block';
import { LensSummary } from '@/components/entity/lens-summary';
/**
 * Entity Profile Page — REQ-004 / AC-6 / AC-12.
 *
 * Route: `/entity/[entityId]` — entityId is BN format (9 digits or 9+RR+4 = 15 chars).
 * Server Component (async) — direct DB calls, no client credential exposure.
 *
 * Layout (judge-friendly redesign):
 *   1. ConcernHero — big score, tier badge, "why this score" sentence
 *   2. IdentityBlock — compact identity panel + methodology popover
 *   3. LensSummary — 5 color-coded lens cards with raw drill-down
 *   4. FundingTimeline — stacked bar chart with per-source legend
 *   5. DetailsGrid — director matches + source breakdown
 *
 * Promise.all parallel fetch (AC-6) is handled inside fetchEntityData.
 * `revalidate: 60` ISR — warm TTFB < 1200ms target (AC-12).
 */
import { Header } from '@/components/layout/header';
import { MethodologyPopover } from '@/components/shared/methodology-popover';
import { fetchEntityData } from '@/lib/entity/profile-data';
import { notFound } from 'next/navigation';

export const revalidate = 60;
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type PageProps = {
  params: Promise<{ entityId: string }>;
};

export default async function EntityProfilePage({ params }: PageProps) {
  const { entityId } = await params;
  const data = await fetchEntityData(entityId);
  if (!data) notFound();

  return (
    <>
      <Header />
      <main className="bg-slate-50 pb-16">
        <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
          {/* HERO — Concern Score */}
          <ConcernHero
            legalName={data.identity.legal_name}
            bn={data.identity.bn}
            city={data.identity.city}
            province={data.identity.province}
            score={data.concern.score}
            tier={data.concern.tier}
            components={data.concern.components}
          />

          {/* IDENTITY + METHODOLOGY */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <IdentityBlock {...data.identity} />
            </div>
            <aside className="rounded-xl border border-slate-200 bg-white p-6">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                How we scored this
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                The Concern Score is a deterministic weighted sum of five independent lens signals.
                Click below for the formula and tier thresholds.
              </p>
              <div className="mt-3">
                <MethodologyPopover />
              </div>
            </aside>
          </div>

          {/* LENS GRID */}
          <div>
            <h2 className="text-xl font-bold text-slate-900">Five lens summary</h2>
            <p className="mt-1 text-sm text-slate-600">
              Each lens runs an independent SQL query. Cards are colored by score level — open any
              &quot;View raw rows&quot; button to inspect the underlying data.
            </p>
            <div className="mt-4">
              <LensSummary
                bn={data.identity.bn}
                zombie={data.lenses.zombie}
                ghost={data.lenses.ghost}
                loop={data.lenses.loop}
                director={data.lenses.director}
                multi_source={data.lenses.multi_source}
              />
            </div>
          </div>

          {/* FUNDING TIMELINE */}
          <FundingTimeline data={data.funding_timeline} />

          {/* DETAILS GRID — director + source breakdown */}
          <DetailsGrid director={data.lenses.director} multi_source={data.lenses.multi_source} />
        </div>
      </main>
    </>
  );
}
