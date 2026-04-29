/**
 * 랜딩 페이지 — REQ-005 Statement A.
 *
 * High concern ranking top 50 (Server Component).
 * `revalidate: 300` (5분) — Vercel data cache hit 시 빠른 응답.
 *
 * 매핑: SPEC-RHI-001 REQ-005 / AC-9 (정부 엔티티 자동 제외)
 */
import Link from 'next/link';

import { Header } from '@/components/layout/header';
import { TierBadge } from '@/components/shared/tier-badge';
import { getLandingRanking } from '@/lib/ranking/landing';

/**
 * Vercel data cache TTL — plan.md §2B.4 (landing revalidate = 300s).
 */
export const revalidate = 300;

/**
 * postgres.js Node 의존 — Server component는 자동 nodejs runtime이지만 명시.
 */
export const runtime = 'nodejs';

/**
 * 랜딩 페이지 — top 50 high concern + 헤더 네비게이션.
 */
export default async function HomePage(): Promise<React.ReactElement> {
  const rows = await getLandingRanking({ limit: 50 });

  return (
    <>
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Recipient Health Index
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            캐나다 정부 자금 수혜 단체의 5개 렌즈 통합 건강성 지표 — 상위 {rows.length}개 우려 단체
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
                <th className="px-4 py-2 text-left font-semibold text-gray-700">Tier</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-700">Top Lens</th>
                <th className="px-4 py-2 text-right font-semibold text-gray-700">
                  마지막 자금 연도
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-500">
                    데이터 없음
                  </td>
                </tr>
              )}
              {rows.map((r, i) => {
                const entityHref = `/entity/${r.bn}`;
                return (
                  <tr key={r.bn} className="hover:bg-gray-50">
                    <td className="px-4 py-2 tabular-nums text-gray-500">{i + 1}</td>
                    <td className="px-4 py-2">
                      <Link href={entityHref} className="font-medium text-blue-600 hover:underline">
                        {r.legal_name}
                      </Link>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-gray-600">{r.bn}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-semibold">
                      {r.score.toFixed(1)}
                    </td>
                    <td className="px-4 py-2">
                      <TierBadge tier={r.tier} />
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-700">{r.top_lens}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-gray-600">
                      {r.last_funding_year ?? '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <p className="mt-4 text-xs text-gray-500">
          * Score는 zombie 패턴 기반 휴리스틱 점수이며, 5개 렌즈 통합 정확 점수는 각 단체 페이지에서
          확인하세요.
        </p>
      </main>
    </>
  );
}
