---
engine: PostgreSQL 18.3
client: postgres.js (driver only)
host: dpg-d7auudv5r7bs738iqh70-b.replica-cyan.oregon-postgres.render.com
database: database_database_w2a1
read_only: true
last_synced_at: 2026-04-27
manifest_hash: "GovAlta-agency-26-2026-04-19"
schemas: [cra, fed, ab, general, public]
---

# Database Schema — GovAlta Agency 26 Hackathon Dataset

해커톤이 제공한 통합 PostgreSQL **read-only replica**의 스키마 문서. 우리(participants)는 이 스키마를 변경하지 않으며, 오직 SELECT만 수행한다. 모든 분석 산출물은 어플리케이션(Next.js Server Actions)에서 계산한다.

## 0. 메타

- **연결**: `postgresql://...@dpg-d7auudv5r7bs738iqh70-b.replica-cyan.oregon-postgres.render.com/database_database_w2a1?sslmode=require`
- **PG 버전**: 18.3 (Debian 12)
- **권한**: SELECT only (replica)
- **총 행 수**: ~14M+ across 79 tables
- **데이터 출처**: CRA T3010 (charity filings) + FED grants/contributions + AB grants/contracts + custom entity matching
- **알려진 데이터 이슈 출처**: GovAlta/agency-26-hackathon `KNOWN-DATA-ISSUES.md` (F-1, F-2, F-3, C-*, A-* 코드)

## 1. 스키마 (5개)

| 스키마 | 용도 | 주요 테이블 수 |
|---|---|---|
| **cra** | Canada Revenue Agency T3010 자선단체 신고서 + 사전계산 분석 레이어 | 39 |
| **fed** | 연방 grants & contributions (51개 부처) | 7 (1 fact + 6 lookup) |
| **ab** | Alberta 도정부 grants/contracts/sole-source/non-profit | 9 |
| **general** | Cross-source entity matching golden records + Splink 결과 | 13 |
| **public** | 연방 조달 계약 (procurement contracts) | 1 |

## 2. 핵심 사실 테이블 (Fact tables)

### 2.1 cra.cra_financial_general (134 MB)
T3010 신고서 본문 — 113개 컬럼 (대부분 `field_NNNN` boolean/numeric T3010 form line)

핵심 컬럼:
- `bn` (varchar) — Business Number, 자선단체 식별자
- `fpe` (date) — Fiscal Period End
- `field_5030`, `field_5031`, `field_5032` (numeric) — 자산/부채 totals
- `field_5862-5864` (numeric) — 인건비 관련 (top 10 directors compensation)
- `field_2000-2800` (boolean) — 프로그램 활동 영역 플래그

조인: `bn` 으로 다른 cra 테이블, `general.entity_source_links` (source_schema='cra', source_table='cra_financial_general')

### 2.2 cra.cra_identification (133 MB)
자선단체 기본 정보 + 카테고리 + 등록일

| 컬럼 | 타입 | 비고 |
|---|---|---|
| bn | varchar | PK 일부 |
| fiscal_year | int | PK 일부 |
| category | varchar | `cra_category_lookup.code` 참조 (앞 0 제거) |
| sub_category | varchar | `cra_sub_category_lookup.code` 참조 |
| designation | char | A=Public Foundation, B=Private Foundation, C=Charitable Org |
| legal_name | text | 정규명 |
| account_name | text | 별칭 |
| address_line_1/2, city, province, postal_code, country | varied | 주소 |
| registration_date | date | 등록 시점 |
| language, contact_phone, contact_email | varied | 연락처 |

### 2.3 cra.cra_directors (530 MB)
이사 명부 — 2.87M 행

핵심: `bn`, `last_name`, `first_name`, `initials`, `position`, `at_arms_length` (boolean), `start_date`, `end_date`

→ Lens 4 (Director Network)의 핵심 소스. 동명이인 회피를 위해 last+first+initials 셋 매칭 권장.

### 2.4 cra.cra_qualified_donees (350 MB)
T3010 Schedule 5 — 다른 자선단체로의 기부

핵심: `bn` (송금자), `donee_bn` (수혜자), `donee_name`, `total_gifts` (numeric), `political_activity_gift` (boolean)

→ `cra.loops` 의 원천 데이터. 사이클 탐지의 raw input.

### 2.5 fed.grants_contributions (3,006 MB)
연방 grants & contributions 단일 fat table — 1.27M 행, 40개 컬럼

