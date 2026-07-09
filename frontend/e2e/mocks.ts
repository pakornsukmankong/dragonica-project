import type { Page } from '@playwright/test';

// Minimal but shape-accurate API fixtures (see src/types Skill/SkillClass).
export const CLASSES = [
  {
    id: 21,
    base_class: 'Warrior',
    name: 'Knight → Paladin → Dragoon',
    slug: 'dragoon',
    sort_order: 1,
  },
  {
    id: 23,
    base_class: 'Magician',
    name: 'Monk → Priest → Cleric',
    slug: 'cleric',
    sort_order: 3,
  },
];

// 1 SP per level so a level-1 character (10 SP budget) can afford several
// points during a test.
const levels = (sp: number, max: number) =>
  Array.from({ length: max }, (_, i) => ({
    level: i + 1,
    reqLevel: 1,
    sp,
    mp: 5,
    cooldown: 1000,
  }));

export const SKILLS = [
  {
    id: 1,
    name: 'Hammer Crush',
    description: 'Smash the ground.',
    icon_url: '/skill-icons/1.webp',
    type: 0,
    class_bits: [21],
    base_class: 'Warrior',
    req_level: 1,
    max_level: 5,
    prerequisites: [],
    positions: { '21': [0, 0, 0] },
    weapon_limit: 0,
    levels: levels(1, 5),
  },
  {
    id: 2,
    name: 'Storm Blade',
    description: 'A whirling strike.',
    icon_url: '/skill-icons/2.webp',
    type: 0,
    class_bits: [21],
    base_class: 'Warrior',
    req_level: 1,
    max_level: 5,
    // locked until Hammer Crush has 1 point
    prerequisites: [{ id: 1, level: 1 }],
    positions: { '21': [0, 0, 1] },
    weapon_limit: 0,
    levels: levels(1, 5),
  },
];

export const COMMUNITY_BUILDS = [
  {
    id: 'b1',
    share_slug: 'aaaa1111',
    name: 'Tanky Dragoon',
    description: 'Max survivability.',
    class_id: 21,
    char_level: 60,
    like_count: 4,
    view_count: 120,
    comment_count: 2,
    created_at: '2026-07-01T00:00:00Z',
    profiles: { username: 'flok' },
    skill_classes: { name: 'Knight → Paladin → Dragoon', base_class: 'Warrior' },
  },
];

/** Intercept every backend call the smoke suite touches. */
export async function mockApi(page: Page) {
  await page.route('**/api/skills/classes', (route) =>
    route.fulfill({ json: CLASSES }),
  );
  await page.route('**/api/skills/classes/21', (route) =>
    route.fulfill({ json: { class: CLASSES[0], skills: SKILLS } }),
  );
  await page.route('**/api/skills/community**', (route) =>
    route.fulfill({
      json: { builds: COMMUNITY_BUILDS, total: 1, page: 1, pageSize: 24 },
    }),
  );
  await page.route('**/api/skills/me/builds', (route) =>
    route.fulfill({ status: 401, json: { message: 'Unauthorized' } }),
  );
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({ status: 401, json: { message: 'Unauthorized' } }),
  );
  await page.route('**/api/stats/**', (route) =>
    route.fulfill({ json: { total: 1 } }),
  );
}
