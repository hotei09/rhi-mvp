# Structure: Recipient Health Index (RHI)

Solo MVP를 위한 디렉토리 구조 및 코드 조직.

> 본 문서는 product.md의 5개 렌즈와 1:1 대응되는 모듈 구조를 정의한다. tech.md는 구현 도구·라이브러리 선정을 다룬다.

## 1. 최상위 디렉토리

```
Ottawa_hacker/                  # repo root
├── .moai/                      # MoAI-ADK 메타데이터 (이미 존재)
│   ├── project/
│   │   ├── product.md          # 제품 정의 (작성됨)
│   │   ├── structure.md        # 본 문서
│   │   ├── tech.md             # 스택·DB·배포
│   │   ├── brand/              # 디자인 토큰 (필요 시 활용)
│   │   └── db/                 # DB 메타 (다음 단계 /moai db init 으로 생성)
│   ├── specs/                  # /moai plan 산출물
│   └── reports/                # 평가/감사 리포트
│
├── .claude/                    # Claude Code 설정 (이미 존재)
├── CLAUDE.md                   # 프로젝트 지시문 (이미 존재)
├── .mcp.json                   # MCP 설정
├── .gitignore
│
├── apps/
│   └── web/                    # Next.js 16 App Router (단일 앱)
│       ├── app/                # 라우트
│       ├── components/         # UI
│       ├── lib/                # 도메인 로직 + DB 어댑터
│       ├── public/             # 정적 자산
│       ├── tests/              # Vitest + Playwright
│       ├── next.config.ts
│       ├── tsconfig.json
│       ├── package.json
│       └── .env.local          # 로컬 DB 연결 (gitignored)
│
├── packages/                   # (선택) 공유 패키지가 생기면
│
├── sql/                        # SQL 자산 (Server Action에서 import)
│   ├── views/                  # 사전 정의 분석 뷰
│   │   ├── lens1_zombie.sql
│   │   ├── lens2_ghost.sql
│   │   ├── lens3_loop_classified.sql
│   │   ├── lens4_director_overlap.sql
│   │   ├── lens5_multi_source.sql
│   │   ├── concern_score.sql
│   │   └── high_concern_ranking.sql
│   ├── migrations/             # 자체 테이블 (기록용)이 필요할 경우만
│   └── README.md               # 각 SQL의 입력·출력·계산식 문서화
│
├── scripts/
│   ├── verify-db.ts            # 연결 + 스키마 sanity check
│   ├── sample-entities.ts      # 데모 시나리오용 엔티티 후보 추출
│   └── benchmark-queries.ts    # 핫 쿼리 응답시간 측정
│
└── docs/                       # 발표·심사 자료 (선택)
    ├── methodology.md          # 점수 공식 + 데이터 함정 (방법론 페이지의 source)
    ├── demo-script.md          # 5분 발표 스크립트
    └── data-issues.md          # KNOWN-DATA-ISSUES.md 사본 (참조용)
```

> Repo는 단일 Next.js 앱 + 분리된 SQL 자산 폴더 구조. 모노레포 도구(turbo, pnpm workspaces)는 도입하지 않는다 — Solo MVP에 과한 복잡도.

## 2. apps/web 내부 구조 (Next.js 16 App Router)

