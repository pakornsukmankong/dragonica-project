// Authoritative skill-build validation. Pure functions (no Nest/DB deps) so the
// same rules can be mirrored on the frontend for live UX. The server runs this
// on save; a client cannot persist an illegal build.

export interface SkillLevel {
  level: number;
  reqLevel: number; // character level required to reach this skill level
  sp: number; // skill points this level costs to learn
}

// A prerequisite: skill `id` must be at least `level` before this skill unlocks.
export interface SkillPrereq {
  id: number;
  level: number;
}

export interface SkillDef {
  id: number;
  maxLevel: number;
  reqLevel: number; // character level to learn level 1
  prerequisites: SkillPrereq[]; // other skills that must be leveled first
  classBits: number[]; // which classes may learn it
  levels: SkillLevel[];
}

export type Allocations = Record<string, number>; // skillId -> points

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  spSpent: number;
  spAvailable: number;
}

// Skill points a character has earned by a given level. Warriors start with 10,
// other base classes with 15; every level adds 20 (spidpex/Landverse rule).
export const SP_PER_LEVEL = 20;
export function spBaseForClass(classId: number): number {
  return classId === 21 || classId === 22 ? 10 : 15;
}
// `bonus` = extra SP the player added by hand (quest/event SP not derived from
// level), matching the sim's `+ plus` term.
export function availableSkillPoints(
  charLevel: number,
  spBase = 10,
  bonus = 0,
): number {
  if (charLevel < 1) return Math.max(0, bonus);
  return spBase + (charLevel - 1) * SP_PER_LEVEL + Math.max(0, bonus);
}

// SP cost to raise a skill to `points`: the sum of each level's own sp cost
// (levels are 1-indexed by their array position).
export function skillSpCost(skill: SkillDef, points: number): number {
  let c = 0;
  for (let i = 0; i < points && i < skill.levels.length; i++) {
    c += skill.levels[i]?.sp ?? 0;
  }
  return c;
}

// How many points a skill can hold at a given character level, honouring the
// per-level unlock ladder (e.g. Dragon Scale lv2 needs char lv62).
export function maxPointsAtLevel(skill: SkillDef, charLevel: number): number {
  const byLadder = skill.levels.filter((l) => l.reqLevel <= charLevel).length;
  return Math.min(
    skill.maxLevel,
    byLadder || (charLevel >= skill.reqLevel ? skill.maxLevel : 0),
  );
}

export function validateBuild(
  skills: SkillDef[],
  charLevel: number,
  allocations: Allocations,
  spBase = 10,
  bonus = 0,
): ValidationResult {
  const errors: string[] = [];
  const byId = new Map(skills.map((s) => [s.id, s]));
  let spSpent = 0;

  for (const [rawId, rawPoints] of Object.entries(allocations)) {
    const id = Number(rawId);
    const points = Number(rawPoints);
    const skill = byId.get(id);

    if (!skill) {
      errors.push(`skill ${id} is not available for this class`);
      continue;
    }
    if (!Number.isInteger(points) || points < 0) {
      errors.push(`skill ${id} has invalid points`);
      continue;
    }
    if (points === 0) continue;
    spSpent += skillSpCost(skill, points);

    if (points > skill.maxLevel) {
      errors.push(`${id}: ${points} exceeds max level ${skill.maxLevel}`);
    }
    const allowed = maxPointsAtLevel(skill, charLevel);
    if (points > allowed) {
      errors.push(`${id}: level ${points} needs a higher character level`);
    }
    for (const pre of skill.prerequisites) {
      const parentPoints = Number(allocations[String(pre.id)] ?? 0);
      if (parentPoints < pre.level) {
        errors.push(`${id}: requires skill ${pre.id} at level ${pre.level}`);
      }
    }
  }

  const spAvailable = availableSkillPoints(charLevel, spBase, bonus);
  if (spSpent > spAvailable) {
    errors.push(
      `not enough skill points: spent ${spSpent}, have ${spAvailable}`,
    );
  }

  return { valid: errors.length === 0, errors, spSpent, spAvailable };
}
