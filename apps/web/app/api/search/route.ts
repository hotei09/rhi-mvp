/**
 * `GET /api/search` — 글로벌 엔티티 검색 (REQ-005 Statement B / AC-7).
 *
 * 입력: `?q=<query>` — min 2 chars
 * 출력: `{ results: SearchResult[], q: string, latency_ms: number }`
 *
 * 검색 source: `general.vw_entity_search` 뷰 (queries.md §10).
 *  - prefix match 우선 (`norm_canonical ILIKE 'q%'`) → partial match
 *  - bn_root 또는 bn_variants 정확 매칭
 *  - source_link_count DESC tiebreaker
 *
 * 응답시간 목표: warm < 200ms (AC-7).
 *
 * @MX:NOTE: [AUTO] revalidate 미설정 — 매 요청마다 DB 직접 조회 (search query는 unique하므로 캐시 hit 비효율).
 *          rate-limit middleware가 IP 단위 보호 제공.
 * @MX:SPEC: SPEC-RHI-001 REQ-005 / AC-7
 */
import { z } from 'zod';

import { sql } from '@/lib/db/client';

/** postgres.js Node 의존 — Edge runtime 불가. */
export const runtime = 'nodejs';

/** 매 요청 DB 직접 조회 — 캐시 비활성화. */
export const dynamic = 'force-dynamic';

/**
 * 쿼리 파라미터 zod schema.
 * - q: 최소 2자 (1자 검색은 매칭 결과 폭증 회피)
 * - limit: 1~50 (기본 20)
 */
const SearchSchema = z.object({
  q: z.string().min(2).max(100),
  limit: z.number().int().min(1).max(50).optional().default(20),
});

/**
 * 검색 결과 항목.
 *
 * `general.vw_entity_search` 실제 컬럼:
 *  - id: integer
 *  - canonical_name: text
 *  - bn_root: varchar (nullable)
 *  - bn_variants: text[]
 *  - dataset_sources: text[] (FED/AB/CRA 등)
 *  - source_count: integer (몇 개 dataset에 등장하는지)
 */
type SearchResult = {
  id: number;
  canonical_name: string;
  bn_root: string | null;
  dataset_sources: string[] | null;
  source_count: number | null;
};

/**
 * 검색 응답 본문.
 */
type SearchResponseBody = {
  results: SearchResult[];
  q: string;
  latency_ms: number;
};

/**
 * 검증 실패 응답 본문.
 */
type SearchErrorBody = {
  error: string;
  details?: unknown;
};

/**
 * GET /api/search 핸들러.
 *
 * @param request - 표준 Web Request (URL의 q query param 추출)
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const qRaw = url.searchParams.get('q');
  const limitRaw = url.searchParams.get('limit');

  // q 파라미터가 없거나 빈 문자열이면 400
  if (qRaw === null || qRaw === '') {
    const body: SearchErrorBody = { error: 'Missing query parameter "q"' };
    return Response.json(body, { status: 400 });
  }

  // zod 검증
  const parsed = SearchSchema.safeParse({
    q: qRaw,
    limit: limitRaw ? Number.parseInt(limitRaw, 10) : undefined,
  });
  if (!parsed.success) {
    const body: SearchErrorBody = {
      error: 'Invalid query parameter',
      details: parsed.error.flatten(),
    };
    return Response.json(body, { status: 400 });
  }

  const { q, limit } = parsed.data;

  // queries.md §10 — prefix match 우선 정렬, dataset_sources 노출
  // 실제 vw_entity_search 컬럼에는 norm_canonical/source_link_count 가 없으므로
  // lower(canonical_name) 기반 ILIKE + source_count 로 대체.
  const t0 = performance.now();
  const rows = (await sql.unsafe(
    `
      SELECT id, canonical_name, bn_root, dataset_sources, source_count
      FROM general.vw_entity_search
      WHERE
        canonical_name ILIKE '%' || $1 || '%'
        OR bn_root = $1
        OR $1 = ANY(bn_variants)
      ORDER BY
        CASE WHEN canonical_name ILIKE $1 || '%' THEN 0 ELSE 1 END,
        source_count DESC NULLS LAST
      LIMIT $2
    `,
    [q, limit],
  )) as Array<SearchResult>;
  const latencyMs = Math.round(performance.now() - t0);

  const body: SearchResponseBody = {
    results: rows,
    q,
    latency_ms: latencyMs,
  };
  return Response.json(body, { status: 200 });
}
