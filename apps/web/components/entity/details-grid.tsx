/**
 * Details Grid — entity profile bottom band.
 *
 * Two side-by-side panels:
 *   - Director Overlap Details: top 5 matched directors with co-listed BNs
 *   - Source Breakdown: per-source totals (FED / AB / CRA) and source_count
 *
 * Server Component — pure presentational.
 *
 * @MX:SPEC: SPEC-RHI-001 REQ-004 (entity profile)
 */
import Link from 'next/link';

import { formatCAD } from '@/lib/format/currency';
import type { DirectorOverlap } from '@/lib/lenses/director';
import type { MultiSourceResult } from '@/lib/lenses/multi-source';

export type DetailsGridProps = {
  director: DirectorOverlap;
  multi_source: MultiSourceResult;
};

export function DetailsGrid({ director, multi_source }: DetailsGridProps) {
  const topMatches = director.matches.slice(0, 5);

  return (
    <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Director details */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
          Director overlap details
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Top {Math.min(5, topMatches.length)} matched directors with co-listed BNs (signal only)
        </p>

        {topMatches.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No director overlap detected.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {topMatches.map((match) => (
              <li key={`${match.last_name}-${match.first_name}-${match.initials}`} className="py-3">
                <p className="text-sm font-medium text-slate-900">
                  {match.last_name}, {match.first_name}
                  {match.initials ? ` (${match.initials})` : ''}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {match.matched_bns.length} co-listed BN
                  {match.matched_bns.length === 1 ? '' : 's'}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {match.matched_bns.slice(0, 6).map((bn) => (
                    <Link
                      key={bn}
                      href={`/entity/${bn}`}
                      className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700 hover:bg-slate-200 hover:text-blue-700"
                    >
                      {bn}
                    </Link>
                  ))}
                  {match.matched_bns.length > 6 ? (
                    <span className="inline-flex items-center px-2 py-0.5 text-xs text-slate-500">
                      +{match.matched_bns.length - 6} more
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Source breakdown */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
          Source breakdown
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Funding totals across federal, provincial, and CRA-reported government transfers
        </p>

        <dl className="mt-4 divide-y divide-slate-100">
          <div className="flex items-center justify-between py-3">
            <dt className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-700" aria-hidden />
              Federal grants (deduped)
            </dt>
            <dd className="text-base font-semibold tabular-nums text-slate-900">
              {formatCAD(multi_source.fed_total, { compact: true })}
            </dd>
          </div>
          <div className="flex items-center justify-between py-3">
            <dt className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-700" aria-hidden />
              Alberta grants
            </dt>
            <dd className="text-base font-semibold tabular-nums text-slate-900">
              {formatCAD(multi_source.ab_total, { compact: true })}
            </dd>
          </div>
          <div className="flex items-center justify-between py-3">
            <dt className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-700" aria-hidden />
              CRA gov-transfers (reported)
            </dt>
            <dd className="text-base font-semibold tabular-nums text-slate-900">
              {formatCAD(multi_source.cra_govt_total, { compact: true })}
            </dd>
          </div>
          <div className="flex items-center justify-between py-3">
            <dt className="text-sm font-medium text-slate-700">Same-year overlap</dt>
            <dd className="text-base font-semibold tabular-nums text-slate-900">
              {multi_source.same_year_overlap}
            </dd>
          </div>
          <div className="flex items-center justify-between py-3">
            <dt className="text-sm font-medium text-slate-700">Source count</dt>
            <dd className="text-base font-semibold tabular-nums text-slate-900">
              {multi_source.source_count} / 3
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
