/**
 * 단위 테스트 — `lib/data-issues/safe-queries.ts` 순수 SQL 헬퍼 + read-only 가드.
 * DB 연결 없이 문자열 생성·검사 로직만 검증.
 */
import '../setup-env';
import { describe, expect, it } from 'vitest';

describe('lib/data-issues/safe-queries — EXCLUDED_LEGAL_NAME_PATTERNS', () => {
  it('contains 12 government and health-body exclusion patterns (v0.1.4)', async () => {
    const { EXCLUDED_LEGAL_NAME_PATTERNS } = await import('@/lib/data-issues/safe-queries');
    expect(EXCLUDED_LEGAL_NAME_PATTERNS).toHaveLength(12);
  });

  it('includes the canonical govt patterns from queries.md §1 (v0.1.0 — 6개)', async () => {
    const { EXCLUDED_LEGAL_NAME_PATTERNS } = await import('@/lib/data-issues/safe-queries');
    expect(EXCLUDED_LEGAL_NAME_PATTERNS).toContain('Government of %');
    expect(EXCLUDED_LEGAL_NAME_PATTERNS).toContain('%Health Authority%');
    expect(EXCLUDED_LEGAL_NAME_PATTERNS).toContain('%Crown Corporation%');
    expect(EXCLUDED_LEGAL_NAME_PATTERNS).toContain('City of %');
    expect(EXCLUDED_LEGAL_NAME_PATTERNS).toContain('Town of %');
    expect(EXCLUDED_LEGAL_NAME_PATTERNS).toContain('Municipality of %');
  });

  it('includes additional health-body patterns (v0.1.4 — 신규 6개)', async () => {
    // v0.1.4: sample-entities.ts 추출에서 health bodies가 zombie top 10을 차지한 false positive 해결.
    const { EXCLUDED_LEGAL_NAME_PATTERNS } = await import('@/lib/data-issues/safe-queries');
    expect(EXCLUDED_LEGAL_NAME_PATTERNS).toContain('%Hospital%');
    expect(EXCLUDED_LEGAL_NAME_PATTERNS).toContain('%Hopital%');
    expect(EXCLUDED_LEGAL_NAME_PATTERNS).toContain('%Health Services%');
    expect(EXCLUDED_LEGAL_NAME_PATTERNS).toContain('%Santé%');
    expect(EXCLUDED_LEGAL_NAME_PATTERNS).toContain('%Centre Intégré%');
    expect(EXCLUDED_LEGAL_NAME_PATTERNS).toContain('%Shared Health%');
  });

  it('is a readonly array (frozen)', async () => {
    const { EXCLUDED_LEGAL_NAME_PATTERNS } = await import('@/lib/data-issues/safe-queries');
    // TypeScript readonly + Object.freeze 검증
    expect(Object.isFrozen(EXCLUDED_LEGAL_NAME_PATTERNS)).toBe(true);
  });
});

