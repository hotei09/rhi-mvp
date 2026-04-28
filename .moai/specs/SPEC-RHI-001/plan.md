---
spec_id: SPEC-RHI-001
version: 0.1.2
created: 2026-04-27
updated: 2026-04-27
methodology: TDD (RED-GREEN-REFACTOR)
coverage_target: 85
---

# Plan — SPEC-RHI-001 Recipient Health Index MVP

> 본 문서는 SPEC-RHI-001 (RHI MVP)의 구현 계획·기술 스택·위험 분석·MX 어노테이션 계획을 정의한다. 시간 추정은 [HARD] 룰에 따라 사용 금지 — 우선순위와 단계 순서로만 명시한다.
>
> **WHAT vs HOW 분리 원칙**: spec.md는 WHAT/WHY (관찰 가능한 행동, acceptance criteria, 비기능 제약)만 정의한다. 본 plan.md는 HOW (모듈 배치, 라이브러리 선정, 옵션, 구체 파일 경로, 함수 시그니처, 캐시 정책, 가중치/임계값의 실제 수치 등)를 단일 출처(single source of truth)로 정의한다. 두 문서가 충돌할 경우 spec.md의 행동 정의가 우선하고, plan.md의 구현 결정은 그 범위 내에서 수정된다.

## 1. 구현 접근 방식

### 1.1 개발 방법론

- **TDD (RED-GREEN-REFACTOR)** — `.moai/config/sections/quality.yaml`의 `development_mode: TDD`에 따름
- 각 REQ별로 RED (실패 테스트) → GREEN (최소 구현) → REFACTOR (구조 정리) 사이클 반복
- 단위 테스트: Vitest (`apps/web/tests/unit/`)
- 통합 테스트: Vitest + Render PG replica 직결 (`apps/web/tests/integration/`)
- E2E: Playwright (`apps/web/tests/e2e/`)
- Coverage target: **85%** (line + branch)

### 1.2 단계 순서 (priority-based)

> 시간이 아닌 단계 순서. Priority Low 항목은 Out-of-Scope 룰 엄수 (product.md §11) — 일정 압박 시 망설임 없이 컷.

**Priority High (반드시 완료, 단계 1-3)**:

- **단계 1 (REQ-001 우선)**: DB 어댑터 + safe-query primitives → 모든 후속 REQ의 전제
  - postgres.js 싱글톤 + zod env 검증
  - F-3 dedup helper (window function) + 정부 엔티티 제외 helper
  - `/api/healthz` 엔드포인트 (DB 연결 sanity)
  - `scripts/verify-db.ts` 실행으로 79 tables / 5 schemas 매핑 확인

- **단계 2 (REQ-002 + REQ-003 병렬 가능)**: 5개 렌즈 + Concern Score 통합
  - 5개 lens 함수 (`zombie`, `ghost`, `loop`, `director`, `multi-source`) — RED-GREEN
  - `concern-score.ts` 가중합 + 가중치 yaml 로더 (sum 검증)
  - 단위 테스트: 결정론적 입력 → 출력 매핑 검증

- **단계 3 (REQ-004)**: Entity Profile 페이지 — `/entity/[entityId]`
  - 5개 lens 호출 `Promise.all` 병렬
  - Server Component 렌더 + Client Component drill-down (raw row drawer)
  - Funding timeline (Recharts stacked bar)
  - Methodology popover

**Priority Medium (시간 허용 시, 단계 4)**:

- **단계 4 (REQ-005)**: 공개 페이지 + 검색 + rate limit
  - 랜딩 페이지 `/` (high concern ranking top 50)
  - 렌즈별 페이지 3개 (`/lens/zombie`, `/lens/ghost`, `/lens/loops`)
  - 개별 loop 페이지 (`/lens/loops/[loopId]`) — react-flow 그래프
  - Methodology 페이지
  - 글로벌 검색 (`general.vw_entity_search`)
  - Rate limit middleware (Vercel Edge, IP당 분당 30 req)

