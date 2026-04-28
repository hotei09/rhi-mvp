# Tech: Recipient Health Index (RHI)

스택, DB 통합, 핵심 쿼리 패턴, 데이터 함정 회피, 배포 전략.

> product.md (가치 제안 + 5개 렌즈) 와 structure.md (디렉토리 + 모듈 경계) 의 구체 구현 도구를 정의한다.

## 1. 스택 한 눈에

| 영역 | 선택 | 이유 |
|---|---|---|
| 프레임워크 | **Next.js 16** App Router | Server Component로 PG 직결, 단일 repo로 BE+FE, Vercel 배포 자동화 |
| 언어 | **TypeScript 5.7+** strict mode | DB row → TS 타입 안전성, 도메인 로직 명확 |
| 런타임 | Node 22 LTS | Vercel 기본, postgres.js 호환 |
| 패키지 매니저 | **pnpm** 또는 **bun** | bun이 빠르나 Vercel 호환은 pnpm이 안전. 우선 pnpm 확정. |
| DB 드라이버 | **postgres** (porsager/postgres) | Edge/Node 양쪽 지원, prepared statement 지원, prisma보다 가벼움 |
| 검증 | **zod** 3.x | 환경변수 + DB row 런타임 검증 |
| UI 키트 | **shadcn/ui** + Radix | Tailwind 기반 합성형 컴포넌트, OKLCH 테마 |
| 스타일 | **Tailwind CSS** 4.x | 디자인 토큰 호환 (.moai/project/brand 활용 가능) |
| 차트 | **Recharts** 2.x | 분포·시계열·stacked bar |
| 그래프 | **react-flow** 12.x (= reactflow) | Lens 3 사이클 네트워크 시각화 |
| 테스트 단위 | **Vitest** | Next.js와 호환성 우수, Jest보다 빠름 |
| 테스트 E2E | **Playwright** | Chrome MCP + 시나리오 기록 가능 |
| 린트·포맷 | **Biome** 1.9+ | eslint+prettier 대체, 단일 도구로 속도 ↑ |
| 타입 체크 | **tsc** strict | CI 게이트에서 실행 |
| 배포 | **Vercel** | Next.js native, Edge functions 옵션 |
| DB 호스팅 | **Render Postgres** (read replica) | 해커톤 제공, 자체 호스팅 안 함 |

## 2. DB 통합

### 2.1 연결 정보

```bash
# .env.local (gitignored)
PGCONN="postgresql://database_database_w2a1_user:JvqVh0msmuBrwgING68S52H0sz3wEEXI@dpg-d7auudv5r7bs738iqh70-b.replica-cyan.oregon-postgres.render.com/database_database_w2a1?sslmode=require"
```

- **Vercel 환경변수에도 동일 값** 등록 (Production / Preview / Development 모두)
- 해커톤 종료 후 자격증명 회전 가능성 → README에 "creds rotation" 노트 추가

### 2.2 클라이언트 셋업

```typescript
// apps/web/lib/db/client.ts
import postgres from 'postgres';
import { env } from './env';

declare global {
  // eslint-disable-next-line no-var
  var __pg: ReturnType<typeof postgres> | undefined;
}

export const sql = globalThis.__pg ?? postgres(env.PGCONN, {
  ssl: 'require',
  max: 10,                    // 동시 연결 제한 (Render free 티어 보호)
  idle_timeout: 20,           // 초
  connect_timeout: 10,
  prepare: true,
  transform: { undefined: null },
});

if (process.env.NODE_ENV !== 'production') {
  globalThis.__pg = sql;       // dev hot reload 시 연결 재사용
}
```

### 2.3 환경변수 검증 (zod)

```typescript
// apps/web/lib/db/env.ts
import { z } from 'zod';

const schema = z.object({
  PGCONN: z.string().url().refine(
    (s) => s.startsWith('postgresql://') || s.startsWith('postgres://'),
    'PGCONN must be a postgres connection string',
  ),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export const env = schema.parse(process.env);
```

### 2.4 쿼리 패턴

**원칙**: tagged template literal + 파라미터 바인딩만 사용. 문자열 연결 SQL injection 절대 금지.

```typescript
// 안전 (postgres.js tagged template)
const rows = await sql`
  SELECT bn, legal_name, total_govt
  FROM cra.govt_funding_by_charity
  WHERE bn = ${userInputBn}
  ORDER BY fiscal_year DESC
  LIMIT 10
