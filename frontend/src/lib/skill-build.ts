// Client-side mirror of the backend skill-build validator (kept deliberately in
// sync with backend/src/skill/skill-build.validator.ts) for live UX. The server
// re-validates on save, so this is only for instant feedback.

import type { Skill } from '@/types';

// Warriors start with 10 SP, other bases with 15; +20 per level.
export const SP_PER_LEVEL = 20;

export function spBaseForClass(classId: number): number {
  return classId === 21 || classId === 22 ? 10 : 15;
}

// `bonus` = extra SP the player added by hand (quests/events).
export function availableSkillPoints(
  charLevel: number,
  spBase = 10,
  bonus = 0,
): number {
  const b = Math.max(0, bonus);
  if (charLevel < 1) return b;
  return spBase + (charLevel - 1) * SP_PER_LEVEL + b;
}

// SP cost to raise a skill to `points` = sum of each level's own sp cost.
export function skillSpCost(skill: Skill, points: number): number {
  let c = 0;
  for (let i = 0; i < points && i < skill.levels.length; i++)
    c += skill.levels[i]?.sp ?? 0;
  return c;
}

// How many points a skill can hold at a character level, honouring its per-level
// unlock ladder (e.g. Dragon Scale lv2 needs char lv62).
export function maxPointsAtLevel(skill: Skill, charLevel: number): number {
  const byLadder = skill.levels.filter((l) => l.reqLevel <= charLevel).length;
  return Math.min(
    skill.max_level,
    byLadder || (charLevel >= skill.req_level ? skill.max_level : 0),
  );
}

export type Allocations = Record<string, number>;

export interface BuildState {
  classId: number;
  charLevel: number;
  allocations: Allocations;
  bonusSp?: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  spSpent: number;
  spAvailable: number;
}

// Total SP spent = sum of each allocated skill's sp cost for its levels.
export function spSpent(skills: Skill[], allocations: Allocations): number {
  const byId = new Map(skills.map((s) => [s.id, s]));
  let total = 0;
  for (const [id, pts] of Object.entries(allocations)) {
    const s = byId.get(Number(id));
    if (s) total += skillSpCost(s, Number(pts) || 0);
  }
  return total;
}

// Can we add one more point to this skill right now? Returns a reason if not.
export function canIncrement(
  skill: Skill,
  charLevel: number,
  allocations: Allocations,
  skills: Skill[],
  spBase = 10,
  bonus = 0,
): { ok: boolean; reason?: string } {
  const cur = Number(allocations[skill.id] ?? 0);
  if (cur >= skill.max_level) return { ok: false, reason: 'max' };
  if (cur + 1 > maxPointsAtLevel(skill, charLevel))
    return { ok: false, reason: 'level' };
  for (const pre of skill.prerequisites ?? []) {
    if (Number(allocations[pre.id] ?? 0) < pre.level)
      return { ok: false, reason: 'prereq' };
  }
  const cost = skill.levels[cur]?.sp ?? 0;
  if (
    spSpent(skills, allocations) + cost >
    availableSkillPoints(charLevel, spBase, bonus)
  )
    return { ok: false, reason: 'sp' };
  return { ok: true };
}

export function validateBuild(
  skills: Skill[],
  charLevel: number,
  allocations: Allocations,
  spBase = 10,
  bonus = 0,
): ValidationResult {
  const errors: string[] = [];
  const byId = new Map(skills.map((s) => [s.id, s]));
  let spent = 0;

  for (const [rawId, rawPoints] of Object.entries(allocations)) {
    const id = Number(rawId);
    const points = Number(rawPoints);
    const skill = byId.get(id);
    if (!skill) {
      errors.push(`skill ${id} is not available for this class`);
      continue;
    }
    if (points <= 0) continue;
    spent += skillSpCost(skill, points);
    if (points > skill.max_level)
      errors.push(`${skill.name}: exceeds max level ${skill.max_level}`);
    if (points > maxPointsAtLevel(skill, charLevel))
      errors.push(`${skill.name}: needs a higher character level`);
    for (const pre of skill.prerequisites ?? []) {
      if (Number(allocations[pre.id] ?? 0) < pre.level)
        errors.push(`${skill.name}: requires a prerequisite skill`);
    }
  }

  const spAvailable = availableSkillPoints(charLevel, spBase, bonus);
  if (spent > spAvailable)
    errors.push(`not enough skill points (${spent}/${spAvailable})`);

  return { valid: errors.length === 0, errors, spSpent: spent, spAvailable };
}

// --- share encoding ----------------------------------------------------------
// Compact, URL-safe encoding so a build can be shared before it is ever saved.

export function encodeBuild(state: BuildState): string {
  const json = JSON.stringify([
    state.classId,
    state.charLevel,
    Object.entries(state.allocations).filter(([, p]) => p > 0),
    state.bonusSp ?? 0,
  ]);
  return typeof window === 'undefined'
    ? Buffer.from(json).toString('base64url')
    : btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeBuild(code: string): BuildState | null {
  try {
    const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
    const json = typeof window === 'undefined'
      ? Buffer.from(b64, 'base64').toString()
      : atob(b64);
    const [classId, charLevel, entries, bonusSp] = JSON.parse(json);
    const allocations: Allocations = {};
    for (const [id, p] of entries) allocations[id] = p;
    return { classId, charLevel, allocations, bonusSp: bonusSp ?? 0 };
  } catch {
    return null;
  }
}