describe('lib/data-issues/safe-queries — buildGovtExclusionClause', () => {
  it('returns parenthesized clause', async () => {
    const { buildGovtExclusionClause } = await import('@/lib/data-issues/safe-queries');
    const clause = buildGovtExclusionClause('legal_name');
    expect(clause.startsWith('(')).toBe(true);
    expect(clause.endsWith(')')).toBe(true);
  });

  it('joins 12 NOT ILIKE expressions with AND (v0.1.4)', async () => {
    const { buildGovtExclusionClause } = await import('@/lib/data-issues/safe-queries');
    const clause = buildGovtExclusionClause('legal_name');
    // v0.1.0 govt 6개
    expect(clause).toContain("legal_name NOT ILIKE 'Government of %'");
    expect(clause).toContain("legal_name NOT ILIKE '%Health Authority%'");
    expect(clause).toContain("legal_name NOT ILIKE '%Crown Corporation%'");
    expect(clause).toContain("legal_name NOT ILIKE 'City of %'");
    expect(clause).toContain("legal_name NOT ILIKE 'Town of %'");
    expect(clause).toContain("legal_name NOT ILIKE 'Municipality of %'");
    // v0.1.4 health bodies 6개 신규
    expect(clause).toContain("legal_name NOT ILIKE '%Hospital%'");
    expect(clause).toContain("legal_name NOT ILIKE '%Hopital%'");
    expect(clause).toContain("legal_name NOT ILIKE '%Health Services%'");
    expect(clause).toContain("legal_name NOT ILIKE '%Santé%'");
    expect(clause).toContain("legal_name NOT ILIKE '%Centre Intégré%'");
    expect(clause).toContain("legal_name NOT ILIKE '%Shared Health%'");
    // 12개 NOT ILIKE → 11개 AND 연결자
    expect(clause.match(/ AND /g)?.length).toBe(11);
  });

  it('handles qualified column aliases (e.g., m.legal_name)', async () => {
    const { buildGovtExclusionClause } = await import('@/lib/data-issues/safe-queries');
    const clause = buildGovtExclusionClause('m.legal_name');
    expect(clause).toContain("m.legal_name NOT ILIKE 'Government of %'");
    expect(clause).toContain("m.legal_name NOT ILIKE 'Town of %'");
  });
});

describe('lib/data-issues/safe-queries — F3_DEDUP_FED_CTE', () => {
  it('contains ROW_NUMBER OVER PARTITION BY pattern', async () => {
    const { F3_DEDUP_FED_CTE } = await import('@/lib/data-issues/safe-queries');
    expect(F3_DEDUP_FED_CTE).toContain('ROW_NUMBER()');
    expect(F3_DEDUP_FED_CTE).toContain('PARTITION BY');
    expect(F3_DEDUP_FED_CTE).toContain('ref_number');
  });

  it('partitions by recipient with COALESCE fallback', async () => {
    const { F3_DEDUP_FED_CTE } = await import('@/lib/data-issues/safe-queries');
    expect(F3_DEDUP_FED_CTE).toContain('COALESCE');
    expect(F3_DEDUP_FED_CTE).toContain('recipient_business_number');
    expect(F3_DEDUP_FED_CTE).toContain('recipient_legal_name');
    expect(F3_DEDUP_FED_CTE).toContain('_id::text');
  });

  it('orders by amendment_number DESC then amendment_date DESC then _id DESC (F-2 tiebreaker)', async () => {
    const { F3_DEDUP_FED_CTE } = await import('@/lib/data-issues/safe-queries');
    expect(F3_DEDUP_FED_CTE).toContain('amendment_number');
    expect(F3_DEDUP_FED_CTE).toContain('amendment_date DESC');
    expect(F3_DEDUP_FED_CTE).toContain('_id DESC');
  });

  it('filters ref_number IS NOT NULL', async () => {
    const { F3_DEDUP_FED_CTE } = await import('@/lib/data-issues/safe-queries');
    expect(F3_DEDUP_FED_CTE).toContain('ref_number IS NOT NULL');
  });
});

describe('lib/data-issues/safe-queries — withF3Dedup', () => {
  it('wraps inner query with WITH dedup_fed AS clause', async () => {
    const { withF3Dedup } = await import('@/lib/data-issues/safe-queries');
    const inner = 'SELECT SUM(agreement_value) FROM dedup_fed WHERE rn = 1';
    const wrapped = withF3Dedup(inner);
    expect(wrapped).toContain('WITH dedup_fed AS');
    expect(wrapped).toContain(inner);
  });

  it('produces a SQL query in correct order (CTE before SELECT)', async () => {
    const { withF3Dedup } = await import('@/lib/data-issues/safe-queries');
    const wrapped = withF3Dedup('SELECT * FROM dedup_fed WHERE rn = 1');
    const ctePos = wrapped.indexOf('WITH dedup_fed');
    const selectPos = wrapped.lastIndexOf('SELECT * FROM dedup_fed');
    expect(ctePos).toBeGreaterThanOrEqual(0);
    expect(selectPos).toBeGreaterThan(ctePos);
  });
});

