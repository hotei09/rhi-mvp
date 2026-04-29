/**
 * `GET /api/healthz` — DB 연결 sanity check.
 *
 * 동작:
 * - SELECT 1 AS ok 실행
 * - 성공 시 200 + `{ ok: true, ts: <ISO-8601> }` 반환
 * - 실패 시 503 + `{ ok: false, ts, error }` 반환
 *
 * 매핑: SPEC-RHI-001 REQ-005 Statement C, AC-1
 *
 * @MX:NOTE 외부 모니터링이 ts 필드를 사용하여 응답 신선도를 검증한다.
 *          캐싱 disabled (force-dynamic) — 매 요청마다 실제 DB ping을 수행해야 monitoring 의미가 있음.
 */
import { sql } from '@/lib/db/client';

/**
 * Next.js Route Segment Config — 캐시 비활성화.
 * healthz는 매 호출 시 실제 DB 상태를 반영해야 하므로 SSG/ISR 사용 불가.
 */
export const dynamic = 'force-dynamic';

/**
 * postgres.js는 Node.js stream API에 의존 — Edge runtime 호환 불가.
 */
export const runtime = 'nodejs';

/**
 * 응답 본문 타입.
 */
interface HealthzResponse {
  ok: boolean;
  ts: string;
  error?: string;
}

/**
 * GET /api/healthz handler.
 *
 * @returns 200 OK with `{ ok: true, ts }` on DB reachable;
 *          503 Service Unavailable with `{ ok: false, ts, error }` on DB failure.
 */
export async function GET(_request: Request): Promise<Response> {
  const ts = new Date().toISOString();
  try {
    const rows = (await sql`SELECT 1 AS ok`) as Array<{ ok: number }>;
    const ok = rows[0]?.ok === 1;
    const body: HealthzResponse = { ok, ts };
    return Response.json(body, { status: ok ? 200 : 503 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const body: HealthzResponse = { ok: false, ts, error: message };
    return Response.json(body, { status: 503 });
  }
}