**Priority Low (있으면 좋음, 단계 5 — 컷 가능)**:

- 엔티티 비교 페이지 (`/compare?a=&b=`) — 2개 BN 나란히
- PDF 리포트 export
- 데모 시나리오 빠른 링크 카드
- E2E 시나리오 자동화 (Playwright 스크립트)

### 1.3 단계별 산출물 매트릭스

| 단계 | REQ | 핵심 산출물 | 검증 방법 |
|---|---|---|---|
| 1 | REQ-001 | `lib/db/{client,env}.ts`, `lib/data-issues/safe-queries.ts`, `app/api/healthz/route.ts`, `scripts/verify-db.ts` | `pnpm exec tsx scripts/verify-db.ts` 통과, AC-1 |
| 2 | REQ-002, REQ-003 | `lib/lenses/{zombie,ghost,loop,director,multi-source,concern-score}.ts`, `concern-score-weights.yaml`, `sql/views/lens*.sql` | Vitest unit 통과, AC-2/3/4/5/6/9/11 |
| 3 | REQ-004 | `app/entity/[entityId]/page.tsx`, `components/entity/*` | Vitest integration + manual smoke test, AC-12 |
| 4 | REQ-005 | `app/page.tsx`, `app/lens/*/page.tsx`, `app/methodology/page.tsx`, `middleware.ts` | Playwright E2E + 발표 시나리오, AC-7/8/10 |

---

## 2. 기술 스택

> 자세한 라이브러리 선정 사유는 `tech.md` 참조. 본 절은 **버전 잠금**만 명시.

### 2.1 핵심 의존성 (Production)

```
next:         ^16.0.0
react:        ^19.0.0
react-dom:    ^19.0.0
postgres:     ^3.4.5      // porsager/postgres
zod:          ^3.23.8
recharts:     ^2.15.0
reactflow:    ^11.11.4    // = react-flow 12.x 등가 패키지명
tailwindcss:  ^4.0.0
@radix-ui/react-dialog: ^1.1.2
@radix-ui/react-tabs:   ^1.1.1
lucide-react: ^0.468.0
clsx:         ^2.1.1
tailwind-merge: ^2.5.5
```

### 2.2 개발 의존성 (Dev)

```
typescript:        ^5.7.2
@types/node:       ^22.0.0
@types/react:      ^19.0.0
vitest:            ^2.1.8
@vitest/ui:        ^2.1.8
@playwright/test:  ^1.49.0
@biomejs/biome:    ^1.9.4
tsx:               ^4.19.0
```

### 2.3 런타임·인프라

- Node 22 LTS (Vercel 기본, postgres.js 호환)
- pnpm 9+ (Vercel 호환 우선)
- Vercel `regions: ['iad1']` (us-east, Render Oregon과 가까움)
- PostgreSQL 18.3 (Render replica, read-only)
- Tailwind CSS 4.x + shadcn/ui (OKLCH 테마)

자세한 비채택 기술 + 사유는 tech.md §12 참조 (Prisma, Drizzle, FastAPI, Streamlit, GraphQL, DuckDB, Cloudflare Workers, Tailwind v3 등 모두 비채택).

---

## 2A. Module Layout (HOW — absorbed from spec.md REQ blocks)

본 절은 spec.md의 각 REQ가 명세하는 기능을 어떤 파일에 어떤 라이브러리 옵션으로 배치할지를 정의한다. spec.md REQ 블록은 WHAT/WHY만 다루고, 모든 파일 경로 / 라이브러리 옵션 / 함수 이름은 본 절을 단일 출처로 한다.

### 2A.1 REQ-001 — Database Adapter and Safe-Query Primitives