핵심:
- `_id` (int) — **유일한 진정한 PK** (F-1 이슈 회피)
- `ref_number` (text) — TBS spec PK이나 41,046건 충돌 (F-1)
- `amendment_number` (text), `amendment_date` (date), `is_amendment` (boolean)
- `recipient_business_number`, `recipient_legal_name`, `recipient_operating_name`
- `agreement_value` (numeric) — **누적값(cumulative), F-3 함정** — naive SUM 시 트리플 카운트
- `agreement_start_date`, `agreement_end_date`
- `prog_name_en/fr`, `prog_purpose_en/fr`, `agreement_title_en/fr`
- `owner_org`, `owner_org_title` — 발주 부처

→ Lens 5 (Multi-source funding)의 연방측 소스. 단, F-3 회피 SQL 패턴(window 함수)을 반드시 적용 (queries.md 참조).

### 2.6 ab.ab_grants (1,044 MB)
Alberta 도 grants — 1.99M 행

핵심: `id`, `ministry`, `business_unit_name`, `recipient`, `program`, `amount` (numeric), `payment_date`, `fiscal_year`, `display_fiscal_year`, `lottery`, `lottery_fund`

### 2.7 ab.ab_contracts / ab.ab_sole_source
계약 및 수의계약 데이터 (각 25 MB / 11 MB).

`ab.ab_sole_source` 핵심: `vendor`, `amount`, `start_date`, `end_date`, `permitted_situations`, `contract_services`

### 2.8 public.contracts (82 MB)
연방 조달 계약 — 153K 행, 44개 컬럼 (모든 컬럼 text)

핵심:
- `reference_number`, `procurement_id`
- `vendor_name`, `vendor_postal_code`, `country_of_vendor`
- `original_value`, `contract_value`, `amendment_value` — 조달 가치 추이
- `solicitation_procedure`, `limited_tendering_reason` — 수의 / 경쟁 입찰 구분
- `commodity_type`, `commodity_code` — 카테고리
- `former_public_servant` — Lens 6 (Related Parties)에 직접 활용 가능 컬럼
- `contracting_entity`, `owner_org`, `owner_org_title`

→ Challenge #4/#5/#6의 핵심 소스. 본 MVP에선 활용 우선순위 낮음 (in-scope 외).

## 3. 사전계산 분석 레이어 (cra 스키마)

해커톤 제공자가 미리 계산해 둔 분석 결과 테이블 — **Lens 1/2/3 구현이 비약적으로 빨라짐**.

| 테이블 | 행 수 | 용도 |
|---|---|---|
| `cra.govt_funding_by_charity` | 167K | bn × fiscal_year별 federal/provincial/municipal/total_govt + revenue + **govt_share_of_rev** 사전 계산 |
| `cra.govt_funding_by_year` | (소형) | 연도별 합계 |
| `cra.overhead_by_charity` | (94 MB) | 자선단체별 오버헤드 비율 |
| `cra.overhead_by_year`, `cra.overhead_by_year_designation` | (소형) | 연도/지정별 오버헤드 |
| `cra.t3010_plausibility_flags` | (664kB) | T3010 룰 위반 사전 플래그 (rule_code, severity) |
| `cra.t3010_impossibilities` | (23 MB) | 불가능한 값 카탈로그 |
| `cra.t3010_completeness_issues` | (40kB) | 결측 이슈 |
| `cra.donee_name_quality` | (122 MB) | donee 이름 품질 평가 |
| `cra.identification_name_history` | (15 MB) | 이름 변경 이력 |

### 3.1 그래프/사이클 분석 (Lens 3)

| 테이블 | 행 수 | 용도 |
|---|---|---|
| **`cra.loops`** | **5,808** | 사전탐지된 funding 사이클. `path_bns` (array), `total_flow`, `bottleneck_amt`, `min_year`, `max_year`, `hops` |
| **`cra.loop_participants`** | (4MB) | loop_id × bn × position_in_loop × sends_to × receives_from |
| **`cra.loop_edges`** | 60 MB | 단방향 edge: src, dst, total_amt, edge_count, years[] |
| **`cra.loop_edge_year_flows`** | (4 MB) | edge × year별 flow |
| **`cra.loop_universe`** | (624 kB) | 분석 대상 BN 집합 |
| **`cra.loop_charity_financials`** | (376 kB) | loop 참여 BN의 재무 요약 |
| **`cra.loop_financials`** | (704 kB) | loop별 재무 합계 |
| **`cra.scc_components`** | 10,177 | Strongly Connected Components |
| **`cra.scc_summary`** | (144 kB) | SCC 요약 |
| **`cra.identified_hubs`** | 20 | top hub BN (CHIMP, United Way 등) + hub_type |
| **`cra.matrix_census`** | (6 MB) | 사이클 매트릭스 통계 |
| **`cra.johnson_cycles`** | (3 MB) | Johnson algorithm 결과 |
| **`cra.partitioned_cycles`** | (136 kB) | 분할된 사이클 |
| **`cra._dnq_canonical`** | (18 MB) | 정규화된 donee 이름 |

