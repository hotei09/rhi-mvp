# Product: Recipient Health Index (RHI)

캐나다 공공자금 수혜 엔티티의 건전성을 다중 렌즈로 평가하는 단일 페이지 대시보드.

## 1. 개요

- **작업명**: Recipient Health Index (RHI) — 별칭 후보: FundTrail.ca, GrantRisk
- **해커톤**: GovAlta Agency 26 Hackathon (Ottawa, 2026)
- **데이터 소스**: 정부 제공 통합 PostgreSQL (CRA T3010 + FED grants/contributions + AB grants/contracts/sole-source + general entity-matching)
- **개발 형태**: Solo, 1주 MVP
- **배포**: Vercel + Render Postgres 직결 (replica)
- **참여 챌린지**: #1 Zombie / #2 Ghost / #3 Loops / #6 Related Parties (lite) / #8 Duplicative (lite)
- **선택 원칙**: depth over breadth — 5개 챌린지를 각기 분리된 5개 분석으로 보지 않고, **단일 엔티티 점수 체계 안에서 통합된 5개 렌즈**로 다룸

## 2. 해결하려는 문제

캐나다는 매년 수십억 달러의 공적 자금을 비영리·기업·개인사업체에 이전한다. 그러나 자금 수혜 후 실체가 사라지거나(Zombie), 명목상만 존재하거나(Ghost), 자금이 동일 그룹 내에서 순환하거나(Loops), 동일 인물이 다수 수혜 엔티티를 통제(Related Parties)하거나, 다단계 정부에서 중복 자금을 수령(Duplicative)하는 패턴이 존재한다.

기존 공개 데이터에서는 이러한 패턴을 **엔티티 단위로 종합 평가하는 도구가 존재하지 않는다**. 각 패턴은 학술 논문이나 단발성 조사 보도에만 등장하며, 일반 시민·언론·감사기관이 사용할 수 있는 운영형 도구는 없다.

## 3. 사용자 (Target Audience)

- **1차**: 조사 저널리스트 — 특정 단체의 funding history와 위험 시그널을 5초 안에 확인
- **2차**: 정책 분석가 — 부처별·지역별 위험 분포 패턴 조망
- **3차**: 시민 / 자선 기부자 — 기부 전 단체 건전성 점검
- **4차**: 회계감사관 — 일선 조사 우선순위 도출

심사위원 관점: "이 도구를 매일 쓰는 실제 사용자가 누구인지 명확하다"는 점이 강한 평가 포인트.

## 4. 핵심 가치 제안

> "한 엔티티의 BN을 입력하면 5개 렌즈의 위험 시그널을 30초 안에 본다. 모든 점수는 raw SQL까지 클릭 한 번에 추적된다."

- **통합성**: 5개 챌린지가 단일 엔티티 점수로 수렴
- **방어가능성 (Defensibility)**: 모든 시그널이 SQL 트레이스 + raw row drill-down 제공
- **실용성**: 인쇄 가능한 single-page 엔티티 리포트
- **투명성**: 점수 계산식 + 데이터 함정(F-1/F-3) 공개

## 5. 다섯 렌즈 (Five Lenses)

### Lens 1 — Zombie Recipient (Challenge #1)
- **정의**: 마지막 정부 자금 수령 후 12개월 이내 T3010 filing 중단 + 정부 자금 비중 ≥ 70%
- **데이터**: `cra.govt_funding_by_charity` + `cra.cra_identification`의 최신 `fpe`
- **출력**: zombie_score (0–100), 마지막 자금/마지막 filing 날짜, 정부 자금 누적
- **함정**: 정부·보건당국 같은 카테고리는 자동 제외 (`category` 화이트리스트 필터)

### Lens 2 — Ghost Capacity (Challenge #2)
- **정의**: 살아있되 직원 0 + 정부 자금 비중 ≥ 70% + 인건비/이전지출 ≥ 80% + 프로그램 지출 ≤ 20%
- **데이터**: `cra.cra_financial_general` (직원 수 field, 인건비 field_5862-5864, 프로그램 지출 boolean flags)
- **출력**: ghost_score (0–100), 직원 수, 인건비 비율, 프로그램 지출 비율
- **함정**: 신생 단체(첫 filing 12개월 미만) 제외

