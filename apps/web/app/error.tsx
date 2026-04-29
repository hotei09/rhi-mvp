'use client';

// 글로벌 에러 boundary placeholder — Phase 4에서 사용자 친화적 메시지/recovery UI로 교체.
// Next.js 16: 'use client' 필수.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-2xl font-semibold">문제가 발생했습니다</h1>
      <p className="text-sm text-muted-foreground">
        {error.message || '알 수 없는 오류가 발생했습니다.'}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
      >
        다시 시도
      </button>
    </div>
  );
}
