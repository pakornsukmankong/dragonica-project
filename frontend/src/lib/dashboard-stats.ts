// Client-side dashboard aggregations.
//
// The dashboard fetches every session once (GET /sessions) and lets the user
// narrow them to a date range. Deriving the summary / character / dungeon
// stats from that same filtered list keeps the whole page consistent with a
// single filter, instead of each block querying its own unfiltered endpoint.
//
// The math mirrors the backend DashboardService so numbers match when no
// filter is applied: gold/hour is derived from raw minutes (not rounded
// hours) so short sessions aren't distorted.

import type {
  CharacterStat,
  DashboardSummary,
  DungeonStats,
  Session,
} from '@/types';

const perHour = (totalGold: number, totalMinutes: number): number =>
  totalMinutes > 0 ? Math.round((totalGold / totalMinutes) * 60) : 0;

export function computeSummary(sessions: Session[]): DashboardSummary {
  const totalGold = sessions.reduce((sum, s) => sum + (s.gold_earned ?? 0), 0);
  const totalMinutes = sessions.reduce(
    (sum, s) => sum + (s.duration_minutes ?? 0),
    0,
  );

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
    totalHours: Math.round(totalMinutes / 60),
    goldPerHour: perHour(totalGold, totalMinutes),
    favoriteDungeon,
  };
}

export function computeCharacterStats(sessions: Session[]): CharacterStat[] {
  const map = new Map<string, CharacterStat>();

  for (const s of sessions) {
    const charId = s.character_id;
    const existing = map.get(charId);

    if (existing) {
      existing.totalSessions += 1;
      existing.totalGold += s.gold_earned ?? 0;
      existing.totalMinutes += s.duration_minutes ?? 0;
    } else {
      map.set(charId, {
        characterId: charId,
        characterName: s.characters?.name ?? 'Unknown',
        className: s.characters?.classes?.name ?? 'Unknown',
        level: s.characters?.level ?? 1,
        totalSessions: 1,
        totalGold: s.gold_earned ?? 0,
        totalMinutes: s.duration_minutes ?? 0,
        goldPerHour: 0,
      });
    }
  }

  return Array.from(map.values())
    .map((stat) => ({
      ...stat,
      goldPerHour: perHour(stat.totalGold, stat.totalMinutes),
    }))
    .sort((a, b) => b.totalGold - a.totalGold);
}

export function computeDungeonStats(sessions: Session[]): DungeonStats[] {
  const map = new Map<string, DungeonStats>();

  for (const s of sessions) {
    // Sessions not tied to a dungeon can't be ranked by dungeon.
    if (!s.dungeon_id || !s.dungeons) continue;

    const id = s.dungeon_id;
    const existing = map.get(id);

    if (existing) {
      existing.totalSessions += 1;
      existing.totalGold += s.gold_earned ?? 0;
      existing.totalMinutes += s.duration_minutes ?? 0;
    } else {
      map.set(id, {
        dungeonId: id,
        dungeonName: s.dungeons.name,
        totalSessions: 1,
        totalGold: s.gold_earned ?? 0,
        totalMinutes: s.duration_minutes ?? 0,
        goldPerHour: 0,
      });
    }
  }

  return Array.from(map.values())
    .map((d) => ({ ...d, goldPerHour: perHour(d.totalGold, d.totalMinutes) }))
    // Best farming spot first (gold per hour).
    .sort((a, b) => b.goldPerHour - a.goldPerHour);
}