`;

// raw 문자열 SQL이 필요한 경우 (sql/views/ import)
const rows = await sql.unsafe(zombieQuery, [bn, threshold]);
```

## 3. 데이터 함정 회피 (KNOWN-DATA-ISSUES.md 대응)

이 절은 product.md §11 위험요소를 구현 레벨로 풀어쓴다.

### 3.1 F-3: agreement_value 누적 함정

```typescript
// ❌ 잘못된 방식 (raw 테이블 SUM → 트리플 카운트)
SELECT SUM(agreement_value) FROM fed.grants_contributions;

// ✅ 올바른 방식 (제공된 view 사용)
SELECT SUM(agreement_value) FROM fed.vw_agreement_current;
// 또는
SELECT SUM(agreement_value) FROM fed.vw_agreement_originals;
```

`lib/data-issues/safe-queries.ts` 에 다음 헬퍼 노출:

```typescript
export const FED_AGREEMENT_VIEW = 'fed.vw_agreement_current'; // 현재 commitment
export const FED_AGREEMENT_ORIGINALS_VIEW = 'fed.vw_agreement_originals'; // 원본 가치만
// 어떤 코드든 fed.grants_contributions 의 agreement_value를 SUM하면 lint 룰로 차단
```

### 3.2 F-1 / F-2: ref_number 충돌

- 동일 ref_number가 다른 recipient를 가리킬 수 있음
- 자체 PK는 `_id` 컬럼만 신뢰
- 그루핑 키는 `(ref_number, COALESCE(recipient_business_number, recipient_legal_name, _id::text))` 사용

### 3.3 govt_share 함정 (정부 엔티티)

```typescript
// product.md §5 Lens 1 — 정부·보건당국 카테고리 제외
const EXCLUDED_CATEGORIES = ['government', 'health authority', 'crown corporation', 'hospital'];

// SQL에서:
WHERE LOWER(category) NOT IN (
  'government of canada', 'crown corporation', 'health authority',
  'hospital', 'government of the province of alberta', ...
)
```

카테고리 매핑은 `cra.cra_category_lookup` 의 32kB 룩업을 활용해 제외 목록을 데이터로 관리.

### 3.4 단순 동명이인 (Lens 4)

- `cra_directors` 의 `last_name + first_name` 매칭은 위양성 다발
- 정밀도 보장: `last_name + first_name + initials` 셋이 모두 일치해야 동일인 후보
- 추가 약화: `cra_identification.postal_code` 같은 지역 컨텍스트 (이사 본인 주소 컬럼 부재 → 이 시그널은 단순 카운트로만 표시, 강한 결론 도출 금지)

## 4. 핵심 SQL 패턴 (sql/views/ 미리보기)

> 실제 파일은 `sql/views/lens{N}_*.sql` 에 작성. 여기서는 핵심 logic만 발췌.

### 4.1 Lens 1 — Zombie

```sql
-- sql/views/lens1_zombie.sql (의사 코드)
WITH last_funding AS (
  SELECT bn, MAX(fiscal_year) AS last_funding_year, SUM(total_govt) AS total_funding
  FROM cra.govt_funding_by_charity
  WHERE govt_share_of_rev >= 0.7
  GROUP BY bn
),
last_filing AS (
  SELECT bn, MAX(fpe) AS last_fpe FROM cra.cra_financial_general GROUP BY bn
),
charity_meta AS (
  SELECT bn, MAX(fiscal_year) AS latest_year, MAX(legal_name) AS legal_name,
         MAX(category) AS category
  FROM cra.cra_identification GROUP BY bn
)
SELECT
  m.bn, m.legal_name, m.category,
  f.last_funding_year, f.total_funding,
  fl.last_fpe,
  EXTRACT(MONTH FROM AGE(CURRENT_DATE, fl.last_fpe))
    + 12 * EXTRACT(YEAR FROM AGE(CURRENT_DATE, fl.last_fpe)) AS months_since_last_filing,
  -- zombie_score: 마지막 자금 ↔ 마지막 filing 사이 ≤ 12개월이면 100, 그 이상은 감소
  CASE
    WHEN fl.last_fpe IS NULL THEN 0
    WHEN fl.last_fpe < CURRENT_DATE - INTERVAL '24 months'
      AND f.last_funding_year >= EXTRACT(YEAR FROM fl.last_fpe) - 1 THEN 100
    WHEN fl.last_fpe < CURRENT_DATE - INTERVAL '18 months' THEN 70
    WHEN fl.last_fpe < CURRENT_DATE - INTERVAL '12 months' THEN 40
    ELSE 0
  END AS zombie_score
FROM charity_meta m
JOIN last_funding f USING (bn)
LEFT JOIN last_filing fl USING (bn)
WHERE LOWER(COALESCE(m.category, '')) NOT IN (
  'government of canada', 'crown corporation', 'health authority',
  'hospital', 'government of the province of alberta'
);
```

