/**
 * Entity profile not-found — 라우트 세그먼트별 404.
 * BN이 cra_identification에 없을 때 fetchEntityData가 notFound() 호출하면 본 페이지가 렌더된다.
 */
import Link from 'next/link';

export default function EntityNotFound() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-center">
      <h1 className="text-2xl font-semibold">Entity not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        The requested BN is not registered in the CRA identification records. Please verify the BN
        format.
      </p>
      <Link href="/" className="mt-6 inline-block text-sm underline">
        Back to home
      </Link>
    </main>
  );
}
