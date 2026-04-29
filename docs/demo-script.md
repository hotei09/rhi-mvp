# RHI MVP — Hackathon 5분 발표 시나리오

> GovAlta Agency 26 Hackathon — Recipient Health Index (RHI) Solo 1주 MVP

---

## 발표 개요

| 단계 | 시간 | 화면 | 핵심 메시지 |
|---|---|---|---|
| 1. 도입 | 0:00–1:00 | 랜딩 페이지 (`/`) | 문제 정의 + 해결 방안 한 문장 |
| 2. 케이스 A — Zombie | 1:00–2:00 | `/entity/107460909RR0001` | 정부 자금 받고 사라진 단체 |
| 3. 케이스 B — Loop Tier C | 2:00–3:00 | `/lens/loops/252` | 자금이 순환하는 사이클 |
| 4. 케이스 C — Multi-Source | 3:00–4:00 | `/entity/890943673RR0001` | 복합 시그널 분석 |
| 5. 마무리 | 4:00–5:00 | `/methodology` + Q&A 대비 | 투명성 + 함정 공개 |

---

## 0. 발표 전 준비

### 0.1 환경 확인 (발표 10분 전)

```bash
# 개발 서버 구동 (콜드스타트 방지)
cd apps/web && pnpm dev

# DB 연결 확인
curl http://localhost:3000/api/healthz
# 기대 응답: {"ok":true,"ts":"..."}
```

### 0.2 브라우저 워밍 (발표 5분 전)

다음 4개 페이지를 순서대로 방문하여 쿼리 캐시 채우기:

1. `http://localhost:3000/` — 랜딩 (Top 50 랭킹)
2. `http://localhost:3000/entity/107460909RR0001` — 케이스 A
3. `http://localhost:3000/lens/loops/252` — 케이스 B
4. `http://localhost:3000/entity/890943673RR0001` — 케이스 C

### 0.3 화면 설정

- 브라우저 풀스크린 (F11 또는 Cmd+Ctrl+F)
- 폰트 크기 확대: Cmd+ 두 번 (심사위원 가독성)
- DevTools 패널 닫기
- 알림 및 Slack 무음 처리
- 노트북 절전 모드 해제 (시스템 환경설정 > 배터리)

### 0.4 오프라인 백업 카드 (인쇄 권장)

| 케이스 | BN / URL | 단체명 |
|---|---|---|
| A (Zombie) | `107460909RR0001` | NORTH BAY RECOVERY HOME |
| B (Loop) | `/lens/loops/252` | loop_id=252 |
| C (Multi) | `890943673RR0001` | KIDSABILITY CENTRE FOR CHILD DEVELOPMENT FOUNDATION |

---

## 1. 도입 (0:00–1:00)

### 1.1 화면: `/`

랜딩 페이지 진입. Top 50 High Concern 랭킹 테이블이 화면에 보임.

### 1.2 발표 멘트

> "캐나다 정부는 매년 수십억 달러의 공적 자금을 비영리단체, 기업, 개인사업체에 이전합니다.
>
> 그런데 일부 수혜 단체들은 자금 수령 후 실체가 사라지거나, 명목상만 존재하거나, 같은 그룹 안에서 자금이 순환하거나, 동일 인물이 여러 수혜 단체를 동시에 통제합니다.
>
> 이런 패턴을 한눈에 볼 수 있는 도구가 지금까지 없었습니다.
>
> Recipient Health Index — RHI는 5개 렌즈로 이 패턴을 평가해서, 단일 Concern Score로 통합합니다. 모든 점수는 raw SQL까지 클릭 한 번에 추적됩니다.
>
> 1주 Solo MVP, 14M+ 행, 79개 테이블, read-only 데이터입니다."

### 1.3 화면 동선

1. 랜딩 페이지의 Top 50 테이블을 5초 정도 보여준다.
2. 검색 박스에 "salvation" 입력 — 드롭다운 결과가 나타남을 시연.
3. "이렇게 BN 또는 단체명으로 즉시 검색할 수 있습니다."
4. 결과를 클릭하지 않고, 직접 케이스 A URL로 이동.