| 요소 | 위치 / 옵션 |
|---|---|
| Singleton client | `apps/web/lib/db/client.ts` — `globalThis.__pg` 캐싱 패턴으로 dev hot reload 시 연결 재사용 |
| 환경 변수 schema | `apps/web/lib/db/env.ts` — zod schema로 PGCONN 형식 (`postgresql://...sslmode=require`) 검증 |
| 연결 옵션 | `ssl: 'require'`, `max: 10`, `idle_timeout: 20`, `prepare: true` |
| F-3 dedup helper | `apps/web/lib/data-issues/safe-queries.ts` — queries.md §3 ROW_NUMBER OVER PARTITION BY (ref_number, recipient) 기반 |
| 정부 엔티티 제외 helper | 동일 파일 — queries.md §1 `legal_name ILIKE` 패턴 기반 |
| Read-only 강제 | client wrapper에서 SQL 문자열 검사 (UPDATE/INSERT/DELETE/CREATE/DROP/ALTER/TRUNCATE 등 키워드 prefix 검증) → 위반 시 throw + console.error 로그 |

### 2A.2 REQ-002 — Five Lens Scoring Functions

각 lens 함수는 `apps/web/lib/lenses/<name>.ts` 단일 파일로 배치한다.

| Lens | 파일 | 핵심 SQL/로직 출처 |
|---|---|---|
| Zombie | `lib/lenses/zombie.ts` | queries.md §2 — `govt_share ≥ 0.7` + filing gap > 12mo, 단계 점수 0/30/60/80/100 |
| Ghost | `lib/lenses/ghost.ts` | queries.md §4 — `program_ratio < 0.5` + `govt_share ≥ 0.7` + 신생 단체 (12mo 이하) 제외 |
| Loop | `lib/lenses/loop.ts` | queries.md §5 — Tier A/B/C 분류, `cra.loops` (5,808행) + `cra.loop_participants` + `cra.identified_hubs` (20 hubs) + `cra.scc_components` 활용. 분류 근거 narrative 배열 포함 |
| Director | `lib/lenses/director.ts` | queries.md §6 — last+first+initials 셋 매칭, "signal-only" 카운트 |
| Multi-source | `lib/lenses/multi-source.ts` | queries.md §7 — `general.entity_source_links` 기반 FED/AB/CRA gov-transfers 합계, same_year_overlap 카운트 |

### 2A.3 REQ-003 — Concern Score Integration

| 요소 | 위치 / 옵션 |
|---|---|
| Score computation | `apps/web/lib/lenses/concern-score.ts` — `computeConcernScore(signals: LensSignals)` (tech.md §4.3 의사 코드 참조) |
| Weights config (canonical) | `.moai/project/db/concern-score-weights.yaml` — 5개 가중치, sum=1.0 |
| Tier thresholds (canonical) | 동일 yaml 파일 또는 별도 const `CONCERN_TIER_THRESHOLDS` (structure.md §7 SCREAMING_SNAKE_CASE). single source of truth 원칙 — spec.md REQ 본문에는 수치 미명시. |
| Boot-time validation | 서버 boot 시 weight sum 검증 (`Math.abs(sum - 1.0) <= 0.001`). 미달 시 즉시 `throw` 로 부팅 중단 |
| In-memory cache | yaml 1회 로드 후 module-level `const` 캐싱. Hot-reload 미지원 (MVP 결정) |
| Lens → signal 변환 | Loop: `tier_C → 100, tier_B → 50, tier_A or null → 0` ・ Director: `min(overlap_count × 10, 100)` ・ Multi-source: `count >= 2 ? 100 : 0` |

### 2A.4 REQ-004 — Entity Profile Page

| 요소 | 위치 / 옵션 |
|---|---|
| 라우트 | `apps/web/app/entity/[entityId]/page.tsx` — async Server Component |
| 5개 lens 병렬 호출 | `Promise.all([zombie, ghost, loop, director, multiSource])` 패턴 |
| Concern Score 카드 | `apps/web/components/entity/concern-card.tsx` — 통합 점수 + tier 배지 |
| Lens 요약 카드 | `apps/web/components/entity/lens-summary.tsx` — 5개 lens 요약 (raw drill-down 트리거) |
| Raw row drawer | `apps/web/components/entity/raw-row-drawer.tsx` — Client Component, lazy fetch, SQL 트레이스 표시 |
| Funding timeline | `apps/web/components/entity/funding-timeline.tsx` — Recharts stacked bar (FED+AB+CRA per fiscal_year) |
| Identity block | `apps/web/components/entity/identity-block.tsx` — `cra_identification` (legal_name, BN, 카테고리, 등록일, 주소) |
| Methodology popover | `apps/web/components/shared/methodology-popover.tsx` — 점수 공식 호버 설명 |
| 캐싱 | fetch 옵션 `next: { revalidate: 60 }` (1분) |