## 4. Entity Matching (general 스키마)

23M 행 cross-source 통합. 이미 851K개 golden record 매핑 완료.

| 테이블 | 행 수 | 용도 |
|---|---|---|
| **`general.entity_golden_records`** | **851,300** | 통합 entity 마스터. `cra_profile`, `fed_profile`, `ab_profile` JSONB 보유. `bn_root`, `bn_variants[]`, `aliases jsonb`, `addresses jsonb`, `related_entities jsonb` |
| `general.entities` | (1.2 GB) | 작업용 entity 테이블 (canonical_name, alternate_names[], merged_into) |
| **`general.entity_source_links`** | **5,161,245** | 모든 source row → canonical entity_id 매핑 (source_schema, source_table, source_pk jsonb, source_name, match_confidence, match_method, link_status) |
| `general.entity_merge_candidates` | (1.3 GB) | 후보 머지 |
| `general.entity_merges` | (54 MB) | 적용된 머지 |
| `general.entity_resolution_log` | (472 MB) | 매칭 로그 |
| `general.splink_predictions` | 125 MB | Splink fuzzy matching 결과 |
| `general.splink_aliases`, `splink_build_metadata` | (소형) | Splink 메타 |
| `general.donee_trigram_candidates` | (40 kB) | trigram 매칭 후보 |
| `general.ministries`, `ministries_crosswalk`, `ministries_history` | (소형) | 부처 매핑 / 이력 |
| `general.resolution_batches` | (16 kB) | 매칭 배치 |

## 5. 사전계산 뷰 (11개)

해커톤 제공 뷰 — Server Action에서 직접 호출 가능.

| 스키마 | 뷰 | 용도 |
|---|---|---|
| `general` | **`vw_entity_search`** | 검색 인덱스 — 엔티티 페이지 검색 박스 백엔드 |
| `general` | **`vw_entity_funding`** | entity_id별 통합 funding 합계 (FED+AB+CRA gov-transfers) |
| `cra` | `vw_charity_profiles` | 자선단체 통합 프로필 |
| `cra` | `vw_charity_financials_by_year` | 자선단체 × 연도 재무 |
| `cra` | `vw_charity_programs` | 프로그램 활동 요약 |
| `fed` | `vw_grants_decoded` | code → label 디코드된 grants |
| `fed` | `vw_grants_by_department` | 부처별 집계 |
| `fed` | `vw_grants_by_province` | 도별 집계 |
| `ab` | `vw_grants_by_ministry` | 부처별 집계 |
| `ab` | `vw_grants_by_recipient` | 수혜자별 집계 |
| `ab` | `vw_non_profit_decoded` | non-profit 상태 디코드 |

> 주의: KNOWN-DATA-ISSUES.md가 언급하는 `fed.vw_agreement_current`, `fed.vw_agreement_originals`는 **현재 배포된 replica에 존재하지 않는다**. F-3 함정 회피는 SQL window 함수로 직접 처리 (queries.md §3 참조).

## 6. 룩업 테이블

| 테이블 | 용도 |
|---|---|
| `cra.cra_category_lookup` | 자선단체 카테고리 (0001-Organizations Relieving Poverty, 0030-Christianity, 0210-Foundations, ...) |
| `cra.cra_sub_category_lookup` | sub-category 코드 |
| `cra.cra_designation_lookup` | A=Public Foundation, B=Private Foundation, C=Charitable Organization |
| `cra.cra_country_lookup`, `cra.cra_province_state_lookup` | 지리 |
| `cra.cra_program_type_lookup` | 프로그램 타입 |
| `fed.agreement_type_lookup`, `country_lookup`, `currency_lookup`, `province_lookup`, `recipient_type_lookup` | 연방 룩업 |
| `ab.ab_grants_fiscal_years`, `ab_grants_ministries`, `ab_grants_programs`, `ab_grants_recipients` | AB 정규화 |
| `ab.ab_non_profit_status_lookup` | NP 상태 |

## 7. 카테고리 분포 (top 10 by BN count)

