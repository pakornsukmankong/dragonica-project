import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Auth: /grind is behind the middleware, which reads the Supabase session
// from the auth cookie locally (no network call — see src/middleware.ts).
// A well-formed cookie with an unexpired (unsigned) JWT is enough to route
// through; every API call the page then makes is mocked below.
// ---------------------------------------------------------------------------

// Cookie name is sb-<project-ref>-auth-token. CI exports the env var; local
// runs fall back to parsing frontend/.env like `next dev` does.
function supabaseRef(): string {
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
    url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(\S+)/)?.[1];
  }
  const ref = url?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
  if (!ref) throw new Error('Cannot determine Supabase project ref');
  return ref;
}

const b64url = (s: string) =>
  Buffer.from(s).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function fakeSessionCookie() {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const jwt = [
    b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' })),
    b64url(JSON.stringify({ sub: 'e2e-user', role: 'authenticated', exp })),
    'e2e-signature',
  ].join('.');
  const session = {
    access_token: jwt,
    refresh_token: 'e2e-refresh',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: exp,
    user: {
      id: 'e2e-user',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'e2e@example.com',
      app_metadata: {},
      user_metadata: {},
      created_at: '2026-01-01T00:00:00Z',
    },
  };
  // @supabase/ssr v0.5 stores the session as base64url JSON with this prefix.
  return `base64-${b64url(JSON.stringify(session))}`;
}

const DUNGEONS = [
  { id: 'd1', name: 'Bearded Whale Coast', image_url: null },
  { id: 'd2', name: 'Van Cliff Fortress', image_url: null },
  { id: 'd3', name: 'Drakos', image_url: null },
];

const CHARACTERS = [
  { id: 'c1', name: 'Floki', level: 60, class_id: 21, user_id: 'e2e-user' },
];

