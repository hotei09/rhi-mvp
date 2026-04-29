/**
 * SPEC-RHI-001 — 데모 시나리오용 엔티티 후보 추출 스크립트.
 *
 * 발표 5분 데모를 위한 3개 케이스 BN 후보를 Render PG replica에서 추출하여
 * `.moai/reports/demo-candidates.json` 으로 저장한다 (product.md §9 매핑).
 *
 *  Case A — Zombie:           zombie_score >= 80 + govt_share >= 0.7 + last_fpe < 24mo
 *  Case B — Loop Tier C:      cross-org cycle + plausibility flag (또는 low program ratio + no hub)
 *  Case C — Multi-Source 통합: 3+ lens hit (zombie + ghost + multi_source >= 2)
 *                              cheap-first fallback: zombie ∩ multi_source 교집합 → top 10 by concern_score
 *
 * 사용법: `cd apps/web && pnpm exec tsx ../../scripts/sample-entities.ts`
 *
 * HARD 제약:
 *  - read-only 쿼리만 (lib/db/client.ts 가드 자동 적용)
 *  - 30초 쿼리 타임아웃 (Promise.race)
 *  - 빈 결과 시 임계값 완화 (zombie_score >= 60)
 *  - F-3 dedup + 정부 엔티티 제외 강제
 *
 * @MX:NOTE: [AUTO] 데모 후보 추출 스크립트 — 결과는 발표용으로 사람이 검토 후 골라낸다 (product.md §9).
 * @MX:SPEC: SPEC-RHI-001 데모 시나리오 가이드
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
// 타입 전용 import — 런타임 영향 없음, env 로드 전에 안전
import type { LoopMetaInput } from '../apps/web/lib/lenses/loop';

// =============================================================================
// 1. .env.local 로더 (verify-db.ts 와 동일 패턴 — apps/web cwd 기준)
// =============================================================================
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
  console.error(`[sample-entities] .env.local not found at ${envPath}`);
  process.exit(1);
}

// =============================================================================
// 2. 타입 정의
// =============================================================================

/** Zombie 케이스 후보 행 */
type ZombieCandidate = {
  bn: string;
  legal_name: string;
  zombie_score: number;
  last_fpe: string | null;
  last_funding_year: number | null;
  total_funding: number | null;
  months_since_filing: number | null;
};

/** Loop Tier C 후보 */
type LoopTierCCandidate = {
  loop_id: number;
  hops: number;
  total_flow: number;
  path_display: string;
  classification_reasons: string[];
  distinct_bn_roots: number;
  has_plausibility_flag: boolean;
};

/** Multi-Source 통합 후보 (zombie + multi_source 교집합) */
type MultiSourceCandidate = {
  bn: string;
  legal_name: string;
  concern_score: number;
  tier: string;
  components: {
    zombie_score: number;
    ghost_score: number;
    loop_signal: number;
    director_overlap: number;
    multi_source_count: number;
  };
};

/** 최종 출력 JSON 구조 */
type DemoCandidatesReport = {
  generated_at: string;
  zombie: ZombieCandidate[];
  loop_tier_c: LoopTierCCandidate[];
  multi_source: MultiSourceCandidate[];
  metadata: {
    zombie_threshold_used: number;
    multi_source_strategy: string;
    notes: string[];
  };
};

// =============================================================================
// 3. 헬퍼 — 30초 쿼리 타임아웃
// =============================================================================

/**
 * Promise.race 로 30초 타임아웃을 적용한다.
 * 타임아웃 시 호출자는 catch 후 fallback (예: 후보 풀 축소) 처리.
 */
