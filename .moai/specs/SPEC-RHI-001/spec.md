---
id: SPEC-RHI-001
version: 0.1.2
status: draft
created: 2026-04-27
updated: 2026-04-27
author: hotei0518
priority: high
issue_number: 0
---

# SPEC-RHI-001 — Recipient Health Index MVP (5 lenses + concern score)

> 캐나다 공공자금 수혜 엔티티의 건전성을 5개 렌즈와 통합 Concern Score로 평가하는 단일 페이지 대시보드 (GovAlta Agency 26 Hackathon, Solo 1주 MVP).

## HISTORY

- **v0.1.2 (2026-04-27)**: plan-auditor iter 2 residuals — DN1 AC-6 parametric, DN2 healthz body {ok:true,ts}, DN3 healthz timing 200ms, DN4 REQ atomicity rule softened, DN5 §3 reframed as non-binding.
- **v0.1.1 (2026-04-27)**: plan-auditor iteration 1 review 반영. (D1) REQ-003을 REQ-004 앞으로 재배열하여 numeric order 정렬. (D4) REQ-003을 boot-time validation (Ubiquitous) + runtime scoring (Event-driven) 두 절로 분리. (D5) REQ-005 첫 절에서 "Where" Optional 키워드를 "When" Event-driven으로 교체. (D6+D8) REQ-005를 세 개의 명시적 EARS 절(공개 페이지/검색/속도제한+헬스체크)로 재구성하되 5-REQ HARD cap 준수. (D7+D14) REQ-001 Acceptance에 AC-9, REQ-002 Acceptance에 AC-5 추가하여 forward traceability 완결. (D9) REQ-001 read-only 제약을 State-driven 부정문에서 Unwanted (If/then) 절로 교체. (D10) Exclusion #5에 1024px 미만 뷰포트 / 터치 제스처 / 모바일 전용 레이아웃의 구체 경계 명시. (D11) REQ 블록의 파일 경로 · 라이브러리 옵션 · 함수 이름 등 구현 세부사항을 plan.md로 이동. (D12+D13) REQ-003에서 가중치 수치 (0.30/0.25/0.20/0.10/0.15) 및 tier 임계값 (80/60/40/20)을 제거하고 단일 YAML 설정으로 일원화. plan.md `Reference Constants`로 이동. acceptance.md에서 AC-1 warm cache 정의 추가 · AC-8을 AC-8a (perf) / AC-8b (rate limit) 분리 · AC-10에 측정 가능한 시각 디스클레이머 기준 추가.
- **v0.1.0 (2026-04-27)**: 초안 (initial draft). product.md / structure.md / tech.md / db/queries.md / db/schema.md 5개 컨텍스트 문서로부터 EARS 요구사항 추출. 5개 REQ, 12개 AC, 7개 Exclusion 정의. 모든 파일은 신규 생성([NEW]).

---

## 1. 개요

본 SPEC은 Recipient Health Index (RHI) MVP의 기능·비기능 요구사항을 EARS 형식으로 정의한다. 구현 대상은 다음 다섯 개 렌즈를 단일 엔티티 점수 체계 안에서 통합하는 read-only Next.js 대시보드:

