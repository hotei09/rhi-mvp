/**
 * Vercel Edge Middleware — REQ-005 Statement C / AC-8b.
 *
 * IP-based rate limit (분당 30 req per IP). 31번째 요청은 HTTP 429.
 *
 * Skip 대상:
 *  - `/api/healthz` — 운영 모니터링 엔드포인트는 항상 응답해야 함
 *  - 정적 자원 (`_next/static`, `_next/image`, `/favicon.ico`) — `config.matcher` 로 제외
 *
 * Store는 module-level Map. 단일 인스턴스 내에서만 유효 — 멀티 region 또는
 * 다중 인스턴스 배포 시 distributed store (Redis/Vercel KV) 필요.
 *
 * @MX:WARN: [AUTO] in-memory Map은 단일 인스턴스에서만 동작 — 프로덕션 멀티 region 배포 시 distributed store 필수
 * @MX:REASON: 본 MVP는 Vercel single-region (iad1) 배포 가정. 다중 인스턴스/edge region 시 IP 카운터가 노드별로 분리되어 실제 임계값이 maxRequests × N으로 불릴 수 있음. SPEC-RHI-001 plan.md §2B.4 단일 region 명시 + Out-of-Scope §11 distributed cache 미포함.
 * @MX:SPEC: SPEC-RHI-001 REQ-005 / AC-8b
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import {
  DEFAULT_RATE_LIMIT_CONFIG,
  type RateLimitStore,
  enforceRateLimit,
} from '@/lib/middleware/rate-limit';

/**
 * Module-level store — 단일 Edge worker process 내 공유.
 * Hot reload 시 새로 시작되며, 프로덕션은 단일 region (iad1) 가정.
 */
const STORE: RateLimitStore = new Map();

/**
 * Rate limit 적용 제외 경로 — healthz는 모니터링 endpoint.
 */
const EXEMPT_PATHS = new Set<string>(['/api/healthz']);

/**
 * 클라이언트 IP를 헤더에서 추출. 우선순위:
 * 1. x-forwarded-for의 첫번째 항목 (Vercel/일반 reverse proxy)
 * 2. x-real-ip
 * 3. fallback 'unknown'
 */
function extractClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;
  return 'unknown';
}

/**
 * Edge middleware entry. Rate limit 적용 + 통과 시 NextResponse.next().
 */
export function middleware(request: NextRequest): NextResponse {
  const pathname = request.nextUrl.pathname;
  // healthz는 항상 통과
  if (EXEMPT_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const ip = extractClientIp(request);
  const result = enforceRateLimit(ip, Date.now(), STORE, DEFAULT_RATE_LIMIT_CONFIG);

  if (!result.allowed) {
    return new NextResponse(
      JSON.stringify({ error: 'Too Many Requests', retryAfter: result.retryAfter }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(result.retryAfter ?? 60),
        },
      },
    );
  }

  return NextResponse.next();
}

/**
 * Next.js matcher — 정적 자산 제외.
 * `_next/static`, `_next/image`, `/favicon.ico`는 미들웨어 비대상.
 */
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
