# Migrations — Dataset Version Tracking

> **이 프로젝트는 read-only replica를 사용한다.** 자체 schema migration 권한이 없으므로,
> 본 파일은 표준 migration history 대신 **하카톤이 제공한 데이터셋 스냅샷의 버전 추적**으로 재사용한다.

---

## Dataset Snapshots

해커톤 제공자가 데이터셋을 갱신할 때마다 본 표에 기록.

| 스냅샷 ID | Captured At | Source Repo Tag | Total Rows | KNOWN-DATA-ISSUES Snapshot Date | 비고 |
|---|---|---|---|---|---|
| baseline | 2026-04-27 | GovAlta/agency-26-hackathon @ main (2026-04-19) | ~14M | 2026-04-19 | 본 프로젝트 시작 시점 |
| _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ | 갱신 시 추가 |

검증 쿼리 (스냅샷 비교용):

```sql
-- 핵심 테이블 행 수 카운트
SELECT 'cra.loops' AS tbl, count(*) FROM cra.loops
UNION ALL SELECT 'cra.identified_hubs', count(*) FROM cra.identified_hubs
UNION ALL SELECT 'cra.govt_funding_by_charity', count(*) FROM cra.govt_funding_by_charity
UNION ALL SELECT 'cra.cra_identification', count(*) FROM cra.cra_identification
UNION ALL SELECT 'cra.cra_directors', count(*) FROM cra.cra_directors
UNION ALL SELECT 'fed.grants_contributions', count(*) FROM fed.grants_contributions
UNION ALL SELECT 'public.contracts', count(*) FROM public.contracts
UNION ALL SELECT 'ab.ab_grants', count(*) FROM ab.ab_grants
UNION ALL SELECT 'general.entity_golden_records', count(*) FROM general.entity_golden_records
UNION ALL SELECT 'general.entity_source_links', count(*) FROM general.entity_source_links;
```

baseline 결과 (2026-04-27 측정):
| 테이블 | 행 수 |
|---|---|
| cra.loops | 5,808 |
| cra.identified_hubs | 20 |
| cra.scc_components | 10,177 |
| cra.govt_funding_by_charity | 166,968 |
| cra.cra_identification | 421,866 |
| cra.cra_directors | 2,873,624 |
| fed.grants_contributions | 1,275,521 |
| public.contracts | 153,455 |
| ab.ab_grants | 1,986,676 |
| ab.ab_sole_source | 15,533 |
| general.entity_golden_records | 851,300 |
| general.entity_source_links | 5,161,245 |

스냅샷 변동이 5% 이상이면 본 파일에 새 행 추가 + 영향받는 lens query 재테스트.

---

## Schema Drift Detection

read-only replica는 schema 변경을 우리가 일으키지 않는다. 그러나 hackathon이 schema를 변경할 가능성이 있으므로:

```bash
# 검증 스크립트 (scripts/verify-db.ts에 통합)
psql "$PGCONN" -c "\dn"               # 5개 schema 확인
psql "$PGCONN" -c "
  SELECT count(*)
  FROM information_schema.tables
  WHERE table_schema IN ('ab','cra','fed','general','public')
    AND table_type='BASE TABLE'
"  # 79 expected
```

drift 검출 시:
1. 행 수 변동 → migrations.md baseline 갱신 + 영향 분석
2. 테이블 추가/삭제 → schema.md 즉시 업데이트
3. 컬럼 변경 → 영향받는 lens query 회귀 테스트

---

## Application-side "Migrations"

자체 DB는 없지만, 어플리케이션에 다음의 schema-like 산출물이 있다.

| 항목 | 위치 | 변경 추적 방식 |
|---|---|---|
| Concern Score 가중치 | `.moai/project/db/concern-score-weights.yaml` (생성 예정) | git history |
| 정부 엔티티 화이트리스트 | `apps/web/lib/data-issues/exclusions.ts` | git history |
| Loop 분류 룰 (Tier A/B/C 임계값) | `apps/web/lib/lenses/loop.ts` | git history |
| Lens 점수 임계값 | `apps/web/lib/lenses/concern-score.ts` | git history |

이들은 SPEC-RHI-001 (다음 단계 `/moai plan`에서 작성) 의 acceptance criteria와 연동된다.

---

## Rollback Notes

read-only replica이므로 rollback 개념은 적용되지 않는다. 어플리케이션 측 롤백:

| 상황 | 절차 |
|---|---|
| Concern Score 가중치 변경 후 회귀 발견 | git revert + Vercel 재배포 |
| 정부 엔티티 화이트리스트 오탐 | exclusions.ts 수정 + 재배포 |
| 새 데이터셋 스냅샷 후 lens 결과 급변 | baseline 비교 → 영향 lens 일시 비활성화 또는 점수 리캘리브레이션 |

---

Last reviewed: 2026-04-27
Maintained by: 사용자 (수동) — 데이터셋 갱신 시 baseline 행 추가