### 1.4 핵심 메시지

5개 분리된 챌린지를 단일 점수 체계로 통합. 모든 숫자는 재현 가능.

---

## 2. 케이스 A — Zombie Recipient (1:00–2:00)

### 2.1 화면: `/entity/107460909RR0001`

주소창에 직접 입력하거나, 검색에서 "north bay recovery" 검색 후 클릭.

### 2.2 발표 멘트

> "첫 번째 케이스입니다. Zombie Recipient — 정부 자금을 받은 후 T3010 신고서 제출을 중단한 자선단체를 가리킵니다.
>
> 이 단체는 NORTH BAY RECOVERY HOME, 온타리오주의 약물 회복 센터입니다. 카테고리 100, 약물 남용 회복 서비스입니다.
>
> 정부 자금 총 수혜액: 약 128만 달러. 마지막 자금 수령 연도: 2020년. 그런데 마지막 T3010 filing이 2020년 3월 31일입니다.
>
> 지금 2026년입니다. 6년 동안 — 72개월 동안 — 이 단체는 정부에 어떤 결산도 보고하지 않았습니다.
>
> 이 자금이 어디에 쓰였는지, 단체가 아직 존재하는지, 지금으로서는 추적할 방법이 없습니다.
>
> Zombie Score: 100. 최상위 위험 등급입니다."

### 2.3 화면 포인트

화면에서 강조할 요소 (순서대로):

1. **Concern Score 카드**: 상단의 큰 숫자 + Critical 등급 배지 — 시각적 임팩트가 강함.
2. **5 렌즈 요약 바**: Zombie 100 / Ghost 0 / Loop 0 / Director ? / Multi-source 0 — Zombie 하나가 전체 점수를 끌어올리는 구조 설명.
3. **Funding Timeline**: 2020년까지의 자금 막대 그래프, 이후 공백 — 시각적으로 침묵이 보임.
4. **Identity block**: BN `107460909RR0001`, legal_name, last_fpe `2020-03-31`, months_since_fpe `72`.
5. (시간 허용 시) Zombie 렌즈 카드의 "Raw data" 버튼 클릭 → SQL 트레이스 + raw 행 드로어 노출.

### 2.4 핵심 메시지

5초 안에 위험 신호 식별. 모든 숫자는 SQL까지 추적 가능해서 감사관이 바로 다음 단계로 넘어갈 수 있음. 6년 침묵은 감사 우선순위의 명확한 단서.

---

## 3. 케이스 B — Loop Tier C (2:00–3:00)

### 3.1 화면: `/lens/loops/252`

주소창에 직접 입력.

### 3.2 발표 멘트

> "두 번째 케이스입니다. Loop Participant — 정부 자금이 특정 그룹 내에서 순환하는 패턴입니다.
>
> 우리 시스템은 사전에 탐지된 5,808개 자금 순환 사이클을 분석하고, 자체 분류 룰로 Tier A, B, C로 나눕니다.
>
> Tier A는 합법입니다 — Salvation Army처럼 같은 BN 루트를 공유하는 internal hierarchy거나, United Way, CHIMP 같은 알려진 허브를 경유한 경우입니다. RHI는 이 케이스를 자동으로 걸러냅니다.
>
> Tier C는 의심입니다 — cross-organization 사이클이면서 프로그램 지출 비율이 낮거나, T3010 plausibility flag가 매칭된 경우입니다.
>
> 이 loop_id 252는 두 단체 사이에서 약 1,057만 달러가 순환합니다. BN `119228864RR0002`와 `868346966RR0001` 사이의 2-hop 사이클. 분류 이유: cross-organization 루프에 프로그램 지출 비율이 낮음, 허브 경유 없음. Tier C 최상위 의심 등급."

### 3.3 화면 포인트

