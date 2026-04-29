'use client';

/**
 * Raw Row Drawer — REQ-004 / SPEC-RHI-001.
 *
 * 5개 lens별 raw 행을 lazy fetch하여 modal/drawer 내 표시한다 (사용자 신뢰 + 디버깅 용도).
 * Radix Dialog (`@radix-ui/react-dialog`)로 접근성 준수 + 모바일 호환.
 */
import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useState } from 'react';

/**
 * 5개 lens 식별자 — API 라우트 query param과 일치.
 */
export type LensId = 'zombie' | 'ghost' | 'loop' | 'director' | 'multi-source';

/**
 * 클라이언트 측 lens raw row drawer.
 * `entityId`(BN)와 `lens`을 받아 클릭 시 raw row + SQL trace를 모달로 렌더.
 */
export type RawRowDrawerProps = {
  /** 클릭 트리거 라벨. */
  label: string;
  /** 자선단체 BN. */
  bn: string;
  /** 어떤 lens의 raw row을 fetch할지. */
  lens: LensId;
};

type RawRowResponse = {
  rows: Record<string, unknown>[];
  sql: string;
  lens: string;
};

/**
 * 단일 lens의 raw row을 표시하는 drawer 트리거.
 * Drawer가 열릴 때만 fetch가 실행되어 초기 페이지 로드 비용을 회피.
 */
export function RawRowDrawer({ label, bn, lens }: RawRowDrawerProps) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<RawRowResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || data) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/entity/${encodeURIComponent(bn)}/lens-raw?lens=${encodeURIComponent(lens)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
        return (await res.json()) as RawRowResponse;
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, data, bn, lens]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button type="button" className="text-xs underline underline-offset-2 hover:no-underline">
          {label}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 max-h-[80vh] w-[90vw] max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-lg bg-white p-6 shadow-xl dark:bg-neutral-900">
          <Dialog.Title className="text-lg font-semibold">
            Raw rows — {lens.toUpperCase()}
          </Dialog.Title>
          <Dialog.Description className="text-xs text-muted-foreground">
            BN {bn} (max 50 rows)
          </Dialog.Description>
          {loading && <p className="mt-4 text-sm">Loading…</p>}
          {error && <p className="mt-4 text-sm text-red-600">Error: {error}</p>}
          {data && (
            <div className="mt-4 space-y-3 text-xs">
              <details className="rounded border bg-muted/50 p-2">
                <summary className="cursor-pointer font-mono">SQL trace</summary>
                <pre className="mt-2 whitespace-pre-wrap break-words">{data.sql}</pre>
              </details>
              <div className="overflow-auto">
                <table className="w-full text-left">
                  <tbody>
                    {data.rows.length === 0 && (
                      <tr>
                        <td className="py-2 italic text-muted-foreground">no rows</td>
                      </tr>
                    )}
                    {data.rows.map((row, i) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: stable list within drawer
                      <tr key={i} className="border-t align-top">
                        <td className="py-2 font-mono">{JSON.stringify(row)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <div className="mt-4 flex justify-end">
            <Dialog.Close asChild>
              <button type="button" className="rounded border px-3 py-1 text-sm">
                Close
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
