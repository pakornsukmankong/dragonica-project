import {
  SkillDef,
  availableSkillPoints,
  maxPointsAtLevel,
  skillSpCost,
  spBaseForClass,
  validateBuild,
} from './skill-build.validator';

// A leveled skill: 5 levels, learnable at 60, each level costs 10 sp.
const dragonScale: SkillDef = {
  id: 1,
  maxLevel: 5,
  reqLevel: 60,
  prerequisites: [],
  classBits: [21],
  levels: [
    { level: 1, reqLevel: 60, sp: 10 },
    { level: 2, reqLevel: 62, sp: 10 },
    { level: 3, reqLevel: 64, sp: 10 },
    { level: 4, reqLevel: 66, sp: 10 },
    { level: 5, reqLevel: 68, sp: 10 },
  ],
};

// A skill gated behind dragonScale at level 2; each level costs 20 sp.
const advanced: SkillDef = {
  id: 2,
  maxLevel: 3,
  reqLevel: 65,
  prerequisites: [{ id: 1, level: 2 }],
  classBits: [21],
  levels: [
    { level: 1, reqLevel: 65, sp: 20 },
    { level: 2, reqLevel: 67, sp: 20 },
    { level: 3, reqLevel: 69, sp: 20 },
  ],
};

const skills = [dragonScale, advanced];

describe('availableSkillPoints', () => {
  it('grants base at level 1, then +20 per level', () => {
    expect(availableSkillPoints(1)).toBe(10); // Warrior base
    expect(availableSkillPoints(1, 15)).toBe(15); // other bases
    expect(availableSkillPoints(70)).toBe(1390);
    expect(availableSkillPoints(70, 15)).toBe(1395);
  });
  it('picks the base from the class bit', () => {
    expect(spBaseForClass(21)).toBe(10);
    expect(spBaseForClass(24)).toBe(15);
  });
});

describe('skillSpCost', () => {
  it('sums each per-level sp cost', () => {
    expect(skillSpCost(dragonScale, 3)).toBe(30); // 10+10+10
    expect(skillSpCost(advanced, 2)).toBe(40); // 20+20
  });
});

describe('maxPointsAtLevel', () => {
  it('honours the per-level unlock ladder', () => {
    expect(maxPointsAtLevel(dragonScale, 59)).toBe(0);
    expect(maxPointsAtLevel(dragonScale, 60)).toBe(1);
    expect(maxPointsAtLevel(dragonScale, 63)).toBe(2);
    expect(maxPointsAtLevel(dragonScale, 100)).toBe(5);
  });
});

describe('validateBuild', () => {
  it('accepts a legal allocation and totals sp cost', () => {
    const r = validateBuild(skills, 70, { '1': 5, '2': 3 });
    expect(r.valid).toBe(true);
    expect(r.spSpent).toBe(5 * 10 + 3 * 20); // 110
  });

  it('rejects points above the skill max level', () => {
    const r = validateBuild(skills, 100, { '1': 6 });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('exceeds max level'))).toBe(true);
  });

  it('rejects a level the character has not reached', () => {
    const r = validateBuild(skills, 61, { '1': 3 });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('higher character level'))).toBe(
      true,
    );
  });

  it('rejects a skill whose prerequisite is not learned', () => {
    const r = validateBuild(skills, 70, { '2': 1 });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('requires skill'))).toBe(true);
  });

  it('rejects a prerequisite that is under the required level', () => {
    const r = validateBuild(skills, 70, { '1': 1, '2': 1 });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('level 2'))).toBe(true);
  });

  it('accepts a skill once its prerequisite level is met', () => {
    const r = validateBuild(skills, 70, { '1': 2, '2': 1 });
    expect(r.valid).toBe(true);
  });

  it('rejects an unknown skill for the class', () => {
    const r = validateBuild(skills, 70, { '999': 1 });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('not available'))).toBe(true);
  });

  it('rejects spending more sp than earned', () => {
    // learnable at level 1, 5 levels of 10 sp = 50; at char level 1 only 10 sp.
    const cheap: SkillDef = {
      id: 3,
      maxLevel: 5,
      reqLevel: 1,
      prerequisites: [],
      classBits: [21],
      levels: Array.from({ length: 5 }, (_, i) => ({
        level: i + 1,
        reqLevel: 1,
        sp: 10,
      })),
    };
    const r = validateBuild([cheap], 1, { '3': 5 });
    expect(r.spSpent).toBe(50);
    expect(r.spAvailable).toBe(10);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('skill points'))).toBe(true);
  });
});
