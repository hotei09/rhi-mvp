import { sql } from '@/lib/db/client';
import { normalizeBn, validateBn } from '@/lib/domain/identifiers';
/**
 * Lens Raw Row Drill-Down API — REQ-004 / Route handler.
 *
 * 클라이언트 측 Raw Row Drawer (`components/entity/raw-row-drawer.tsx`)가 lazy fetch한다.
 * 5개 lens별 raw 행을 최대 50개 + SQL trace 텍스트와 함께 JSON 으로 반환.
 *
 * 보안: 모든 쿼리는 `sql.unsafe`의 read-only 가드를 통과 (write 키워드 prefix 검사).
 */
import { type NextRequest, NextResponse } from 'next/server';

type Params = { params: Promise<{ entityId: string }> };

type LensId = 'zombie' | 'ghost' | 'loop' | 'director' | 'multi-source';

const VALID_LENSES: readonly LensId[] = [
  'zombie',
  'ghost',
  'loop',
  'director',
  'multi-source',
] as const;

/**
 * lens별 raw row 쿼리 정의.
 * Limit 50 — drawer는 표시 목적이므로 페이지네이션 없이 충분.
 */
const RAW_QUERIES: Record<LensId, { sql: string; params: (bn: string) => string[] }> = {
  zombie: {
    sql: `SELECT bn, fiscal_year, total_govt, govt_share_of_rev, revenue
          FROM cra.govt_funding_by_charity
          WHERE bn = $1
          ORDER BY fiscal_year DESC
          LIMIT 50`,
    params: (bn) => [bn],
  },
  ghost: {
    sql: `SELECT bn, fiscal_year, programs, total_expenditures,
                 strict_overhead_pct, broad_overhead_pct
          FROM cra.overhead_by_charity
          WHERE bn = $1
          ORDER BY fiscal_year DESC
          LIMIT 50`,
    params: (bn) => [bn],
  },
  loop: {
    sql: `SELECT lp.loop_id, l.hops, l.total_flow, l.path_bns
          FROM cra.loop_participants lp
          JOIN cra.loops l ON l.id = lp.loop_id
          WHERE lp.bn = $1
          ORDER BY l.total_flow DESC
          LIMIT 50`,
    params: (bn) => [bn],
  },
  director: {
    sql: `SELECT last_name, first_name, COALESCE(initials, '') AS initials,
                 position, at_arms_length, start_date, end_date
          FROM cra.cra_directors
          WHERE bn = $1
          ORDER BY last_name, first_name
          LIMIT 50`,
    params: (bn) => [bn],
  },
  'multi-source': {
    sql: `SELECT entity_id, source_schema, source_table, source_name
          FROM general.entity_source_links
          WHERE source_name = $1 AND source_schema = 'cra'
          LIMIT 50`,
    params: (bn) => [bn],
  },
};

/**
 * GET /api/entity/[entityId]/lens-raw?lens=<id>
 */
export async function GET(request: NextRequest, { params }: Params) {
  const { entityId } = await params;
  const lensParam = request.nextUrl.searchParams.get('lens') ?? '';

  if (!validateBn(entityId)) {
    return NextResponse.json({ error: 'invalid bn format' }, { status: 400 });
  }
  if (!VALID_LENSES.includes(lensParam as LensId)) {
    return NextResponse.json(
      { error: `invalid lens — must be one of ${VALID_LENSES.join(', ')}` },
      { status: 400 },
    );
  }

  const bn = normalizeBn(entityId);
  const lens = lensParam as LensId;
  const query = RAW_QUERIES[lens];

  try {
    const rows = (await sql.unsafe(query.sql, query.params(bn))) as Array<Record<string, unknown>>;
    return NextResponse.json({
      rows,
      sql: query.sql.trim(),
      lens,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
