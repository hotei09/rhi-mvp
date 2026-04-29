/**
 * Methodology page — native English presentation for hackathon judges.
 *
 * Replaces the previous raw-markdown render of docs/methodology.md with a
 * structured TSX page focused on judge readability.
 *
 * Sections:
 *   1. What we built
 *   2. The 5 lenses
 *   3. Concern Score formula
 *   4. Tier thresholds (visual ladder)
 *   5. Data traps acknowledged (F-3 / F-1 / AC-9)
 *   6. Director disclaimer (AC-10)
 *   7. What we excluded (#4/#5/#7/#9/#10)
 *   8. Tech stack & attribution
 *
 * @MX:SPEC: SPEC-RHI-001 REQ-005 / AC-10 (director disclaimer documented)
 */
import { Header } from '@/components/layout/header';
import { TierBadge } from '@/components/shared/tier-badge';

export const revalidate = 3600;
export const runtime = 'nodejs';

type LensRow = {
  num: string;
  name: string;
  definition: string;
  tables: string;
  formula: string;
  example: string;
  weight: string;
};

const LENSES: LensRow[] = [
  {
    num: '#1',
    name: 'Zombie',
    definition: 'A government-funded charity that stopped filing CRA returns.',
    tables: 'cra.govt_funding_by_charity, cra.cra_financial_general',
    formula: 'last_fpe age vs last_funding_year — 0 / 30 / 60 / 80 / 100',
    example: 'BN 107460909RR0001 (North Bay Recovery Home)',
    weight: '0.30',
  },
  {
    num: '#2',
    name: 'Ghost',
    definition: 'Reported program spend is much smaller than total spend.',
    tables: 'cra.cra_financial_general',
    formula: 'program_ratio = program_expenditures / total_expenditures',
    example: 'program_ratio < 0.30 → score 100',
    weight: '0.25',
  },
  {
    num: '#3',
    name: 'Loop',
    definition: 'Money cycles between charities and returns to its source.',
    tables: 'cra.loops, cra.identified_hubs',
    formula: 'CASE: BN-root, hub-touch, plausibility, program-ratio',
    example: 'Loop #252 — $10.6M Tier C cross-org cycle',
    weight: '0.20',
  },
  {
    num: '#6',
    name: 'Director',
    definition: 'The same individuals appear on multiple charity boards.',
    tables: 'cra.cra_directors',
    formula: 'last_name + first_name + initials match across BNs',
    example: 'Signal only — see AC-10 disclaimer below',
    weight: '0.10',
  },
  {
    num: '#8',
    name: 'Multi-Source',
    definition: 'One entity receives FED + Provincial + CRA simultaneously.',
    tables: 'general.entity_source_links, *.grants tables',
    formula: 'count of distinct source_schema per entity_id',
    example: 'KidsAbility (BN 890943673RR0001) — 3-source overlap',
    weight: '0.15',
  },
];

type TierRow = {
  tier: 'Critical' | 'High' | 'Medium' | 'Low' | 'Healthy';
  range: string;
  description: string;
};

const TIERS: TierRow[] = [
  {
    tier: 'Critical',
    range: 'score ≥ 80',
    description: 'Multiple lenses fire concurrently — needs human review.',
  },
  {
    tier: 'High',
    range: '60 ≤ score < 80',
    description: 'Strong signal in 1–2 lenses, worth investigating.',
  },
  { tier: 'Medium', range: '40 ≤ score < 60', description: 'Notable signal — borderline.' },
  { tier: 'Low', range: '20 ≤ score < 40', description: 'Minor signal — likely benign.' },
  { tier: 'Healthy', range: 'score < 20', description: 'No concerning patterns detected.' },
];

type TrapCard = {
  code: string;
  title: string;
  problem: string;
  fix: string;
  impact: string;
};

const TRAPS: TrapCard[] = [
  {
    code: 'F-3',
    title: 'agreement_value triple counting',
    problem:
      'Federal grants are amended over time and the database stores every revision. A naïve SUM produces inflated totals.',
    fix: 'A window-function CTE (`withF3Dedup`) keeps only rn = 1 per ref_number ordered by amendment date.',
    impact: '$921.6B raw → $816.1B deduped (11.45% reduction across the FED dataset).',
  },
  {
    code: 'F-1',
    title: 'ref_number collisions',
    problem:
      'ref_number is not globally unique across federal grant programs — the same string can map to different agreements.',
    fix: 'We trust _id (the auto-incrementing primary key) only and treat ref_number as display metadata.',
    impact: 'Prevents incorrect joins between FED grants and entity_source_links.',
  },
  {
    code: 'AC-9',
    title: 'Government entity false positives',
    problem:
      'Crown corporations and federal agencies are listed as charities in CRA registries, contaminating the candidate set.',
    fix: '12 legal_name patterns excluded at the CTE stage via `buildGovtExclusionClause` before lens scoring runs.',
    impact: 'Removes large hub-mediated false positives from the ranking.',
  },
];

