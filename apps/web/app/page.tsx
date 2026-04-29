/**
 * Landing page — judge-friendly redesign for AI for Accountability Hackathon.
 *
 * Sections:
 *   A. Hero band — title + 4 macro stats + 3 demo CTA cards
 *   B. Challenge map — 5 lens cards mapping to challenges #1, #2, #3, #6, #8
 *   C. High Concern Top 20 ranking table
 *   D. Methodology / data sources / source code footer
 *
 * Server Component — DB queries via Promise.all; ISR cache 5 min (revalidate 300).
 *
 * @MX:SPEC: SPEC-RHI-001 REQ-005 (judge presentation)
 */
import Link from 'next/link';

import { Header } from '@/components/layout/header';
import { TierBadge } from '@/components/shared/tier-badge';
import { formatCAD } from '@/lib/format/currency';
import { getLandingRanking } from '@/lib/ranking/landing';
import { getGlobalStats } from '@/lib/ranking/stats';

export const revalidate = 300;
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Format a large integer with thousand separators (e.g., 851000 -> "851K+").
 */
function formatCompactCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M+`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K+`;
  return n.toLocaleString('en-CA');
}

/**
 * Demo CTA card — links judge directly to a curated example.
 */
function DemoCard({
  href,
  label,
  title,
  subtitle,
  accent,
}: {
  href: string;
  label: string;
  title: string;
  subtitle: string;
  accent: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md"
    >
      <span
        className={`inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${accent}`}
      >
        {label}
      </span>
      <h3 className="mt-3 text-base font-semibold text-slate-900 group-hover:text-blue-700">
        {title}
      </h3>
      <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
      <span className="mt-4 inline-flex items-center text-sm font-medium text-blue-600">
        Open profile
        <svg
          aria-hidden="true"
          className="ml-1 h-4 w-4 transition group-hover:translate-x-0.5"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
            clipRule="evenodd"
          />
        </svg>
      </span>
    </Link>
  );
}

/**
 * Macro stat block in the hero band.
 */
function StatBlock({ value, label, hint }: { value: string; label: string; hint?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-3xl font-bold tabular-nums text-slate-900 sm:text-4xl">{value}</span>
      <span className="mt-1 text-sm font-medium text-slate-700">{label}</span>
      {hint ? <span className="mt-0.5 text-xs text-slate-500">{hint}</span> : null}
    </div>
  );
}

/**
 * Challenge map card — one per lens.
 */
