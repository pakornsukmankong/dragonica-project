import { test, expect } from '@playwright/test';
import { mockApi } from './mocks';

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test('landing renders the hero and skill preview', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  // the simulator preview mock ships real skill icons
  await expect(page.locator('img[src*="/skill-icons/"]').first()).toBeVisible();
});

test('landing CTA leads to the skill simulator', async ({ page }) => {
  await page.goto('/');
  // keyboard activation — the CTA's hover:scale animation makes pointer
  // clicks flaky (element never reports stable)
  await page
    .getByRole('link', { name: /skill simulator|จัดสกิล/i })
    .press('Enter');
  await expect(page).toHaveURL(/\/skills$/);
});
