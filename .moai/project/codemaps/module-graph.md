# Module Dependency Graph — apps/web

SPEC-RHI-001 구현 모듈 간 의존성. 화살표 방향은 import 방향.

## 전체 모듈 그래프

```mermaid
graph TD
  subgraph DB["lib/db/"]
    env[env.ts<br/>zod schema]
    client[client.ts<br/>postgres.js singleton]
    client --> env
    client --> pg[(Render PG<br/>read-only replica)]
  end

  subgraph DataIssues["lib/data-issues/"]
    safeQ[safe-queries.ts<br/>F-3 dedup + govt exclude]
    safeQ --> client
  end

  subgraph Lenses["lib/lenses/"]
    zombie[zombie.ts<br/>Lens 1 scoring]
    ghost[ghost.ts<br/>Lens 2 scoring]
    loop[loop.ts<br/>Lens 3 Tier A/B/C]
    director[director.ts<br/>Lens 4 overlap]
    multi[multi-source.ts<br/>Lens 5 source count]
    cs[concern-score.ts<br/>가중합 + tier mapping]
    weights[/.moai/project/db/<br/>concern-score-weights.yaml/]

    zombie --> client
    zombie --> safeQ
    ghost --> client
    ghost --> safeQ
    loop --> client
    director --> client
    director --> safeQ
    multi --> client
    multi --> safeQ
    cs --> weights
  end

  subgraph Entity["lib/entity/"]
    profile[profile-data.ts<br/>Promise.all 5 lens]
    profile --> zombie
    profile --> ghost
    profile --> loop
    profile --> director
    profile --> multi
    profile --> cs
  end

  subgraph AppPages["app/ (Server Components)"]
    landing["app/page.tsx<br/>High Concern Top 50"]
    entityPage["app/entity/[id]/page.tsx<br/>Entity Profile"]
    lensZombie["app/lens/zombie/page.tsx"]
    lensGhost["app/lens/ghost/page.tsx"]
    lensLoops["app/lens/loops/page.tsx"]
    loopDetail["app/lens/loops/[id]/page.tsx"]
    methodology["app/methodology/page.tsx<br/>(static)"]
    healthz["app/api/healthz/route.ts"]
    search["app/api/search/route.ts"]
    lensRaw["app/api/entity/[id]/lens-raw/route.ts"]
  end

  subgraph Components["components/"]
    entityComps["components/entity/*<br/>ConcernCard, LensSummary,<br/>FundingTimeline, RawRowDrawer"]
    vizComps["components/viz/*<br/>LoopGraph (react-flow),<br/>FundingStacked (Recharts)"]
    shared["components/shared/*<br/>EmptyState, Skeleton,<br/>MethodologyPopover"]
    directorDetail["components/lens/director-detail.tsx<br/>signal only disclaimer ≥14px"]
  end

  landing --> zombie
  landing --> cs
  entityPage --> profile
  entityPage --> entityComps
  entityComps --> vizComps
  entityComps --> shared
  entityComps --> directorDetail
  lensZombie --> zombie
  lensGhost --> ghost
  lensLoops --> loop
  loopDetail --> loop
  healthz --> client
  search --> client
  lensRaw --> zombie
  lensRaw --> ghost
  lensRaw --> loop
  lensRaw --> director
  lensRaw --> multi
```

## 레이어별 의존 방향 원칙

| 레이어 | 의존 허용 | 의존 금지 |
|---|---|---|
| `app/` | `components/`, `lib/` | `lib/` 내부 구현 인라인 |
| `components/` | `lib/`, `components/ui/` | 다른 도메인 `components/` 직접 참조 |
| `lib/lenses/` | `lib/db/`, `lib/data-issues/` | `components/`, `app/` |
| `lib/data-issues/` | `lib/db/` | `lib/lenses/` (순환 방지) |
| `lib/db/` | Node stdlib | 없음 |

## 핵심 데이터 흐름

```mermaid
sequenceDiagram
  participant Browser
  participant ServerComp as Next.js Server Component
  participant Profile as lib/entity/profile-data.ts
  participant Lenses as lib/lenses/*.ts (5개)
  participant DB as Render PG (read-only)

  Browser->>ServerComp: GET /entity/{bn}
  ServerComp->>Profile: getEntityProfile(bn)
  Profile->>Lenses: Promise.all([zombie, ghost, loop, director, multi])
  Lenses->>DB: 5개 SQL 동시 실행
  DB-->>Lenses: raw rows
  Lenses-->>Profile: scored results
  Profile-->>ServerComp: EntityProfile (5 lens + concern score)
  ServerComp-->>Browser: rendered HTML
  Browser->>ServerComp: (lazy) GET /api/entity/{bn}/lens-raw
  ServerComp-->>Browser: raw SQL trace JSON
```

---

생성 기준: SPEC-RHI-001 v0.1.3 (2026-04-28)
