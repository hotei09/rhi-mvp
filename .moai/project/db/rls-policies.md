# Access Control — Read-Only Replica

> 일반적인 RLS 정책 문서가 아니다. 본 프로젝트는 해커톤 제공 **read-only replica**를 사용하므로
> 데이터베이스 측 RLS 설정 권한이 없다. 본 파일은 (1) replica의 read-only 본질, (2) 어플리케이션
> 측 접근 제어, (3) 윤리·법적 디스클레이머를 문서화한다.

---

## 1. Database-side: Read-Only by Design

### 1.1 Replica 특성

- **호스트**: `dpg-d7auudv5r7bs738iqh70-b.replica-cyan.oregon-postgres.render.com`
- **유형**: Render PostgreSQL replica (`-b.replica-cyan` suffix가 replica임을 시사)
- **권한**: 사용자 `database_database_w2a1_user`는 SELECT만 보유
- **쓰기 시도**: PG가 자체 거부 → `ERROR: cannot execute INSERT in a read-only transaction`
- **Connection string**: `?sslmode=require` 강제

### 1.2 우리 측 추가 보호

```typescript
// apps/web/lib/db/client.ts
export const sql = postgres(env.PGCONN, {
  ssl: 'require',
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

// 어플리케이션 코드 정책: 쓰기 SQL은 BAN
// Biome / lint 룰로 다음을 금지:
//   - INSERT, UPDATE, DELETE, ALTER, CREATE, DROP, TRUNCATE
//   - sql.unsafe() with above keywords
```

향후 자체 PG 인스턴스로 마이그레이션 시: 별도 user (read_user) 생성 + 권한 부여로 동일한 본질 유지.

---

## 2. Application-side: 사용자 인증·권한 (현재 없음)

| 역할 | 권한 |
|---|---|
| **익명 (anonymous)** | 모든 페이지 읽기 가능. 본 도구는 공개 인사이트 도구. |
| **(향후) 인증 사용자** | 본 MVP 범위 외. 라벨링·신고 기능 추가 시 도입 예정. |
| **관리자** | 본 MVP 범위 외. |

본 MVP는 인증을 도입하지 않는다 — `/login`, `/auth/*` 라우트 없음.

---

## 3. 어플리케이션 측 데이터 필터 (=정성적 RLS)

DB 측 RLS는 없지만, 어플리케이션 lens 쿼리에 **자동 적용되는 도메인 필터**가 존재한다.

### 3.1 정부 엔티티 제외 필터 (Lens 1, 2)

`apps/web/lib/data-issues/exclusions.ts` 에서 관리.

```typescript
export const GOVERNMENT_NAME_PATTERNS: RegExp[] = [
  /^Government of (Canada|the Province|the Territory)/i,
  /Health Authority$/i,
  /Health Region$/i,
  /Crown Corporation/i,
  /Royal Canadian Mounted Police/i,
  /^City of /i,
  /^Town of /i,
  /^Municipality of /i,
];

export function isGovernmentEntity(legalName: string | null): boolean {
  if (!legalName) return false;
  return GOVERNMENT_NAME_PATTERNS.some((p) => p.test(legalName));
}
```

| Table | Column | Filter | Why |
|---|---|---|---|
| cra.govt_funding_by_charity | legal_name | `NOT isGovernmentEntity(legal_name)` | Lens 1/2 false positive 방지 (보건당국·도정부) |
| cra.cra_identification | legal_name | (동일) | 검색 결과에서 정부 엔티티는 별도 facet |

### 3.2 신생 단체 제외 (Lens 2)

```sql
-- 첫 filing이 12개월 미만인 단체는 ghost 점수 제외
WHERE (CURRENT_DATE - registration_date) >= INTERVAL '12 months'
```

### 3.3 데이터 품질 임계 (Lens 3)

```sql
-- t3010_plausibility_flags severity >= 3 인 BN 만 Tier C 후보
WHERE EXISTS (
  SELECT 1 FROM cra.t3010_plausibility_flags pf
  WHERE pf.bn = lp.bn AND pf.severity >= 3
)
```

---

## 4. 윤리·법적 디스클레이머

본 도구는 공공 데이터 기반 **자동 분류 결과**를 제시한다. 사람·단체에 대한 법적 결론을
자동 생성하지 않으며, 사용자에게 다음을 명시한다:

### 4.1 페이지별 디스클레이머

- **Landing (`/`)**: "이 도구는 공공 데이터 자동 분석 결과를 제시합니다. 법적 결론이나 비위 단정이 아닙니다."
- **Entity profile (`/entity/{id}`)**: 각 lens 점수 옆에 "Why?" 호버 → "이 점수는 SQL 룰의 결과이며, 단체의 실제 행위에 대한 판단이 아닙니다."
- **Methodology (`/methodology`)**: 데이터 함정(F-1, F-3) + 알려진 false positive 패턴 + Concern Score 한계 명시

### 4.2 SEO·인덱싱 차단

```
# apps/web/public/robots.txt
User-agent: *
Disallow: /entity/
Disallow: /lens/loops/
Allow: /
Allow: /methodology
```

엔티티 프로필 페이지는 검색엔진 인덱싱 차단. 일반 명예훼손·검색 노이즈 방지.

### 4.3 PII 처리

- T3010 directors의 first/last name은 **공개 데이터** (CRA 공식 공개 항목)
- 그러나 검색·정렬·랭킹 페이지에서는 BN과 단체명 위주로 제시. 개인 이름 단독 검색 기능은 제공하지 않음.
- 향후 인증 도입 시: 직접 인명 검색은 인증 사용자 한정.

---

## 5. Rate Limiting

해커톤 발표 traffic 폭주 대비.

```typescript
// apps/web/middleware.ts (Vercel Edge)
import { ipAddress } from '@vercel/edge';

const HITS = new Map<string, { count: number; resetAt: number }>();

export function middleware(req: Request) {
  const ip = ipAddress(req) ?? 'unknown';
  const now = Date.now();
  const entry = HITS.get(ip);

  if (!entry || now > entry.resetAt) {
    HITS.set(ip, { count: 1, resetAt: now + 60_000 });
    return;
  }
  entry.count++;
  if (entry.count > 30) {
    return new Response('Too Many Requests', { status: 429 });
  }
}
```

(Production-grade는 Upstash Redis 기반이 좋으나, MVP는 in-memory 충분)

---

## 6. Access Control Matrix (현재 상태)

| Resource | anonymous | authenticated | admin |
|---|---|---|---|
| `/`, `/ranking`, `/methodology` | ALLOW (read) | ALLOW (read) | ALLOW (read) |
| `/entity/{id}` | ALLOW (read, no-index) | ALLOW (read) | ALLOW (read) |
| `/lens/*` | ALLOW (read) | ALLOW (read) | ALLOW (read) |
| `/api/healthz` | ALLOW (read) | ALLOW (read) | ALLOW (read) |
| `/admin/*` | (미존재) | (미존재) | (미존재) |
| Database write | DENIED (PG replica) | DENIED | DENIED |

---

## 7. 향후 (out-of-scope)

- 자체 PG 인스턴스 마이그레이션 시 read_user / writer_user 분리
- 사용자 라벨링 기능 → Supabase Auth + RLS 도입
- 신고/이의 제기 워크플로우 → 별도 인증된 channel

---

Last reviewed: 2026-04-27
Note: 표준 RLS 템플릿은 본 프로젝트와 무관 (read-only replica). 본 파일은 어플리케이션 측 접근·필터·디스클레이머에 초점.