화면에서 강조할 요소:

1. **Tier 배지**: 'C' 빨간색 배지가 최상단에 보임.
2. **Path 노드 목록**: `119228864RR0002` ↔ `868346966RR0001`, hops=2.
3. **Total flow**: $10,574,080 — 큰 숫자 강조.
4. **classification_reasons**: cross-organization loop, low/null program ratio, no hub, no plausibility flag — 분류 근거 narrative가 텍스트로 노출됨.
5. (시간 허용 시) `/methodology` 로 잠깐 이동하여 Tier 분류 룰 테이블 보여주기 — "블랙박스가 아닙니다"라는 포인트 강화.

### 3.4 핵심 메시지

분류 룰은 완전히 결정론적이고 공개됨. Tier A를 자동 제외하여 false positive를 줄임. 1,000만 달러 규모의 순환을 5초 안에 식별.

---

## 4. 케이스 C — Multi-Source High Concern (3:00–4:00)

### 4.1 화면: `/entity/890943673RR0001`

주소창에 직접 입력. (또는 검색에서 "kidsability" 검색)

### 4.2 발표 멘트

> "세 번째이자 마지막 케이스입니다. 단일 시그널이 아닌 복합 시그널 분석입니다.
>
> 이 단체는 KIDSABILITY CENTRE FOR CHILD DEVELOPMENT FOUNDATION — 아동 발달 지원 재단입니다.
>
> Concern Score는 50, Medium 등급입니다. 그런데 5개 렌즈 중 3개에서 동시에 시그널이 나옵니다.
>
> 첫째, Ghost Score 100 — 프로그램 지출 비율이 기준치 이하입니다. 자금을 받지만 실제 프로그램 활동이 미미하다는 시그널입니다.
>
> 둘째, Director Overlap 43 — 이 단체 이사진 중 43명이 정부 자금을 받는 다른 BN의 이사와 이름이 겹칩니다.
>
> 셋째, Multi-Source Count 2 — 연방 정부와 CRA, 두 개 소스에서 동시에 자금을 수령하고 있습니다.
>
> 한 가지 시그널은 우연일 수 있습니다. 세 가지가 동시에 나타나는 것은 조사 저널리스트나 감사관이 더 깊이 들여다볼 이유가 됩니다.
>
> 단, Director Overlap은 signal only입니다 — 사기 단정이 아닙니다. 동명이인 가능성이 있습니다. 우리는 이 면책조항을 UI에서 명시적으로 표시합니다."

### 4.3 화면 포인트

화면에서 강조할 요소:

1. **Concern Score 카드**: 50 / Medium 등급 배지.
2. **5 렌즈 요약**: Ghost 100, Director 43, Multi-source 2 — 세 개가 동시에 켜진 시각적 상태.
3. **Director Overlap 카드**: 하단의 "signal only — not a fraud claim" 디스클레이머 텍스트 (14px 이상, role=note) — 윤리적 설계 강조.
4. **Funding Timeline**: FED + CRA 두 가지 색깔의 막대가 같은 연도에 겹쳐 있는 다중 소스 시각화.
5. (시간 허용 시) Concern Score 공식 팝오버 hover → "이렇게 5개 렌즈가 단일 점수로 수렴합니다."

### 4.4 핵심 메시지

복합 시그널이 단일 시그널보다 신뢰도가 높음. RHI의 차별화 포인트: 5개 분리된 챌린지를 단일 점수로 통합하여 우선순위 결정을 쉽게 만듦. 디스클레이머 설계가 도구의 책임 있는 사용을 보장.

---

## 5. 마무리 (4:00–5:00)

### 5.1 화면: `/methodology`

주소창에 직접 입력.

### 5.2 발표 멘트