### 2A.5 REQ-005 — Public Pages, Search, Health, and Rate Limiting

| 표면 | 위치 / 옵션 |
|---|---|
| 랜딩 (Statement A) | `apps/web/app/page.tsx` — top 50 high concern ranking + 통계, `revalidate: 300` |
| 렌즈별 페이지 (Statement A) | `apps/web/app/lens/zombie/page.tsx`, `/ghost/page.tsx`, `/loops/page.tsx` — `revalidate: 600` |
| 개별 loop (Statement A) | `apps/web/app/lens/loops/[loopId]/page.tsx` — react-flow 그래프 + Tier 분류 근거 narrative |
| Methodology (Statement A) | `apps/web/app/methodology/page.tsx` — 정적 마크다운 렌더 (`docs/methodology.md` source) |
| 글로벌 검색 (Statement B) | `apps/web/components/layout/search-box.tsx` + `general.vw_entity_search` 뷰 (queries.md §10) |
| Healthz (Statement C) | `apps/web/app/api/healthz/route.ts` — Route handler, no caching |
| Rate limit (Statement C) | `apps/web/middleware.ts` — Vercel Edge Middleware, IP-based rate limit (분당 30 req) |

---

## 2B. Reference Constants (정량 수치 — single source of truth)

본 절은 spec.md REQ에서 의도적으로 제외한 수치들의 실제 기본값을 한 곳에 모은다. spec.md REQ 본문에는 수치 미명시이며, 본 절이 default 값의 canonical reference이고, 운영 조정 시 yaml/const 파일을 수정한다.

### 2B.1 Concern Score Weights (default seed for `.moai/project/db/concern-score-weights.yaml`)

```yaml
concern_score_weights:
  zombie:       0.30
  ghost:        0.25
  loop:         0.20
  director:     0.10
  multi_source: 0.15
# Sum = 1.00 (boot-time validation: abs(sum - 1.0) <= 0.001)
```

출처: product.md §6 + db/seed-data.md §3.

### 2B.2 Concern Tier Thresholds

```typescript
// apps/web/lib/lenses/concern-score.ts
export const CONCERN_TIER_THRESHOLDS = {
  CRITICAL: 80, // score >= 80
  HIGH:     60, // 60 <= score < 80
  MEDIUM:   40, // 40 <= score < 60
  LOW:      20, // 20 <= score < 40
  HEALTHY:   0, // score <  20
} as const;
```

ascending threshold 순서. 출처: product.md §6.

### 2B.3 Lens Score Conversion to Signals

| Lens output | Signal value (input to concern score) |
|---|---|
| Zombie score (0-100) | identity (그대로 사용) |
| Ghost score (0-100) | identity |
| Loop tier C | 100 |
| Loop tier B | 50 |
| Loop tier A or null | 0 |
| Director overlap count | `min(count × 10, 100)` |
| Multi-source count | `count >= 2 ? 100 : 0` |

### 2B.4 Operational Constants

| 항목 | 기본값 |
|---|---|
| Rate limit window | 60 seconds |
| Rate limit threshold | 30 requests per IP per window |
| Healthz response time target | < 200ms warm |
| Warm cache definition | 동일 라우트 첫 요청 후 60초 이내 후속 요청 (Vercel data cache TTL 일치) |
| Entity page revalidate | 60 seconds |
| Landing page revalidate | 300 seconds |
| Lens page revalidate | 600 seconds |

