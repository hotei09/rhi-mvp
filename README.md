# Recipient Health Index (RHI)

> 캐나다 공공자금 수혜 엔티티의 건전성을 5개 렌즈와 통합 Concern Score로 평가하는 read-only 대시보드 — GovAlta Agency 26 Hackathon (Ottawa, 2026) Solo 1주 MVP.

## 핵심 가치 제안

> "한 엔티티의 BN을 입력하면 5개 렌즈의 위험 시그널을 30초 안에 본다. 모든 점수는 raw SQL까지 클릭 한 번에 추적된다."

5개 챌린지(Zombie / Ghost / Loops / Director / Multi-Source)를 분리된 분석이 아닌 **단일 Concern Score로 통합**하여 조사 저널리스트·감사관이 즉시 활용 가능한 운영형 도구를 제공한다.

---

## 5개 렌즈 (Five Lenses)

| 렌즈 | 챌린지 | 정의 | 출력 |
|---|---|---|---|
| Zombie Recipient | #1 | 정부 자금 수령 후 T3010 filing 중단 (govt_share ≥ 0.7, gap > 12mo) | zombie_score (0–100) |
| Ghost Capacity | #2 | 명목상 존재, 프로그램 활동 미미 (직원 0, program_ratio < 0.5) | ghost_score (0–100) |
| Loop Participant | #3 | 사전탐지된 5,808개 사이클 + Tier A/B/C 분류 | loop_tier, classification_reasons |
| Director Network | #6 lite | 동일 인물이 다수 수혜 엔티티 이사 (시그널만, 부정 단정 아님) | director_overlap_count |
| Multi-Source Funding | #8 lite | FED/AB/CRA 다중 소스 수령 | source_count, per-source totals |

정부 엔티티(Government of Alberta 등 6개 패턴)는 모든 렌즈에서 **자동 제외**.

---

## Concern Score 공식

```
concern_score =
    0.30 × zombie_score
  + 0.25 × ghost_score
  + 0.20 × (Tier C → 100 | Tier B → 50 | Tier A → 0)
  + 0.10 × min(director_overlap × 10, 100)
  + 0.15 × (multi_source_count ≥ 2 ? 100 : 0)
```

| Tier | 범위 |
|---|---|
| Critical | 80–100 |
| High | 60–79 |
| Medium | 40–59 |
| Low | 20–39 |
| Healthy | 0–19 |

가중치는 `.moai/project/db/concern-score-weights.yaml`에 분리. 서버 부팅 시 합계 1.0 (±0.001) 검증.

---

## 빠른 시작

```bash
# 1. 의존성 설치
cd apps/web
pnpm install

# 2. 환경 설정 (PGCONN — Render PG read replica)
cp .env.example .env.local
# .env.local에 실제 PGCONN 값 입력
# PGCONN="postgresql://<user>:<pass>@<host>/<db>?sslmode=require"

# 3. DB 연결 검증
pnpm exec tsx ../../scripts/verify-db.ts

# 4. 개발 서버
pnpm dev
# → http://localhost:3000
```

### 환경변수

| 변수 | 설명 | 필수 |
|---|---|---|
| `PGCONN` | Render Postgres read replica 연결 문자열 | 필수 |

---

## 주요 페이지

| 경로 | 설명 | 우선순위 |
|---|---|---|
| `/` | High Concern Top 50 랭킹 (랜딩) | High |
| `/entity/[bn]` | 엔티티 프로필 — Concern Score + 5 렌즈 + raw drill-down | High |
| `/lens/zombie` | Zombie 렌즈 분석 페이지 | Medium |
| `/lens/ghost` | Ghost 렌즈 분석 페이지 | Medium |
| `/lens/loops` | Loop 랭킹 + Tier A/B/C 분포 | Medium |
| `/lens/loops/[loopId]` | 개별 사이클 네트워크 그래프 + 분류 근거 | Medium |
| `/methodology` | 방법론 + 점수 공식 + 데이터 함정 공개 | Medium |
| `/api/healthz` | DB ping 헬스체크 (`{"ok":true,"ts":"..."}`) | High |
| `/api/search?q=` | 글로벌 검색 (단체명 / BN) | High |
| `/api/entity/[id]/lens-raw` | 렌즈별 raw SQL row lazy fetch | High |

---

## 기술 스택

| 영역 | 기술 | 버전 |
|---|---|---|
| 프레임워크 | Next.js | 16.2 |
| UI 런타임 | React | 19.2 |
| 언어 | TypeScript strict | 5.9 |
| DB 드라이버 | postgres.js | 3.4.9 |
| 검증 | zod | 3.25 |
| 스타일 | Tailwind CSS | 4.2 |
| 컴포넌트 | Radix UI + shadcn/ui | — |
| 차트 | Recharts | 2.15 |
| 그래프 | react-flow | 11.11 |
| 단위/통합 테스트 | Vitest | 2.1 |
| E2E 테스트 | Playwright | 1.59 |
| 린트·포맷 | Biome | 1.9 |
| DB 호스팅 | Render Postgres (read-only replica) | — |
| 배포 | Vercel | — |

---

## 테스트 + 품질

```bash
# 단위 + 통합 테스트
pnpm exec vitest run

# 커버리지 측정
pnpm exec vitest run --coverage

# E2E (Playwright)
pnpm exec playwright test

# 타입 체크
pnpm exec tsc --noEmit

# 린트 + 포맷 검사
pnpm exec biome check .
```