> "마지막으로 Methodology 페이지입니다.
>
> 모든 점수 공식, 가중치, Tier 임계값, 데이터 함정을 여기에 공개합니다. 예를 들어 F-3 함정 — FED 데이터에서 동일 계약의 amendment chain을 단순 SUM하면 약 11%, 약 1,050억 달러가 과대 계상됩니다. RHI는 ROW_NUMBER 중복 제거로 이 함정을 회피하고, 그 결과를 여기에 명시합니다.
>
> RHI의 가치는 5개 렌즈를 단일 점수로 통합한 것만이 아닙니다. 모든 판단이 raw SQL 트레이스로 추적 가능하다는 점입니다. 감사관이 법정에서도 쓸 수 있는 방어 가능성, Defensibility가 핵심입니다.
>
> 수치로 말씀드리겠습니다. 1주 Solo MVP, 169 테스트 전부 통과, 라인 커버리지 75%, 12개 Acceptance Criteria 전부 PASS, TypeScript strict 오류 0개, TRUST 5 5/5.
>
> Read-only 데이터, 이해관계 없는 도구입니다. 감사합니다."

### 5.3 화면 동선

1. Methodology 페이지의 Concern Score 공식 섹션을 잠깐 보여준다.
2. 알려진 데이터 함정(F-3) 섹션 스크롤 — "이런 함정까지 공개하는 도구입니다."
3. 발표 마무리 후, 질문 대기 중에는 `/api/healthz` 또는 랜딩 페이지를 배경 화면으로 유지.

### 5.4 핵심 메시지

투명성이 신뢰의 기반. 함정을 숨기지 않고 공개하는 것 자체가 도구의 가치.

---

## 6. 예상 질문 대응 (Q&A)

### Q1: "정부 기관이 Zombie 상위에 안 나오는 이유는?"

AC-9 정부 엔티티 자동 제외 적용. `legal_name` 기반 12개 ILIKE 패턴으로 사전 필터링:

- `Government of %`, `%Health Authority%`, `%Crown Corporation%`
- `City of %`, `Town of %`, `Municipality of %`
- `%Hospital%`, `%Hopital%`, `%Health Services%`
- `%Santé%`, `%Centre Intégré%`, `%Shared Health%`

Government of Alberta (BN `124072513RR0010`)처럼 `govt_share_of_rev ≈ 0.94`인 단체는 형식상 Zombie 룰에 매칭되지만, 분석 대상 자체가 아니므로 자동 제외. `apps/web/lib/data-issues/safe-queries.ts`의 `buildGovtExclusionClause` 함수로 구현.

### Q2: "Concern Score 가중치 (0.30/0.25/0.20/0.10/0.15)를 어떻게 정했나요?"

위험도 기반 판단 + `product.md §6`에 설계 근거 기록. 가중치는 `.moai/project/db/concern-score-weights.yaml`에 분리되어 변경 이력 추적 가능. 서버 부팅 시 합계 1.0 (±0.001) 검증 — 잘못된 설정이면 `process.exit(1)` (AC-11).

### Q3: "Director Overlap에서 동명이인 false positive는 어떻게 처리하나요?"

`last_name + first_name + initials` 세 가지를 모두 매칭하여 정밀도를 높임 (`queries.md §6`). 그럼에도 동명이인 가능성이 남아 있어서 UI에서 "signal only — not a fraud claim" 디스클레이머를 14px 이상, `role=note`로 명시 (AC-10). 외부 corporate registry 데이터가 없는 상황에서 강한 결론은 내리지 않음.

### Q4: "Loop Tier 분류가 결정론적인가요?"

100% 결정론. `classifyLoop` 함수가 다음 순서로 평가:

1. `distinct_bn_roots = 1` → Tier A (internal hierarchy)
2. `identified_hubs` 경유 → Tier A (known hub)
3. `t3010_plausibility_flags.severity >= 3` 매칭 → Tier C (data quality)
4. cross-org + `avg_program_ratio >= 0.6` → Tier B (observed)
5. 나머지 → Tier C (suspicious)

Vitest unit test에서 각 분기 검증 완료 (AC-3, AC-4).

### Q5: "F-3 함정이 무엇인가요?"