### Lens 3 — Loop Participant (Challenge #3)
- **정의**: 사전탐지된 5,808개 사이클 중 하나 이상에 참여한 BN
- **데이터**: `cra.loops`, `cra.loop_participants`, `cra.identified_hubs`, `cra.scc_components`
- **출력**: loop_count, max_flow_in_loop, hub_status (none/hub/SCC member)
- **분류 레이어** (이 해커톤의 진짜 일감):
  - **Tier A (합법)**: 동일 BN 루트 (예: Salvation Army `107951618`) 또는 알려진 도네이션 플랫폼/연합자선 허브 (CHIMP, United Way, Vancouver Foundation 등)
  - **Tier B (관찰)**: cross-org 루프이나 참여자 모두 program_expenditure ratio ≥ 0.6
  - **Tier C (의심)**: cross-org 루프 + 낮은 program ratio + t3010 plausibility flag 매칭
- **출력 추가**: loop_tier (A/B/C), 분류 근거 narrative

### Lens 4 — Director Network (Challenge #6 lite)
- **정의**: 동일 인물이 다수 funded entity의 이사인 경우 시그널
- **데이터**: `cra.cra_directors` (last_name + first_name 정규화)
- **출력**: director_overlap_count (이 BN의 이사 중 다른 funded BN 이사와 동명인 수)
- **주의**: 단순 동명이인은 false positive — first+last+initials 매칭으로 정밀도 확보. 외부 corporate registry 부재로 단순 시그널만 제공.
- **MVP 범위**: 시그널만 표시, 깊은 분석은 outscope

### Lens 5 — Multi-Source Funding (Challenge #8 lite)
- **정의**: 동일 entity_id 가 FED + AB + CRA gov-transfers 셋 중 둘 이상에서 자금 수령
- **데이터**: `general.entity_source_links` 그룹화 + `cra.govt_funding_by_charity` + `fed.vw_agreement_current` (F-3 회피) + `ab.ab_grants`
- **출력**: source_count, 각 소스 합계, 동일 회계연도 중복 여부
- **MVP 범위**: 카운트와 합계만, 정책 매칭(같은 목적 여부)은 outscope

## 6. Concern Score (통합 점수)

```
concern_score =
    0.30 × zombie_score
  + 0.25 × ghost_score
  + 0.20 × (loop_tier_C ? 100 : loop_tier_B ? 50 : 0)
  + 0.10 × min(director_overlap_count × 10, 100)
  + 0.15 × (multi_source_count >= 2 ? 100 : 0)
```

- 가중치는 `.moai/project/db/concern-score-weights.yaml` 에 분리하여 변경 추적 가능하게 함
- 모든 컴포넌트 점수는 0–100 normalize
- 최종 표시: 0–100 + Tier (Critical 80+, High 60-79, Medium 40-59, Low 20-39, Healthy <20)

## 7. MVP 범위 (in-scope / out-of-scope)

### In-Scope (1주 Solo)
- 5개 렌즈 점수 계산 (SQL views + Server Actions)
- 엔티티 검색 (BN, 이름)
- 엔티티 프로필 페이지 (5개 렌즈 + raw drill-down)
- 상위 N개 High Concern 랭킹 (엔티티 카테고리 필터: 자선/기업/협회 등)
- 렌즈별 페이지 (Zombie / Ghost / Loops 3개)
- 방법론 페이지 (데이터 소스, F-1/F-3 함정, 점수 공식 공개)
- 데모용 시나리오 가이드 (3개 케이스 예시)

### Out-of-Scope (의도적 제외)
- 챌린지 #4 / #5 / #7 / #9 / #10 (별도 데이터/외부 소스 필요)
- 외부 뉴스 스크래핑·LLM 분류 (시간 부족)
- 사용자 계정·로그인 (공개 도구)
- 데이터 쓰기·라벨링·플래그 신고 (read-only)
- 모바일 최적화 (1차 데스크톱 우선)
- 다국어 (한국어 UI 우선, 발표는 영어 슬라이드 별도)

