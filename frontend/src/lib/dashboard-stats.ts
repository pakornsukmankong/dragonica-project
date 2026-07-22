// Client-side dashboard aggregations.
//
// The dashboard fetches every session once (GET /sessions) and lets the user
// narrow them to a date range. Deriving the summary / character / dungeon
// stats from that same filtered list keeps the whole page consistent with a
// single filter, instead of each block querying its own unfiltered endpoint.
//
// The math mirrors the backend DashboardService so numbers match when no
// filter is applied.

import type {
  CharacterStat,
  DashboardSummary,
  DungeonStats,
  Session,
} from '@/types';

// One dungeon run costs 20 stamina, so gold is rated per 20 — that reads as
// "what a run is worth" instead of a per-point figure nobody thinks in.
const STAMINA_UNIT = 20;

// Only runs that actually recorded stamina may feed the rate; a run logged
// without it would otherwise add gold to the numerator and nothing to the
// denominator.
const perStamina = (gold: number, totalStamina: number): number =>
  totalStamina > 0 ? Math.round((gold / totalStamina) * STAMINA_UNIT) : 0;

// Gold from runs that recorded stamina — the rate's numerator, tracked
// alongside the plain totals while grouping.
interface RatedGold {
  ratedGold: number;
}

function addRatedGold(totals: RatedGold, s: Session) {
  if ((s.stamina_used ?? 0) > 0) totals.ratedGold += s.gold_earned ?? 0;
}

export function computeSummary(sessions: Session[]): DashboardSummary {
  const totalGold = sessions.reduce((sum, s) => sum + (s.gold_earned ?? 0), 0);
  const totalStamina = sessions.reduce(
    (sum, s) => sum + (s.stamina_used ?? 0),
    0,
  );

  const rated: RatedGold = { ratedGold: 0 };
  for (const s of sessions) addRatedGold(rated, s);

  // Most-farmed dungeon by run count.
  const dungeonCounts = new Map<string, number>();
  for (const s of sessions) {
    const name = s.dungeons?.name;
    if (name) dungeonCounts.set(name, (dungeonCounts.get(name) ?? 0) + 1);
  }

  let favoriteDungeon: string | null = null;
  let maxCount = 0;
  for (const [name, count] of dungeonCounts) {
    if (count > maxCount) {
      maxCount = count;
      favoriteDungeon = name;
    }
  }

  return {
    totalGold,
    totalStamina,
    goldPerStamina: perStamina(rated.ratedGold, totalStamina),
    favoriteDungeon,
  };
}

export function computeCharacterStats(sessions: Session[]): CharacterStat[] {
  const map = new Map<string, CharacterStat & RatedGold>();

  for (const s of sessions) {
    const charId = s.character_id;
    let existing = map.get(charId);

    if (existing) {
      existing.totalSessions += 1;
      existing.totalGold += s.gold_earned ?? 0;
      existing.totalStamina += s.stamina_used ?? 0;
    } else {
      existing = {
        characterId: charId,
        characterName: s.characters?.name ?? 'Unknown',
        className: s.characters?.classes?.name ?? 'Unknown',
        level: s.characters?.level ?? 1,
        totalSessions: 1,
        totalGold: s.gold_earned ?? 0,
        totalStamina: s.stamina_used ?? 0,
        goldPerStamina: 0,
        ratedGold: 0,
      };
      map.set(charId, existing);
    }

    addRatedGold(existing, s);
  }

  return Array.from(map.values())
    .map(({ ratedGold, ...stat }) => ({
      ...stat,
      goldPerStamina: perStamina(ratedGold, stat.totalStamina),
    }))
    .sort((a, b) => b.totalGold - a.totalGold);
}

export function computeDungeonStats(sessions: Session[]): DungeonStats[] {
  const map = new Map<string, DungeonStats & RatedGold>();

  for (const s of sessions) {
    // Sessions not tied to a dungeon can't be ranked by dungeon.
    if (!s.dungeon_id || !s.dungeons) continue;

    const id = s.dungeon_id;
    let existing = map.get(id);

    if (existing) {
      existing.totalSessions += 1;
      existing.totalGold += s.gold_earned ?? 0;
      existing.totalStamina += s.stamina_used ?? 0;
    } else {
      existing = {
        dungeonId: id,
        dungeonName: s.dungeons.name,
        totalSessions: 1,
        totalGold: s.gold_earned ?? 0,
        totalStamina: s.stamina_used ?? 0,
        goldPerStamina: 0,
        ratedGold: 0,
      };
      map.set(id, existing);
    }

    addRatedGold(existing, s);
  }

  return (
    Array.from(map.values())
      .map(({ ratedGold, ...d }) => ({
        ...d,
        goldPerStamina: perStamina(ratedGold, d.totalStamina),
      }))
      // Best farming spot first (gold per 20 stamina).
      .sort((a, b) => b.goldPerStamina - a.goldPerStamina)
  );
}