type ExcludedRow = { num: string; name: string; reason: string };

const EXCLUDED: ExcludedRow[] = [
  {
    num: '#4',
    name: 'Procurement contract overruns',
    reason: 'Not in scope — focuses on grants only.',
  },
  {
    num: '#5',
    name: 'Lobbying registry cross-reference',
    reason: 'Requires Lobbying Commissioner data outside the brief.',
  },
  {
    num: '#7',
    name: 'Real-time anomaly alerting',
    reason: 'MVP is batch; streaming infra is out of the 36-hour budget.',
  },
  {
    num: '#9',
    name: 'Beneficial-ownership tracing',
    reason: 'Requires corporate registry access we did not have.',
  },
  {
    num: '#10',
    name: 'Predictive risk modeling',
    reason: 'Without labeled fraud data we explicitly chose signals, not predictions.',
  },
];

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-12 text-2xl font-bold text-slate-900">{children}</h2>;
}

export default function MethodologyPage(): React.ReactElement {
  return (
    <>
      <Header />
      <main className="bg-slate-50 pb-16">
        {/* Hero */}
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-4xl px-4 pt-12 pb-8 sm:px-6 lg:px-8">
            <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-700">
              Methodology
            </span>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900">
              How the Recipient Health Index works
            </h1>
            <p className="mt-3 text-lg text-slate-600">
              We aggregated three open Canadian government datasets, classified concerning patterns
              through five independent lenses, and combined them into a single traceable score.
              Every number on every page links back to a raw row.
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          {/* 1. What we built */}
          <SectionHeading>1. What we built</SectionHeading>
          <p className="mt-3 text-base leading-relaxed text-slate-700">
            A read-only dashboard over 851K+ canonical entities synthesized from CRA T3010 charity
            returns, the federal Open Government grants registry, and the Alberta provincial grants
            registry. The system surfaces five accountability lenses, combines them into a weighted
            Concern Score (0–100), groups entities into five tiers (Critical → Healthy), and lets a
            reviewer drill from any score to the original SQL row that produced it.
          </p>

          {/* 2. The 5 lenses */}
          <SectionHeading>2. The five lenses</SectionHeading>
          <p className="mt-3 text-sm text-slate-600">
            Each lens is independent — failure in one does not silence the others. Weights are
            stored in{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
              .moai/project/db/concern-score-weights.yaml
            </code>{' '}
            and validated to sum to 1.0 ± 0.001 at boot (AC-11).
          </p>
          <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                    #
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Lens
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Definition
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Formula
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Weight
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {LENSES.map((l) => (
                  <tr key={l.name}>
                    <td className="px-3 py-3 align-top font-mono text-xs text-slate-500">
                      {l.num}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <span className="font-semibold text-slate-900">{l.name}</span>
                      <div className="mt-0.5 font-mono text-xs text-slate-500">{l.tables}</div>
                    </td>
                    <td className="px-3 py-3 align-top text-slate-700">
                      {l.definition}
                      <div className="mt-1 text-xs text-slate-500">e.g. {l.example}</div>
                    </td>
                    <td className="px-3 py-3 align-top font-mono text-xs text-slate-600">
                      {l.formula}
                    </td>
                    <td className="px-3 py-3 text-right align-top tabular-nums font-semibold text-slate-900">
                      {l.weight}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 3. Concern Score formula */}
          <SectionHeading>3. Concern Score formula</SectionHeading>
          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <pre className="overflow-x-auto text-sm font-mono text-slate-800 whitespace-pre">
              {`Concern = 0.30 · ZombieScore
        + 0.25 · GhostScore
        + 0.20 · LoopSignal
        + 0.10 · DirectorScore
        + 0.15 · MultiSourceScore`}
            </pre>
            <p className="mt-4 text-sm text-slate-600">
              Why these weights? Zombie and Ghost are the most directly defensible signals from
              public CRA data, so they carry the largest weight. Loop is heavier than Director
              because cycles are observable as joined rows, while director matches are necessarily
              probabilistic. Multi-Source sits between Loop and Ghost — a strong signal once entity
              resolution is established.
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Weights are loaded from YAML at boot and validated to sum to 1.0 ± 0.001 (AC-11) — any
              drift fails the build.
            </p>
          </div>

          {/* 4. Tier thresholds */}
          <SectionHeading>4. Tier thresholds</SectionHeading>
          <div className="mt-4 space-y-3">
            {TIERS.map((t) => (
              <div
                key={t.tier}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4"
              >
                <div className="flex items-center gap-4">
                  <TierBadge tier={t.tier} />
                  <div>
                    <p className="font-mono text-sm tabular-nums text-slate-700">{t.range}</p>
                    <p className="mt-0.5 text-sm text-slate-600">{t.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 5. Data traps */}
          <SectionHeading>5. Data traps acknowledged</SectionHeading>
          <p className="mt-3 text-sm text-slate-600">
            We did not just trust the source rows. The three traps below were caught during
            verification (
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">scripts/verify-db.ts</code>
            ) and patched before scoring.
          </p>
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
            {TRAPS.map((trap) => (
              <div
                key={trap.code}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <span className="inline-flex items-center rounded-md bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900">
                  {trap.code}
                </span>
                <h3 className="mt-2 text-base font-semibold text-slate-900">{trap.title}</h3>
                <p className="mt-2 text-sm text-slate-700">
                  <span className="font-semibold">Problem.</span> {trap.problem}
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  <span className="font-semibold">Fix.</span> {trap.fix}
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  <span className="font-semibold">Impact.</span> {trap.impact}
                </p>
              </div>
            ))}
          </div>

          {/* 6. Director disclaimer */}
          <SectionHeading>6. Director Disclaimer (AC-10)</SectionHeading>
          <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-6">
            <p className="text-sm text-slate-800">
              The Director lens reports overlap candidates only when{' '}
              <strong>last name + first name + first-letter initials</strong> match across multiple
              BNs. Without an external corporate registry we cannot disambiguate homonyms.
            </p>
            <p
              role="note"
              aria-label="director-disclaimer"
              className="mt-3 text-sm italic text-blue-900"
              style={{ fontSize: '14px' }}
            >
              signal only — not a fraud claim
            </p>
            <p className="mt-3 text-xs text-slate-600">
              The disclaimer renders inside every Director card on every entity page, with{' '}
              <code className="rounded bg-white px-1.5 py-0.5">role=&quot;note&quot;</code>,{' '}
              <code className="rounded bg-white px-1.5 py-0.5">aria-label</code>, and ≥14px font.
            </p>
          </div>

          {/* 7. What we excluded */}
          <SectionHeading>7. What we excluded (and why)</SectionHeading>
          <p className="mt-3 text-sm text-slate-600">
            The hackathon brief proposed ten challenges. We deliberately scoped to five lenses to
            preserve depth over breadth. The five we did not address:
          </p>
          <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Challenge
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Topic
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Reason for exclusion
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {EXCLUDED.map((row) => (
                  <tr key={row.num}>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{row.num}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
                    <td className="px-4 py-3 text-slate-600">{row.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 8. Tech stack */}
          <SectionHeading>8. Tech stack & attribution</SectionHeading>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-900">Application</h3>
              <p className="mt-2 text-sm text-slate-600">
                Next.js 16 App Router · React 19 Server Components · TypeScript 5.9 · Tailwind 4 ·
                Recharts.
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-900">Data layer</h3>
              <p className="mt-2 text-sm text-slate-600">
                PostgreSQL · postgres.js client · materialized CTEs for F-3 dedup · Vercel Postgres
                deployment.
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-900">Open data sources</h3>
              <p className="mt-2 text-sm text-slate-600">
                CRA T3010 charity returns · Federal Open Government grants registry · Alberta grants
                registry. All three are licensed under the Open Government Licence — Canada.
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-900">Hosting</h3>
              <p className="mt-2 text-sm text-slate-600">
                Vercel serverless · ISR (60s entity, 300s landing, 3600s methodology) · Edge cache
                for static assets.
              </p>
            </div>
          </div>

          <p className="mt-12 text-xs text-slate-500">
            Korean working notes are available at{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5">docs/methodology.md</code> in the{' '}
            <a
              href="https://github.com/hotei0518/Ottawa_hacker"
              target="_blank"
              rel="noreferrer noopener"
              className="text-blue-700 hover:underline"
            >
              GitHub repository
            </a>
            .
          </p>
        </div>
      </main>
    </>
  );
}
