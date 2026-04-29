/**
 * Loop graph 시각화 — react-flow 기반 노드/엣지 표시.
 *
 * MVP 트레이드오프: react-flow 통합이 복잡하므로 본 컴포넌트는 노드/엣지를
 * 가독성 있는 리스트로 표시한다 (Server Component-friendly).
 * 향후 enhancement: react-flow Client Component로 graph 시각화.
 *
 * 매핑: SPEC-RHI-001 REQ-005 / AC-3 / AC-4
 */

/**
 * 단일 BN 노드.
 */
export type LoopNode = {
  id: string;
  bn: string;
  legal_name?: string | null;
};

/**
 * BN 간 자금 흐름 엣지.
 */
export type LoopEdge = {
  source: string;
  target: string;
  amount?: number | null;
};

/**
 * Loop graph props.
 */
export type LoopGraphProps = {
  nodes: LoopNode[];
  edges: LoopEdge[];
};

/**
 * Loop graph 시각화 — Server Component (no client interactivity needed).
 */
export function LoopGraph({ nodes, edges }: LoopGraphProps): React.ReactElement {
  return (
    <div data-testid="loop-graph" className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700">
        Loop 참여자 ({nodes.length} 노드, {edges.length} 엣지)
      </h3>

      <div className="mb-4">
        <div className="mb-1 text-xs font-medium text-gray-500">참여 BN 목록</div>
        <ul className="space-y-1">
          {nodes.map((n, i) => (
            <li
              key={n.id}
              className="flex items-center gap-2 text-sm"
              data-testid="loop-graph-node"
            >
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                {i + 1}
              </span>
              <span className="font-mono text-xs text-gray-600">{n.bn}</span>
              {n.legal_name ? <span className="text-gray-700">{n.legal_name}</span> : null}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <div className="mb-1 text-xs font-medium text-gray-500">자금 흐름</div>
        <ul className="space-y-1">
          {edges.map((e, idx) => (
            <li
              key={`${e.source}-${e.target}-${idx}`}
              className="flex items-center gap-2 text-sm"
              data-testid="loop-graph-edge"
            >
              <span className="font-mono text-xs text-gray-600">{e.source}</span>
              <span className="text-gray-400">→</span>
              <span className="font-mono text-xs text-gray-600">{e.target}</span>
              {e.amount != null ? (
                <span className="ml-auto tabular-nums text-xs text-gray-600">
                  ${(e.amount / 1_000).toFixed(0)}K
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
