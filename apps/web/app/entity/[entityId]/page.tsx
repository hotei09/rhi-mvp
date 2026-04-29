import { ConcernCard } from '@/components/entity/concern-card';
import { FundingTimeline } from '@/components/entity/funding-timeline';
import { IdentityBlock } from '@/components/entity/identity-block';
import { LensSummary } from '@/components/entity/lens-summary';
import { MethodologyPopover } from '@/components/shared/methodology-popover';
import { fetchEntityData } from '@/lib/entity/profile-data';
/**
 * Entity Profile Page — REQ-004 / AC-6 / AC-12.
 *
 * 라우트: `/entity/[entityId]` — entityId는 BN format (9자리 숫자 또는 9+RR+4 = 15자).
 * Server Component (async) — DB 직접 호출, PG 자격증명 클라이언트 노출 방지.
 *
 * Promise.all로 5개 lens + funding timeline + identity 병렬 fetch (AC-6).
 * `revalidate: 60` ISR — 1분 cache hit 동안 warm TTFB < 1200ms 목표 (AC-12).
 */
import { notFound } from 'next/navigation';

/**
 * ISR cache TTL — plan.md §2B.4 (entity page revalidate = 60s).
 */
export const revalidate = 60;

/**
 * Next.js 16 async params 타입.
 */
type PageProps = {
  params: Promise<{ entityId: string }>;
};

/**
 * Entity profile page entry — 모든 데이터 페치 + 5개 카드 렌더.
 */
export default async function EntityProfilePage({ params }: PageProps) {
  const { entityId } = await params;
  const data = await fetchEntityData(entityId);
  if (!data) notFound();

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-6 py-10">
      <IdentityBlock {...data.identity} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ConcernCard
            score={data.concern.score}
            tier={data.concern.tier}
            components={data.concern.components}
          />
        </div>
        <aside className="rounded-lg border bg-card p-6 text-sm">
          <h3 className="font-semibold">Methodology</h3>
          <p className="mt-2 text-xs text-muted-foreground">
            점수 산출 공식과 가중치를 확인합니다.
          </p>
          <div className="mt-3">
            <MethodologyPopover />
          </div>
        </aside>
      </div>

      <LensSummary
        bn={data.identity.bn}
        zombie={data.lenses.zombie}
        ghost={data.lenses.ghost}
        loop={data.lenses.loop}
        director={data.lenses.director}
        multi_source={data.lenses.multi_source}
      />

      <FundingTimeline data={data.funding_timeline} />
    </main>
  );
}
