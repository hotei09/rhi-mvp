'use client';

/**
 * Methodology Popover — REQ-004.
 *
 * Concern Score 산출 공식 / 가중치 / tier 임계값을 호버/클릭 시 표시한다.
 * Radix Dialog로 접근성 보장. plan.md §2B Reference Constants 와 동기화.
 *
 * 주의: tier 임계값 const는 client bundle에서 직접 import할 수 없는 lib/lenses/concern-score.ts
 * (node:fs 의존)와 동기화되어 있어야 한다 — plan.md §2B.2 변경 시 본 파일도 동시 갱신.
 */
import * as Dialog from '@radix-ui/react-dialog';

/**
 * Tier 임계값 — `lib/lenses/concern-score.ts`의 `TIER_THRESHOLDS` 와 동기화 필수.
 * plan.md §2B.2 변경 시 동시 갱신.
 */
const TIER_THRESHOLDS = {
  CRITICAL: 80,
  HIGH: 60,
  MEDIUM: 40,
  LOW: 20,
  HEALTHY: 0,
} as const;

/**
 * 가중치 매핑 — `.moai/project/db/concern-score-weights.yaml` 기본값과 동일.
 * 실제 보여주는 값은 dynamic이지만 popover는 사용자 학습용 정적 표기로 충분.
 */
const DISPLAYED_WEIGHTS = [
  { lens: 'Zombie', weight: 0.3 },
  { lens: 'Ghost', weight: 0.25 },
  { lens: 'Loop', weight: 0.2 },
  { lens: 'Director', weight: 0.1 },
  { lens: 'Multi-Source', weight: 0.15 },
];

/**
 * Methodology popover 트리거 + 본문.
 */
export function MethodologyPopover() {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="text-xs underline underline-offset-2 hover:no-underline"
          aria-label="methodology-popover"
        >
          Methodology
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 max-h-[80vh] w-[90vw] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-lg bg-white p-6 shadow-xl dark:bg-neutral-900">
          <Dialog.Title className="text-lg font-semibold">Concern Score 공식</Dialog.Title>
          <div className="mt-4 space-y-4 text-sm">
            <div>
              <h4 className="font-semibold">가중합 공식</h4>
              <pre className="mt-1 rounded bg-muted/50 p-2 text-xs">
                {`score = w_zombie · zombie_score
      + w_ghost · ghost_score
      + w_loop · loop_signal
      + w_director · min(director_overlap × 10, 100)
      + w_multi · (multi_source_count >= 2 ? 100 : 0)`}
              </pre>
            </div>
            <div>
              <h4 className="font-semibold">가중치 (sum = 1.0)</h4>
              <table className="mt-1 w-full text-left">
                <tbody>
                  {DISPLAYED_WEIGHTS.map((w) => (
                    <tr key={w.lens} className="border-t">
                      <td className="py-1">{w.lens}</td>
                      <td className="py-1 text-right tabular-nums">{w.weight.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <h4 className="font-semibold">Tier 임계값 (ascending)</h4>
              <ul className="mt-1 space-y-1 text-xs">
                <li>Critical ≥ {TIER_THRESHOLDS.CRITICAL}</li>
                <li>
                  High {TIER_THRESHOLDS.HIGH} – {TIER_THRESHOLDS.CRITICAL - 1}
                </li>
                <li>
                  Medium {TIER_THRESHOLDS.MEDIUM} – {TIER_THRESHOLDS.HIGH - 1}
                </li>
                <li>
                  Low {TIER_THRESHOLDS.LOW} – {TIER_THRESHOLDS.MEDIUM - 1}
                </li>
                <li>Healthy &lt; {TIER_THRESHOLDS.LOW}</li>
              </ul>
            </div>
          </div>
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