```
apps/web/
├── app/
│   ├── layout.tsx                  # 루트 레이아웃 (header, footer, theme)
│   ├── page.tsx                    # 랜딩: High Concern 랭킹 + CTA
│   ├── loading.tsx                 # 글로벌 로딩
│   ├── error.tsx                   # 글로벌 에러
│   ├── not-found.tsx
│   │
│   ├── entity/
│   │   └── [entityId]/             # 엔티티 프로필 페이지
│   │       ├── page.tsx            # 5개 렌즈 통합 뷰
│   │       └── loading.tsx
│   │
│   ├── lens/
│   │   ├── zombie/page.tsx         # Lens 1 분석 페이지
│   │   ├── ghost/page.tsx          # Lens 2 분석 페이지
│   │   └── loops/
│   │       ├── page.tsx            # Lens 3 랭킹 + 분류 분포
│   │       └── [loopId]/page.tsx   # 개별 사이클 그래프 + 분류 근거
│   │
│   ├── ranking/
│   │   └── page.tsx                # 전체 High Concern 랭킹 + facets
│   │
│   ├── methodology/
│   │   └── page.tsx                # 방법론 + F-1/F-3 함정 공개
│   │
│   ├── compare/
│   │   └── page.tsx                # (Priority Low) 엔티티 2개 비교
│   │
│   ├── search/
│   │   └── route.ts                # (선택) Server Action 대신 API route
│   │
│   └── api/                        # 필요 최소
│       └── healthz/route.ts        # 헬스체크
│
├── components/
│   ├── ui/                         # shadcn/ui 자동 생성
│   │   ├── button.tsx, card.tsx, dialog.tsx, table.tsx, tabs.tsx, badge.tsx
│   │   └── ...
│   ├── layout/
│   │   ├── header.tsx, footer.tsx, nav.tsx
│   │   └── search-box.tsx          # 헤더의 글로벌 검색
│   ├── entity/
│   │   ├── concern-card.tsx        # 통합 Concern Score 카드
│   │   ├── lens-summary.tsx        # 5개 렌즈 요약 (raw drill-down 트리거)
│   │   ├── funding-timeline.tsx    # FED+AB+CRA 자금 타임라인 (Recharts)
│   │   ├── identity-block.tsx      # 이름·BN·주소·카테고리
│   │   └── raw-row-drawer.tsx      # SQL 트레이스 + raw row 표시
│   ├── lens/
│   │   ├── zombie-detail.tsx       # Lens 1 상세
│   │   ├── ghost-detail.tsx        # Lens 2 상세
│   │   ├── loop-detail.tsx         # Lens 3 상세 (분류 근거 포함)
│   │   ├── director-detail.tsx     # Lens 4 상세
│   │   └── multi-source-detail.tsx # Lens 5 상세
│   ├── viz/
│   │   ├── concern-distribution.tsx  # Recharts 히스토그램
│   │   ├── loop-graph.tsx          # react-flow 네트워크
│   │   └── funding-stacked.tsx     # FED+AB+CRA stacked bar
│   └── shared/
│       ├── empty-state.tsx, skeleton.tsx, error-boundary.tsx
│       └── methodology-popover.tsx # 점수 공식 호버 설명
│
├── lib/
│   ├── db/
│   │   ├── client.ts               # postgres.js 인스턴스 (싱글톤)
│   │   ├── env.ts                  # 환경변수 검증 (zod)
│   │   └── views.ts                # SQL view import 통합 export
│   ├── lenses/                     # 5개 렌즈의 도메인 로직
│   │   ├── zombie.ts               # Lens 1: 쿼리 + 결과 타입 + 점수 계산
│   │   ├── ghost.ts                # Lens 2
│   │   ├── loop.ts                 # Lens 3: 분류 로직 (Tier A/B/C)
│   │   ├── director.ts             # Lens 4
│   │   ├── multi-source.ts         # Lens 5
│   │   └── concern-score.ts        # 통합 점수 계산 + 가중치 yaml 로더
│   ├── domain/
│   │   ├── entity.ts               # Entity 타입 + 어댑터 (golden_records ⇄ UI)
│   │   ├── funding.ts              # Funding 통합 타입
│   │   └── identifiers.ts          # BN normalize, entity_id 변환
│   ├── data-issues/
│   │   ├── catalog.ts              # F-1, F-2, F-3, C-*, A-* 코드와 메타
│   │   └── safe-queries.ts         # 함정 회피 쿼리 패턴 (vw_agreement_current 등)
│   ├── format/
│   │   ├── currency.ts             # CAD 표시 + 약식 ($1.2M)
│   │   ├── date.ts                 # fpe → "2024 FY" 등
│   │   └── bn.ts                   # 정규화·표시
│   └── utils.ts                    # cn (Tailwind merge), etc.
│
├── tests/
│   ├── unit/                       # Vitest
│   │   ├── concern-score.test.ts
│   │   ├── loop-classification.test.ts
│   │   └── identifiers.test.ts
│   ├── integration/                # DB 연결한 테스트 (READ-ONLY)
│   │   └── lens-views.test.ts
│   └── e2e/                        # Playwright
│       └── entity-profile.spec.ts
│
├── public/
│   ├── favicon.ico
│   └── og.png                      # 소셜 공유 카드
│
├── styles/
│   └── globals.css                 # Tailwind base + 디자인 토큰 (.moai/project/brand 참조)
│
├── next.config.ts
├── tsconfig.json
├── package.json
├── biome.json                      # 린트+포맷 (eslint+prettier 대체)
├── playwright.config.ts
├── vitest.config.ts
└── .env.local                      # PGCONN, gitignored
```

