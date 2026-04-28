---
spec_id: SPEC-RHI-001
version: 0.1.2
created: 2026-04-27
updated: 2026-04-27
total_scenarios: 12
format: Given-When-Then
---

# Acceptance Criteria — SPEC-RHI-001 Recipient Health Index MVP

> 본 문서는 SPEC-RHI-001의 12개 Acceptance Criteria를 Given-When-Then 형식으로 정의한다. 모든 AC는 자동화 가능한 검증 기준을 가지며 (Vitest unit/integration 또는 Playwright E2E), TDD 사이클의 RED phase에서 실패 테스트로 먼저 작성된다.

---

## 1. AC-1 — Health Check 엔드포인트

> 매핑: REQ-001, REQ-005

**Given** Render PG replica 가 정상 reachable 상태이고
**And** Next.js 서버가 production 모드로 실행 중일 때
**When** 클라이언트가 `GET /api/healthz` 를 호출하면
**Then** 서버는 200 OK 와 `{ "ok": true, "ts": <ISO-8601> }` JSON을 반환해야 하고
**And** 응답 본문은 DB ping (`SELECT 1 AS ok`) 결과를 반영해야 하며
**And** TTFB는 200ms 이하 (warm) 여야 한다.

**Warm cache 정의**: 본 AC를 비롯한 acceptance 문서 전체에서 "warm cache"는 **동일 라우트로 첫 요청을 보낸 뒤 60초 이내의 후속 요청**으로 정의한다. 이 60초 윈도우는 Vercel data cache 의 기본 `revalidate` TTL과 일치하며, 첫 요청은 cold, 60초 경과 또는 revalidate 만료 후 첫 요청도 cold로 간주한다.

**검증 방법**:
- Vitest integration: `apps/web/tests/integration/healthz.test.ts`
- Playwright E2E: `tests/e2e/smoke.spec.ts` `/api/healthz` 응답 확인

---

## 2. AC-2 — Zombie BN 점수 ≥ 80 (Lens 1)

> 매핑: REQ-002

**Given** 다음 조건을 만족하는 BN이 데이터에 존재하고
- `cra.govt_funding_by_charity` 의 `govt_share_of_rev ≥ 0.7`
- 마지막 `cra.cra_financial_general.fpe` 가 현재 시각으로부터 24개월 이상 과거
- 마지막 funding year가 마지막 fpe 연도 - 1 이상 (자금 수령 후 filing 중단 패턴)
- `legal_name`이 정부/Health Authority/Crown Corporation 패턴에 매칭되지 않음

**When** `getZombieScore(bn)` 가 호출되면
**Then** 반환된 `zombie_score`는 80 이상이어야 하고
**And** `last_funding_year`, `total_funding`, `last_fpe`, `months_since_filing` 필드가 모두 비어있지 않아야 하며
**And** raw row drill-down에 사용 가능한 SQL trace를 함께 반환해야 한다.

**검증 방법**:
- Vitest integration: `apps/web/tests/integration/lens-views.test.ts` zombie 시드 BN으로 검증
- 후보 BN 추출: `scripts/sample-entities.ts` (단계 1 완료 후 실행)

---

## 3. AC-3 — Salvation Army Loop Tier A 분류

> 매핑: REQ-002

**Given** Salvation Army root BN `107951618`을 공유하는 path 가 `cra.loops` 에 존재하고
**And** 해당 loop의 `path_bns` 모든 원소가 `'107951618'` 9자리 prefix로 시작할 때
**When** `getLoopClassification(loop_id)` 가 호출되면
**Then** `tier`는 `'A'` 여야 하고
**And** `classification_reasons` 배열에 `'all participants share BN root prefix (internal hierarchy)'` 가 포함되어야 하며
**And** Concern Score 컴포넌트에서 `loop_signal = 0` 으로 환산되어야 한다 (Tier A → 0).

**검증 방법**:
- Vitest unit: `apps/web/tests/unit/loop-classification.test.ts` — distinct_bn_roots=1 시 Tier A 결정론 검증
- Vitest integration: 실 `cra.loops` 에서 Salvation Army 관련 loop_id 추출 후 검증

---

## 4. AC-4 — Cross-Organization 의심 Loop Tier C 분류

> 매핑: REQ-002

**Given** loop의 `distinct_bn_roots ≥ 2` (cross-organization)이고
**And** loop 참여 BN 중 하나라도 `cra.t3010_plausibility_flags.severity ≥ 3` 매칭이 있고
**And** loop이 `cra.identified_hubs` 의 알려진 hub를 통과하지 않을 때
**When** `getLoopClassification(loop_id)` 가 호출되면
**Then** `tier`는 `'C'` 여야 하고
**And** `classification_reasons` 배열에 `'participant has T3010 plausibility flag (severity >= 3)'` 가 포함되어야 하며
**And** Concern Score 컴포넌트에서 `loop_signal = 100` 으로 환산되어야 한다 (Tier C → 100).