async function mockGrindApi(
  page: Page,
  onSessionPost: (body: unknown) => void,
  onDropPost: (body: unknown) => void = () => {},
  dbItems: unknown[] = [],
) {
  await page.route('**/api/game-data/dungeons', (route) =>
    route.fulfill({ json: DUNGEONS }),
  );
  await page.route('**/api/characters', (route) =>
    route.fulfill({ json: CHARACTERS }),
  );
  // Items already ensured into the backend table (sorted first in the picker).
  await page.route('**/api/game-data/items', (route) =>
    route.fulfill({ json: dbItems }),
  );
  // Find-or-create for a game-database pick; echo the requested item back.
  await page.route('**/api/game-data/items/ensure', (route) => {
    const body = route.request().postDataJSON() as {
      gameItemId: number;
      name: string;
      rarity?: string;
      icon?: unknown;
    };
    return route.fulfill({
      json: {
        id: `item-${body.gameItemId}`,
        name: body.name,
        rarity: body.rarity ?? null,
        game_item_id: body.gameItemId,
        icon: body.icon ?? null,
      },
    });
  });
  await page.route('**/api/sessions/drops', (route) => {
    onDropPost(route.request().postDataJSON());
    return route.fulfill({ json: { id: 'sd1' } });
  });
  await page.route('**/api/sessions', (route) => {
    onSessionPost(route.request().postDataJSON());
    return route.fulfill({ json: { id: 's1' } });
  });
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

test('dungeon autocomplete filters as you type and commits a selection', async ({ page }) => {
  await mockGrindApi(page, () => {});
  await page.goto('/grind');
  await expect(page.getByRole('heading', { name: 'Grind Tracker' })).toBeVisible();

  const combo = page.getByPlaceholder('Type to search dungeons...');
  await combo.click();
  // Full list first, then narrowed by the query.
  await expect(page.getByRole('option')).toHaveCount(3);
  await combo.fill('cliff');
  await expect(page.getByRole('option')).toHaveCount(1);
  await expect(page.getByRole('option', { name: 'Van Cliff Fortress' })).toBeVisible();

  await page.keyboard.press('Enter');
  await expect(combo).toHaveValue('Van Cliff Fortress');
  await expect(page.getByRole('listbox')).toHaveCount(0);
});

test('saving a session sends the picked dungeon and the note', async ({ page }) => {
  let posted: Record<string, unknown> | undefined;
  await mockGrindApi(page, (body) => {
    posted = body as Record<string, unknown>;
  });
  await page.goto('/grind');

  // Dungeon via autocomplete.
  const combo = page.getByPlaceholder('Type to search dungeons...');
  await combo.fill('drakos');
  await page.getByRole('option', { name: 'Drakos' }).click();
  await expect(combo).toHaveValue('Drakos');

  // Character via the Radix select.
  await page.getByText('Select character...').click();
  await page.getByRole('option', { name: 'Floki (Lv.60)' }).click();

  // Note.
  await page.getByLabel('Note').fill('full party, xp event');

  await page.getByRole('button', { name: 'Save Session' }).click();
  await expect(page.getByText('Session saved', { exact: true })).toBeVisible();

  expect(posted).toMatchObject({
    characterId: 'c1',
    dungeonId: 'd3',
    note: 'full party, xp event',
  });
});

test('item drops: pick from the game database and save the drop', async ({ page }) => {
  let postedDrop: Record<string, unknown> | undefined;
  await mockGrindApi(
    page,
    () => {},
    (body) => {
      postedDrop = body as Record<string, unknown>;
    },
  );
  await page.goto('/grind');

  // Search the static game item database (served from /public/data).
  const search = page.getByPlaceholder('Search the item database...');
  await expect(search).toBeEnabled(); // waits for the item DB to load
  await search.fill('dark soul crossbow');
  await page.getByRole('option', { name: 'Dark Soul CrossBow', exact: true }).click();

  // The pick becomes a drop row (qty 1, price intentionally left at 0).
  const row = page.getByRole('row').filter({ hasText: 'Dark Soul CrossBow' });
  await expect(row).toBeVisible();

  // Removing works, and picking again re-adds it.
  await row.getByRole('button', { name: /remove/i }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Dark Soul CrossBow' })).toHaveCount(0);
  await search.fill('dark soul crossbow');
  await page.getByRole('option', { name: 'Dark Soul CrossBow', exact: true }).click();

  // Save with a character picked; the drop goes to /sessions/drops.
  await page.getByText('Select character...').click();
  await page.getByRole('option', { name: 'Floki (Lv.60)' }).click();
  await page.getByRole('button', { name: 'Save Session' }).click();
  await expect(page.getByText('Session saved', { exact: true })).toBeVisible();

  expect(postedDrop).toMatchObject({
    sessionId: 's1',
    quantity: 1,
    priceEach: 0,
  });
  expect(String(postedDrop?.itemId)).toMatch(/^item-\d+$/);
});

test('items already in the database sort to the top of the item search', async ({ page }) => {
  // Pretend one real game item was logged before: it should lead the list.
  const equipment = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, '..', 'public', 'data', 'items', 'equipment.json'),
      'utf8',
    ),
  ) as { id: number; name: string; icon: unknown }[];
  const crossbow = equipment.find((it) => it.name === 'Dark Soul CrossBow')!;

  let ensured: Record<string, unknown> | undefined;
  await mockGrindApi(page, () => {}, () => {}, [
    {
      id: 'db-row-1',
      name: crossbow.name,
      game_item_id: crossbow.id,
      icon: crossbow.icon,
      icon_url: null,
      rarity: null,
      default_price: 0,
    },
  ]);
  await page.route('**/api/game-data/items/ensure', (route) => {
    ensured = route.request().postDataJSON() as Record<string, unknown>;
    return route.fulfill({
      json: { id: 'db-row-1', name: crossbow.name, game_item_id: crossbow.id },
    });
  });
  await page.goto('/grind');

  const search = page.getByPlaceholder('Search the item database...');
  await expect(search).toBeEnabled();
  await search.click();
  // 29k+ items in the database, but the previously logged one leads the list.
  await expect(page.getByRole('option').first()).toHaveText('Dark Soul CrossBow');

  // Picking it sends the sprite-atlas icon along, so the row stores it.
  await page.getByRole('option').first().click();
  await expect(
    page.getByRole('row').filter({ hasText: 'Dark Soul CrossBow' }),
  ).toBeVisible();
  expect(ensured).toMatchObject({
    gameItemId: crossbow.id,
    icon: crossbow.icon as Record<string, unknown>,
  });
});
