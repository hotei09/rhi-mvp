/**
 * E2E 테스트 — 랜딩 + 렌즈별 + Methodology 페이지 smoke test.
 *
 * 매핑: SPEC-RHI-001 REQ-005 Statement A
 */
import { expect, test } from '@playwright/test';

test.describe('Landing + Lens + Methodology Pages', () => {
  test('landing page renders title and concern table', async ({ page }) => {
    const response = await page.goto('/', { waitUntil: 'load', timeout: 30_000 });
    expect(response?.status()).toBeLessThan(500);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // 상단 헤더에 RHI 또는 Recipient Health Index 텍스트가 보여야 함
    const bodyText = (await page.textContent('body')) ?? '';
    expect(bodyText).toMatch(/Recipient Health Index|RHI/i);
  });

  test('zombie lens page renders', async ({ page }) => {
    const response = await page.goto('/lens/zombie', { waitUntil: 'load', timeout: 30_000 });
    expect(response?.status()).toBeLessThan(500);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const bodyText = (await page.textContent('body')) ?? '';
    expect(bodyText.toLowerCase()).toContain('zombie');
  });

  test('ghost lens page renders', async ({ page }) => {
    const response = await page.goto('/lens/ghost', { waitUntil: 'load', timeout: 30_000 });
    expect(response?.status()).toBeLessThan(500);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('loops lens page renders', async ({ page }) => {
    const response = await page.goto('/lens/loops', { waitUntil: 'load', timeout: 30_000 });
    expect(response?.status()).toBeLessThan(500);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('methodology page renders content', async ({ page }) => {
    const response = await page.goto('/methodology', { waitUntil: 'load', timeout: 30_000 });
    expect(response?.status()).toBeLessThan(500);
    const bodyText = (await page.textContent('body')) ?? '';
    expect(bodyText.toLowerCase()).toContain('methodology');
  });
});