**검증 방법**:
- Vitest unit: `loop-classification.test.ts` — Tier C 결정론 검증
- Vitest integration: 실 데이터에서 plausibility flag severity ≥ 3 + cross-org loop 후보 추출

---

## 5. AC-5 — F-3 Dedup ≤ Raw SUM 단조성

> 매핑: REQ-001, REQ-002 (Lens 5)

**Given** `fed.grants_contributions` 의 `agreement_value` 누적값 함정이 존재하는 상황에서
**When** F-3 dedup window function 패턴 (queries.md §3) 으로 `dedup SUM` 을 계산하면
**Then** `dedup SUM ≤ raw SUM (SELECT SUM(agreement_value) FROM fed.grants_contributions)` 단조 부등식이 성립해야 하고
**And** 동일 `(ref_number, recipient_business_number)` 튜플당 정확히 1행만 선택되어야 하며
**And** F-2 tiebreaker (`amendment_number DESC, amendment_date DESC, _id DESC`)가 정상 동작하여 ROW_NUMBER tie 가 발생하지 않아야 한다.

**검증 방법**:
- Vitest integration: `apps/web/tests/integration/safe-queries.test.ts`
  - `raw_sum = SELECT SUM(agreement_value) FROM fed.grants_contributions`
  - `dedup_sum = SELECT SUM(agreement_value) FROM dedup_fed WHERE rn = 1`
  - assert: `dedup_sum < raw_sum` (KNOWN-DATA-ISSUES.md F-3에 따라 dedup이 raw보다 작아야 함, 약 $816B vs $921B)
  - assert: `COUNT(DISTINCT (ref_number, recipient)) = COUNT(*) WHERE rn = 1`

---

## 6. AC-6 — Multi-Lens Composite Score (단일 엔티티)

> 매핑: REQ-003, REQ-004

**Given** 현재 plan.md §2B에 정의된 Reference Constants (가중치 `w_zombie`, `w_ghost`, `w_loop`, `w_director`, `w_multi`, sum = 1.0 ± 0.001) 및 `CONCERN_TIER_THRESHOLDS`가 로드된 상태이고
**And** 5개 lens 중 3개 이상에서 hit하는 엔티티가 존재할 때 (e.g., lens signals: `zombie_score = 60`, `ghost_score = 40`, `loop_signal = 50` (Tier B), `director_overlap = 5`, `multi_source_count = 2`)
**When** `/entity/[entityId]` 페이지가 요청되면
**Then** 페이지는 5개 lens 결과를 `Promise.all` 로 병렬 fetch 해야 하고
**And** Concern Score는 다음 parametric 공식으로 계산되어야 한다:
- `concern_score = w_zombie · zombie_score + w_ghost · ghost_score + w_loop · loop_signal + w_director · min(director_overlap × 10, 100) + w_multi · (multi_source_count >= 2 ? 100 : 0)`
- 산출된 score는 plan.md §2B의 `CONCERN_TIER_THRESHOLDS` (ascending threshold)에 매핑되어 tier가 결정되어야 한다
**And** AC-6은 "현재 로드된 Reference Constants로부터 score와 tier가 재현 가능"한 경우 통과한다 — plan.md의 가중치/임계값을 변경하면 score는 달라지지만 계산 메서드 (가중합 + threshold 매핑)는 동일하게 유지되어야 한다
**And** 페이지는 통합 Concern Score 카드 + 5개 lens 요약 카드 + funding timeline + raw drill-down 트리거를 모두 렌더해야 한다.

> (현재 plan.md §2B Reference Constants 기준으로 계산하면 score는 58 → tier 'Medium'이 된다. 이 수치는 보조 정보이며 frozen test fixture가 아니다 — Reference Constants 변경 시 자동으로 재계산된다.)

**검증 방법**:
- Vitest unit: `apps/web/tests/unit/concern-score.test.ts` — 결정론적 입력 → 출력 매핑
- Vitest integration: `Promise.all` 5개 lens 호출 + 합산 검증
- Playwright E2E: `/entity/{seed_bn}` 렌더 + DOM 노드 확인

---

## 7. AC-7 — 글로벌 검색 (vw_entity_search)

> 매핑: REQ-005