function ChallengeCard({
  num,
  lens,
  problem,
  approach,
  count,
  countLabel,
  href,
  accent,
  border,
}: {
  num: string;
  lens: string;
  problem: string;
  approach: string;
  count: number;
  countLabel: string;
  href: string;
  accent: string;
  border: string;
}) {
  return (
    <Link
      href={href}
      className={`group flex flex-col rounded-xl border ${border} bg-white p-5 transition hover:shadow-md`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${accent}`}
        >
          Challenge {num}
        </span>
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{lens}</span>
      </div>
      <h3 className="mt-3 text-base font-semibold text-slate-900">{problem}</h3>
      <p className="mt-2 text-sm text-slate-600">{approach}</p>
      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-2xl font-bold tabular-nums text-slate-900">
          {count.toLocaleString('en-CA')}
        </span>
        <span className="text-xs text-slate-500">{countLabel}</span>
      </div>
      <span className="mt-3 inline-flex items-center text-xs font-medium text-blue-600 group-hover:underline">
        Explore lens
        <svg aria-hidden="true" className="ml-1 h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
            clipRule="evenodd"
          />
        </svg>
      </span>
    </Link>
  );
}

/**
 * Footer link card.
 */
function FooterCard({
  title,
  description,
  href,
  external,
}: {
  title: string;
  description: string;
  href: string;
  external?: boolean;
}) {
  const linkProps = external
    ? { target: '_blank', rel: 'noreferrer noopener' as const }
    : ({} as Record<string, never>);
  return (
    <Link
      href={href}
      {...linkProps}
      className="block rounded-lg border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:bg-slate-50"
    >
      <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
      <p className="mt-1 text-xs text-slate-600">{description}</p>
    </Link>
  );
}

/**
 * Landing page — hero + challenge map + ranking + footer.
 */
export default async function HomePage(): Promise<React.ReactElement> {
  const [stats, ranking] = await Promise.all([getGlobalStats(), getLandingRanking({ limit: 20 })]);

  return (
    <>
      <Header />
      <main className="bg-slate-50 pb-16">
        {/* SECTION A — HERO */}
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 pt-12 pb-10 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-700">
                AI for Accountability Hackathon · Ottawa 2026
              </span>
              <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
                Recipient Health Index
              </h1>
              <p className="mt-3 text-lg text-slate-600">
                Canadian government funding accountability — five lenses, one score, every signal
                traceable to its raw data row.
              </p>
            </div>

            {/* Macro stats band */}
            <div className="mt-10 grid grid-cols-2 gap-6 border-t border-slate-200 pt-8 sm:grid-cols-4">
              <StatBlock
                value={formatCompactCount(stats.totalEntities)}
                label="canonical entities"
                hint="general.entity_golden_records"
              />
              <StatBlock
                value={stats.totalCycles.toLocaleString('en-CA')}
                label="cycles classified"
                hint="cra.loops Tier A/B/C"
              />
              <StatBlock
                value={`${formatCAD(stats.fedDedupTotal, { compact: true })}`}
                label="FED grants deduped"
                hint={`from ${formatCAD(stats.fedRawTotal, { compact: true })} raw (F-3 trap)`}
              />
              <StatBlock
                value={String(stats.govtExclusionPatterns)}
                label="govt patterns excluded"
                hint="AC-9 false-positive guard"
              />
            </div>

            {/* Demo CTAs */}
            <div className="mt-10">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                Try the live demo
              </h2>
              <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
                <DemoCard
                  href="/entity/107460909RR0001"
                  label="Zombie pattern"
                  title="North Bay Recovery Home"
                  subtitle="$1.29M unclaimed funding · 6-year filing gap"
                  accent="bg-red-50 text-red-700"
                />
                <DemoCard
                  href="/lens/loops/252"
                  label="Loop Tier C"
                  title="Cross-org cycle #252"
                  subtitle="$10.6M flow across multiple BNs"
                  accent="bg-yellow-50 text-yellow-800"
                />
                <DemoCard
                  href="/entity/890943673RR0001"
                  label="Multi-source hit"
                  title="KidsAbility"
                  subtitle="3-lens overlap · FED + AB + CRA"
                  accent="bg-green-50 text-green-700"
                />
              </div>
            </div>
          </div>
        </section>

        {/* SECTION B — CHALLENGE MAP */}
        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h2 className="text-2xl font-bold text-slate-900">Five lenses, five challenges</h2>
            <p className="mt-2 text-sm text-slate-600">
              Each lens addresses a specific accountability question raised by the hackathon brief.
              Live counts below come from the production database.
            </p>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <ChallengeCard
              num="#1"
              lens="Zombie"
              problem="Government funding paid to charities that stopped filing"
              approach="CRA filing date vs last govt-funded fiscal year"
              count={stats.zombieCount}
              countLabel="charities · last filing > 18 months stale"
              href="/lens/zombie"
              accent="bg-red-100 text-red-800"
              border="border-red-200"
            />
            <ChallengeCard
              num="#2"
              lens="Ghost"
              problem="Spending classified as program but driven by overhead"
              approach="charitable_program_expenditures / total_expenditures < 0.30"
              count={stats.ghostCount}
              countLabel="charities · program ratio < 30%"
              href="/lens/ghost"
              accent="bg-orange-100 text-orange-800"
              border="border-orange-200"
            />
            <ChallengeCard
              num="#3"
              lens="Loop"
              problem="Money moves between related charities then back to source"
              approach="3-stage CASE classification with hub/internal-hierarchy guards"
              count={stats.tierCDistinctLoops}
              countLabel="distinct cycles classified"
              href="/lens/loops"
              accent="bg-yellow-100 text-yellow-800"
              border="border-yellow-200"
            />
            <ChallengeCard
              num="#6"
              lens="Director"
              problem="Same individuals on multiple charity boards"
              approach="last+first+initials match across BNs (signal only)"
              count={stats.directorOverlapCount}
              countLabel="overlap candidates"
              href="/methodology"
              accent="bg-blue-100 text-blue-800"
              border="border-blue-200"
            />
            <ChallengeCard
              num="#8"
              lens="Multi-Source"
              problem="One entity drawing from FED + Provincial + CRA simultaneously"
              approach="entity_id resolution across 3 source schemas with F-3 dedup"
              count={stats.multiSourceCount}
              countLabel="entities funded by 2+ sources"
              href="/methodology"
              accent="bg-green-100 text-green-800"
              border="border-green-200"
            />

            {/* Methodology entry card to fill the 6th slot */}
            <Link
              href="/methodology"
              className="group flex flex-col justify-between rounded-xl border border-slate-300 bg-slate-100 p-5 transition hover:border-slate-400 hover:bg-slate-200"
            >
              <div>
                <span className="inline-flex items-center rounded-md bg-slate-200 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-slate-700">
                  How it works
                </span>
                <h3 className="mt-3 text-base font-semibold text-slate-900">
                  Concern Score formula + data traps
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  Weights, tier thresholds, F-3 / F-1 traps acknowledged, AC-10 director disclaimer,
                  out-of-scope challenges.
                </p>
              </div>
              <span className="mt-4 inline-flex items-center text-sm font-medium text-blue-700 group-hover:underline">
                Read methodology →
              </span>
            </Link>
          </div>
        </section>

        {/* SECTION C — RANKING TABLE */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h2 className="text-2xl font-bold text-slate-900">High concern · top 20</h2>
            <p className="mt-2 text-sm text-slate-600">
              Heuristic ranking using the Zombie signal — a stale-filing pattern that flags
              recipients who stopped filing while still on government records. The full 5-lens
              integrated Concern Score is on each entity profile page.
            </p>
          </div>

          <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="w-12 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                    #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Entity
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Tier
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Score
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Top lens
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Last funding year
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ranking.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      No data
                    </td>
                  </tr>
                ) : (
                  ranking.map((row, i) => {
                    const href = `/entity/${row.bn}`;
                    return (
                      <tr key={row.bn} className="cursor-pointer transition hover:bg-slate-50">
                        <td className="px-4 py-3 tabular-nums text-slate-500">{i + 1}</td>
                        <td className="px-4 py-3">
                          <Link href={href} className="font-medium text-blue-700 hover:underline">
                            {row.legal_name}
                          </Link>
                          <div className="mt-0.5 font-mono text-xs text-slate-500">BN {row.bn}</div>
                        </td>
                        <td className="px-4 py-3">
                          <TierBadge tier={row.tier} />
                        </td>
                        <td className="px-4 py-3 text-right text-base font-semibold tabular-nums text-slate-900">
                          {row.score.toFixed(1)}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-700">{row.top_lens}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                          {row.last_funding_year ?? '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Click any row to open the full 5-lens entity profile with raw-row drill-down.
          </p>
        </section>

        {/* SECTION D — FOOTER */}
        <section className="mx-auto mt-12 max-w-7xl border-t border-slate-200 px-4 pt-10 sm:px-6 lg:px-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
            For the judges
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FooterCard
              title="Methodology · data traps"
              description="Concern Score formula, tier ladder, F-3 / F-1 / AC-9 acknowledged."
              href="/methodology"
            />
            <FooterCard
              title="GitHub source"
              description="Full repo with SPEC, queries, and data-issues notes."
              href="https://github.com/hotei0518/Ottawa_hacker"
              external
            />
            <FooterCard
              title="Data sources"
              description="CRA T3010, Federal Open Government grants, Alberta grants registry."
              href="https://open.canada.ca/en/open-data"
              external
            />
            <FooterCard
              title="Tech stack"
              description="Next.js 16 · TypeScript · PostgreSQL · Vercel · Recharts."
              href="https://github.com/hotei0518/Ottawa_hacker#tech-stack"
              external
            />
          </div>
        </section>
      </main>
    </>
  );
}
