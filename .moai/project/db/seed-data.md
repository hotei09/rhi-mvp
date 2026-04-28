# Seed Data — Lookups, Weights, Demo Scenarios

표준 "테스트 fixture seed" 개념과 다르다. 본 프로젝트는 read-only replica를 사용하므로 DB seed는
존재하지 않는다. 대신 본 파일은 (1) 해커톤이 제공한 룩업 테이블, (2) 어플리케이션 측 설정 시드
(가중치·화이트리스트), (3) 발표 시연용 데모 엔티티 후보를 정리한다.

---

## 1. 시드 전략 (Seed Strategy)

**Strategy**: hybrid — "DB seed" 0개, "config seed" + "demo scenario seed"만 관리

| 시드 유형 | 위치 | 변경 추적 |
|---|---|---|
| Lookup data | DB 자체 (`cra.cra_*_lookup`, `fed.*_lookup`, `ab.ab_*_lookup`, `general.ministries`) — 해커톤 제공 | DB 스냅샷 (migrations.md) |
| Config seed | `.moai/project/db/concern-score-weights.yaml`, `apps/web/lib/data-issues/exclusions.ts` | git history |
| Demo scenarios | `apps/web/lib/demo/scenarios.ts` | git history |

**Seeding tool**: 별도 tool 없음. DB lookup은 SQL JOIN으로 직접 사용. config/demo는 코드 import.

**When seeds run**:
- [x] 빌드 시점에 demo scenarios 컴파일 (정적 import)
- [x] 런타임에 weights yaml 로드 (서버 부팅 시 1회)
- [ ] CI 통합 테스트 — 추후 단계

---

## 2. DB Lookup Tables (해커톤 제공)

### 2.1 cra 스키마

| 테이블 | 행 | 코드 | 용도 |
|---|---|---|---|
| `cra.cra_category_lookup` | ~100 | 0001-0250 | 자선 활동 카테고리 (Christianity=0030, Islam=0040, Judaism=0050, Foundations=0210, ...) |
| `cra.cra_sub_category_lookup` | (소형) | 코드 | sub-category |
| `cra.cra_designation_lookup` | 3 | A/B/C | A=Public Foundation, B=Private Foundation, C=Charitable Organization |
| `cra.cra_country_lookup` | (소형) | ISO | 국가 |
| `cra.cra_province_state_lookup` | (소형) | 코드 | 도/주 |
| `cra.cra_program_type_lookup` | (소형) | 코드 | 프로그램 타입 |

### 2.2 fed 스키마

| 테이블 | 용도 |
|---|---|
| `fed.agreement_type_lookup` | 협정 타입 (G=Grant, C=Contribution, ...) |
| `fed.country_lookup` | 국가 |
| `fed.currency_lookup` | 통화 |
| `fed.province_lookup` | 캐나다 도 |
| `fed.recipient_type_lookup` | 수혜자 타입 |

### 2.3 ab 스키마

| 테이블 | 용도 |
|---|---|
| `ab.ab_grants_fiscal_years` | 회계연도 |
| `ab.ab_grants_ministries` | 부처 정규화 |
| `ab.ab_grants_programs` | 프로그램 정규화 |
| `ab.ab_grants_recipients` | 수혜자 정규화 |
| `ab.ab_non_profit_status_lookup` | NP 상태 |

### 2.4 general 스키마

| 테이블 | 용도 |
|---|---|
| `general.ministries` | 부처 마스터 |
| `general.ministries_crosswalk` | 부처 매핑 |
| `general.ministries_history` | 부처 변경 이력 |

---

## 3. Config Seed — Concern Score Weights

`/.moai/project/db/concern-score-weights.yaml` 에 분리 (아직 미생성, `/moai run` 단계에서 생성).

```yaml
# Concern Score 가중치 (합 = 1.0)
# 변경 시 reasoning을 git commit message에 명시할 것
zombie: 0.30
ghost: 0.25
loop: 0.20
director: 0.10
multi_source: 0.15

# Tier 임계값
tier_thresholds:
  Critical: 80
  High: 60
  Medium: 40
  Low: 20
  # Healthy: < 20

# 마지막 보정 일자
last_calibration: 2026-04-27
calibration_method: "expert judgment (Solo MVP — no large-scale labeling)"
```

calibration는 후속 작업으로 진화 (실 데이터에서 sample-based feedback 후 조정).

---

## 4. Config Seed — 정부 엔티티 화이트리스트

`apps/web/lib/data-issues/exclusions.ts` 에서 관리. 본 파일에는 root 패턴만 기록.

```typescript
// 본 패턴 매칭 BN은 Lens 1, 2 점수 계산에서 제외
export const GOVERNMENT_NAME_PATTERNS: RegExp[] = [
  /^Government of (Canada|the Province|the Territory)/i,
  /Health Authority$/i,
  /Health Region$/i,
  /Crown Corporation/i,
  /Royal Canadian Mounted Police/i,
  /^City of /i,
  /^Town of /i,
  /^Municipality of /i,
  /Public Library$/i,
  /^Province of /i,
];

// 정부 자금 수령 자체는 합법인 BN (제외 후에도 funding history는 표시)
export const KNOWN_LARGE_GOVT_RECIPIENTS = [
  '124072513RR0010', // Government of the Province of Alberta (도정부)
  '887612463RR0001', // Fraser Health Authority
  '895830180RR0001', // Saskatchewan Health Authority
  '119261048RR0001', // Vancouver Coastal Health Authority
];
```