**Given** `general.vw_entity_search` 뷰가 배포되어 있고
**And** 검색 박스에 사용자가 단체명 일부 또는 BN을 입력했을 때
**When** 검색 쿼리가 다음 패턴으로 실행되면 (queries.md §10):
```sql
SELECT id, canonical_name, bn_root, dataset_sources
FROM general.vw_entity_search
WHERE norm_canonical ILIKE '%' || lower($1) || '%'
   OR bn_root = $1
   OR $1 = ANY(bn_variants)
ORDER BY CASE WHEN norm_canonical ILIKE lower($1) || '%' THEN 0 ELSE 1 END,
         source_link_count DESC NULLS LAST
LIMIT $2
```

**Then** prefix match 결과가 partial match보다 우선 정렬되어야 하고
**And** 결과 limit (예: 20개) 이내에서 `dataset_sources` (FED/AB/CRA 어디 소스에 등장하는지) 정보가 포함되어야 하며
**And** 응답 시간은 200ms 이하 (warm) 여야 한다.

**검증 방법**:
- Vitest integration: 알려진 단체명 prefix → top 1 검증
- Playwright E2E: 헤더 검색 박스 → 결과 드롭다운 표시

---

## 8. AC-8 — 성능 + 속도 제한 (Split: AC-8a / AC-8b)

> 매핑: REQ-005 Statement C, 성능

본 AC는 두 개의 독립적인 검증 기준으로 분리하여 측정한다. AC-8a는 정상 트래픽 하의 성능 목표를 검증하고, AC-8b는 속도 제한 동작을 검증한다. 두 기준을 분리하면 성능 회귀와 속도 제한 회귀를 각각 독립적으로 추적할 수 있다.

### AC-8a — Performance under normal load

**Given** Vercel Edge Middleware 의 IP-based rate limit (분당 30 req) 이 활성화되어 있고
**And** `/` 랜딩 페이지가 plan.md `Reference Constants`의 캐시 설정으로 배포된 상황에서
**When** 60초 동안 1000회 burst 요청 (분당 30회 미만으로 IP를 분산하여 rate limit 미발동) 을 보내고 응답 시간을 수집하면
**Then** `/` 라우트의 95th percentile TTFB는 1500ms 이하여야 하고
**And** Lens 3 (`high_concern_ranking` 쿼리) 응답시간 목표 (warm < 200ms — queries.md §12) 와 일관되어야 한다.

**검증 방법**:
- `scripts/benchmark-queries.ts` 1000회 60초 burst 측정 → percentile 계산
- 측정 IP는 rate limit 미발동을 위해 충분히 분산하거나 측정 환경에서 limit 우회

### AC-8b — Rate limit enforcement

**Given** Vercel Edge Middleware 의 IP-based rate limit (분당 30 req) 이 활성화되어 있고
**And** 단일 IP 가 60초 윈도우 내에서 31번째 요청을 시도하는 상황에서
**When** 단일 IP가 60초 안에 30회를 초과하는 요청을 보내면
**Then** 31번째 요청은 HTTP 429 (Too Many Requests) 를 반환해야 하고
**And** rate-limit 윈도우가 reset된 이후 (1분 경과 후) 동일 IP에서 다시 200 응답이 가능해야 한다.

**검증 방법**:
- Playwright E2E: 60초 안에 31회 요청 → 31번째 응답 코드 확인
- 회복 검증: 60초 대기 후 같은 IP로 1회 요청 → 200 응답 확인

---

## 9. AC-9 — 정부 엔티티 자동 제외

> 매핑: REQ-001, REQ-002

**Given** `Government of Alberta` (BN `124072513RR0010`)이 데이터에 존재하고
**And** 해당 엔티티의 `govt_share_of_rev ≈ 0.94` (정부 자체이므로 수치상 매우 높음)이고
**And** filing 패턴이 zombie 룰에 형식적으로는 매칭될 수 있을 때
**When** zombie 또는 ghost ranking을 조회하면 (`/lens/zombie`, `/lens/ghost`, `/`)
**Then** 결과 목록에 `Government of Alberta` 가 **포함되지 않아야** 하고
**And** safe-queries helper 의 `legal_name ILIKE 'Government of %'` 패턴이 SQL CTE 단계에서 사전 필터링해야 하며
**And** 다른 정부 엔티티 (`'%Health Authority%'`, `'%Crown Corporation%'`, `'City of %'`, `'Town of %'`, `'Municipality of %'`) 도 동일하게 제외되어야 한다.

**검증 방법**:
- Vitest integration: `safe-queries.test.ts` — Government of Alberta BN을 zombie/ghost 결과에서 검색 → 0 hits
- Vitest integration: 6개 패턴 각각 sample 엔티티로 제외 확인

