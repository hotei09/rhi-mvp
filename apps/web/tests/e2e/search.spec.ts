/**
 * E2E 테스트 — 글로벌 검색 박스 (AC-7).
 *
 * 검색 입력 → 드롭다운 결과 → 클릭 시 /entity/[bn] 이동
 */
import { expect, test } from '@playwright/test';

test.describe('Global Search Box (AC-7)', () => {
  test('search api returns results for valid query', async ({ request }) => {
    const response = await request.get('/api/search?q=salvation');
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      results: Array<{ canonical_name: string; bn_root: string }>;
    };
    expect(Array.isArray(body.results)).toBe(true);
  });

  test('search api returns 400 on missing query', async ({ request }) => {
    const response = await request.get('/api/search');
    expect(response.status()).toBe(400);
  });

  test('search box on landing page is visible and usable', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load', timeout: 30_000 });
    // search-box 컴포넌트는 'data-testid="global-search"'를 노출
    const searchBox = page.getByTestId('global-search-input');
    await expect(searchBox).toBeVisible();
    await searchBox.fill('salvation');
    // 결과 드롭다운 표시 (debounce 300ms 후)
    await page.waitForTimeout(800);
    const results = page.getByTestId('global-search-results');
    await expect(results).toBeVisible();
  });
});