---

## 3. 위험 분석 (Risk Analysis)

| ID | 위험 | 가능성 | 영향 | 완화 전략 |
|---|---|---|---|---|
| R1 | Render PG cold start latency (Oregon ↔ Vercel iad1 baseline ~80ms, 첫 요청 추가 cold delay) | 중 | 응답 시간 목표 (TTFB < 1.5s 95p) 미달 | Vercel data cache + `next: { revalidate: 60-300 }` 적극 활용. Server Component fetch에서 자동 캐싱. 측정은 `scripts/benchmark-queries.ts` |
| R2 | Director-overlap false positive — 흔한 이름 (e.g., John Smith)이 다수 BN에 등장하여 시그널 오버플로우 | 고 | Lens 4 신뢰도 저하 + 사용자 혼동 | last+first+initials 셋 매칭 (queries.md §6). UI에서 "signal only — not a fraud claim" 명시 디스클레이머 (AC-10) |
| R3 | t3010 plausibility severity 분포 불명 — Tier C 임계값 (severity ≥ 3) 적정성 사전 검증 안 됨 | 중 | Lens 3 분류 정확도 저하 | 단계 2 첫 작업으로 EDA 쿼리 실행 (`SELECT severity, COUNT(*) FROM cra.t3010_plausibility_flags GROUP BY 1`). 분포 보고 임계값 calibrate |
| R4 | F-3 window function 성능 — `fed.grants_contributions` 1.27M 행 + ROW_NUMBER OVER PARTITION BY (ref_number, recipient) | 중 | `lens5_multi_source` 응답 시간 초과 | PARTITION BY ref_number는 인덱스 친화적 (가정: ref_number 컬럼 인덱싱). benchmark required (목표: < 2000ms cold, < 500ms warm — queries.md §12). 미달 시 어플리케이션 단 dedup 또는 결과 캐싱 |
| R5 | Solo 1주 일정 초과 | 중 | MVP 기능 불완전 → 발표 임팩트 저하 | Out-of-Scope 룰 엄수 (Exclusions §1-7). Priority Low 항목 (`compare/`, PDF export, demo card) 즉시 컷. Priority Medium 중 `/lens/loops/[loopId]` 그래프 시각화는 발표 효과 큰 항목이므로 우선 유지, 다른 항목 컷 우선순위 |

---

## 4. 참조 구현 (Reference Implementations)

본 SPEC 구현 시 다음 기존 문서의 패턴을 차용 (수정 금지, 참조 only):

### 4.1 Concern Score 가중치 + tier 임계값

- **출처**: `.moai/project/product.md` §6 + `.moai/project/db/seed-data.md` §3 (concern-score-weights yaml seed)
- **구현 위치**: `.moai/project/db/concern-score-weights.yaml` (신규) + `apps/web/lib/lenses/concern-score.ts`
- **공식**:
  ```
  concern_score = 0.30 * zombie + 0.25 * ghost + 0.20 * (C?100:B?50:0)
                + 0.10 * min(director_overlap*10, 100) + 0.15 * (multi_source>=2?100:0)
  ```
- **Tier 임계값**: Critical ≥ 80, High 60-79, Medium 40-59, Low 20-39, Healthy < 20

### 4.2 Lens 3 Tier A/B/C 분류 룰

- **출처**: `.moai/project/db/queries.md` §5
- **구현 위치**: `apps/web/lib/lenses/loop.ts` + `sql/views/lens3_loop_classified.sql`
- **룰 요약**:
  - Tier A (합법): `distinct_bn_roots = 1` (internal hierarchy, e.g., Salvation Army `107951618`) 또는 `cra.identified_hubs` 통과 (CHIMP, United Way 등 20개)
  - Tier B (관찰): cross-org but `avg_program_ratio ≥ 0.6`
  - Tier C (의심): `cra.t3010_plausibility_flags.severity ≥ 3` 매칭 또는 cross-org + 낮은 program ratio

