---
id: SPEC-RHI-001
version: 0.1.2
status: draft
created: 2026-04-27
updated: 2026-04-27
author: hotei0518
priority: high
issue_number: 0
form: compact
---

# SPEC-RHI-001 (Compact) — RHI MVP

> 압축 버전. 전체 prose는 `spec.md` 참조. 본 파일은 REQ + AC + Files + Exclusions의 신속 참조용. v0.1.2: plan-auditor iter 2 residuals 반영 (AC-6 parametric, healthz body 형식 통일, healthz warm TTFB 200ms 통일, REQ atomicity rule 완화, §3 non-binding 재구성).

## REQ (5 modules, EARS, numeric order)

- **REQ-001 [Ubiquitous + Unwanted]** — Singleton DB client validated by typed env schema. Two safe-query primitives: F-3 dedup (`(ref_number, recipient)` 기반) + government-entity exclusion (`legal_name` 패턴). 쓰기 시도 (INSERT/UPDATE/DELETE/DDL) 발생 시 DB 도달 전에 거부 + 로그.
- **REQ-002 [Event-driven]** — Five lens scoring functions (zombie / ghost / loop / director / multi-source). 결정론적 0-100 점수 + raw row 트레이스 반환.
- **REQ-003 [Ubiquitous + Event-driven]** — Boot 시 가중치 sum=1.0 (±0.001) 검증, 실패 시 fail-fast. 호출 시 lens signal에 가중치 적용 → composite score + per-component breakdown 반환. 가중치/임계값 수치는 plan.md `Reference Constants` (§2B)에 정의 (single source of truth).
- **REQ-004 [Event-driven]** — Per-entity profile page: 5개 lens `Promise.all` 병렬 fetch, 통합 Concern Score 표시, raw SQL 행 drill-down 제공.
- **REQ-005 [Event-driven + Unwanted]** — 단일 "공개 read 인터페이스" 테마 아래 세 개 독립 표면 (구현 모듈 별도, 5-REQ HARD 상한 준수 목적):
  - Statement A — Public pages: 랜딩 / 렌즈 3종 / loop 상세 / methodology / 검색 결과 page navigation
  - Statement B — Global search: `general.vw_entity_search`, prefix 우선, dataset_sources 노출
  - Statement C — Operational guards: 분당 30 req/IP 초과 시 HTTP 429 + window reset 시 회복; `/api/healthz` 요청 시 `SELECT 1` + 200 응답 with body `{"ok": true, "ts": "<ISO-8601 UTC>"}` (TTFB < 200ms warm)

## AC (12 scenarios, Given-When-Then)

- **AC-1** — `GET /api/healthz` → 200 with body `{"ok": true, "ts": "<ISO-8601 UTC>"}`. TTFB < 200ms warm. Warm cache = 첫 요청 후 60초 이내 후속 요청.
- **AC-2** — Zombie 룰 매칭 BN → `zombie_score ≥ 80`.
- **AC-3** — Salvation Army root BN `107951618` 포함 loop → `tier = 'A'` (`distinct_bn_roots = 1`), loop signal = 0.
- **AC-4** — Cross-org loop + plausibility severity ≥ 3 매칭 → `tier = 'C'`, loop signal = 100.
- **AC-5** — F-3 dedup window function: `dedup SUM ≤ raw SUM`, ROW_NUMBER tie 발생 안 함 (F-2 tiebreaker).
- **AC-6** — Parametric Concern Score: 현재 plan.md §2B Reference Constants의 가중치 `w_*`와 `CONCERN_TIER_THRESHOLDS`로부터 `concern_score = w_zombie·zombie_score + w_ghost·ghost_score + w_loop·loop_signal + w_director·min(overlap×10,100) + w_multi·(count>=2?100:0)` 가 재현 가능해야 한다 (가중치 변경 시 score 변경되나 메서드는 동일). 현재 default 수치 적용 시 (60·40·B(50)·5·2) → 58 / Medium은 보조 정보로 frozen test fixture 아님. 5개 lens `Promise.all` 병렬.
- **AC-7** — `general.vw_entity_search` 검색 → prefix match 우선, `dataset_sources` 포함, < 200ms warm.
- **AC-8** — 두 개 sub-criterion 분리 (split):
  - **AC-8a (Performance)**: 60초간 1000회 burst, `/` 라우트 95p TTFB < 1500ms (rate limit 미발동 환경)
  - **AC-8b (Rate limit)**: 단일 IP 60초 윈도우 내 31번째 요청 → HTTP 429, 1분 후 회복
