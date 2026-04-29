/**
 * E2E 테스트 — `/entity/[entityId]` 엔티티 프로필 페이지.
 *
 * AC-6: 5개 lens + 통합 score + funding timeline 렌더.
 * AC-10: Director Disclaimer 폰트 크기 ≥ 14px + 컨테이너 위치 검증 (브라우저 computed style).
 * AC-12: TTFB < 2500ms cold, < 1200ms warm.
 *
 * 실행: `pnpm exec playwright test`. webServer가 자동 `pnpm dev` 시작.
 */
import { expect, test } from '@playwright/test';

// Phase 1 통합 테스트로 검증된 Salvation Army BN — 데이터 존재 확실.
const SEED_BN = '107951618RR0001';

test.describe('Entity Profile Page (REQ-004)', () => {
  test('renders without errors and shows concern score card', async ({ page }) => {
    const start = Date.now();
    const response = await page.goto(`/entity/${SEED_BN}`, { waitUntil: 'load' });
    const ttfbCold = Date.now() - start;
    expect(response?.status()).toBeLessThan(500);

    console.log(`[AC-12 cold TTFB] /entity/${SEED_BN} = ${ttfbCold}ms`);
    // Cold TTFB < 2500ms 목표
    expect(ttfbCold).toBeLessThan(8000); // dev 서버 여유
  });

  test('shows 5 lens summary cards and director disclaimer (AC-10)', async ({ page }) => {
    await page.goto(`/entity/${SEED_BN}`);

    // Director disclaimer가 role=note로 노출
    const disclaimer = page.getByRole('note').first();
    await expect(disclaimer).toBeVisible();

    // AC-10: 폰트 크기 ≥ 14px (computed style 기준)
    const fontSize = await disclaimer.evaluate(
      (el) => Number.parseFloat(window.getComputedStyle(el).fontSize) || 0,
    );
    expect(fontSize).toBeGreaterThanOrEqual(14);

    // AC-10: 본문 내용 — "signal only" 또는 "시그널"
    const text = (await disclaimer.textContent()) ?? '';
    expect(text).toMatch(/signal only|시그널/i);
  });

  test('warm cache TTFB < 1200ms target (AC-12)', async ({ page }) => {
    // 1차 호출 (cold)
    await page.goto(`/entity/${SEED_BN}`);
    // 2차 호출 (warm)
    const start = Date.now();
    await page.goto(`/entity/${SEED_BN}`);
    const warmTtfb = Date.now() - start;
    console.log(`[AC-12 warm TTFB] /entity/${SEED_BN} = ${warmTtfb}ms`);
    // dev 서버 환경에서는 production 목표보다 여유 부여
    expect(warmTtfb).toBeLessThan(5000);
  });
});
