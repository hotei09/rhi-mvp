/**
 * Lens 4 — Director Network (REQ-002, signal-only).
 *
 * 동일 인물 (last_name + first_name + initials 셋 매칭)이 다른 funded BN의 이사로
 * 등재된 시그널 카운트. 동명이인 false positive 회피를 위해 셋 매칭 필수 (queries.md §6).
 *
 * 결과는 단순 카운트 시그널이며, "fraud claim"으로 해석 금지 (AC-10 디스클레이머).
 */
import { buildGovtExclusionClause } from '@/lib/data-issues/safe-queries';
import { sql } from '@/lib/db/client';

/**
 * Director match — 동일 인물(last+first+initials)에 대해 매칭된 다른 BN 목록.
 */
export type DirectorMatch = {
  last_name: string;
  first_name: string;
  initials: string;
  matched_bns: string[];
};

/**
 * Director lens 결과.
 */
export type DirectorOverlap = {
  overlap_count: number;
  matches: DirectorMatch[];
};

/**
 * 단일 BN의 Director overlap을 계산한다.
 *
 * @param bn - 자선단체 BN
 * @returns overlap 카운트 + 매칭 디테일
 */
export async function getDirectorOverlap(bn: string): Promise<DirectorOverlap> {
  // 다른 funded BN 정부 엔티티 자동 제외 — id_meta 단계에서 legal_name 패턴 적용
  const exclusion = buildGovtExclusionClause('id_meta.legal_name');

  // queries.md §6 패턴: target_directors → funded_bns → overlapping
  const query = `
    WITH target_directors AS (
      SELECT DISTINCT
        last_name, first_name, COALESCE(initials, '') AS initials
      FROM cra.cra_directors
      WHERE bn = $1
    ),
    funded_bns AS (
      SELECT DISTINCT bn FROM cra.govt_funding_by_charity WHERE total_govt > 0
    ),
    govt_filtered AS (
      SELECT DISTINCT id_meta.bn
      FROM cra.cra_identification id_meta
      WHERE ${exclusion}
    ),
    overlapping AS (
      SELECT
        d.bn,
        d.last_name,
        d.first_name,
        COALESCE(d.initials, '') AS initials
      FROM cra.cra_directors d
      JOIN target_directors td
        ON td.last_name = d.last_name
       AND td.first_name = d.first_name
       AND td.initials = COALESCE(d.initials, '')
      JOIN funded_bns f ON f.bn = d.bn
      JOIN govt_filtered g ON g.bn = d.bn
      WHERE d.bn <> $1
    )
    SELECT
      last_name,
      first_name,
      initials,
      array_agg(DISTINCT bn ORDER BY bn) FILTER (WHERE bn IS NOT NULL) AS matched_bns
    FROM overlapping
    GROUP BY last_name, first_name, initials
    ORDER BY last_name, first_name, initials
  `;

  const rows = (await sql.unsafe(query, [bn])) as Array<{
    last_name: string;
    first_name: string;
    initials: string;
    matched_bns: string[] | null;
  }>;

  const matches: DirectorMatch[] = rows.map((r) => ({
    last_name: r.last_name,
    first_name: r.first_name,
    initials: r.initials,
    matched_bns: r.matched_bns ?? [],
  }));

  // 전체 overlap_count = 매칭된 unique BN 수
  const allMatchedBns = new Set<string>();
  for (const m of matches) {
    for (const b of m.matched_bns) allMatchedBns.add(b);
  }

  return {
    overlap_count: allMatchedBns.size,
    matches,
  };
}
