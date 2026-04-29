# Methodology — Recipient Health Index (RHI)

## 개요

RHI는 캐나다 정부 자금을 수령한 비영리/자선단체의 건강성을 5개 렌즈로 통합 분석하여 단일 우려 점수(Concern Score)와 등급(Tier)을 산출하는 지표 시스템입니다.

본 문서는 SPEC-RHI-001 MVP 의 점수 산출 공식, 각 렌즈 정의, 데이터 소스, 알려진 함정, 면책조항을 공개합니다. **투명성이 RHI의 핵심 가치**이며, 모든 점수는 재현 가능한 SQL 패턴으로 산출됩니다.

---

## 데이터 소스

| 소스 | 설명 | 핵심 테이블 |
|---|---|---|
| **CRA T3010** | 캐나다 자선단체 연차 신고서 (~85k charities, 2010-2023) | `cra.cra_identification`, `cra.cra_financial_general`, `cra.govt_funding_by_charity`, `cra.overhead_by_charity` |
| **FED Grants & Contributions** | 연방 정부 보조금/기여금 데이터 (1.27M rows, 2018-) | `fed.grants_contributions` |
| **AB Grants** | 앨버타 주정부 보조금 데이터 | `ab.ab_grants`, `ab.ab_grants_recipients` |
| **Loop Detection** | 자금 순환 사이클 분석 (5,808 loops 사전 계산) | `cra.loops`, `cra.loop_participants`, `cra.identified_hubs`, `cra.scc_components` |
| **T3010 Plausibility Flags** | T3010 데이터 품질 플래그 (severity 1-5) | `cra.t3010_plausibility_flags` |
| **Entity Resolution** | 다중 데이터 소스 엔티티 매칭 (Splink ML) | `general.entities`, `general.entity_source_links`, `general.vw_entity_search` |

---

## 5개 렌즈

### Lens 1 — Zombie Recipient

**정의**: 정부 자금을 받은 후 filing(T3010 제출)을 중단한 패턴.

**조건**:
- `cra.govt_funding_by_charity.govt_share_of_rev >= 0.7` (정부 자금 비중 70% 이상)
- 마지막 `cra.cra_financial_general.fpe` (filing date)가 일정 기간 이상 과거

**점수 단계**:
- 100: last_fpe < 24개월 + 마지막 funding이 last_fpe 연도 - 1 이상 (자금 수령 후 즉시 중단)
- 80: last_fpe < 18개월
- 60: last_fpe < 12개월
- 30: last_fpe < 6개월
- 0: 정상 filing

### Lens 2 — Ghost Recipient

**정의**: 정부 자금 수령은 계속되지만 program 비율이 비정상적으로 낮은 패턴 (운영비 위주 지출 의심).

**조건**:
- `cra.overhead_by_charity.programs / total_expenditures < 0.5` (program ratio < 50%)
- `govt_share_of_rev >= 0.7`
- `cra.cra_identification.registration_date <= CURRENT_DATE - INTERVAL '12 months'` (신생 단체 제외)

**점수 단계**:
- 100: program_ratio < 30%
- 80: program_ratio < 40%
- 60: program_ratio < 50%
- 0: program_ratio >= 50%

### Lens 3 — Funding Loops (Tier A/B/C)

**정의**: 자금 순환 사이클 (예: A → B → C → A) 패턴. 5,808개 사전 계산된 cycle을 분류.

**Tier 분류 규칙** (CASE 평가 순서 — `queries.md §5`):

1. **Tier A — Internal hierarchy**: `distinct_bn_roots = 1` (모든 참여자가 동일 BN root prefix). 합법 internal 자금 이동 (예: Salvation Army `107951618` 9자리 prefix 공유).
2. **Tier A — Known hub-mediated**: `cra.identified_hubs` (CHIMP, United Way 등 20개) 통과. 합법 fund aggregator 패턴.
3. **Tier C — Data-quality flagged**: `cra.t3010_plausibility_flags.severity >= 3` 매칭. 데이터 품질 이슈가 있는 cycle.
4. **Tier B — Observed**: cross-organization but `avg_program_ratio >= 0.6` (관찰 가능, 합법성 의심 적음).
5. **Tier C — Suspicious**: cross-organization + low/null program ratio + no hub + no flag.

**Concern Score 환산**:
- Tier A or null → loop_signal = 0
- Tier B → loop_signal = 50
- Tier C → loop_signal = 100

### Lens 4 — Director Overlap

**정의**: 동일 인물(또는 동명이인)이 여러 funded BN의 이사로 등록된 패턴.

**매칭 기준**: `last_name + first_name + initials` 셋이 모두 일치.

**점수 환산**: `min(director_overlap_count × 10, 100)` (Concern Score 통합 시).

**중요 면책조항**: Director overlap은 **신호일 뿐 사기 단정이 아닙니다 (signal only — not a fraud claim)**. 동명이인 false positive 가능성이 매우 높습니다. 외부 corporate registry 확인 없이는 동일 인물 여부를 단정할 수 없습니다. UI에서 본 면책조항을 명시적으로 표시합니다 (AC-10).

### Lens 5 — Multi-Source Funding

**정의**: 동일 entity가 FED + AB + CRA gov-transfers 둘 이상에서 자금을 수령하는 패턴.

