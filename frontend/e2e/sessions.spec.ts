import { test, expect, type Page } from '@playwright/test';
import { supabaseRef, fakeSessionCookie } from './auth-helpers';

// The sessions list is paginated and filtered SERVER-side: the page asks for
// `/sessions?page=N&limit=10[&filters]` and renders `{ data, total }` as-is.

const CHARACTERS = [
  { id: 'c1', name: 'Floki', level: 60, class_id: 21, user_id: 'e2e-user' },
];

function makeSession(i: number) {
  return {
    id: `s${i}`,
    user_id: 'e2e-user',
    character_id: 'c1',
    dungeon_id: null,
    started_at: `2026-07-0${(i % 9) + 1}T10:00:00Z`,
    ended_at: null,
    duration_minutes: 60,
    gold_earned: 1000 * i,
    gold_dropped: 0,
    note: null,
    created_at: `2026-07-0${(i % 9) + 1}T10:00:00Z`,
    characters: { ...CHARACTERS[0], classes: { id: 'cl1', name: 'Knight' } },
    dungeons: null,
    session_drops: [],
  };
}

async function mockSessionsApi(page: Page, requests: URL[]) {
  await page.route('**/api/sessions?*', (route) => {
    const url = new URL(route.request().url());
    requests.push(url);
    const pageNo = Number(url.searchParams.get('page') ?? '1');
    const limit = Number(url.searchParams.get('limit') ?? '10');
    // 25 sessions total; slice the requested window like the server would.
    const total = 25;
    const from = (pageNo - 1) * limit;
    const data = Array.from(
      { length: Math.max(0, Math.min(limit, total - from)) },
      (_, i) => makeSession(from + i + 1),
    );
    return route.fulfill({ json: { data, total } });
  });
  await page.route('**/api/characters', (route) =>
    route.fulfill({ json: CHARACTERS }),
  );
  await page.route('**/api/game-data/items', (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({ json: { id: 'e2e-user', email: 'e2e@example.com' } }),
  );
}

test.beforeEach(async ({ context }) => {
  await context.addCookies([
    {
      name: `sb-${supabaseRef()}-auth-token`,
      value: fakeSessionCookie(),
      domain: 'localhost',
      path: '/',
    },
  ]);
});

test('sessions list pages on the server and sends filters as query params', async ({ page }) => {
  const requests: URL[] = [];
  await mockSessionsApi(page, requests);
  await page.goto('/sessions');

  // Page 1: the server's total drives the count and page indicator.
  await expect(page.getByText('Showing 25 sessions')).toBeVisible();
  await expect(page.getByText('Page 1 of 3')).toBeVisible();
  const firstList = requests.find((u) => u.searchParams.get('page') === '1');
  expect(firstList?.searchParams.get('limit')).toBe('10');

  // Next page asks the server for page=2 instead of slicing locally.
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.getByText('Page 2 of 3')).toBeVisible();
  expect(requests.some((u) => u.searchParams.get('page') === '2')).toBe(true);

  // Picking a character filter is sent as a query param and resets to page 1.
  requests.length = 0;
  await page.getByText('All Characters').click();
  await page.getByRole('option', { name: 'Floki' }).click();
  await expect
    .poll(() =>
      requests.some(
        (u) =>
          u.searchParams.get('characterId') === 'c1' &&
          u.searchParams.get('page') === '1',
      ),
    )
    .toBe(true);
});