async function withTimeout<T>(label: string, p: Promise<T>, ms = 30_000): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`[timeout] ${label} > ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// =============================================================================
// 4. 메인
// =============================================================================
async function main(): Promise<void> {
  // dynamic import — env 로드 후 client 초기화 (verify-db.ts 와 동일 패턴)
  const { sql } = await import('../apps/web/lib/db/client');
  const { buildGovtExclusionClause, withF3Dedup } = await import(
    '../apps/web/lib/data-issues/safe-queries'
  );
  const { classifyLoop } = await import('../apps/web/lib/lenses/loop');
  const { computeConcernScore } = await import('../apps/web/lib/lenses/concern-score');

  const startTime = Date.now();
  const queryTimings: Record<string, number> = {};

  console.log('[sample-entities] 데모 후보 추출 시작 (SPEC-RHI-001 §9)');
  console.log(`[sample-entities] cwd=${process.cwd()}`);

  // ---------------------------------------------------------------------------
  // Case A — Zombie 후보 (top 10 by zombie_score >= 80)
  // ---------------------------------------------------------------------------
  const zombieExclusion = buildGovtExclusionClause('legal_name');

  /**
   * Zombie ranking 쿼리 — apps/web/lib/lenses/zombie.ts 의 단일 BN 변형을 top-N으로 확장.
   * 정부 엔티티 6개 패턴 사전 제외 (AC-9), govt_share >= 0.7 + revenue > 100000 필터 (queries.md §2).
   */
  const buildZombieQuery = (minScore: number): string => `
    WITH last_funding AS (
      SELECT
        bn,
        MAX(fiscal_year) AS last_funding_year,
        SUM(total_govt) AS total_funding
      FROM cra.govt_funding_by_charity
      WHERE govt_share_of_rev >= 0.7 AND revenue > 100000
      GROUP BY bn
    ),
    last_filing AS (
      SELECT bn, MAX(fpe) AS last_fpe FROM cra.cra_financial_general GROUP BY bn
    ),
    charity_meta AS (
      SELECT DISTINCT ON (bn) bn, legal_name
      FROM cra.cra_identification
      WHERE ${zombieExclusion}
      ORDER BY bn, fiscal_year DESC
    ),
    scored AS (
      SELECT
        m.bn,
        m.legal_name,
        f.last_funding_year,
        f.total_funding::float8 AS total_funding,
        fl.last_fpe,
        EXTRACT(MONTH FROM AGE(CURRENT_DATE, fl.last_fpe))
          + 12 * EXTRACT(YEAR FROM AGE(CURRENT_DATE, fl.last_fpe))::float8 AS months_since_filing,
        CASE
          WHEN fl.last_fpe IS NULL                              THEN 0
          WHEN fl.last_fpe < CURRENT_DATE - INTERVAL '24 months'
            AND f.last_funding_year >= EXTRACT(YEAR FROM fl.last_fpe) - 1 THEN 100
          WHEN fl.last_fpe < CURRENT_DATE - INTERVAL '18 months' THEN 80
          WHEN fl.last_fpe < CURRENT_DATE - INTERVAL '12 months' THEN 60
          WHEN fl.last_fpe < CURRENT_DATE - INTERVAL '6 months'  THEN 30
          ELSE 0
        END AS zombie_score
      FROM charity_meta m
      JOIN last_funding f USING (bn)
      LEFT JOIN last_filing fl USING (bn)
    )
    SELECT bn, legal_name, zombie_score,
           last_fpe, last_funding_year, total_funding, months_since_filing
    FROM scored
    WHERE zombie_score >= ${minScore}
    ORDER BY zombie_score DESC, total_funding DESC NULLS LAST
    LIMIT 10
  `;

  let zombieThreshold = 80;
  let zombieRows: ZombieCandidate[] = [];

  console.log('[sample-entities] [A/3] Zombie 후보 추출 중 (threshold=80)...');
  try {
    const t0 = Date.now();
    const rows = (await withTimeout(
      'zombie@80',
      sql.unsafe(buildZombieQuery(80)),
    )) as Array<ZombieCandidate>;
    queryTimings['zombie@80'] = Date.now() - t0;

    if (rows.length === 0) {
      // fallback: 임계값 완화
      console.log(
        '[sample-entities]   ⚠️  threshold 80 결과 0건 — threshold 60으로 fallback',
      );
      zombieThreshold = 60;
      const t1 = Date.now();
      const fallback = (await withTimeout(
        'zombie@60',
        sql.unsafe(buildZombieQuery(60)),
      )) as Array<ZombieCandidate>;
      queryTimings['zombie@60'] = Date.now() - t1;
      zombieRows = fallback;
    } else {
      zombieRows = rows;
    }
    console.log(
      `[sample-entities]   ✓ Zombie 후보 ${zombieRows.length}건 (threshold=${zombieThreshold}, ${queryTimings[`zombie@${zombieThreshold}`]}ms)`,
    );
  } catch (err) {
    console.error('[sample-entities]   ✗ Zombie 쿼리 실패:', (err as Error).message);
  }

  // ---------------------------------------------------------------------------
  // Case B — Loop Tier C 후보
  // ---------------------------------------------------------------------------
  /**
   * Loop 메타 + hub touch + plausibility flag + program ratio 를 inline CTE로 조인.
   * apps/web/lib/lenses/loop.ts 의 getLoopClassification 단일 loop 쿼리를 ranking으로 확장.
   * Tier C 분류 로직은 메모리에서 classifyLoop 적용 (CASE 순서 보존).
   */
  const loopRankingQuery = `
    WITH loop_base AS (
      SELECT
        l.id AS loop_id,
        l.hops,
        l.path_bns,
        l.total_flow::float8 AS total_flow,
        cardinality(
          (SELECT array_agg(DISTINCT substr(p, 1, 9)) FROM unnest(l.path_bns) p)
        ) AS distinct_bn_roots
      FROM cra.loops l
    ),
    hub_check AS (
      SELECT lp.loop_id,
             COUNT(*) FILTER (WHERE h.bn IS NOT NULL) > 0 AS hub_touch
      FROM cra.loop_participants lp
      LEFT JOIN cra.identified_hubs h ON h.bn = lp.bn
      GROUP BY lp.loop_id
    ),
    plausibility_check AS (
      SELECT lp.loop_id,
             COUNT(*) FILTER (WHERE pf.severity >= 3) > 0 AS has_plausibility_flag
      FROM cra.loop_participants lp
      LEFT JOIN cra.t3010_plausibility_flags pf ON pf.bn = lp.bn AND pf.severity >= 3
      GROUP BY lp.loop_id
    ),
    program_health AS (
      SELECT lp.loop_id,
             AVG(
               COALESCE(
                 CASE WHEN o.total_expenditures > 0
                      THEN o.programs::float8 / o.total_expenditures::float8
                      ELSE 0 END,
                 0
               )
             )::float8 AS avg_program_ratio
      FROM cra.loop_participants lp
      LEFT JOIN cra.overhead_by_charity o ON o.bn = lp.bn
      GROUP BY lp.loop_id
    )
    SELECT
      b.loop_id, b.hops, b.path_bns, b.total_flow, b.distinct_bn_roots,
      COALESCE(hc.hub_touch, false) AS hub_touch,
      COALESCE(pc.has_plausibility_flag, false) AS has_plausibility_flag,
      ph.avg_program_ratio
    FROM loop_base b
    LEFT JOIN hub_check hc USING (loop_id)
    LEFT JOIN plausibility_check pc USING (loop_id)
    LEFT JOIN program_health ph USING (loop_id)
    WHERE b.distinct_bn_roots >= 2  -- cross-organization 만 (Tier A internal hierarchy 제외)
    ORDER BY b.total_flow DESC NULLS LAST
    LIMIT 200
  `;

  let loopTierCRows: LoopTierCCandidate[] = [];
  console.log('[sample-entities] [B/3] Loop Tier C 후보 추출 중 (top 200 cross-org → 분류 → C 필터)...');
  try {
    const t0 = Date.now();
    const rawLoops = (await withTimeout('loop_ranking', sql.unsafe(loopRankingQuery))) as Array<{
      loop_id: number;
      hops: number;
      path_bns: string[];
      total_flow: number;
      distinct_bn_roots: number;
      hub_touch: boolean;
      has_plausibility_flag: boolean;
      avg_program_ratio: number | null;
    }>;
    queryTimings['loop_ranking'] = Date.now() - t0;

    // 메모리에서 classifyLoop 적용 → Tier C 만 필터
    const classified = rawLoops
      .map((r) =>
        classifyLoop({
          loop_id: r.loop_id,
          hops: r.hops,
          path_bns: r.path_bns,
          total_flow: r.total_flow,
          distinct_bn_roots: r.distinct_bn_roots,
          hub_touch: r.hub_touch,
          has_plausibility_flag: r.has_plausibility_flag,
          avg_program_ratio: r.avg_program_ratio,
        } satisfies LoopMetaInput),
      )
      .filter((c) => c.tier === 'C');

    // total_flow DESC 정렬 후 top 10
    classified.sort((a, b) => b.total_flow - a.total_flow);
    loopTierCRows = classified.slice(0, 10).map((c) => {
      // path_display: "BN1 → BN2 → ... → BN1" (첫 4개 + 끝)
      const pathArr = c.path_bns;
      let display: string;
      if (pathArr.length <= 5) {
        display = pathArr.join(' → ');
      } else {
        const head = pathArr.slice(0, 3).join(' → ');
        const tail = pathArr[pathArr.length - 1];
        display = `${head} → … (${pathArr.length - 4} more) → ${tail}`;
      }
      return {
        loop_id: c.loop_id,
        hops: c.hops,
        total_flow: c.total_flow,
        path_display: display,
        classification_reasons: c.classification_reasons,
        distinct_bn_roots: rawLoops.find((r) => r.loop_id === c.loop_id)?.distinct_bn_roots ?? 0,
        has_plausibility_flag:
          rawLoops.find((r) => r.loop_id === c.loop_id)?.has_plausibility_flag ?? false,
      } satisfies LoopTierCCandidate;
    });
    console.log(
      `[sample-entities]   ✓ Loop Tier C 후보 ${loopTierCRows.length}건 / 분석 ${rawLoops.length} cross-org loops (${queryTimings['loop_ranking']}ms)`,
    );
  } catch (err) {
    console.error('[sample-entities]   ✗ Loop ranking 쿼리 실패:', (err as Error).message);
  }

  // ---------------------------------------------------------------------------
  // Case C — Multi-Source High Concern (zombie + multi_source 교집합)
  // ---------------------------------------------------------------------------
  /**
   * 비용 절감 전략: zombie 상위 50 + multi_source >= 2 후보를 BN 단위로 교집합.
   * 그 후 ghost/loop/director 시그널을 추가 fetch 하여 computeConcernScore 적용.
   *
   * BN ↔ entity_id 매핑: general.entity_source_links.source_name = bn (CRA 측).
   */
  // multi-source 후보: cra.govt_funding_by_charity bn ∈ entity_source_links 에 fed/ab 도 매핑된 BN
  // F-3 dedup 적용한 fed 합계 사용
  // ESL_FED_PRE / ESL_AB_PRE: source_schema 사전 필터링 후 _id 추출.
  // CTE 안에서 미리 필터링하지 않으면 PG가 fed/ab 외 schema의 source_pk 에도 cast 평가를 시도하여
  // "invalid input syntax for type integer: <UUID>" 에러 발생 (다른 schema의 source_pk가 UUID 형식).
  const multiSourceCandQuery = withF3Dedup(`
    , cra_entities AS (
      SELECT DISTINCT esl.entity_id, esl.source_name AS bn
      FROM general.entity_source_links esl
      WHERE esl.source_schema = 'cra'
    ),
    esl_fed_pre AS (
      SELECT entity_id, (source_pk->>'_id')::int AS fed_id
      FROM general.entity_source_links
      WHERE source_schema = 'fed'
        AND source_pk ? '_id'
        AND (source_pk->>'_id') ~ '^[0-9]+$'
    ),
    esl_ab_pre AS (
      -- AB source_pk 는 일부가 UUID 형식이고 일부가 integer-as-text. ab_grants.id는 integer 타입이므로
      -- numeric 형식만 cast 한다 (UUID 행은 link 매칭 불가능 — 데이터 함정 무시).
      SELECT entity_id, (source_pk->>'id')::int AS ab_id
      FROM general.entity_source_links
      WHERE source_schema = 'ab'
        AND source_pk ? 'id'
        AND (source_pk->>'id') ~ '^[0-9]+$'
    ),
    fed_match AS (
      SELECT efp.entity_id,
             SUM(fc.agreement_value)::float8 AS fed_total
      FROM dedup_fed fc
      JOIN esl_fed_pre efp ON efp.fed_id = fc._id
      WHERE fc.rn = 1 AND fc.agreement_value > 0
      GROUP BY efp.entity_id
    ),
    ab_match AS (
      SELECT eap.entity_id,
             SUM(ab.amount)::float8 AS ab_total
      FROM ab.ab_grants ab
      JOIN esl_ab_pre eap ON eap.ab_id = ab.id
      WHERE ab.amount > 0
      GROUP BY eap.entity_id
    ),
    cra_match AS (
      SELECT ce.entity_id, ce.bn,
             SUM(g.total_govt)::float8 AS cra_total
      FROM cra_entities ce
      JOIN cra.govt_funding_by_charity g ON g.bn = ce.bn
      WHERE g.total_govt > 0
      GROUP BY ce.entity_id, ce.bn
    )
    SELECT
      cm.entity_id,
      cm.bn,
      cm.cra_total,
      COALESCE(fm.fed_total, 0) AS fed_total,
      COALESCE(am.ab_total, 0) AS ab_total,
      (CASE WHEN cm.cra_total > 0 THEN 1 ELSE 0 END
        + CASE WHEN COALESCE(fm.fed_total, 0) > 0 THEN 1 ELSE 0 END
        + CASE WHEN COALESCE(am.ab_total, 0) > 0 THEN 1 ELSE 0 END
      ) AS source_count
    FROM cra_match cm
    LEFT JOIN fed_match fm USING (entity_id)
    LEFT JOIN ab_match am USING (entity_id)
    WHERE (CASE WHEN cm.cra_total > 0 THEN 1 ELSE 0 END
        + CASE WHEN COALESCE(fm.fed_total, 0) > 0 THEN 1 ELSE 0 END
        + CASE WHEN COALESCE(am.ab_total, 0) > 0 THEN 1 ELSE 0 END
      ) >= 2
    ORDER BY (cm.cra_total + COALESCE(fm.fed_total, 0) + COALESCE(am.ab_total, 0)) DESC
    LIMIT 50
  `);

  const multiSourceRows: MultiSourceCandidate[] = [];

  console.log('[sample-entities] [C/3] Multi-Source 후보 추출 중 (zombie ∩ multi_source 교집합)...');
  try {
    // 1. multi-source >= 2 후보 top 50
    const t0 = Date.now();
    const msCandidates = (await withTimeout(
      'multi_source_top50',
      sql.unsafe(multiSourceCandQuery),
    )) as Array<{
      entity_id: string;
      bn: string;
      cra_total: number;
      fed_total: number;
      ab_total: number;
      source_count: number;
    }>;
    queryTimings['multi_source_top50'] = Date.now() - t0;
    console.log(
      `[sample-entities]   · multi_source >= 2 후보 ${msCandidates.length}건 (${queryTimings['multi_source_top50']}ms)`,
    );

    if (msCandidates.length === 0) {
      console.warn('[sample-entities]   ⚠️  multi_source 후보 0건 — 빈 결과 반환');
    } else {
      // 2. zombie 시그널 (이미 추출된 zombieRows에 BN 매칭 + 미매칭 BN은 별도 조회)
      const zombieMap = new Map<string, number>();
      for (const z of zombieRows) zombieMap.set(z.bn, z.zombie_score);

      // multi_source 후보 BN 중 zombieMap에 없는 것은 zombie_score=0 처리
      // (zombie top 10 안에 못 든 BN은 점수 80 미만이므로 0/30/60 중 하나)

      // 3. ghost + loop + director 시그널을 일괄 조회 (BN 묶음)
      const candidateBns = msCandidates.map((c) => c.bn);
      const bnList = candidateBns.map((b) => `'${b}'`).join(',');

      // ghost: program_ratio + govt_share 기반 score (queries.md §4)
      // 후보 BN 묶음에 대해 한 번에 평가
      const ghostBatchQuery = `
        WITH funding_recent AS (
          SELECT bn, AVG(govt_share_of_rev)::float8 AS share
          FROM cra.govt_funding_by_charity
          WHERE fiscal_year >= 2022 AND bn IN (${bnList})
          GROUP BY bn
          HAVING AVG(govt_share_of_rev) >= 0.7
        ),
        overhead AS (
          SELECT bn,
                 AVG(CASE WHEN total_expenditures > 0
                          THEN programs::float8 / total_expenditures::float8
                          ELSE NULL END)::float8 AS program_ratio
          FROM cra.overhead_by_charity
          WHERE bn IN (${bnList})
          GROUP BY bn
        )
        SELECT
          f.bn,
          CASE
            WHEN o.program_ratio < 0.20 AND f.share >= 0.85 THEN 100
            WHEN o.program_ratio < 0.30 AND f.share >= 0.80 THEN 80
            WHEN o.program_ratio < 0.40 AND f.share >= 0.75 THEN 50
            WHEN o.program_ratio < 0.50 AND f.share >= 0.70 THEN 30
            ELSE 0
          END AS ghost_score
        FROM funding_recent f
        LEFT JOIN overhead o USING (bn)
      `;

      // loop 참여 (BN 단위 max tier)
      const loopBatchQuery = `
        SELECT lp.bn,
               COUNT(DISTINCT lp.loop_id)::int AS loop_count
        FROM cra.loop_participants lp
        WHERE lp.bn IN (${bnList})
        GROUP BY lp.bn
      `;

      // director overlap (간이 시그널 — 동일 first+last 이름이 다른 BN 이사로 등재된 카운트)
      // 비용이 큰 쿼리이므로 후보 BN 묶음에 한정
      const directorBatchQuery = `
        SELECT
          d1.bn,
          COUNT(DISTINCT d2.bn)::int AS director_overlap
        FROM cra.cra_directors d1
        JOIN cra.cra_directors d2
          ON LOWER(TRIM(d1.last_name)) = LOWER(TRIM(d2.last_name))
         AND LOWER(TRIM(d1.first_name)) = LOWER(TRIM(d2.first_name))
         AND d1.bn <> d2.bn
        WHERE d1.bn IN (${bnList})
          AND d1.last_name IS NOT NULL
          AND d1.first_name IS NOT NULL
        GROUP BY d1.bn
      `;

      // legal_name 매핑
      const metaBatchQuery = `
        SELECT DISTINCT ON (bn) bn, legal_name
        FROM cra.cra_identification
        WHERE bn IN (${bnList})
        ORDER BY bn, fiscal_year DESC
      `;

      const t1 = Date.now();
      const [ghostRows, loopRows, directorRows, metaRows] = await Promise.all([
        withTimeout('ghost_batch', sql.unsafe(ghostBatchQuery)) as Promise<
          Array<{ bn: string; ghost_score: number }>
        >,
        withTimeout('loop_batch', sql.unsafe(loopBatchQuery)) as Promise<
          Array<{ bn: string; loop_count: number }>
        >,
        withTimeout('director_batch', sql.unsafe(directorBatchQuery)) as Promise<
          Array<{ bn: string; director_overlap: number }>
        >,
        withTimeout('meta_batch', sql.unsafe(metaBatchQuery)) as Promise<
          Array<{ bn: string; legal_name: string }>
        >,
      ]);
      queryTimings['multi_source_signals_batch'] = Date.now() - t1;
      console.log(
        `[sample-entities]   · 4-batch 시그널 조회 완료 (${queryTimings['multi_source_signals_batch']}ms)`,
      );

      // 5. 후보별로 computeConcernScore 적용
      const ghostMap = new Map<string, number>();
      for (const g of ghostRows) ghostMap.set(g.bn, g.ghost_score);
      const loopMap = new Map<string, number>();
      for (const l of loopRows) loopMap.set(l.bn, l.loop_count);
      const directorMap = new Map<string, number>();
      for (const d of directorRows) directorMap.set(d.bn, d.director_overlap);
      const metaMap = new Map<string, string>();
      for (const m of metaRows) metaMap.set(m.bn, m.legal_name);

      // loop_signal 결정: 본 스크립트는 BN별 max tier 분류를 생략하고
      // loop 참여 카운트만 사용 (참여 시 50 — Tier B 가정).
      // 정확한 Tier 결정은 발표 페이지에서 getLoopParticipation 으로 재계산됨.
      const scored = msCandidates.map((m) => {
        const zombie_score = zombieMap.get(m.bn) ?? 0;
        const ghost_score = ghostMap.get(m.bn) ?? 0;
        const loop_count = loopMap.get(m.bn) ?? 0;
        const loop_signal = loop_count > 0 ? 50 : 0; // 보수적 가정 — Tier B 환산
        const director_overlap = directorMap.get(m.bn) ?? 0;
        const multi_source_count = m.source_count;

        const result = computeConcernScore({
          zombie_score,
          ghost_score,
          loop_signal,
          director_overlap,
          multi_source_count,
        });

        return {
          bn: m.bn,
          legal_name: metaMap.get(m.bn) ?? '(unknown)',
          concern_score: result.score,
          tier: result.tier,
          components: {
            zombie_score,
            ghost_score,
            loop_signal,
            director_overlap,
            multi_source_count,
          },
        } satisfies MultiSourceCandidate;
      });

      // 6. concern_score DESC 정렬 + top 10
      scored.sort((a, b) => b.concern_score - a.concern_score);
      multiSourceRows.push(...scored.slice(0, 10));
      console.log(
        `[sample-entities]   ✓ Multi-Source 후보 ${multiSourceRows.length}건 (top 10 by concern_score)`,
      );
    }
  } catch (err) {
    console.error('[sample-entities]   ✗ Multi-Source 쿼리 실패:', (err as Error).message);
  }

  // ---------------------------------------------------------------------------
  // 결과 저장 + 사람 가독 요약
  // ---------------------------------------------------------------------------
  const totalMs = Date.now() - startTime;
  const report: DemoCandidatesReport = {
    generated_at: new Date().toISOString(),
    zombie: zombieRows,
    loop_tier_c: loopTierCRows,
    multi_source: multiSourceRows,
    metadata: {
      zombie_threshold_used: zombieThreshold,
      multi_source_strategy: 'zombie ∩ multi_source>=2 → top 10 by concern_score',
      notes: [
        'F-3 dedup 적용 (FED 합계)',
        '정부 엔티티 6개 패턴 자동 제외 (AC-9)',
        'Loop Tier C 분류는 classifyLoop CASE 순서 보존',
        'Multi-Source loop_signal은 보수적 가정 (참여 시 Tier B = 50)',
        'BN ↔ entity_id 매핑은 source_schema=cra 기준 source_name=bn',
      ],
    },
  };

  const reportPath = resolve(process.cwd(), '../../.moai/reports/demo-candidates.json');
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

  // 사람 가독 요약 출력
  console.log('');
  console.log('================================================================');
  console.log(' SPEC-RHI-001 데모 후보 추출 결과 요약');
  console.log('================================================================');
  console.log(`총 실행 시간: ${totalMs}ms`);
  console.log(`결과 파일:    ${reportPath}`);
  console.log('');

  // Case A
  console.log('[Case A] Zombie 후보 (top 5 미리보기)');
  if (zombieRows.length === 0) {
    console.log('  (결과 없음)');
  } else {
    for (const [i, z] of zombieRows.slice(0, 5).entries()) {
      console.log(
        `  ${i + 1}. BN ${z.bn} | score=${z.zombie_score} | last_fpe=${z.last_fpe} | total=$${(z.total_funding ?? 0).toLocaleString()} | ${z.legal_name}`,
      );
    }
  }
  console.log('');

  // Case B
  console.log('[Case B] Loop Tier C 후보 (top 5 미리보기)');
  if (loopTierCRows.length === 0) {
    console.log('  (결과 없음)');
  } else {
    for (const [i, l] of loopTierCRows.slice(0, 5).entries()) {
      console.log(
        `  ${i + 1}. loop_id=${l.loop_id} | hops=${l.hops} | flow=$${l.total_flow.toLocaleString()} | ${l.classification_reasons[0] ?? ''}`,
      );
      console.log(`     path: ${l.path_display}`);
    }
  }
  console.log('');

  // Case C
  console.log('[Case C] Multi-Source High Concern (top 5 미리보기)');
  if (multiSourceRows.length === 0) {
    console.log('  (결과 없음)');
  } else {
    for (const [i, m] of multiSourceRows.slice(0, 5).entries()) {
      console.log(
        `  ${i + 1}. BN ${m.bn} | concern=${m.concern_score} (${m.tier}) | sources=${m.components.multi_source_count} | zombie=${m.components.zombie_score} ghost=${m.components.ghost_score} loop=${m.components.loop_signal} director=${m.components.director_overlap}`,
      );
      console.log(`     ${m.legal_name}`);
    }
  }
  console.log('');

  // 발표용 top 1 추천
  console.log('--- 발표용 추천 후보 (각 케이스 top 1) ---');
  if (zombieRows[0]) {
    console.log(`  Zombie:       BN ${zombieRows[0].bn} (${zombieRows[0].legal_name})`);
  }
  if (loopTierCRows[0]) {
    console.log(
      `  Loop Tier C:  loop_id ${loopTierCRows[0].loop_id} (hops=${loopTierCRows[0].hops}, flow=$${loopTierCRows[0].total_flow.toLocaleString()})`,
    );
  }
  if (multiSourceRows[0]) {
    console.log(
      `  Multi-Source: BN ${multiSourceRows[0].bn} (${multiSourceRows[0].legal_name}, concern=${multiSourceRows[0].concern_score})`,
    );
  }

  // 쿼리 타이밍 요약
  console.log('');
  console.log('--- 쿼리 타이밍 ---');
  for (const [k, v] of Object.entries(queryTimings)) {
    console.log(`  ${k.padEnd(28)} ${v}ms`);
  }

  console.log('');
  console.log('[sample-entities] 완료 — exit 0');

  await sql.end({ timeout: 5 });
  process.exit(0);
}

main().catch(async (err) => {
  console.error('[sample-entities] FATAL:', err);
  try {
    const { sql } = await import('../apps/web/lib/db/client');
    await sql.end({ timeout: 5 });
  } catch {
    // ignore
  }
  process.exit(1);
});
