/**
 * 데이터 함정 회피 헬퍼 — 정부 엔티티 제외 + F-3 dedup.
 *
 * 출처:
 * - 정부 패턴: queries.md §1, rls-policies.md §3.1
 * - F-3 dedup: queries.md §3, KNOWN-DATA-ISSUES F-3 (~$105B / ~11% overcounting on raw SUM)
 */

/**
 * 정부 엔티티 제외에 사용하는 ILIKE 패턴.
 * legal_name 컬럼에 대해 NOT ILIKE로 적용 — schema.md §7에 따르면 category 기반 필터는 부정확하며
 * legal_name 패턴이 authoritative.
 *
 * - 'Government of %': 연방·주 정부
 * - '%Health Authority%': 보건당국 (Alberta Health Services 등)
 * - '%Crown Corporation%': 크라운 법인 (Canada Post 등)
 * - 'City of %': 광역시
 * - 'Town of %': 일반시
 * - 'Municipality of %': 지자체
 */
// @MX:NOTE: [AUTO] 정부 엔티티 6개 패턴 — queries.md §1 + rls-policies.md §3.1 canonical list. category 기반 필터는 schema.md §7에 따라 부정확하므로 legal_name 패턴이 authoritative. 추가 시 acceptance.md AC-9도 갱신.
// @MX:SPEC: SPEC-RHI-001 REQ-001 / AC-9
export const EXCLUDED_LEGAL_NAME_PATTERNS = Object.freeze([
  'Government of %',
  '%Health Authority%',
  '%Crown Corporation%',
  'City of %',
  'Town of %',
  'Municipality of %',
] as const);

/**
 * 주어진 컬럼에 대해 6개 정부 패턴을 NOT ILIKE로 모두 제외하는 SQL fragment를 생성한다.
 * 결과는 괄호로 감싸진 AND-joined 절이며, WHERE 절에 직접 삽입 가능.
 *
 * @param columnAlias - 컬럼 식별자 (예: 'legal_name', 'm.legal_name')
 * @returns 괄호로 감싼 SQL fragment — 예: `(legal_name NOT ILIKE 'Government of %' AND ... AND legal_name NOT ILIKE 'Municipality of %')`
 *
 * @example
 *   const clause = buildGovtExclusionClause('m.legal_name');
 *   const query = `SELECT * FROM cra.cra_identification m WHERE ${clause}`;
 */
export function buildGovtExclusionClause(columnAlias: string): string {
  const conditions = EXCLUDED_LEGAL_NAME_PATTERNS.map(
    (pattern) => `${columnAlias} NOT ILIKE '${pattern}'`,
  );
  return `(${conditions.join(' AND ')})`;
}

/**
 * F-3 dedup CTE — fed.grants_contributions의 (ref_number, recipient) 튜플당
 * 최신 amendment 한 행만 선택하는 ROW_NUMBER OVER PARTITION BY 패턴.
 *
 * 출처: queries.md §3
 *
 * - PARTITION BY: ref_number + COALESCE(recipient_business_number, recipient_legal_name, _id::text)
 * - ORDER BY: amendment_number DESC, amendment_date DESC, _id DESC (F-2 tiebreaker)
 * - WHERE: ref_number IS NOT NULL
 *
 * 이 CTE 적용 후 `WHERE rn = 1`로 필터링하면 트리플 카운트 함정을 회피한다.
 * KNOWN-DATA-ISSUES F-3에 따르면 raw SUM 대비 약 11% (~$105B) 감소가 정상.
 */
// @MX:WARN: [AUTO] PARTITION BY (ref_number, recipient) ORDER tiebreaker가 critical — F-3 trap이 amendment_number/_id tiebreaker 누락 시 재현됨
// @MX:REASON: queries.md §3 F-3 trap 문서화. KNOWN-DATA-ISSUES.md에 raw SUM 대비 ~$105B (~11%) overcounting 확인. AC-5 검증에서 dedup_sum < raw_sum 단조성 보장 필수. 변경 시 통합 테스트 (tests/integration/safe-queries.test.ts) 재실행.
// @MX:SPEC: SPEC-RHI-001 REQ-001 / AC-5
export const F3_DEDUP_FED_CTE = `WITH dedup_fed AS (
  SELECT
    fc.*,
    ROW_NUMBER() OVER (
      PARTITION BY
        fc.ref_number,
        COALESCE(fc.recipient_business_number, fc.recipient_legal_name, fc._id::text)
      ORDER BY
        COALESCE(NULLIF(fc.amendment_number, '')::int, 0) DESC NULLS LAST,
        fc.amendment_date DESC NULLS LAST,
        fc._id DESC
    ) AS rn
  FROM fed.grants_contributions fc
  WHERE fc.ref_number IS NOT NULL
)`;

/**
 * F-3 dedup CTE를 inner query 앞에 prepend한다.
 * inner query는 `dedup_fed` 테이블 별칭을 참조해야 한다 (`WHERE rn = 1` 필터 포함 권장).
 *
 * @param innerQuery - dedup_fed를 참조하는 SELECT 쿼리
 * @returns CTE + innerQuery 결합 SQL
 *
 * @example
 *   const sql = withF3Dedup('SELECT SUM(agreement_value) FROM dedup_fed WHERE rn = 1');
 */
export function withF3Dedup(innerQuery: string): string {
  return `${F3_DEDUP_FED_CTE}\n${innerQuery}`;
}