`fed.grants_contributions`의 `agreement_value` 누적 함정. 동일 계약의 amendment가 여러 행에 누적되어 단순 `SUM` 시 약 11%, ~1,050억 달러 과대 계상됨. F-3 dedup 후 $816.1B, 원시 합계 $921.6B. `apps/web/lib/data-issues/safe-queries.ts`의 `withF3Dedup` 헬퍼로 일관 적용. AC-5에서 단조 부등식 `dedup_sum < raw_sum` 검증.

### Q6: "모바일이 안 되는 이유는?"

SPEC §4 Exclusion #5 — 1024px 미만 뷰포트, 터치 제스처, 모바일 전용 레이아웃은 1주 Solo MVP 일정 보호를 위해 의도적 제외. 1차 사용자인 조사 저널리스트와 감사관은 PC 환경 가정. post-MVP 확장 가능.

### Q7: "Vercel 배포를 안 했나요?"

로컬 dev 환경에서 시연. `pnpm dev` 기준 `/api/healthz` 200 응답, 검색, 5 렌즈 점수 모두 실시간 작동. 발표 시간 압박으로 production 배포는 post-Hackathon. 코드베이스와 인프라 설정은 Vercel + Render Postgres 구성 완료 상태.

### Q8: "이 도구를 재현할 수 있나요?"

SPEC-RHI-001 (`spec.md`, `plan.md`, `acceptance.md`) 전체 공개. `apps/web` 소스 코드, `sql/views`, 테스트 모두 기록. `README.md` 빠른 시작 가이드로 `PGCONN` 환경 변수 설정 후 `pnpm install && pnpm dev`로 재현 가능. GovAlta 제공 DB 접근 권한이 전제.

---

## 7. 발표 후 Follow-up

### 즉시 가능한 개선

- `%Health Sciences%`, `%University of %`, `%CHU %` 등 추가 정부 제외 패턴 보강 (v0.1.5)
- HAMILTON HEALTH SCIENCES CORPORATION, LONDON HEALTH SCIENCES CENTRE 등 현재 누락 케이스 해결

### 중기 확장

- Vercel production 배포 + 공개 URL 공개
- materialized view 도입 (자체 Postgres 인스턴스 마이그레이션 후 — replica 쓰기 불가 제약 해소)
- 추가 데모 케이스 수집 (사용자 피드백 기반)
- GitHub repository public 공개

---

## 8. 백업 시연 (네트워크 장애 대응)

만약 Render PG 또는 로컬 서버 응답이 지연되는 경우:

| 상황 | 대응 |
|---|---|
| DB 쿼리 느림 | `/methodology` 페이지는 정적 — 항상 빠름. 방법론 설명으로 시간 채우기 |
| 서버 미시작 | 발표 전 `pnpm dev` 터미널 열어두고 확인. 사전 스크린샷으로 대체 |
| URL 타이핑 실수 | 오프라인 카드(섹션 0.4)에서 정확한 BN 복사 |
| 전체 네트워크 장애 | 사전에 찍어둔 `docs/screenshots/` 폴더의 스크린샷으로 대체 (선택 준비) |

---

## 9. 시간 조절 기준

5분 발표가 예상보다 빠르게 진행될 경우:

- 케이스 A에서 Raw data 드로어를 열어 SQL 트레이스 시연 추가 (~20초)
- 케이스 C에서 Concern Score 공식 hover 팝오버 시연 추가 (~15초)
- 케이스 B에서 `/methodology`로 이동해 Tier 분류 룰 테이블 보여주기 (~25초)

5분 발표가 예상보다 느리게 진행될 경우:

- 케이스 B의 화면 포인트 4번(classification_reasons 텍스트) 생략
- 케이스 C의 Funding Timeline 설명 생략
- 마무리 멘트에서 수치 부분만 빠르게 읽기

---

Version: 1.0.0
Last Updated: 2026-04-27
Author: hotei0518
SPEC: SPEC-RHI-001