- **AC-9** — Government of Alberta (BN `124072513RR0010`) → zombie/ghost ranking에서 자동 제외 (`govt_share=0.94` 무시). 6개 정부 패턴 (`Government of`, `Health Authority`, `Crown Corporation`, `City of`, `Town of`, `Municipality of`) 동일 적용.
- **AC-10** — Director overlap (last+first+initials 매칭) → 카운트 시그널 + 측정 가능한 디스클레이머: 동일 카드 내, 최소 14px 폰트, role='note' 또는 ARIA label 보유, "signal only — not a fraud claim" 또는 한국어 동등 표현 포함. Methodology 페이지에 false positive 회피 룰 문서화.
- **AC-11** — Concern weights yaml: server boot 1회 로드, 메모리 캐시, sum=1.0 ±0.001 검증 실패 시 boot 중단. Hot-reload 미지원.
- **AC-12** — `/entity/[id]` warm TTFB < 1200ms. Cold first hit < 2500ms 허용.

## REQ → AC Forward Traceability

| REQ | Acceptance |
|---|---|
| REQ-001 | AC-1, AC-5, AC-9 |
| REQ-002 | AC-2, AC-3, AC-4, AC-5, AC-9, AC-10 |
| REQ-003 | AC-6, AC-11 |
| REQ-004 | AC-6, AC-12 |
| REQ-005 | AC-1, AC-7, AC-8 (8a + 8b) |

모든 12개 AC가 최소 1개 이상의 REQ에서 forward-reference됨을 확인.

## Files to Modify (Non-binding Snapshot)

> 영향 범위 스냅샷용. 정확한 모듈 구조는 plan.md `Module Layout` (§2A) 단일 출처. 충돌 시 plan.md 우선.

| Group | 위치 | 설명 |
|---|---|---|
| Application | `apps/web/` | Next.js 16 App Router (라우트 / 컴포넌트 / lib / middleware / 설정) |
| SQL Assets | `sql/views/` | 5개 lens view + concern_score + high_concern_ranking |
| Configuration | `.moai/project/db/concern-score-weights.yaml` | 가중치 canonical source (default seed: plan.md §2B.1) |
| Scripts | `scripts/` | verify-db / sample-entities / benchmark-queries |
| Documentation | `docs/methodology.md` | Methodology 페이지 정적 마크다운 source |

총 약 30개 신규 파일. [MODIFY] / [REMOVE] / [EXISTING] 항목 없음 (Greenfield).

## Exclusions (HARD, 7 entries)

1. 인증·사용자 계정·관리자 콘솔 없음 (read-only public tool)
2. DB 쓰기 작업 일체 금지 (Render replica)
3. 해커톤 챌린지 #4, #5, #7, #9, #10 미참여
4. 외부 뉴스 스크래핑 / LLM 분류 (#10) 미수행
5. **모바일 최적화 UI**: 1024px 미만 뷰포트 반응형 브레이크포인트 없음, 터치 제스처 처리 없음, 모바일-전용 레이아웃 없음 (데스크톱 우선)
6. 다국어 UI 미지원 (한국어 1차, 영어 발표 슬라이드 별도)
7. Materialized view 생성 미수행 (replica 권한 없음)

---

Version: 0.1.2
Status: draft
Last Updated: 2026-04-27
Reference: spec.md (full prose), plan.md (implementation HOW + Reference Constants), acceptance.md (12 AC + edge cases)
