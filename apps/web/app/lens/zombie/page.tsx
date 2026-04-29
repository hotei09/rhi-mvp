/**
 * Zombie Lens 페이지 — REQ-005 Statement A.
 *
 * 매핑: SPEC-RHI-001 REQ-005 / AC-2 / AC-9
 */
import Link from 'next/link';

import { Header } from '@/components/layout/header';
import { getZombieRanking } from '@/lib/ranking/lens';

export const revalidate = 600;
export const runtime = 'nodejs';

export default async function ZombieLensPage(): Promise<React.ReactElement> {
  const rows = await getZombieRanking({ limit: 50 });

  // score 분포
  const distribution: Record<number, number> = { 30: 0, 60: 0, 80: 0, 100: 0 };
  for (const r of rows) {
    if (distribution[r.zombie_score] !== undefined) {
      distribution[r.zombie_score] = (distribution[r.zombie_score] ?? 0) + 1;
    }
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Zombie Recipients</h1>
          <p className="mt-2 text-sm text-gray-600">
            정부 자금 (govt_share ≥ 0.7) 수령 후 filing 중단 패턴 — 단계별 점수 30/60/80/100.
          </p>
        </header>

        <section className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[30, 60, 80, 100].map((score) => (
            <div
              key={score}
              className="rounded-lg border border-gray-200 bg-white p-4 text-center shadow-sm"
            >
              <div className="text-xs font-medium text-gray-500">Score {score}</div>
              <div className="mt-1 text-2xl font-bold tabular-nums text-gray-900">
                {distribution[score] ?? 0}
              </div>
            </div>
          ))}
        </section>

        <section className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-gray-700">#</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-700">단체명</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-700">BN</th>
                <th className="px-4 py-2 text-right font-semibold text-gray-700">Score</th>
                <th className="px-4 py-2 text-right font-semibold text-gray-700">자금연도</th>
                <th className="px-4 py-2 text-right font-semibold text-gray-700">Total Funding</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                    데이터 없음
                  </td>
                </tr>
              )}
              {rows.map((r, i) => (
                <tr key={r.bn} className="hover:bg-gray-50">
                  <td className="px-4 py-2 tabular-nums text-gray-500">{i + 1}</td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/entity/${r.bn}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {r.legal_name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-600">{r.bn}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-semibold">
                    {r.zombie_score}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-600">
                    {r.last_funding_year ?? '—'}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-600">
                    {r.total_funding != null
                      ? `$${(r.total_funding / 1_000_000).toFixed(1)}M`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </>
  );
}
