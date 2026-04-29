/**
 * 개별 Loop 상세 페이지 — REQ-005 Statement A.
 *
 * 매핑: SPEC-RHI-001 REQ-005 / AC-3 / AC-4 / Edge case 13.5 (404)
 */
import { notFound } from 'next/navigation';

import { Header } from '@/components/layout/header';
import { LoopGraph } from '@/components/lens/loop-graph';
import { sql } from '@/lib/db/client';
import { getLoopClassification } from '@/lib/lenses/loop';

export const revalidate = 600;
export const runtime = 'nodejs';

type PageProps = {
  params: Promise<{ loopId: string }>;
};

const TIER_BG: Record<'A' | 'B' | 'C', string> = {
  A: 'bg-green-100 text-green-900 border-green-300',
  B: 'bg-yellow-100 text-yellow-900 border-yellow-300',
  C: 'bg-red-100 text-red-900 border-red-300',
};

/**
 * Loop 참여자 BN 메타정보 조회.
 */
async function getParticipantsMeta(
  bns: string[],
): Promise<Map<string, { bn: string; legal_name: string | null }>> {
  if (bns.length === 0) return new Map();

  const rows = (await sql.unsafe(
    `
      SELECT DISTINCT ON (bn) bn, legal_name
      FROM cra.cra_identification
      WHERE bn = ANY($1)
      ORDER BY bn, fiscal_year DESC
    `,
    [bns],
  )) as Array<{ bn: string; legal_name: string | null }>;
  const map = new Map<string, { bn: string; legal_name: string | null }>();
  for (const r of rows) map.set(r.bn, r);
  return map;
}

export default async function LoopDetailPage({ params }: PageProps): Promise<React.ReactElement> {
  const { loopId: loopIdRaw } = await params;
  const loopId = Number.parseInt(loopIdRaw, 10);
  if (!Number.isInteger(loopId) || loopId <= 0) notFound();

  const classification = await getLoopClassification(loopId);
  if (!classification) notFound();

  // path_bns로 노드 + (인접 쌍) 엣지 구성
  const meta = await getParticipantsMeta(classification.path_bns);
  const nodes = classification.path_bns.map((bn, i) => ({
    id: `${bn}-${i}`,
    bn,
    legal_name: meta.get(bn)?.legal_name ?? null,
  }));

  // path 순서대로 인접 엣지 + 마지막 → 첫번째 (cycle close)
  const edges = classification.path_bns.map((bn, i) => {
    const next = classification.path_bns[(i + 1) % classification.path_bns.length];
    return {
      source: bn,
      target: next ?? bn,
      amount: null as number | null,
    };
  });

  return (
    <>
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              Loop #{classification.loop_id}
            </h1>
            <span
              data-testid="tier-badge"
              className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold uppercase ${TIER_BG[classification.tier]}`}
            >
              Tier {classification.tier}
            </span>
          </div>
          <p className="mt-2 text-sm text-gray-600">
            {classification.hops} hops · ${(classification.total_flow / 1_000_000).toFixed(2)}M
            total flow
          </p>
        </header>

        <section className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
            Classification rationale
          </h2>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-gray-700">
            {classification.classification_reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          {classification.avg_program_ratio !== null && (
            <p className="mt-3 text-xs text-gray-500">
              Average program ratio: {(classification.avg_program_ratio * 100).toFixed(1)}%
            </p>
          )}
        </section>

        <section className="mb-6">
          <LoopGraph nodes={nodes} edges={edges} />
        </section>
      </main>
    </>
  );
}
