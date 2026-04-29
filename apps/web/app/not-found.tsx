// 404 placeholder — Phase 4에서 디자인된 not-found UI 로 교체
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 px-6">
      <h1 className="text-2xl font-semibold">Not found</h1>
      <p className="text-sm text-muted-foreground">요청하신 페이지를 찾을 수 없습니다.</p>
    </div>
  );
}
