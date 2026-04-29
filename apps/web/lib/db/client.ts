/**
 * Postgres 클라이언트 싱글톤 — 모든 lens 함수 / safe-queries / scripts가 공유.
 * postgres.js (porsager/postgres) tagged template + read-only 가드 wrapper.
 */
import postgres from 'postgres';
import { env } from './env';

/**
 * Read-only 위반 시 throw되는 커스텀 에러.
 * SQL 문자열에 INSERT/UPDATE/DELETE/DDL 키워드가 감지되면 발생.
 */
export class ReadOnlyViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReadOnlyViolationError';
  }
}

/**
 * 쓰기 작업으로 분류되는 SQL 키워드 (case-insensitive).
 * Read-only replica 보호를 위해 prefix 검증에 사용.
 */
const WRITE_KEYWORDS = [
  'INSERT',
  'UPDATE',
  'DELETE',
  'CREATE',
  'DROP',
  'ALTER',
  'TRUNCATE',
  'GRANT',
  'REVOKE',
] as const;

/**
 * SQL 문자열에서 leading whitespace, line/block comments를 제거한 후
 * 첫 번째 키워드가 쓰기 작업인지 검사한다.
 *
 * @param sqlText - 검사할 SQL 문자열
 * @returns true if write statement detected, false otherwise
 */
export function isWriteStatement(sqlText: string): boolean {
  // 1. block comments 제거: /* ... */
  let cleaned = sqlText.replace(/\/\*[\s\S]*?\*\//g, '');
  // 2. line comments 제거: -- ... \n
  cleaned = cleaned.replace(/--[^\n]*/g, '');
  // 3. leading whitespace 제거
  cleaned = cleaned.trimStart();
  // 4. 첫 단어 추출 후 대문자 비교
  const firstWord = cleaned.split(/\s+/)[0]?.toUpperCase() ?? '';
  return (WRITE_KEYWORDS as readonly string[]).includes(firstWord);
}

declare global {
  // dev hot reload 시 PG 연결 재사용
  // eslint-disable-next-line no-var
  var __pg: ReturnType<typeof postgres> | undefined;
}

/**
 * postgres.js 클라이언트 인스턴스 생성.
 * - ssl: 'require' — Render replica 필수
 * - max: 10 — 동시 연결 제한 (Render free 티어 보호)
 * - prepare: true — prepared statement 캐싱
 * - transform.undefined → null — JS undefined를 SQL NULL로 변환
 */
function createClient(): ReturnType<typeof postgres> {
  return postgres(env.PGCONN, {
    ssl: 'require',
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: true,
    transform: { undefined: null },
  });
}

const baseSql = globalThis.__pg ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__pg = baseSql;
}

// sql.unsafe wrapper로 read-only 가드 적용
const originalUnsafe = baseSql.unsafe.bind(baseSql);

/**
 * baseSql.unsafe를 read-only 가드로 감싼 버전.
 * 쓰기 SQL 감지 시 ReadOnlyViolationError throw + console.error 로그.
 */
function guardedUnsafe(sqlText: string, ...args: unknown[]): ReturnType<typeof originalUnsafe> {
  if (isWriteStatement(sqlText)) {
    const message = `Read-only violation: write statement rejected. SQL prefix: ${sqlText.slice(0, 80)}`;
    console.error(`[ReadOnlyViolationError] ${message}`);
    throw new ReadOnlyViolationError(message);
  }
  // postgres.js unsafe signature: (query, parameters?, options?)
  return (originalUnsafe as (q: string, ...rest: unknown[]) => ReturnType<typeof originalUnsafe>)(
    sqlText,
    ...args,
  );
}

// baseSql 객체에 가드된 unsafe를 덮어씌운다.
// postgres.js의 sql 객체는 함수이자 메서드 컨테이너이므로 직접 mutate.
(baseSql as unknown as { unsafe: typeof guardedUnsafe }).unsafe = guardedUnsafe;

/**
 * 싱글톤 sql 클라이언트.
 * Tagged template literal 사용 시 자동 파라미터 바인딩 (SQL injection 방지).
 * sql.unsafe(...)는 read-only 가드를 통과한 raw 문자열만 실행.
 *
 * @example
 *   const rows = await sql`SELECT * FROM cra.cra_identification WHERE bn = ${bn}`;
 *   const rows = await sql.unsafe('SELECT 1 AS ok');
 */
// @MX:ANCHOR: [AUTO] fan_in_high — 모든 DB 접근의 진입점 (5개 lens, healthz, safe-queries, scripts)
// @MX:REASON: 5개 lens 함수 / /api/healthz / scripts/verify-db.ts / scripts/benchmark-queries.ts / safe-queries.ts 등 모든 DB 접근 코드가 본 export에 의존. 시그니처 변경 시 fan_in 전체 re-validate 필수.
// @MX:SPEC: SPEC-RHI-001 REQ-001
export const sql = baseSql;
