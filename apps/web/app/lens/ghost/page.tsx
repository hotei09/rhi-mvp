/**
 * Ghost Lens 페이지 — REQ-005 Statement A.
 *
 * 매핑: SPEC-RHI-001 REQ-005 / AC-9
 */
import Link from 'next/link';

import { Header } from '@/components/layout/header';
import { getGhostRanking } from '@/lib/ranking/lens';

export const revalidate = 600;
export const runtime = 'nodejs';

export default async function GhostLensPage(): Promise<React.ReactElement> {
  const rows = await getGhostRanking({ limit: 50 });

  return (
    <>
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Ghost Recipients</h1>
          <p className="mt-2 text-sm text-gray-600">
            program_ratio &lt; 0.5 + govt_share ≥ 0.7 + 12개월 이상 등록된 단체 — 운영비 구성 의심
            패턴.
          </p>
        </header>

        <section className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-gray-700">#</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-700">단체명</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-700">BN</th>
                <th className="px-4 py-2 text-right font-semibold text-gray-700">Score</th>
                <th className="px-4 py-2 text-right font-semibold text-gray-700">Program Ratio</th>
                <th className="px-4 py-2 text-right font-semibold text-gray-700">Govt Share</th>
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
                    {r.ghost_score}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-600">
                    {r.program_ratio != null ? `${(r.program_ratio * 100).toFixed(0)}%` : '—'}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-600">
                    {r.govt_share != null ? `${(r.govt_share * 100).toFixed(0)}%` : '—'}
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
