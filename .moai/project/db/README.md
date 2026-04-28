# .moai/project/db/

GovAlta Agency 26 Hackathon 데이터셋 메타데이터. 본 디렉토리는 해커톤이 제공한 통합 PostgreSQL
**read-only replica**를 어떻게 사용·해석·보호하는지를 문서화한다.

---

## Purpose

해커톤이 제공하는 79개 테이블 / ~14M 행 PG 데이터베이스를 본 프로젝트(Recipient Health Index)
관점에서 다음 항목으로 정리한다:

1. **Schema 매핑** — 5개 도메인 스키마(cra/fed/ab/general/public)의 핵심 테이블·컬럼·관계
2. **Dataset Snapshot** — 베이스라인 행 수와 변동 추적 (자체 migration이 아닌 **데이터셋 버전**)
3. **데이터 함정 회피** — F-1, F-3 등 KNOWN-DATA-ISSUES 대응 SQL 패턴
4. **Lens 쿼리** — 5개 분석 렌즈의 핵심 SQL
5. **접근 제어** — read-only replica 본질 + 어플리케이션 측 필터·디스클레이머
6. **시드 데이터** — DB lookup 테이블 + 설정·시연 시드

→ 본 프로젝트는 표준적 "schema migration · ORM · RLS 설정" 워크플로우와 다르므로,
표준 `/moai db init` 템플릿을 본 프로젝트 컨텍스트에 맞게 재해석하여 작성하였다.

---

## Files

| File | Purpose | Auto-updated? |
|------|---------|---------------|
| `schema.md` | 5개 스키마, 79개 테이블, 11개 사전 뷰, 사전계산 분석 레이어 카탈로그 | No (수동) |
| `erd.mmd` | Lens 1-5에 필요한 핵심 관계만 표시한 Mermaid ERD | No (수동) |
| `migrations.md` | 데이터셋 스냅샷 버전 추적 (자체 migration 아님) | No (수동) |
| `rls-policies.md` | Read-only replica 본질 + 어플리케이션 측 접근·필터·디스클레이머 | No (수동) |
| `queries.md` | 5-lens 쿼리 + F-3 회피 패턴 + 검색·랭킹·헬스체크 | No (수동) |
| `seed-data.md` | DB lookup 카탈로그 + 가중치/화이트리스트/데모 시나리오 메타 | No (수동) |
| `README.md` | 본 파일 — 디렉토리 가이드 | No (수동) |

PostToolUse 자동 동기화는 본 프로젝트에서는 활성화하지 않는다 — 우리는 자체 migration
파일이 없으므로 자동 트리거 대상이 없다.

---

## Configuration

DB 동작은 `.moai/config/sections/db.yaml` 에 의해 제어된다 (작성 시점 기준 미설정).
본 프로젝트의 핵심 설정:

```yaml
db:
  enabled: true
  engine: postgres        # PostgreSQL 18.3 read replica (Render-hosted)
  orm: postgres-js        # porsager/postgres driver only (no ORM)
  multi_tenant: none      # 단일 DB, 도메인별 스키마 분리
  migration_tool: none    # read-only replica, 자체 migration 불가
  read_only: true
  auto_sync:
    enabled: false        # migration 파일 없음 → 트리거 대상 없음
```

`.moai/config/sections/db.yaml` 파일은 본 프로젝트에서는 선택적이며, 상기 값은 README에서 의도를 명시.

---

## How to Use This Directory

**탐색 진입점**: `schema.md` → 5개 스키마 + 핵심 테이블 → `queries.md` 의 5-lens SQL.

**구현 시 참조**:
- 새 lens 쿼리 작성 → `queries.md` §1-§9 패턴 활용
- F-1/F-3 함정 → `queries.md` §3 (window 함수 패턴)
- 정부 엔티티 제외 → `queries.md` §1 + `seed-data.md` §4
- Loop Tier 분류 룰 → `queries.md` §5 + `seed-data.md` §5

**갱신 시 참조**:
- 데이터셋 스냅샷 변동 → `migrations.md` 행 추가
- 정부 화이트리스트 추가 → `seed-data.md` §4 + 코드 PR 링크
- Concern 가중치 변경 → `seed-data.md` §3 + `weights.yaml` (생성 예정) + git commit msg

---

## Read-Only Constraint Reminder

```
┌─────────────────────────────────────────────────────────┐
│  WARNING: Render replica is READ-ONLY.                  │
│  Any INSERT/UPDATE/DELETE/ALTER will be rejected by PG. │
│  All analysis happens in the application layer.         │
│  Concern Score, classification, and weights are         │
│  computed by Next.js Server Actions, NOT by the DB.     │
└─────────────────────────────────────────────────────────┘
```

---

## Auto-sync Policy

| Trigger | Action |
|---------|--------|
| Migration file saved | (해당없음 — 자체 migration 없음) |
| Files in `.moai/project/db/**` saved | Excluded — no recursive trigger |
| Files in `.moai/cache/**` saved | Excluded |

본 프로젝트에서는 `db.auto_sync.enabled: false` 권장.

---

## Excluded Patterns

```
.moai/project/db/**    # 본 디렉토리
.moai/cache/**
**/*.lock
.env.local             # PGCONN credentials
```

---

Last reviewed: 2026-04-27
Populated by: `/moai db init` 인터뷰 → 수동 풍부화 (read-only replica 컨텍스트)
Initial source: 직접 psql 접속 + information_schema 조회