### 4.3 F-3 회피 — Window Function Dedup

- **출처**: `.moai/project/db/queries.md` §3
- **구현 위치**: `apps/web/lib/data-issues/safe-queries.ts` + `apps/web/lib/lenses/multi-source.ts`
- **패턴**:
  ```sql
  WITH dedup_fed AS (
    SELECT *, ROW_NUMBER() OVER (
      PARTITION BY ref_number, COALESCE(recipient_business_number, recipient_legal_name, _id::text)
      ORDER BY COALESCE(NULLIF(amendment_number,'')::int, 0) DESC NULLS LAST,
               amendment_date DESC NULLS LAST, _id DESC
    ) AS rn FROM fed.grants_contributions WHERE ref_number IS NOT NULL
  )
  SELECT ... FROM dedup_fed WHERE rn = 1
  ```
- **검증**: AC-5 — `dedup SUM ≤ raw SUM` 단조성 확인

### 4.4 정부 엔티티 제외 패턴

- **출처**: `.moai/project/db/rls-policies.md` §3.1 (Government exclusion patterns)
- **구현 위치**: `apps/web/lib/data-issues/safe-queries.ts`
- **패턴**: `legal_name ILIKE 'Government of %' OR ILIKE '%Health Authority%' OR ILIKE '%Crown Corporation%' OR ILIKE 'City of %' OR ILIKE 'Town of %' OR ILIKE 'Municipality of %'`
- **검증**: AC-9 — Government of Alberta (BN 124072513RR0010) zombie/ghost ranking에서 자동 제외

---

## 5. MX Tag 어노테이션 계획 (mx_plan)

본 절은 `/moai run` 단계에서 부착할 `@MX` 어노테이션 후보를 사전 식별한다 (`.claude/rules/moai/workflow/mx-tag-protocol.md`).

### 5.1 @MX:ANCHOR 후보 (high fan_in, invariant contract)