---

## 10. AC-10 — Director Overlap "Signal Only" 디스클레이머

> 매핑: REQ-002, UI

**Given** 어떤 BN의 이사 중 다른 funded BN의 이사와 last_name + first_name + initials 셋이 모두 일치하는 경우 (`director_overlap_count > 0`) 가 발생하고
**When** `/entity/[entityId]` 페이지의 Director lens 섹션이 렌더되면
**Then** 카운트 시그널 (e.g., "5 matching directors across 12 other funded BNs") 이 표시되어야 하고
**And** 동일 카드/섹션 내에 명시적 디스클레이머 텍스트 `"signal only — not a fraud claim"` (또는 한국어 등가) 가 다음 **측정 가능한 모든 기준을 만족**하는 위치에 표시되어야 한다:

- **위치**: 디렉터 중복 카운트 시그널과 **동일한 카드/섹션 영역 내**에 위치
- **폰트 크기**: 최소 **14px** (CSS computed style 기준)
- **접근성 속성**: `role='note'` 또는 ARIA `aria-label` 속성 보유
- **본문 내용**: 디스클레이머 본문은 정확히 `"signal only — not a fraud claim"` 영문 표현 또는 한국어 동등 표현 ("시그널일 뿐 사기 단정이 아닙니다" 등)을 포함

**And** Methodology 페이지에 동명이인 false positive 회피 룰 (last+first+initials 셋 매칭, 외부 corporate registry 부재) 이 문서화되어야 한다.

**검증 방법**:
- Vitest unit: `director-detail.tsx` 컴포넌트 snapshot — 디스클레이머 노드 존재 검증, computed font-size ≥ 14px 검증, role/aria 속성 검증
- Playwright E2E: 후보 BN 페이지 방문 → Director 섹션 + 디스클레이머 표시 확인 + 동일 카드 컨테이너 내 위치 확인 (Playwright `boundingBox` API)

---

## 11. AC-11 — Concern Weights YAML Boot-Time 검증

> 매핑: REQ-003

**Given** `.moai/project/db/concern-score-weights.yaml` 파일에 5개 가중치 (`zombie`, `ghost`, `loop`, `director`, `multi_source`) 가 정의되어 있고
**When** Next.js 서버가 boot 되면
**Then** 가중치는 한 번만 로드되어 메모리에 캐시되어야 하고 (hot-reload 미지원)
**And** 합계 검증이 수행되어야 한다: `Σ weights == 1.0 ± 0.001`
**And** 검증 실패 시 (e.g., 합계 0.95 또는 1.05) 서버는 명확한 에러 메시지와 함께 boot 중단해야 한다 (`throw` 또는 `process.exit(1)`)
**And** 검증 통과 시 `computeConcernScore()` 호출은 yaml 파일을 다시 읽지 않아야 한다.

**검증 방법**:
- Vitest unit: `concern-score.test.ts` — invalid weight sum (0.95) 입력 시 throw 검증
- Vitest unit: hot-reload 시뮬레이션 — yaml 파일 변경 후 재호출 시 메모리 cache 사용 확인 (fs.read 호출 0회)

---

## 12. AC-12 — Entity Profile TTFB 성능

> 매핑: REQ-004, 성능

**Given** Vercel iad1 region 배포 + Render PG Oregon replica + `revalidate: 60` 캐시 설정 환경에서
**When** `/entity/[entityId]` 페이지를 warm cache 상태에서 요청하면
**Then** TTFB는 1200ms 이하여야 하고
**And** 5개 lens 함수가 `Promise.all` 로 병렬 실행되어 max(개별 lens 시간) 에 근접해야 하며 (Σ가 아니라)
**And** cold first hit (revalidate 만료 후 첫 요청) 의 TTFB는 2500ms 이하 허용

**검증 방법**:
- `scripts/benchmark-queries.ts` 확장: `/entity/{seed_bn}` warm/cold 100회 측정
- Vercel Analytics 또는 Playwright performance API 활용
- 5개 lens 개별 측정 + `Promise.all` 합 측정 비교 (병렬 효과 확인)

---

## 13. Edge Cases (엣지 케이스)

본 절은 위 12개 AC 외에 명시적 검증이 필요한 엣지 케이스를 나열한다. 각 케이스는 Vitest 단위 테스트로 커버한다.

### 13.1 빈 결과 (No Hits)

- **상황**: 검색 결과 0건, lens 점수 0, ranking 결과 0건
- **기대**: `<empty-state>` 컴포넌트 렌더 (structure.md `components/shared/empty-state.tsx`), 에러 throw 안 함
- **테스트**: `existsBN = 'NONEXISTENT123'` 으로 `getZombieScore` 호출 → `{ score: 0, last_funding_year: null, ... }` 반환