(실제 파일에서는 정밀화 + 코멘트 + 카테고리 화이트리스트 SQL 분리)

### 4.2 Lens 3 — Loop 분류

```sql
-- sql/views/lens3_loop_classified.sql (의사 코드)
WITH loop_meta AS (
  SELECT
    l.id AS loop_id, l.hops, l.path_bns, l.path_display, l.total_flow, l.min_year, l.max_year,
    -- 동일 BN 루트 (앞 9자리) 모두 같으면 internal hierarchy
    cardinality((SELECT array_agg(DISTINCT substr(p, 1, 9)) FROM unnest(l.path_bns) p)) AS distinct_bn_roots
  FROM cra.loops l
),
hub_touch AS (
  -- 알려진 도네이션 플랫폼/연합자선 허브를 거치는 loop
  SELECT DISTINCT lp.loop_id
  FROM cra.loop_participants lp
  JOIN cra.identified_hubs h ON h.bn = lp.bn
  WHERE h.hub_type = 'degree_top_n'
),
program_health AS (
  -- 참여 BN 모두 program_expenditure ratio가 높은가
  SELECT lp.loop_id,
         AVG(COALESCE(o.program_ratio, 0)) AS avg_program_ratio
  FROM cra.loop_participants lp
  LEFT JOIN cra.overhead_by_charity o ON o.bn = lp.bn
  GROUP BY lp.loop_id
),
plausibility AS (
  SELECT DISTINCT lp.loop_id
  FROM cra.loop_participants lp
  JOIN cra.t3010_plausibility_flags pf ON pf.bn = lp.bn AND pf.severity >= 3
)
SELECT
  m.loop_id, m.hops, m.path_display, m.total_flow,
  CASE
    WHEN m.distinct_bn_roots = 1 THEN 'A'   -- 합법 (internal hierarchy)
    WHEN m.loop_id IN (SELECT loop_id FROM hub_touch) THEN 'A'  -- 알려진 허브 통과
    WHEN m.loop_id IN (SELECT loop_id FROM plausibility) THEN 'C'  -- 데이터 품질 플래그
    WHEN ph.avg_program_ratio >= 0.6 THEN 'B'  -- 관찰
    ELSE 'C'  -- 의심
  END AS tier,
  ph.avg_program_ratio
FROM loop_meta m
LEFT JOIN program_health ph USING (loop_id);
```

### 4.3 Concern Score (통합)

```typescript
// lib/lenses/concern-score.ts
import weights from '../../../../.moai/project/db/concern-score-weights.yaml';

export type LensSignals = {
  zombie_score: number;       // 0-100
  ghost_score: number;        // 0-100
  loop_tier: 'A' | 'B' | 'C' | null;
  director_overlap: number;   // count
  multi_source_count: number; // 1, 2, 3
};

export function computeConcernScore(s: LensSignals): { score: number; tier: 'Critical'|'High'|'Medium'|'Low'|'Healthy'; components: Record<string, number> } {
  const loopSignal = s.loop_tier === 'C' ? 100 : s.loop_tier === 'B' ? 50 : 0;
  const directorSignal = Math.min(s.director_overlap * 10, 100);
  const multiSourceSignal = s.multi_source_count >= 2 ? 100 : 0;

  const score =
      weights.zombie       * s.zombie_score
    + weights.ghost        * s.ghost_score
    + weights.loop         * loopSignal
    + weights.director     * directorSignal
    + weights.multi_source * multiSourceSignal;

  const tier = score >= 80 ? 'Critical' : score >= 60 ? 'High' : score >= 40 ? 'Medium' : score >= 20 ? 'Low' : 'Healthy';
  return {
    score: Math.round(score * 10) / 10,
    tier,
    components: { zombie: s.zombie_score, ghost: s.ghost_score, loop: loopSignal, director: directorSignal, multi_source: multiSourceSignal },
  };
}
```

가중치는 `.moai/project/db/concern-score-weights.yaml` 분리:

```yaml
# product.md §6 default
zombie: 0.30
ghost: 0.25
loop: 0.20
director: 0.10
multi_source: 0.15
```