| 위치 | 사유 | 호출자 |
|---|---|---|
| `apps/web/lib/lenses/concern-score.ts` `computeConcernScore()` | fan_in ≥ 3 — entity profile, ranking, lens 페이지 모두 호출 | entity/[id]/page.tsx, page.tsx (랜딩), lens/*/page.tsx |
| `apps/web/lib/db/client.ts` (singleton `sql` export) | fan_in 매우 높음 — 모든 lens 함수 + safe-queries + scripts | 5개 lens, safe-queries, verify-db, benchmark-queries, healthz |

### 5.2 @MX:WARN 후보 (danger zone, requires @MX:REASON)

| 위치 | 사유 |
|---|---|
| `apps/web/lib/data-issues/safe-queries.ts` F-3 dedup helper | 미묘한 SQL 시맨틱: PARTITION BY 키 + ORDER BY tiebreaker 순서 변경 시 SUM 결과 달라짐. F-2 tiebreaker 누락 시 ROW_NUMBER tie로 트리플 카운트 재현 |
| `apps/web/lib/lenses/loop.ts` Tier 분류 분기 | C → A → B 순서 매칭 우선순위 (queries.md §5 CASE 순서). 변경 시 합법/의심 오분류 위험 |

### 5.3 @MX:NOTE 후보 (context delivery)

| 위치 | 사유 |
|---|---|
| `apps/web/lib/lenses/loop.ts` Tier-classification rule constants | Tier A는 internal hierarchy(distinct_bn_roots=1) 또는 known hub 통과; Tier B는 cross-org + program_ratio≥0.6; Tier C는 plausibility flag 또는 low program ratio |
| `apps/web/lib/lenses/concern-score.ts` weight constants | product.md §6 명시 — 변경 시 변경 추적 (yaml hot-reload는 미지원, server boot 시 한 번만 로드) |
| `apps/web/lib/data-issues/safe-queries.ts` 정부 엔티티 화이트리스트 | category 기반 제외는 부정확 — legal_name pattern이 더 신뢰 가능 (schema.md §7 카테고리 분포 footnote 참조) |

### 5.4 @MX:TODO 후보 (RED phase stub)

RED-GREEN-REFACTOR 사이클의 RED 단계에서 빈 lens 함수에 부착, GREEN 단계에서 제거:

- `lib/lenses/zombie.ts` `getZombieScore(bn: string)` — RED stub
- `lib/lenses/ghost.ts` `getGhostScore(bn: string)` — RED stub
- `lib/lenses/loop.ts` `getLoopParticipation(bn: string)` — RED stub
- `lib/lenses/director.ts` `getDirectorOverlap(bn: string)` — RED stub
- `lib/lenses/multi-source.ts` `getMultiSourceFunding(entityId: string)` — RED stub

---

## 6. 검증 및 품질 게이트

### 6.1 TRUST 5 매핑

- **Tested**: Vitest 85% coverage (line + branch). 통합 테스트는 read-only replica 직결 (Vitest integration 폴더), Lens 3 Tier 분류 결정론 검증 (동일 BN → 동일 Tier)
- **Readable**: kebab-case 파일명, camelCase TS 식별자, PascalCase 타입, snake_case SQL 컬럼 (structure.md §7). 한국어 주석 허용 (language.yaml `code_comments: ko`)
- **Unified**: Biome 1.9 단일 도구 (lint + format). pre-commit hook (lefthook) 자동 실행
- **Secured**: postgres.js tagged template (SQL injection 자동 방지). `NEXT_PUBLIC_` 미사용 — PGCONN은 server-side만. `robots.txt: Disallow /entity/` (PII 인덱싱 차단). Rate limit middleware
- **Trackable**: Conventional commits + SPEC ID 참조 (e.g., `feat(SPEC-RHI-001): add zombie lens`). 커밋 메시지는 한국어 (language.yaml `git_commit_messages: ko`)

### 6.2 LSP 품질 게이트 (`.moai/config/sections/quality.yaml`)

- **plan**: LSP baseline capture (현재는 빈 `apps/web/`이므로 baseline = 0)
- **run**: zero errors, zero type errors, zero lint warnings
- **sync**: zero errors, max 10 warnings, clean LSP

### 6.3 성능 게이트 (tech.md §5.1 매핑)

| 페이지 | TTFB 목표 (warm) | 검증 |
|---|---|---|
| `/` | < 800ms | AC-8 95p < 1.5s under rate-limit |
| `/entity/[id]` | < 1.2s warm cache | AC-12 (cold first hit allowed up to 2.5s) |
| `/lens/*` | < 1s | benchmark-queries.ts |
| `/methodology` | < 200ms | static |

---

## 7. 데모 시나리오 매핑 (product.md §9)

발표 5분 내 보여줄 3개 케이스 — 단계 4 완료 후 `scripts/sample-entities.ts`로 실 데이터 후보 추출:

1. **Zombie 케이스**: 정부 자금 ≥ $X 수령 후 filing 중단 자선단체 → `/entity/[id]` 페이지에서 funding timeline 시각화
2. **Loop Tier C 케이스**: cross-org 사이클 중 의심도 최상위 → `/lens/loops/[loopId]` react-flow 그래프 + 분류 근거 narrative
3. **Multi-Source High Concern 케이스**: 5개 렌즈 중 3개 이상 hit한 엔티티 → `/entity/[id]` 통합 점수 + 모든 시그널 한 화면

---

## 8. 다음 단계

1. 본 plan.md + spec.md + acceptance.md 사용자 승인
2. `/moai run SPEC-RHI-001` — manager-tdd 위임 (TDD 모드, quality.yaml 자동 결정)
3. 단계 1부터 RED-GREEN-REFACTOR 순차 진행
4. 단계 3 완료 후 발표 후보 BN 추출 (`scripts/sample-entities.ts`)
5. `/moai sync SPEC-RHI-001` — manager-docs로 README + codemaps + 발표 자료 동기화

---

Version: 0.1.2
Last Updated: 2026-04-27