추가 패턴 발견 시 본 목록 + git commit으로 갱신.

---

## 5. Config Seed — Loop Classification 임계값

`apps/web/lib/lenses/loop.ts` 가 사용.

```typescript
export const LOOP_TIER_RULES = {
  // Tier A 자동: 동일 BN root prefix
  internal_hierarchy_prefix_length: 9,

  // Tier A: 알려진 hub 통과
  known_hub_loop_is_tier_A: true,

  // Tier B → C: program_ratio 임계
  program_ratio_observed_threshold: 0.6,
  program_ratio_suspicious_threshold: 0.4,

  // Tier C 강제: t3010 plausibility severity
  plausibility_severity_threshold: 3,
};
```

---

## 6. Demo Scenarios (발표용 시드)

`/moai run` 단계에서 `apps/web/lib/demo/scenarios.ts` 에 작성. 본 파일은 후보 추출 SQL만 보관.

### 6.1 Demo 후보 추출 SQL

```sql
-- 데모 시나리오 1: Zombie 후보 (정부 자금 ≥ $100K + filing 중단)
-- 사용: 발표 데모 케이스 1
SELECT bn, legal_name, category, last_funding_year, heavy_govt_funding,
       last_fpe, months_since_filing, zombie_score
FROM <Lens 1 query>
WHERE zombie_score >= 80
  AND heavy_govt_funding > 100000
ORDER BY heavy_govt_funding DESC
LIMIT 20;
-- 결과 검토 후 1개 사람이 직접 선택.
```

```sql
-- 데모 시나리오 2: Tier C Loop (cross-org + 의심도)
-- 사용: 발표 데모 케이스 2
SELECT loop_id, hops, path_display, total_flow, tier, classification_reasons
FROM <Lens 3 query>
WHERE tier = 'C'
ORDER BY total_flow DESC
LIMIT 20;
-- 결과 검토 후 1개 사람이 선택. 네트워크 그래프 발표 시 예시로 활용.
```

```sql
-- 데모 시나리오 3: Multi-source High Concern (5개 lens 중 3개+ hit)
-- 사용: 발표 데모 케이스 3 (통합 점수 강점 부각)
WITH multi_lens_hits AS (
  -- 5개 lens 결과 union
)
SELECT bn, legal_name, count(DISTINCT lens) AS lens_count, MAX(score) AS top_score
FROM multi_lens_hits
GROUP BY bn, legal_name
HAVING count(DISTINCT lens) >= 3
ORDER BY top_score DESC
LIMIT 10;
```

### 6.2 시나리오 프리셋 형식

```typescript
// apps/web/lib/demo/scenarios.ts (생성 예정)
export type DemoScenario = {
  id: 'zombie' | 'loop_tier_c' | 'multi_lens';
  title: string;
  description: string;
  entityId?: number;        // golden record id
  bn?: string;
  loopId?: number;
  url: string;              // 라우트
  highlights: string[];     // "이 단체가 흥미로운 이유"
};

export const DEMO_SCENARIOS: DemoScenario[] = [
  // 발표 직전 채워넣음 (실 데이터에서 위 SQL로 추출 후 사람이 검토)
];
```

랜딩 페이지에 "Demo Scenarios" 섹션으로 노출.

---

## 7. Test Fixtures (Vitest)

DB 직접 의존 단위 테스트는 최소화. 대신 함수 입력·출력 fixture만 둠.

```typescript
// apps/web/tests/unit/fixtures/lens-signals.ts
export const SAMPLE_LENS_SIGNALS = {
  zombie_high: { zombie_score: 85, ghost_score: 0, loop_tier: null, director_overlap: 0, multi_source_count: 1 },
  ghost_high: { zombie_score: 0, ghost_score: 80, loop_tier: null, director_overlap: 1, multi_source_count: 1 },
  loop_c_critical: { zombie_score: 30, ghost_score: 40, loop_tier: 'C', director_overlap: 2, multi_source_count: 2 },
  healthy: { zombie_score: 0, ghost_score: 0, loop_tier: 'A', director_overlap: 0, multi_source_count: 1 },
};
```

통합 테스트는 read replica 직접 호출 (`tests/integration/lens-views.test.ts`) — 결과 행 수만 sanity check (정확한 BN은 데이터셋 갱신 시 변할 수 있어 검증 어려움).

---

## 8. Production Data 안전 (해커톤 컨텍스트)

이 프로젝트는 production user data를 다루지 않는다. read-only replica만 사용하며 사용자 입력으로 새 행을 생성하지 않는다. 따라서 표준적 "production seed 안전 룰"은 적용 대상이 아니다.

다만:
- `.env.local` 의 PGCONN credentials는 git에 절대 커밋 금지 (`.gitignore` 확인)
- Vercel ENV에 동일 값 등록 후 로컬 `.env.local` 은 검증용으로만 유지
- 해커톤 종료 후 자격증명 회전(rotation) 가능성 → README에 회전 절차 노트

---

## 9. Seed Order

DB seed가 없으므로 N/A. config seed 로딩 순서:

1. `concern-score-weights.yaml` — 서버 시작 시 1회 로드
2. `exclusions.ts` — module import 시점
3. `LOOP_TIER_RULES` — module import 시점
4. `DEMO_SCENARIOS` — 발표 직전 채워서 module import 시점

---

Last reviewed: 2026-04-27
Note: 표준 RDB seed/fixture 템플릿은 본 프로젝트와 무관. 본 파일은 룩업·설정·데모 시나리오 메타데이터에 초점.
