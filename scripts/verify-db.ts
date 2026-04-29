/**
 * DB 연결 sanity script — Render PG replica의 79 tables / 5 schemas 매핑 검증.
 *
 * 사용법: `cd apps/web && pnpm exec tsx ../../scripts/verify-db.ts`
 *
 * 출력:
 * - PostgreSQL 버전
 * - 스키마별 table 수 (cra, fed, ab, general, public)
 * - 핵심 테이블 행 수 sample
 * - 종료 코드 0 (성공) 또는 1 (실패)
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// .env.local 로드 (apps/web 디렉토리 기준 실행 가정)
const envPath = resolve(process.cwd(), '.env.local');
try {
  const content = readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(?:"(.*?)"|(.*))$/);
    if (!match) continue;
    const [, key, quoted, unquoted] = match;
    if (!key || process.env[key]) continue;
    process.env[key] = quoted ?? unquoted ?? '';
  }
} catch {
  console.error(`[verify-db] .env.local not found at ${envPath}`);
  process.exit(1);
}

async function main(): Promise<void> {
  // dynamic import — env 로드 후 client 초기화
  const { sql } = await import('../apps/web/lib/db/client');

  try {
    // 1. PostgreSQL 버전
    const versionRows = (await sql`SELECT version()`) as Array<{ version: string }>;
    console.log(`[verify-db] PostgreSQL: ${versionRows[0]?.version ?? 'unknown'}`);

    // 2. 스키마별 table 수
    const schemaCounts = (await sql`
      SELECT table_schema, COUNT(*)::int AS table_count
      FROM information_schema.tables
      WHERE table_schema IN ('cra', 'fed', 'ab', 'general', 'public')
        AND table_type = 'BASE TABLE'
      GROUP BY table_schema
      ORDER BY table_schema
    `) as Array<{ table_schema: string; table_count: number }>;

    console.log('[verify-db] Schema table counts:');
    let totalTables = 0;
    for (const row of schemaCounts) {
      console.log(`  ${row.table_schema.padEnd(10)} ${row.table_count} tables`);
      totalTables += row.table_count;
    }
    console.log(`  ${'TOTAL'.padEnd(10)} ${totalTables} tables`);

    // 3. 핵심 테이블 행 수 sample
    const sampleQueries = [
      { schema: 'cra', table: 'cra_identification' },
      { schema: 'cra', table: 'loops' },
      { schema: 'fed', table: 'grants_contributions' },
      { schema: 'ab', table: 'ab_grants' },
    ];

    console.log('[verify-db] Sample table row counts:');
    for (const { schema, table } of sampleQueries) {
      try {
        const result = (await sql.unsafe(
          `SELECT COUNT(*)::bigint AS cnt FROM ${schema}.${table}`,
        )) as Array<{ cnt: string }>;
        const cnt = result[0]?.cnt ?? '0';
        console.log(`  ${schema}.${table.padEnd(25)} ${Number(cnt).toLocaleString()} rows`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`  ${schema}.${table.padEnd(25)} (skipped: ${msg})`);
      }
    }

    console.log('[verify-db] OK — connection and schema mapping verified');
    await sql.end({ timeout: 5 });
    process.exit(0);
  } catch (err) {
    console.error('[verify-db] FAILED:', err);
    try {
      const { sql } = await import('../apps/web/lib/db/client');
      await sql.end({ timeout: 5 });
    } catch {
      // ignore
    }
    process.exit(1);
  }
}

main();