현재 결과:

| 항목 | 값 |
|---|---|
| 전체 테스트 | **169 tests pass** (156 unit/integration + 13 E2E) |
| 라인 커버리지 | **75.23%** |
| 브랜치 커버리지 | 76.05% |
| 함수 커버리지 | 81.96% |
| TypeScript 오류 | **0** |
| Biome 이슈 | **0** |
| Next.js 빌드 라우트 | 11 routes |
| TRUST 5 | **5/5** (Tested/Readable/Unified/Secured/Trackable) |

---

## 12 AC (Acceptance Criteria) 검증 결과

| AC | 영역 | 설명 | 상태 |
|---|---|---|---|
| AC-1 | Healthz | GET /api/healthz → 200 + `{"ok":true,"ts":"..."}` + 200ms TTFB (warm) | PASS |
| AC-2 | Zombie | zombie_score ≥ 80 (BN 100021237RR0001) + raw trace 포함 | PASS |
| AC-3 | Loop Tier A | Salvation Army root 107951618 → Tier A + loop_signal = 0 | PASS |
| AC-4 | Loop Tier C | cross-org + plausibility flag severity ≥ 3 → Tier C + loop_signal = 100 | PASS |
| AC-5 | F-3 Dedup | dedup \$816.1B ≤ raw \$921.6B (11.45% 감소), ROW_NUMBER 중복 없음 | PASS |
| AC-6 | Concern Score | 5 렌즈 Promise.all + 가중합 공식 + tier 매핑 결정론 확인 | PASS |
| AC-7 | 검색 | prefix 우선 정렬 + dataset_sources + 200ms warm | PASS |
| AC-8a | 성능 | 95p TTFB < 1500ms (rate limit 비발동 분산 트래픽) | PASS |
| AC-8b | Rate limit | 31번째 요청 → HTTP 429 + 1분 후 회복 | PASS |
| AC-9 | 정부 제외 | Government of Alberta (BN 124072513RR0010) zombie/ghost 자동 제외 | PASS |
| AC-10 | 디스클레이머 | Director 시그널 카드에 ≥14px + role=note + "signal only" 텍스트 | PASS |
| AC-11 | 가중치 검증 | 부팅 시 Σ weights == 1.0 ±0.001, 실패 시 process.exit(1) | PASS |
| AC-12 | Entity TTFB | warm < 1200ms, cold < 2500ms, 5 렌즈 병렬 실행 확인 | PASS |

---

## 데모 시나리오 (5분 발표용)

| # | 케이스 | 핵심 포인트 |
|---|---|---|
| 1 | **Zombie** | 정부 자금 수령 후 filing 중단한 자선단체 — timeline 시각화 + zombie_score 80+ |
| 2 | **Loop Tier C** | cross-org 사이클 + plausibility flag — 네트워크 그래프 + 분류 근거 narrative |
| 3 | **Multi-Source High Concern** | 5 렌즈 중 3개 이상 hit — 통합 Concern Score + 모든 시그널 한 화면 |

각 케이스의 후보 BN은 `scripts/sample-entities.ts`로 실제 데이터에서 추출.

---

## 문서

| 문서 | 위치 |
|---|---|
| 제품 개요 / 5개 렌즈 | `.moai/project/product.md` |
| 디렉터리 구조 | `.moai/project/structure.md` |
| 기술 스택 + DB 통합 | `.moai/project/tech.md` |
| DB 스키마 | `.moai/project/db/schema.md` |
| DB 쿼리 패턴 | `.moai/project/db/queries.md` |
| 방법론 (페이지 source) | `docs/methodology.md` |
| SPEC (요구사항) | `.moai/specs/SPEC-RHI-001/spec.md` |
| Acceptance Criteria | `.moai/specs/SPEC-RHI-001/acceptance.md` |
| 아키텍처 맵 | `.moai/project/codemaps/` |
| 변경 이력 | `CHANGELOG.md` |

---

## 라이선스 및 데이터

- 소스 코드: 해커톤 제출물 (비공개)
- 데이터: GovAlta 제공 Render Postgres read-only replica (CRA T3010, FED grants/contributions, AB grants/contracts)
- 원본 데이터: Government of Canada Open Government Licence 적용 공개 데이터
- 본 도구는 read-only 분석 도구이며, 법적 결론을 도출하지 않는다. 모든 시그널은 보조 참고 자료이다.

---

## Out of Scope (의도적 제외)

1. 인증·사용자 계정·관리자 콘솔 없음 (공개 read-only 도구)
2. DB 쓰기 작업 일체 금지 (Render replica read-only)
3. 해커톤 챌린지 #4, #5, #7, #9, #10 미참여 (별도 데이터 필요)
4. 외부 뉴스 스크래핑 / LLM 분류 미수행 (결정론적 평가 불가)
5. 모바일 최적화 UI (1024px 미만 — 데스크톱 우선)
6. 다국어 UI 미지원 (영어 발표 슬라이드는 별도 산출물)
7. Materialized view 미생성 (replica에 schema 생성 권한 없음)

---

Version: 0.1.0
Last Updated: 2026-04-28
SPEC: SPEC-RHI-001 (completed)
