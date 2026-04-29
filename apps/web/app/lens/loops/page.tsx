/**
 * Loops Lens 페이지 — REQ-005 Statement A.
 *
 * 매핑: SPEC-RHI-001 REQ-005 / AC-3 / AC-4
 */
import Link from 'next/link';

import { Header } from '@/components/layout/header';
import { getLoopRanking } from '@/lib/ranking/lens';

export const revalidate = 600;
export const runtime = 'nodejs';

const TIER_BG: Record<'A' | 'B' | 'C', string> = {
  A: 'bg-green-100 text-green-900 border-green-300',
  B: 'bg-yellow-100 text-yellow-900 border-yellow-300',
  C: 'bg-red-100 text-red-900 border-red-300',
};

export default async function LoopsLensPage(): Promise<React.ReactElement> {
  const rows = await getLoopRanking({ limit: 50 });

  // tier 분포
  const tierCounts = { A: 0, B: 0, C: 0 };
  for (const r of rows) {
    tierCounts[r.tier]++;
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Funding Loops</h1>
          <p className="mt-2 text-sm text-gray-600">
            Funding cycle patterns (cycle analysis). Tier A: legitimate (internal hierarchy / known
            hub). Tier C: concerning (data-quality flag or cross-org).
          </p>
        </header>

        <section className="mb-6 grid grid-cols-3 gap-4">
          {(['A', 'B', 'C'] as const).map((tier) => (
            <div
              key={tier}
              className={`rounded-lg border p-4 text-center shadow-sm ${TIER_BG[tier]}`}
            >
              <div className="text-xs font-semibold uppercase">Tier {tier}</div>
              <div className="mt-1 text-3xl font-bold tabular-nums">{tierCounts[tier]}</div>
              <div className="mt-1 text-xs">
                {tier === 'A' && 'Legitimate (internal/hub)'}
                {tier === 'B' && 'Observation'}
                {tier === 'C' && 'Concerning'}
              </div>
            </div>
          ))}
        </section>

        <section className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-gray-700">#</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-700">Loop ID</th>
                <th className="px-4 py-2 text-right font-semibold text-gray-700">Hops</th>
                <th className="px-4 py-2 text-right font-semibold text-gray-700">Total Flow</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-700">Tier</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-700">Rationale</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                    No data
                  </td>
                </tr>
              )}
              {rows.map((r, i) => (
                <tr key={r.loop_id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 tabular-nums text-gray-500">{i + 1}</td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/lens/loops/${r.loop_id}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      Loop #{r.loop_id}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.hops}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-600">
                    ${(r.total_flow / 1_000_000).toFixed(1)}M
                  </td>
                  <td className="px-4 py-2">
                    <span
                      data-testid="tier-badge"
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold uppercase ${TIER_BG[r.tier]}`}
                    >
                      Tier {r.tier}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-700">{r.classification_reasons[0]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </>
  );
}
