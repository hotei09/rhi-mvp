/**
 * 통합 테스트 — 랜딩 페이지 high concern ranking (REQ-005 Statement A).
 *
 * Given Render PG replica 가용 + 5개 lens 함수 동작
 * When `getLandingRanking()` 호출
 * Then top N 엔티티 반환, 정부 엔티티 제외 (AC-9), score/tier/legal_name 모두 채워짐
 *
 * 매핑: SPEC-RHI-001 REQ-005 Statement A, AC-9
 */
import '../setup-env';
import { afterAll, describe, expect, it } from 'vitest';

afterAll(async () => {
  const { sql } = await import('@/lib/db/client');
  await sql.end({ timeout: 5 });
});

describe('getLandingRanking — REQ-005 Statement A', () => {
  it('returns up to 50 entries', async () => {
    const { getLandingRanking } = await import('@/lib/ranking/landing');
    const rows = await getLandingRanking({ limit: 50 });
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeLessThanOrEqual(50);
  }, 30_000);

  it('all entries have score, tier, legal_name, bn fields', async () => {
    const { getLandingRanking } = await import('@/lib/ranking/landing');
    const rows = await getLandingRanking({ limit: 20 });
    for (const r of rows) {
      expect(typeof r.bn).toBe('string');
      expect(typeof r.legal_name).toBe('string');
      expect(typeof r.score).toBe('number');
      expect(typeof r.tier).toBe('string');
    }
  }, 30_000);

  it('results are sorted by score descending', async () => {
    const { getLandingRanking } = await import('@/lib/ranking/landing');
    const rows = await getLandingRanking({ limit: 20 });
    if (rows.length > 1) {
      for (let i = 1; i < rows.length; i++) {
        const prev = rows[i - 1];
        const curr = rows[i];
        if (prev && curr) {
          expect(prev.score).toBeGreaterThanOrEqual(curr.score);
        }
      }
    }
  }, 30_000);

  it('government entities are excluded (AC-9)', async () => {
    const { getLandingRanking } = await import('@/lib/ranking/landing');
    const rows = await getLandingRanking({ limit: 50 });
    const govPatterns = [
      /^Government of /i,
      /Health Authority/i,
      /Crown Corporation/i,
      /^City of /i,
      /^Town of /i,
      /^Municipality of /i,
    ];
    for (const r of rows) {
      for (const p of govPatterns) {
        expect(p.test(r.legal_name)).toBe(false);
      }
    }
  }, 30_000);
});