## 3. 데이터 흐름 (요청 → 응답)

```
[Browser]
   │
   │ GET /entity/{entityId}
   ▼
[Next.js Server Component]
   │
   │ import { getEntityProfile } from '@/lib/lenses/...'
   ▼
[lib/lenses/*.ts]  ──── lib/db/client.ts ────▶  Render Postgres (replica)
   │                                               │
   │ ◀──────────────── result rows ───────────────┘
   │
   │ score 계산 (concern-score.ts)
   ▼
[Server Component → Client Component (drilldown)]
   │
   ▼
[Browser: rendered HTML + interactive panels]
```

- 모든 DB 쿼리는 **Server Component / Server Action**에서 실행 (Render PG credentials를 클라이언트에 노출하지 않음)
- 5개 렌즈 쿼리는 **병렬** (Promise.all) — entity 페이지 한 번 요청에 5개 SELECT가 동시 실행
- 핫 쿼리 (랭킹 페이지, methodology) 는 `next: { revalidate: 300 }` 5분 캐시
- 엔티티 프로필은 `revalidate: 60` (1분) — 데이터 변동 거의 없음
- raw drill-down 만 클라이언트 액션으로 fetch (지연 로딩)

## 4. SQL 자산 조직 (sql/views/)

### 4.1 명명 규칙

- `lens{N}_{name}.sql` — 5개 렌즈 각자 독립
- 모든 view는 `rhi_` 접두사 (예: `rhi_lens1_zombie`) — 공식 데이터 view와 충돌 방지
- 모든 view는 idempotent: `CREATE OR REPLACE VIEW ...`
- **Materialized view는 사용하지 않음** (Render Postgres replica는 read-only이며, 우리는 자체 schema 생성 권한 없음)

→ **수정 사항**: replica는 read-only이므로 view를 거기에 만들 수 없다. 대신:

### 4.2 실제 전략 (read-only replica 대응)

- SQL view 정의 파일은 **참조용 / 미래 자체 인스턴스용**으로 보관
- MVP 단계에서는 **Server Action 안에서 raw SQL 문자열로 실행** (CTE 기반)
- `lib/lenses/*.ts` 가 SQL 파일을 `import` 후 파라미터 바인딩하여 실행
- 해커톤 발표 후 자체 DB에 view 배포 가능하게 SQL은 Postgres 표준 문법으로 작성

```typescript
// lib/lenses/zombie.ts
import { sql } from '@/lib/db/client';
import zombieQuery from '../../../../sql/views/lens1_zombie.sql?raw'; // Vite/Next.js raw import

export async function getZombieScore(bn: string) {
  const rows = await sql.unsafe(zombieQuery, [bn]);
  return computeZombieScore(rows[0]);
}
```

### 4.3 핵심 view 목록

| 파일 | 출력 | 의존 테이블 |
|---|---|---|
| lens1_zombie.sql | bn, last_funding_date, last_filing_date, gap_months, govt_share_avg, zombie_score | govt_funding_by_charity, cra_identification, cra_financial_general |
| lens2_ghost.sql | bn, employee_count, comp_ratio, program_ratio, govt_share, ghost_score | cra_financial_general (field_5862-5864), govt_funding_by_charity |
| lens3_loop_classified.sql | loop_id, path_bns, total_flow, tier (A/B/C), classification_reasons[] | loops, loop_participants, identified_hubs, scc_components, overhead_by_charity |
| lens4_director_overlap.sql | bn, overlap_count, overlap_directors[] | cra_directors |
| lens5_multi_source.sql | entity_id, bn, source_count, fed_total, ab_total, cra_govt_total, same_year_overlap | entity_source_links, vw_agreement_current, ab_grants, govt_funding_by_charity |
| concern_score.sql | bn, zombie_score, ghost_score, loop_signal, director_signal, multi_source_signal, concern_score, tier | (위 5개 view 합성) |
| high_concern_ranking.sql | bn, legal_name, category, concern_score, tier | concern_score |