describe('lib/db/client — read-only guard (isWriteStatement)', () => {
  it('rejects INSERT statements (case-insensitive)', async () => {
    const { isWriteStatement } = await import('@/lib/db/client');
    expect(isWriteStatement('INSERT INTO foo VALUES (1)')).toBe(true);
    expect(isWriteStatement('insert into foo')).toBe(true);
    expect(isWriteStatement('Insert Into foo')).toBe(true);
  });

  it('rejects UPDATE/DELETE/TRUNCATE', async () => {
    const { isWriteStatement } = await import('@/lib/db/client');
    expect(isWriteStatement('UPDATE foo SET x=1')).toBe(true);
    expect(isWriteStatement('DELETE FROM foo')).toBe(true);
    expect(isWriteStatement('TRUNCATE foo')).toBe(true);
  });

  it('rejects DDL (CREATE/DROP/ALTER)', async () => {
    const { isWriteStatement } = await import('@/lib/db/client');
    expect(isWriteStatement('CREATE TABLE foo (id int)')).toBe(true);
    expect(isWriteStatement('DROP TABLE foo')).toBe(true);
    expect(isWriteStatement('ALTER TABLE foo ADD COLUMN x int')).toBe(true);
  });

  it('rejects GRANT/REVOKE', async () => {
    const { isWriteStatement } = await import('@/lib/db/client');
    expect(isWriteStatement('GRANT SELECT ON foo TO bar')).toBe(true);
    expect(isWriteStatement('REVOKE SELECT ON foo FROM bar')).toBe(true);
  });

  it('allows SELECT/WITH/EXPLAIN statements', async () => {
    const { isWriteStatement } = await import('@/lib/db/client');
    expect(isWriteStatement('SELECT 1')).toBe(false);
    expect(isWriteStatement('WITH cte AS (SELECT 1) SELECT * FROM cte')).toBe(false);
    expect(isWriteStatement('EXPLAIN SELECT 1')).toBe(false);
    expect(isWriteStatement('select 1 as ok')).toBe(false);
  });

  it('strips leading whitespace before checking', async () => {
    const { isWriteStatement } = await import('@/lib/db/client');
    expect(isWriteStatement('   DELETE FROM foo')).toBe(true);
    expect(isWriteStatement('\n\t  INSERT INTO foo')).toBe(true);
    expect(isWriteStatement('   SELECT 1')).toBe(false);
  });

  it('strips block comments before checking', async () => {
    const { isWriteStatement } = await import('@/lib/db/client');
    expect(isWriteStatement('/* comment */ DELETE FROM foo')).toBe(true);
    expect(isWriteStatement('/* multi\nline */ UPDATE foo SET x=1')).toBe(true);
    expect(isWriteStatement('/* harmless */ SELECT 1')).toBe(false);
  });

  it('strips line comments before checking', async () => {
    const { isWriteStatement } = await import('@/lib/db/client');
    expect(isWriteStatement('-- comment\nDELETE FROM foo')).toBe(true);
    expect(isWriteStatement('-- safe note\nSELECT 1')).toBe(false);
  });

  it('exposes ReadOnlyViolationError class extending Error', async () => {
    const { ReadOnlyViolationError } = await import('@/lib/db/client');
    const err = new ReadOnlyViolationError('test violation');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ReadOnlyViolationError');
    expect(err.message).toBe('test violation');
  });

  it('sql.unsafe(write SQL) throws ReadOnlyViolationError before reaching DB', async () => {
    const { sql, ReadOnlyViolationError } = await import('@/lib/db/client');
    // 쓰기 SQL은 가드에서 즉시 throw — 실제 DB 연결 시도 전에 차단
    expect(() => sql.unsafe('DELETE FROM cra.cra_identification')).toThrow(ReadOnlyViolationError);
    expect(() => sql.unsafe('INSERT INTO foo VALUES (1)')).toThrow(ReadOnlyViolationError);
    expect(() => sql.unsafe('UPDATE bar SET x=1')).toThrow(ReadOnlyViolationError);
  });
});