### 13.2 정부 엔티티 (AC-9 보강)

- **상황**: 검색 박스에 "Government of Alberta" 입력
- **기대**: 검색 결과에는 표시되어야 함 (검색은 모든 엔티티 대상). 단, ranking/lens 결과에서 자동 제외
- **테스트**: 검색 hit 1건, ranking hit 0건

### 13.3 신생 자선단체 (12개월 미만)

- **상황**: `cra.cra_identification.registration_date > CURRENT_DATE - INTERVAL '12 months'`
- **기대**: Lens 2 (Ghost) 에서 자동 제외 (queries.md §4 `registration_date <= CURRENT_DATE - INTERVAL '12 months'`)
- **테스트**: 신생 BN sample → `getGhostScore` 결과 빈 행 또는 score 0

### 13.4 결측 필드

- **상황**: `cra.cra_financial_general.fpe IS NULL` 또는 `field_5862-5864 IS NULL`
- **기대**: Lens 함수는 throw 하지 않고 `null` safe 처리 (e.g., `COALESCE(field_5864, 0)` — queries.md §4)
- **테스트**: NULL 값을 가진 BN → 점수 0 반환, raw row에 NULL 그대로 표시

### 13.5 Loop ID 존재하지 않음

- **상황**: `/lens/loops/[loopId]` 에서 `loopId` 가 5,808개 사이클에 없음
- **기대**: 404 not-found 페이지 렌더 (Next.js `not-found.tsx`), 500 에러 안 남
- **테스트**: Playwright E2E `loopId = 99999` 요청 → 404 응답

### 13.6 Rate Limit 초과 후 회복

- **상황**: 분당 30회 초과 → 429 → 다음 분에서 다시 요청
- **기대**: 429 응답 후 1분 경과 시 다시 200 응답 가능
- **테스트**: Playwright E2E 또는 `scripts/benchmark-queries.ts` 시간 기반 시나리오

---

## 14. Performance Targets (tech.md §5.1 매핑)

페이지/쿼리별 TTFB 목표 (warm cache 기준):

| Route / Query | 목표 (warm) | 목표 (cold) | 매핑 AC |
|---|---|---|---|
| `/api/healthz` | < 200ms (warm cache 60s, after first hit) | < 500ms (cold first hit) | AC-1 |
| `/` (high concern ranking) | < 800ms | < 1500ms | AC-8 |
| `/entity/[id]` | < 1200ms | < 2500ms | AC-12 |
| `/lens/zombie` | < 1000ms | < 2000ms | AC-2 |
| `/lens/ghost` | < 1000ms | < 2000ms | (AC-9 보강) |
| `/lens/loops` | < 1000ms | < 2000ms | AC-3, AC-4 |
| `/methodology` | < 200ms | < 200ms (static) | (정적 페이지) |
| `lens1_zombie_top50` SQL | < 200ms | < 800ms | (queries.md §12) |
| `lens3_loop_classified` SQL | < 300ms | < 1500ms | (queries.md §12) |
| `fed_dedupe_total` SQL (F-3) | < 500ms | < 2000ms | AC-5 (R4 위험) |
| `high_concern_ranking` SQL | < 200ms | < 1000ms | AC-8 |

전체 95p TTFB 목표 (`/`, `/entity/*`, `/lens/*` 종합): **< 1500ms** under rate limit (AC-8).

---

## 15. Definition of Done (DoD)

본 SPEC의 완료 조건:

- [ ] 12개 AC 모두 자동화 테스트로 통과 (Vitest + Playwright)
- [ ] Coverage ≥ 85% (line + branch) — `pnpm test --coverage`
- [ ] LSP zero errors / zero type errors / zero lint warnings (run phase 게이트)
- [ ] 5개 Edge case 모두 단위 테스트 커버
- [ ] 성능 게이트 통과 (95p < 1500ms under rate limit, AC-8)
- [ ] Methodology 페이지 + 디스클레이머 (AC-10) 모두 렌더
- [ ] Vercel production 배포 + `/api/healthz` 응답 200 확인
- [ ] 발표 시나리오 3개 (Zombie / Loop Tier C / Multi-Source High Concern) 후보 BN 추출 + 페이지 동작 확인
- [ ] Concern Score weights yaml + sum 검증 동작 (AC-11)
- [ ] Out-of-Scope 7개 항목 미구현 확인 (인증/쓰기/타 챌린지/뉴스/모바일/다국어/MV)

---

Version: 0.1.2
Last Updated: 2026-04-27