## 5. 라우트별 책임 매트릭스

| 라우트 | 페이지 형식 | 데이터 소스 | 캐싱 | 우선순위 |
|---|---|---|---|---|
| `/` | Server Component | high_concern_ranking (top 50) + 통계 | 5분 | High |
| `/entity/{id}` | Server Component | 5개 렌즈 병렬 + identification + funding history | 1분 | High |
| `/ranking` | Server Component + 클라이언트 필터 | high_concern_ranking + facets | 5분 | High |
| `/lens/zombie` | Server Component | lens1_zombie 상위 N | 10분 | Medium |
| `/lens/ghost` | Server Component | lens2_ghost 상위 N | 10분 | Medium |
| `/lens/loops` | Server Component | lens3_loop_classified 분포 + 상위 N | 10분 | Medium |
| `/lens/loops/{loopId}` | Server Component | 개별 loop + path 노드 정보 | 10분 | Medium |
| `/methodology` | Static | 마크다운 / data-issues 카탈로그 | static | Medium |
| `/compare?a=&b=` | Server Component | 2개 엔티티 병렬 | 1분 | Low |
| `/api/healthz` | Route handler | DB ping | none | High |

## 6. 디렉토리 사용 정책

| 디렉토리 | 용도 | 누가 수정하는가 |
|---|---|---|
| `apps/web/lib/lenses/` | 도메인 로직 (5개 렌즈) | 핵심, 가장 자주 |
| `apps/web/lib/db/` | DB 연결, env | 초기 셋업 후 거의 안 변경 |
| `apps/web/components/entity/` | UI 빌딩 블록 (entity 화면) | 자주 |
| `apps/web/components/viz/` | Recharts/react-flow wrapper | 중반 집중 |
| `sql/views/` | SQL 자산 | lens 추가/조정 시 |
| `scripts/` | 일회성 도구 | 거의 추가 안 함 |
| `docs/` | 발표용 자료 | 막판에 집중 |
| `tests/` | 자동 검증 | 핵심 함수 작성 시 동반 |

## 7. 명명 규칙 요약

- **파일**: kebab-case (`concern-score.ts`)
- **TS 함수/변수**: camelCase (`getZombieScore`, `concernScore`)
- **TS 타입**: PascalCase (`EntityProfile`, `LensResult`)
- **SQL view**: snake_case + `rhi_` 접두사 (`rhi_lens1_zombie`)
- **컬럼**: snake_case (Postgres 관례 그대로)
- **상수**: SCREAMING_SNAKE_CASE (`CONCERN_TIER_THRESHOLDS`)
- **React 컴포넌트**: PascalCase 파일명 + 컴포넌트 (`ConcernCard.tsx` → `<ConcernCard />`)

## 8. 모듈 경계 원칙

- **lib/lenses/** 는 SQL과 점수 계산만. UI 의존성 0
- **components/** 는 lib만 import. 다른 component import은 ui/ → 내 도메인 component로 단방향
- **app/** 는 components/ + lib/만 import. 절대로 lib 내부 구현을 페이지에 인라인하지 않음
- **sql/** 는 외부 파일 시스템에 둠. import 시 raw text loader 사용

## 9. 환경 분리

| 환경 | DB 연결 | 배포 |
|---|---|---|
| local dev | Render replica 직결 (.env.local의 PGCONN) | `bun dev` 또는 `pnpm dev` |
| preview (Vercel PR) | 동일 Render replica | Vercel auto |
| production (Vercel) | 동일 Render replica | Vercel main 배포 |

해커톤 1주는 staging 분리 없음. 모든 환경이 같은 read-only replica 바라봄.

## 10. 다음 단계 산출물

이 문서 작성 후:
- `tech.md` 가 작성되면 의존성 패키지 명시
- `/moai db init` 실행 시 `.moai/project/db/schema.md` 자동 생성 (CRA/FED/AB 테이블 메타)
- `/moai plan` 실행 시 `.moai/specs/SPEC-RHI-001/spec.md` 작성 (5개 렌즈 EARS 요구사항)

---

Version: 1.0.0
Last Updated: 2026-04-27
Reference: product.md (5 lenses), tech.md (stack), .moai/project/db/ (schema after /moai db init)
