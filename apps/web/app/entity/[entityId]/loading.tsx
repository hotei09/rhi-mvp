/**
 * Entity profile loading skeleton — Next.js loading.tsx 라우트 세그먼트.
 * 데이터 페치 동안 즉시 렌더되어 LCP/FCP 개선.
 */
export default function EntityProfileLoading() {
  return (
    <main className="mx-auto max-w-6xl space-y-6 px-6 py-10">
      <div className="h-32 animate-pulse rounded-lg border bg-muted/40" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="h-48 animate-pulse rounded-lg border bg-muted/40 lg:col-span-2" />
        <div className="h-48 animate-pulse rounded-lg border bg-muted/40" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-lg border bg-muted/40" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-lg border bg-muted/40" />
    </main>
  );
}
