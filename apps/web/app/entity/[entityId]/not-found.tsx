/**
 * Entity profile not-found — 라우트 세그먼트별 404.
 * BN이 cra_identification에 없을 때 fetchEntityData가 notFound() 호출하면 본 페이지가 렌더된다.
 */
import Link from 'next/link';

export default function EntityNotFound() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-center">
      <h1 className="text-2xl font-semibold">엔티티를 찾을 수 없습니다</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        요청한 BN이 CRA 식별 정보에 등록되어 있지 않습니다. BN 형식을 다시 확인해 주세요.
      </p>
      <Link href="/" className="mt-6 inline-block text-sm underline">
        홈으로 돌아가기
      </Link>
    </main>
  );
}