| code | category (en) | BN 수 |
|---|---|---|
| 30 | Christianity | 27,438 |
| 1 | Organizations Relieving Poverty | 12,066 |
| 210 | Foundations | 9,354 |
| 200 | Public Amenities | 6,617 |
| 160 | Community Resource | 5,187 |
| 70 | Support of Religion | 4,338 |
| 11 | Support of schools and education | 4,146 |
| 100 | Core Health Care | 3,445 |
| 10 | Teaching Institutions | 3,364 |
| 190 | Arts | 2,847 |

→ 정부·보건당국 자동 제외 룰은 카테고리가 아니라 **legal_name 기반 화이트리스트**가 더 정확함 ("Government of...", "...Health Authority" 등). queries.md §1 참조.

## 8. 관계 (Relationships)

스키마 간 직접 FK는 거의 없음 (cross-source 통합은 `general.entity_source_links` 가 담당). 동일 스키마 내에서는 `bn` (자선단체 식별자) 또는 `_id` (FED) 가 자연 조인 키.

| From | To | 카디널리티 | 조인 키 | 비고 |
|---|---|---|---|---|
| general.entity_source_links | general.entity_golden_records | N:1 | entity_id | 모든 source row가 1개 canonical entity 참조 |
| general.entity_source_links | cra.* / fed.grants_contributions / ab.ab_grants | 1:1 | source_pk (jsonb) | source_pk 디코드해 원본 행 도달 |
| cra.cra_financial_general | cra.cra_identification | 1:1 | (bn, fpe) | T3010 신고서 본문 ↔ 식별 |
| cra.cra_qualified_donees | cra.cra_qualified_donees | N:M | donee_bn → bn | 자선단체 간 기부 (사이클 원천) |
| cra.loops | cra.loop_participants | 1:N | loop_id | 사이클 ↔ 참여 BN |
| cra.loop_participants | cra.cra_identification | N:1 | bn | 참여자 메타 |
| cra.identified_hubs | cra.scc_components | N:1 | scc_id | 허브가 속한 SCC |
| fed.grants_contributions | fed.*_lookup | N:1 | 코드 컬럼들 | 부처/국가/통화 디코드 |
| ab.ab_grants | ab.ab_grants_ministries / programs / recipients | N:1 | (정규화 키) | 카테고리 |

## 9. 인덱스

read-only replica이므로 자체 인덱스 추가 불가. 핫 쿼리 컬럼은 다음을 가정 (Postgres 기본 PK + 자주 사용되는 lookup 키):

| 테이블 | 가정 인덱스 |
|---|---|
| cra.cra_identification | (bn, fiscal_year) |
| cra.cra_financial_general | (bn, fpe) |
| cra.govt_funding_by_charity | (bn, fiscal_year) |
| cra.cra_directors | (bn, fpe) |
| cra.cra_qualified_donees | (bn, donee_bn) |
| cra.loops | (id), 가능: (total_flow), (hops) |
| cra.loop_participants | (loop_id), (bn) |
| fed.grants_contributions | (_id), (recipient_business_number), (ref_number) |
| general.entity_source_links | (entity_id), (source_schema, source_table) |
| general.entity_golden_records | (id), (canonical_name) — 가능 |

성능 측정은 `scripts/benchmark-queries.ts` 으로 검증.

## 10. 알려진 데이터 이슈 (요약)

| 코드 | 이슈 | 영향 | 회피 |
|---|---|---|---|
| F-1 | `ref_number` 41,046건 다른 수혜자 충돌 | naive 그루핑 시 데이터 합쳐짐 | `(ref_number, COALESCE(recipient_business_number, recipient_legal_name, _id::text))` 키 사용 |
| F-2 | (ref_number, amendment_number) 25,853쌍 중복 | window 함수에서 ROW_NUMBER ties | tiebreaker 추가 (e.g., MAX(amendment_date), MAX(_id)) |
| F-3 | `agreement_value` 누적 (트리플 카운트) | naive SUM = $921B (실 commitment $816B) | window 함수로 ref_number별 최신 amendment 한 행만 SELECT (queries.md §3) |
| (govt) | `govt_share_of_rev` 상위에 정부·보건당국 | Lens 1 false positive | `legal_name` 기반 화이트리스트 제외 |
| (denom) | top 5 사이클이 Salvation Army 내부 | Lens 3 false positive | 동일 BN root prefix 검출 (Tier A 분류) |

전체 이슈 카탈로그: 본 문서 참조 + GovAlta/agency-26-hackathon `KNOWN-DATA-ISSUES.md`.

---

Last reviewed: 2026-04-27
Source of truth: 직접 psql 접속 후 실측 (information_schema 조회)
Population method: 수동 작성 (read-only replica이므로 migration scan 불가)