**source_count**: 1 / 2 / 3 (각 소스 미수령 = 0 안 셈).

**점수 환산**: `count >= 2 ? 100 : 0` (Concern Score 통합 시).

**F-3 dedup**: FED 측 합계는 `(ref_number, recipient_business_number)` 튜플당 최신 amendment만 선택하는 ROW_NUMBER OVER PARTITION BY 패턴으로 계산 — agreement_value 누적 함정 회피 (AC-5).

---

## Concern Score 산출

5개 렌즈 raw signal을 가중합으로 통합한 0-100 점수:

```
concern_score
  = w_zombie · zombie_score
  + w_ghost · ghost_score
  + w_loop · loop_signal
  + w_director · min(director_overlap × 10, 100)
  + w_multi · (multi_source_count >= 2 ? 100 : 0)
```

### 기본 가중치 (`.moai/project/db/concern-score-weights.yaml`)

| 렌즈 | 가중치 |
|---|---|
| zombie | 0.30 |
| ghost | 0.25 |
| loop | 0.20 |
| director | 0.10 |
| multi_source | 0.15 |
| **합계** | **1.00** (boot-time 검증 ±0.001) |

가중치는 yaml 파일에서 한 번만 로드되어 메모리 캐시됩니다. Hot-reload 미지원 — 변경 시 서버 재시작 필요.

### Tier 임계값 (Ascending)

| Tier | Score 범위 | 의미 |
|---|---|---|
| **Critical** | ≥ 80 | 즉시 검토 필요 |
| **High** | 60-79 | 우려 단체 |
| **Medium** | 40-59 | 관찰 권고 |
| **Low** | 20-39 | 경미한 시그널 |
| **Healthy** | < 20 | 정상 |

---

## 알려진 데이터 함정

### F-1: ref_number collision (FED Grants)

**증상**: 동일 `ref_number`가 다수 행에 재사용됨 (amendment chain).

**회피**: `(ref_number, recipient_business_number)` 튜플 + amendment_number tiebreaker 적용.

### F-3: agreement_value triple count

**증상**: `SUM(agreement_value)` 단순 합산 시 동일 contract의 amendment chain이 누적되어 약 11% (~$105B) overcounting 발생.

**회피**: window function `ROW_NUMBER() OVER (PARTITION BY ref_number, recipient ORDER BY amendment_number DESC, amendment_date DESC, _id DESC)` 으로 최신 amendment 한 행만 선택 후 SUM.

**검증** (AC-5): `dedup_sum < raw_sum` 단조 부등식 (~$816B vs ~$921B 정도).

### 정부 엔티티 자동 제외 (AC-9)

`legal_name` 패턴으로 zombie/ghost/loops 결과에서 정부 엔티티를 사전 제외:

- `Government of %`
- `%Health Authority%`
- `%Crown Corporation%`
- `City of %`
- `Town of %`
- `Municipality of %`

**이유**: Government of Alberta (BN 124072513RR0010) 등은 `govt_share_of_rev ≈ 0.94` (정부 자체이므로 수치상 매우 높음)이며 zombie 룰에 형식적으로 매칭될 수 있으나, 정부 엔티티 자체는 본 시스템의 분석 대상이 아닙니다.

### Director false positive

같은 last_name + first_name + initials를 가진 여러 사람이 다수 BN의 이사로 등록될 수 있으며 (예: "John A. Smith"), 본 시스템은 **동일 인물인지 단정하지 않습니다**. 외부 corporate registry 데이터 (예: Industry Canada Federal Corporation Data) 통합 없이는 false positive를 완전히 제거할 수 없습니다. 따라서 Director Overlap signal은 항상 `"signal only — not a fraud claim"` 면책조항과 함께 표시됩니다 (AC-10).

### 신생 자선단체 보호

`registration_date > CURRENT_DATE - INTERVAL '12 months'` 단체는 Lens 2 (Ghost)에서 자동 제외됩니다 — overhead 비율이 출범 초기 자연스럽게 높을 수 있어 false positive 회피.

---

## 운영 가드 (REQ-005 Statement C)

- **Rate Limit**: 단일 IP당 분당 30 req. 31번째 요청은 HTTP 429 + Retry-After 헤더. 1분 윈도우 만료 후 재개.
- **Healthz**: `/api/healthz` 는 rate limit 적용 제외. `SELECT 1` ping 후 `{ok, ts}` 응답.

---

## Out of Scope (이번 MVP에서는 제외)

- 인증/사용자 계정 (모든 페이지 공개)
- 데이터 쓰기 (replica read-only)
- 다국어 (한국어 단일)
- 모바일 최적화
- materialized view (replica 쓰기 불가)
- PDF 리포트 export
- 엔티티 비교 (`/compare?a=&b=`)
- 실시간 업데이트 (revalidate 60-600s 캐시)

---

## 참고 자료

- SPEC: `.moai/specs/SPEC-RHI-001/spec.md`
- 쿼리 패턴: `.moai/project/db/queries.md`
- 데이터 함정 카탈로그: `.moai/project/db/KNOWN-DATA-ISSUES.md` (F-1, F-3 등)
- Acceptance Criteria: `.moai/specs/SPEC-RHI-001/acceptance.md`

---

Last Updated: 2026-04-27
SPEC: SPEC-RHI-001 v0.1.2