## 8. 성공 지표 (해커톤 심사 기준 매핑)

해커톤 브리프: "clear, defensible, focused on real-world impact"

| 심사 기준 | RHI 대응 |
|---|---|
| Clear | 5개 렌즈 + 단일 점수 + 엔티티 카드 — 누구나 이해 |
| Defensible | 모든 점수 → SQL 트레이스 → raw row 클릭 가능 |
| Real-world impact | 기자·감사관 사용 시나리오 명시, 데모용 실제 케이스 3개 |
| Depth over breadth | 5개 챌린지 단일 데이터 백본으로 통합, 각 렌즈 풀 깊이 |

## 9. 데모 시나리오 (가이드)

발표 5분 내 보여줄 3개 실제 케이스:

1. **Zombie 케이스**: 정부 자금 ≥ $X 수령 후 filing 중단한 자선단체 — 엔티티 프로필 페이지에서 timeline 시각화
2. **Loop Tier C 케이스**: cross-org 사이클 중 의심도 최상위 — 네트워크 그래프 + 분류 근거 narrative
3. **Multi-Source High Concern 케이스**: 5개 렌즈 중 3개 이상 hit한 엔티티 — 통합 점수 + 모든 시그널 한 화면

각 케이스의 BN/entity_id는 개발 중 실제 데이터에서 후보군 추출 (`SELECT ... ORDER BY concern_score DESC LIMIT 20` 후 사람이 검토하여 발표용 골라냄).

## 10. 프로젝트 일정 (우선순위 기반)

> 주의: HARD 룰에 따라 시간 추정 금지 — 우선순위와 단계 순서로만 명시

**Priority High (반드시 완료)**:
- DB 연결 + ORM 어댑터 (postgres.js) 셋업
- 5개 렌즈 SQL views 작성 및 검증
- Concern Score 계산 함수 + 가중치 yaml
- 엔티티 검색 + 프로필 페이지 (server-rendered)
- High Concern 랭킹 페이지

**Priority Medium (시간 허용 시)**:
- 네트워크 그래프 (Lens 3 분류 시각화)
- 렌즈별 분석 페이지 3개 (Zombie / Ghost / Loops)
- 방법론 페이지 + 데이터 함정 문서화

**Priority Low (있으면 좋음)**:
- 엔티티 비교 페이지 (2개 BN 나란히)
- PDF 리포트 export
- 데모 시나리오 빠른 링크 카드

## 11. 위험 요소 (Risks)

| 위험 | 완화 |
|---|---|
| Render Postgres 응답 지연 (Vercel 콜드스타트 + 대륙간 latency) | 핫 쿼리는 materialized view 또는 결과 캐시 (`unstable_cache` / `revalidate`) |
| F-3 누적값 함정 (agreement_value triple count) | `fed.vw_agreement_current` 뷰 사용 강제, raw 테이블 직접 SUM 금지 |
| 정부·보건당국이 "Top Zombie"로 잘못 잡힘 | category 화이트리스트 필터 + visualization에 카테고리 facet 노출 |
| 동명이인으로 director overlap false positive 폭증 | first+last+initials+postal 매칭으로 정밀도 확보, 시그널만 표시 |
| 1주 Solo 일정 초과 | Out-of-Scope 룰 엄수, Priority Low 항목은 망설임 없이 컷 |

## 12. 다음 단계

1. `structure.md` 와 `tech.md` 를 이 문서에 일관되게 작성
2. SPEC 작성 (`/moai plan` "RHI MVP — 5개 렌즈 통합 대시보드")
3. DB 메타데이터 init (`/moai db init`) — Render PG 스키마 매핑
4. 구현 (`/moai run`) — DDD/TDD per quality.yaml

---

Version: 1.0.0
Last Updated: 2026-04-27