1. **Zombie Recipient** (#1) — 정부 자금 수령 후 filing 중단
2. **Ghost Capacity** (#2) — 명목상 존재 / 프로그램 활동 미미
3. **Loop Participant** (#3) — 사전탐지된 5,808 사이클 + Tier A/B/C 분류
4. **Director Network** (#6 lite) — 동일 인물 다수 수혜 엔티티 이사 시그널
5. **Multi-Source Funding** (#8 lite) — FED/AB/CRA 다중 소스 수령

데이터 백본은 GovAlta가 제공한 통합 PostgreSQL **read-only replica** (79 tables / 5 schemas / ~14M+ rows). 자체 쓰기 권한 없음, materialized view 생성 불가.

본 SPEC은 WHAT/WHY만 정의한다. 라이브러리 선정, 파일 배치, 함수 시그니처, 캐싱 옵션 등 HOW는 plan.md를 단일 출처로 한다.

---

## 2. EARS 요구사항

요구사항은 Easy Approach to Requirements Syntax (EARS) 문법을 따른다. 각 REQ는 단일 책임 영역으로 정의된다. REQ-005는 5-REQ HARD 상한 준수를 위해 "public read interfaces"라는 단일 테마 아래 세 개의 독립 표면(Statement A/B/C)을 묶으며, 구현 모듈은 별도이다. REQ는 1번부터 5번까지 numeric 순서대로 기술한다.

### 2.1 REQ-001 — Database Adapter and Safe-Query Primitives

> **Ubiquitous**: The system **shall** provide a singleton database client whose connection string is validated against a typed environment schema, exposing two safe-query primitives: an F-3 deduplication helper and a government-entity exclusion helper.
>
> **Unwanted**: **If** a write statement (INSERT, UPDATE, DELETE, or DDL) is attempted against the read-only replica, **then** the system **shall** reject the operation before it reaches the database and **shall** log the rejection.

**Rationale**: 모든 5개 렌즈와 검색·랭킹 페이지가 단일 DB 클라이언트에 의존한다. F-3 함정(agreement_value 누적, 트리플 카운트)과 정부 엔티티(govt_share=0.94 같은 false positive) 회피는 모듈 단위로 격리되어야 재사용 가능하고 테스트 가능하다 (queries.md §1, §3). Render 측 replica는 권한 정책상 쓰기 자체가 거부되지만, 애플리케이션 레이어에서도 정책을 강제하면 실수로 인한 운영 사고를 사전에 차단하고 감사 로그를 남길 수 있다.

**What is in scope (no HOW)**:
- 단일 client export — 모든 lens / page / script가 동일 인스턴스 사용
- 환경 변수 schema 검증 — 잘못된 형식이면 boot 시 즉시 실패
- F-3 dedup helper — `(ref_number, recipient)` 기준 중복 제거 + 결정론적 tiebreaker
- 정부 엔티티 제외 helper — `legal_name` 패턴 기반 사전 필터
- Read-only 강제 — 쓰기 시도 시 거부 + 로그

> 구현 세부 (파일 경로, postgres.js 옵션, zod schema, hot-reload 캐싱 패턴 등)는 plan.md `Module Layout` / `Library Versions` 참조.

**Acceptance**: AC-1, AC-5, AC-9

---

### 2.2 REQ-002 — Five Lens Scoring Functions

> **Event-driven**: **When** a caller requests an entity's lens scores (entityId 또는 BN 파라미터 포함), the system **shall** execute the corresponding lens query against the replica and **shall** return a deterministic score in the closed interval [0, 100] together with the supporting raw rows for drill-down.

**Rationale**: 5개 렌즈는 도메인 로직의 핵심 단위이며 각각 독립적으로 테스트 가능해야 한다. SQL 쿼리는 queries.md §2~§7에 정의된 패턴을 따르며, 점수 계산은 결정론적이어야 (동일 입력 → 동일 출력) Vitest로 검증 가능하다.

**What is in scope (no HOW)**:
- Zombie lens — `govt_share ≥ 0.7` + filing gap > 12mo, 단계별 점수
- Ghost lens — 프로그램 비율 < 0.5 + 신생 단체 (12mo 이하) 자동 제외
- Loop lens — Tier A/B/C 분류, 분류 근거 narrative 배열 동반
- Director lens — last+first+initials 셋 매칭, signal-only 카운트
- Multi-source lens — FED/AB/CRA gov-transfers 합계, same-year overlap 카운트

각 lens 호출은 (a) 0-100 점수, (b) raw row 트레이스, (c) 결정론 (random 미사용, 동일 입력 → 동일 출력) 세 조건을 모두 만족해야 한다.

> 구현 세부 (lens 모듈 경로, SQL 절차, 단계 임계값, NULL-safe 처리 패턴 등)는 plan.md `Module Layout` 및 queries.md 참조.

**Acceptance**: AC-2, AC-3, AC-4, AC-5, AC-9, AC-10

---

### 2.3 REQ-003 — Concern Score Integration

> **Ubiquitous**: The system **shall** validate that the configured concern-score weights sum to 1.0 (±0.001) at server boot, and **shall** fail-fast if validation fails.
>
> **Event-driven**: **When** a caller requests the Concern Score for a BN, the system **shall** apply the loaded weights to the five lens signals and **shall** return both the composite score and the per-component breakdown.

**Rationale**: 통합 점수가 RHI의 차별화 포인트 (product.md §6 "5개 챌린지가 단일 엔티티 점수로 수렴"). 가중치를 외부 설정으로 분리하면 변경 추적 가능하고, sum 검증은 잘못된 설정으로 인한 비정상 점수 분포를 사전에 차단한다. Hot-reload는 hackathon 1주 MVP 범위에서 불필요 — boot 시 한 번 로드로 충분 (AC-11).

**What is in scope (no HOW)**:
- 가중치는 단일 YAML 설정 파일이 canonical source of truth이며, 모든 가중치는 합이 1.0 (±0.001)이 되어야 한다. 런타임은 이 가중치를 5개 lens signal에 적용한다. 실제 수치 기본값은 plan.md `Reference Constants`에 정의한다.
- 5개 tier (Critical, High, Medium, Low, Healthy)는 단일 설정 source 안에서 ascending score threshold로 정의된다. 실제 임계값 수치는 plan.md `Reference Constants`에 정의하며, REQ 본문에서는 수치를 명시하지 않는다.
- Composite score와 per-component breakdown 모두 반환 — 디버깅 및 UI drill-down에 필요.
- Boot 시 1회 로드 후 메모리 캐시 — hot-reload 미지원 (MVP 범위 결정).

> 가중치/임계값의 실제 수치, lens-to-signal 변환 룰, YAML 파일 위치, in-memory cache 패턴 등 구현 세부는 plan.md `Reference Constants` 및 `Module Layout` 참조.

**Acceptance**: AC-6, AC-11

---

### 2.4 REQ-004 — Entity Profile Page

> **Event-driven**: **When** a user navigates to the per-entity profile route, the system **shall** render a Server-rendered page that fetches all five lens scores in parallel, **shall** display the integrated Concern Score, and **shall** provide drill-down access to the raw SQL rows backing each lens result.

**Rationale**: 이 페이지가 product.md의 가치 제안 ("BN 입력 → 30초 안에 5개 렌즈 + raw 트레이스 클릭 한 번")을 구현한다. 병렬 실행은 응답 시간을 5×개별 시간 → max(개별 시간)으로 단축하며 (tech.md §5.2), 서버 측 렌더링은 PG credentials을 클라이언트에 노출하지 않는 보안 요건 (tech.md §6) 충족.

**What is in scope (no HOW)**:
- 통합 Concern Score 카드 + tier 배지
- 5개 lens 요약 카드 (raw drill-down 트리거 포함)
- Funding timeline (FED+AB+CRA per fiscal_year) 시각화
- Identity block (legal_name, BN, 카테고리, 등록일, 주소)
- Methodology popover — 점수 공식 호버 설명
- Raw row drawer — 클라이언트 측 lazy fetch, SQL 트레이스 표시

> 라우트 경로, Server vs Client Component 구분, 차트 라이브러리, drawer 컴포넌트 구조, 캐시 옵션 등 구현 세부는 plan.md `Module Layout` 및 `Library Versions` 참조.

**Acceptance**: AC-6, AC-12

---

### 2.5 REQ-005 — Public Pages, Search, Health, and Rate Limiting

> 본 REQ는 단일 "공개 read 인터페이스(public read interfaces)" 테마 아래 세 개의 독립 표면(public page navigation / global search / operational guards)을 묶는다. 각 표면은 서로 다른 EARS 패턴으로 명시되며, 구현 모듈은 별도이지만 동일한 HTTP 엣지(미들웨어, 라우트 핸들러)를 공유한다.

#### Statement A — Public page navigation (Event-driven)

> **Event-driven**: **When** the user navigates to a non-entity public route, the system **shall** provide one of: a High Concern landing ranking, a per-lens analysis page (zombie / ghost / loops), an individual loop detail page, a Methodology page, or a global entity search result page.

#### Statement B — Global entity search (Event-driven)

> **Event-driven**: **When** the user submits a global entity search query (단체명 일부, BN, 또는 BN root), the system **shall** return matched entities via the `general.vw_entity_search` view with prefix-match results prioritized over partial-match results, including each entity's `dataset_sources` (FED/AB/CRA).

#### Statement C — Operational guards (Unwanted + Event-driven)

> **Unwanted**: **If** a client exceeds 30 requests per minute from a single IP address, **then** the system **shall** reject further requests with HTTP 429 until the rate-limit window resets.
>
> **Event-driven**: **When** `/api/healthz` is requested, the system **shall** execute `SELECT 1`, **shall** return HTTP 200 with body `{"ok": true, "ts": "<ISO-8601 UTC timestamp>"}` (the `ts` field is the server's UTC ISO-8601 timestamp at response generation time, used by external monitoring), and **shall** complete within 200ms TTFB under warm-cache conditions.

**Rationale**: 랜딩 페이지와 렌즈별 페이지는 product.md §10 Priority High/Medium 항목이며, 검색은 product.md §3 1차 사용자 (조사 저널리스트, "BN 5초 안에 확인") 동선의 시작점이다. Methodology 페이지는 점수 공식·F-1/F-3 함정 공개로 product.md §4 "투명성" 가치 제안을 충족한다. Rate limit은 tech.md §6 보안 요건 (해커톤 시연 중 traffic 폭주 대비)을 구현하며, healthz는 배포 모니터링·연결 sanity 검증용 — 두 보호 장치 모두 공개 인터페이스의 운영 가드이므로 단일 REQ 안에서 묶는다.

**What is in scope (no HOW)**:
- Statement A — 5종 공개 페이지: 랜딩 (high concern ranking top N), 렌즈별 분석 3종, 개별 loop 상세, Methodology
- Statement B — 글로벌 검색: prefix 우선 정렬, dataset_sources 노출, view 기반
- Statement C — Rate limit: 분당 30 req IP-based threshold, 31번째 요청 → 429, 1분 이후 회복. Healthz: SELECT 1 ping + 200 응답 with body `{"ok": true, "ts": "<ISO-8601 UTC>"}` + 200ms 이하 TTFB (warm).

> 라우트 경로, 미들웨어 위치, 캐시 옵션 (`revalidate` 값 등), 차트/그래프 라이브러리, 검색 박스 컴포넌트, 미들웨어 런타임 환경, 정적 마크다운 source 위치 등 구현 세부는 plan.md `Module Layout` 및 `Library Versions` 참조.

**Acceptance**: AC-1, AC-7, AC-8 (AC-8a + AC-8b)

---

## 3. Files to Modify (Non-binding Scope Snapshot)

> **본 섹션은 비-바인딩 스코프 스냅샷이다.** 정확하고 단일한 구현 모듈 목록은 plan.md §2A `Module Layout`에 있다. 본 목록은 검토자의 빠른 스캐닝을 돕기 위한 보조 자료로만 사용되며, plan.md와 충돌 시 plan.md가 우선한다.

모든 파일은 **신규 생성**([NEW]). Greenfield 프로젝트이므로 기존 파일 수정 없음.

### 3.1 Top-Level Groupings

| Group | 위치 | 설명 |
|---|---|---|
| Application | `apps/web/` | Next.js 16 App Router 애플리케이션 (라우트, 컴포넌트, lib, middleware, 설정 파일) |
| SQL Assets | `sql/views/` | 5개 lens view + concern_score + high_concern_ranking |
| Configuration | `.moai/project/db/concern-score-weights.yaml` | 가중치 설정 (canonical source — plan.md §2B.1 default seed) |
| Scripts | `scripts/` | DB 검증 / sample 추출 / 벤치마크 (verify-db.ts, sample-entities.ts, benchmark-queries.ts) |
| Documentation | `docs/methodology.md` | Methodology 페이지의 정적 마크다운 source |

> 총 약 30개 신규 파일. structure.md §1, §2의 디렉토리 구조와 1:1 대응. 기존 product.md / structure.md / tech.md / db/* 는 본 SPEC에서 수정하지 않음. 정확한 파일 경로 · 라이브러리 옵션 · 함수 이름 등 구현 세부는 plan.md §2A `Module Layout`을 단일 출처로 한다.

---

## 4. Exclusions (의도적 제외, HARD)

본 MVP는 다음 항목을 명시적으로 제외한다. 1주 Solo 일정 보호와 범위 잠금이 목적이며, 향후 확장 가능 포인트는 tech.md §13에 별도 기록.

1. **인증·사용자 계정·관리자 콘솔 없음** — 공개 read-only 도구 (product.md §7)
2. **DB 쓰기 작업 일체 금지** — Render replica는 read-only이며 자체 인스턴스 도입 불가
3. **해커톤 챌린지 #4, #5, #7, #9, #10 미참여** — 별도 데이터/외부 소스 필요 (product.md §1)
4. **외부 뉴스 스크래핑 / LLM 분류 (#10) 미수행** — 시간 부족 + 결정론적 평가 불가
5. **모바일 최적화 UI**: 1024px 미만 뷰포트에 대한 반응형 브레이크포인트, 터치 제스처 처리, 모바일-전용 레이아웃은 제공하지 않음. 데스크톱 우선 (조사 저널리스트·감사관 PC 사용 가정)
6. **다국어 UI 미지원** — 한국어 1차, 영어 발표 슬라이드는 별도 산출물 (product.md §7)
7. **Materialized view 생성 미수행** — replica에 schema 생성 권한 없음. CTE 기반 raw SQL + Vercel data cache로 대체 (structure.md §4.1, tech.md §5.2)

---

## 5. Notes

### 5.1 의존 컨텍스트 문서 (수정 금지)

- `.moai/project/product.md` — 5개 렌즈 정의, Concern Score 공식, 데모 시나리오
- `.moai/project/structure.md` — Next.js App Router 디렉토리, 모듈 경계
- `.moai/project/tech.md` — 스택 버전, F-3 trap 회피, 배포 (Vercel + Render)
- `.moai/project/db/queries.md` — 5개 렌즈 SQL 패턴, F-3 dedup, 검색 쿼리
- `.moai/project/db/schema.md` — 79 tables / 5 schemas 실제 구조

### 5.2 TDD 적용 방향

본 SPEC의 모든 REQ는 RED-GREEN-REFACTOR 사이클로 구현한다 (quality.yaml `development_mode: TDD`):
- **RED**: Vitest로 lens 함수 시그니처와 결정론적 출력에 대한 실패 테스트 작성. 빈 stub 함수는 `@MX:TODO`로 표시
- **GREEN**: queries.md SQL 패턴을 lens 함수에 구현 후 테스트 통과
- **REFACTOR**: Concern Score 가중치 분리, F-3 dedup helper 추출, raw drill-down lazy 로딩

Coverage target: 85% (line + branch). 통합 테스트는 read-only replica 직결 (Vitest integration 폴더).

### 5.3 다음 단계

- `/moai run SPEC-RHI-001` — manager-tdd 또는 manager-ddd 위임 (quality.yaml 기준)
- `/moai sync SPEC-RHI-001` — manager-docs로 README + codemaps 동기화

---

Version: 0.1.2
Status: draft
Last Updated: 2026-04-27
