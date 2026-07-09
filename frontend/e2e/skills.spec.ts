import { test, expect } from '@playwright/test';
import { mockApi } from './mocks';

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test('guest can browse the class list', async ({ page }) => {
  await page.goto('/skills');
  // class names render as one link with each stage in its own span
  await expect(
    page.getByRole('link', { name: /Knight.*Paladin.*Dragoon/ }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: /Monk.*Priest.*Cleric/ }),
  ).toBeVisible();
});

test('guest can allocate SP and prerequisites unlock', async ({ page }) => {
  await page.goto('/skills/21');

  const hammer = page.getByRole('button', { name: /Hammer Crush/ });
  const storm = page.getByRole('button', { name: /Storm Blade/ });
  await expect(hammer).toBeVisible();

  // one click = one point; the SP counter and the level pill both move
  await hammer.click();
  await expect(hammer).toHaveAccessibleName('Hammer Crush 1/5');

  // keyboard: Enter adds, Delete removes (a11y path)
  await hammer.focus();
  await page.keyboard.press('Enter');
  await expect(hammer).toHaveAccessibleName('Hammer Crush 2/5');
  await page.keyboard.press('Delete');
  await expect(hammer).toHaveAccessibleName('Hammer Crush 1/5');

  // prerequisite met (Hammer 1) → Storm Blade can take a point
  await storm.click();
  await expect(storm).toHaveAccessibleName('Storm Blade 1/5');
});

test('guest save is routed to login with a return URL', async ({ page }) => {
  await page.goto('/skills/21');
  await page.getByRole('button', { name: /Hammer Crush/ }).click();
  await page.getByRole('button', { name: /sign in to save/i }).click();
  await expect(page).toHaveURL(/\/login\?next=%2Fskills%2F21%3Fb%3D/);
});

test('community gallery renders public builds for guests', async ({ page }) => {
  await page.goto('/skills/community');
  await expect(page.getByText('Tanky Dragoon')).toBeVisible();
  await expect(page.getByText('flok')).toBeVisible();
});