## 5. 성능

### 5.1 응답 목표

| 페이지 | 목표 (TTFB) |
|---|---|
| / (랭킹) | < 800ms |
| /entity/{id} | < 1.2s (5개 렌즈 병렬) |
| /lens/* | < 1s |
| /methodology | < 200ms (static) |

### 5.2 전략

- **렌즈 쿼리 병렬**: `Promise.all([zombie, ghost, loop, director, multiSource])`
- **인덱스 의존**: bn, fiscal_year, fpe 컬럼은 이미 인덱싱되어 있다고 가정 (read replica이므로 추가 불가). 쿼리에서 인덱스 친화적 WHERE 절 작성
- **Next.js 캐싱**: Server Component fetch에 `next: { revalidate: 60 }` 설정. Vercel data cache로 재요청 차단
- **결과 페이지네이션**: 랭킹은 `LIMIT 50 OFFSET`로 page 단위 제한
- **N+1 회피**: 엔티티 프로필에서 funding history 등은 단일 SQL CTE로 묶어 한 번에

### 5.3 cold start 완화

- Vercel Region 고정: `vercel.json` 의 `regions: ['iad1']` (us-east, Render Oregon과 가까움) — 또는 Vercel Pro에서 region 다중 선택
- `prefetch={false}`로 불필요 fetch 차단

## 6. 보안

- **Read-only replica** — 쓰기 시도 시 Postgres 자체에서 거부됨. 추가 쓰기 보호 필요 없음
- **Credentials 노출**: PGCONN은 server-side ENV에만, 클라이언트 번들에 절대 포함되지 않도록 확인 (Next.js는 `NEXT_PUBLIC_` 접두사 없는 변수는 자동 보호)
- **SQL injection**: postgres.js tagged template은 자동 파라미터 바인딩. 문자열 연결 금지
- **Open data 윤리**: 랭킹 엔티티 표시 시 "이 리스트는 자동 분류이며 법적 결론이 아님" 디스클레이머 항상 노출. Methodology 페이지에서 명시
- **PII**: T3010 directors의 first/last name은 공개 데이터이나 검색·인덱싱 ROBOT 차단 (`robots.txt` Disallow: `/entity/`)
- **Rate limit**: 해커톤 시연 중 traffic 폭주 가능 → Vercel Edge Middleware로 IP당 분당 30 req 제한

## 7. 개발 환경 셋업

### 7.1 사전 요구사항

- Node 22+ (`fnm install 22 && fnm use 22`)
- pnpm 9+ (`npm i -g pnpm`)
- PostgreSQL 클라이언트 16+ (`brew install postgresql@16`) — 디버깅용 (이미 설치됨 확인)
- Vercel CLI (`npm i -g vercel`) — 선택

### 7.2 초기화

```bash
# repo 루트에서
mkdir -p apps/web && cd apps/web
pnpm dlx create-next-app@latest . --ts --app --tailwind --use-pnpm --no-eslint --no-src-dir --import-alias '@/*'
pnpm add postgres zod recharts reactflow
pnpm add -D @types/node biome vitest @vitest/ui playwright @playwright/test
pnpm dlx shadcn@latest init    # OKLCH theme, neutral base
pnpm dlx shadcn@latest add button card table tabs dialog badge skeleton input
```

### 7.3 헬스체크

```bash
# DB 연결 확인
pnpm exec tsx scripts/verify-db.ts
# 출력: "✅ Connected to Postgres 18.3 — 79 tables, 23M rows"

# 핫 쿼리 벤치
pnpm exec tsx scripts/benchmark-queries.ts
```

### 7.4 dev 실행

```bash
pnpm dev    # http://localhost:3000
```

## 8. 배포

### 8.1 Vercel 프로젝트

```bash
cd apps/web
vercel link
vercel env add PGCONN production
vercel env add PGCONN preview
vercel env add PGCONN development
vercel --prod
```

### 8.2 vercel.json

```json
{
  "framework": "nextjs",
  "regions": ["iad1"],
  "buildCommand": "pnpm build",
  "installCommand": "pnpm install --frozen-lockfile"
}
```

### 8.3 도메인

- 기본: `<project>.vercel.app`
- 커스텀 (선택): `rhi.{user-domain}` — 발표 직전 30분 안에 결정 가능

## 9. CI / 품질 게이트

해커톤 1주 Solo 일정에서는 CI를 GitHub Actions로 별도 구성하지 않고 Vercel build 게이트로 충분하다. 단:

- `pnpm typecheck` (tsc --noEmit) 빌드 전 자동 실행
- `pnpm test` (Vitest) 로컬 commit 전 수동
- `pnpm lint` (Biome) commit hook (lefthook) 로 자동
- E2E (Playwright) 는 발표 직전 1회 manual 실행 (3개 데모 시나리오 통과 확인)

## 10. MoAI-ADK 통합

이 프로젝트는 MoAI-ADK 워크플로우와 함께 진행한다.

| 단계 | MoAI 명령 | 산출물 |
|---|---|---|
| DB 메타 | `/moai db init` | `.moai/project/db/{schema.md, erd.mmd, migrations.md, queries.md}` |
| SPEC | `/moai plan "RHI MVP — 5 lenses + concern score"` | `.moai/specs/SPEC-RHI-001/spec.md` (EARS) |
| 구현 | `/moai run SPEC-RHI-001` | `apps/web/` 코드 + `sql/views/` SQL + Vitest |
| 동기화 | `/moai sync SPEC-RHI-001` | README, codemaps, PR |
| 코드 어노테이션 | `/moai mx` | @MX:NOTE, @MX:WARN 등 핵심 함수에 부착 |
| 검토 | `/moai review --security` | 보안·@MX 준수 확인 |

`development_mode` 자동 설정: 신규 프로젝트이므로 TDD 모드로 자동 결정될 예정 (workflow Phase 3.7).

## 11. 핵심 의존성 잠금

`package.json` 의 dependencies 섹션 (예시):

```json
{
  "dependencies": {
    "next": "^16.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "postgres": "^3.4.5",
    "zod": "^3.23.8",
    "recharts": "^2.15.0",
    "reactflow": "^11.11.4",
    "tailwindcss": "^4.0.0",
    "@radix-ui/react-dialog": "^1.1.2",
    "@radix-ui/react-tabs": "^1.1.1",
    "lucide-react": "^0.468.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.5"
  },
  "devDependencies": {
    "typescript": "^5.7.2",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "vitest": "^2.1.8",
    "@vitest/ui": "^2.1.8",
    "@playwright/test": "^1.49.0",
    "tsx": "^4.19.0",
    "@biomejs/biome": "^1.9.4"
  }
}
```

> 버전은 작성 시점 기준. `pnpm install` 시 락 파일에 실제 해상도 기록.

## 12. 비채택 기술 + 사유

| 후보 | 비채택 사유 |
|---|---|
| Prisma | 원시 SQL CTE/window 함수 사용 비중 ↑ → ORM 추상화 가성비 낮음. postgres.js 충분. |
| Drizzle | 스키마 푸시 권한 없는 read replica이므로 schema-first 도구 불필요. |
| FastAPI 별도 백엔드 | 단일 Solo 개발 + 도메인 로직이 SQL 무거움 → 분리 유지비용 큼. Next.js Server Action으로 충분. |
| Streamlit | 발표 시 디자인 임팩트 낮음, Vercel 배포 흐름과 안 맞음. |
| Apollo Federation, GraphQL | 단일 클라이언트 단일 데이터 소스. REST/Server Action으로 충분. |
| DuckDB | Render PG가 실측 사용 가능한 응답시간이면 굳이 라우팅 추가 불필요. 만일 hot path에서 800ms 미달 시 fallback으로 도입 가능. |
| Cloudflare Workers / Edge runtime | postgres.js Node API 의존 → Edge 호환 불완전. Node runtime 유지. |
| Tailwind v3 | 4.x 이미 안정화됨. shadcn/ui 4 + OKLCH 권장. |
| react-d3-graph, Cytoscape.js | react-flow가 React 네이티브 + 인터랙션 풍부 + 학습곡선 낮음. |

## 13. 미래 확장 포인트 (out-of-scope이지만 기록)

해커톤 후 진화 시:
- Lens 6 — Adverse Media (LLM + 뉴스 API)
- Lens 7 — Policy Alignment (외부 정책 KPI 매핑)
- Lens 8 — Procurement Health (#4+#5 추가)
- 다국어 (영어 1차) — 발표 후
- 사용자 라벨링 (false positive 신고)
- 자체 PG 인스턴스로 마이그레이션 → materialized view + 인덱스 추가
- API 노출 (REST + auth)

---

Version: 1.0.0
Last Updated: 2026-04-27
Reference: product.md (vision + lenses), structure.md (modules + routes), KNOWN-DATA-ISSUES.md (data gotchas)
