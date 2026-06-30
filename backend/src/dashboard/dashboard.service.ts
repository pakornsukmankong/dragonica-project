import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface DashboardSummary {
  totalGold: number;
  totalHours: number;
  goldPerHour: number;
  favoriteDungeon: string | null;
}

export interface CharacterStats {
  characterId: string;
  characterName: string;
  className: string;
  level: number;
  totalSessions: number;
  totalGold: number;
  totalMinutes: number;
  goldPerHour: number;
}

interface SessionRow {
  gold_earned: number;
  duration_minutes: number | null;
  dungeons: { name: string } | null;
}

interface SessionWithCharRow {
  character_id: string;
  gold_earned: number;
  duration_minutes: number | null;
  characters: { name: string; level: number; classes: { name: string } } | null;
}

export interface DungeonStats {
  dungeonId: string;
  dungeonName: string;
  totalSessions: number;
  totalGold: number;
  totalMinutes: number;
  goldPerHour: number;
  /** Cost in dragon cores per single run (from the dungeon catalog). */
  dragonCoreCost: number | null;
  /** totalGold divided by total cores spent; null when cost is unknown. */
  goldPerCore: number | null;
}

interface SessionWithDungeonRow {
  dungeon_id: string | null;
  gold_earned: number;
  duration_minutes: number | null;
  dungeons: {
    name: string;
    dragon_core_cost: number | null;
  } | null;
}

@Injectable()
export class DashboardService {
  constructor(private readonly supabase: SupabaseService) {}

  async getSummary(userId: string): Promise<DashboardSummary> {
    const { data, error } = await this.supabase
      .from('sessions')
      .select('gold_earned, duration_minutes, dungeons(name)')
      .eq('user_id', userId);

    if (error) throw error;

    const sessions = (data ?? []) as unknown as SessionRow[];

    const totalGold = sessions.reduce(
      (sum, s) => sum + (s.gold_earned ?? 0),
      0,
    );

    const totalMinutes = sessions.reduce(
      (sum, s) => sum + (s.duration_minutes ?? 0),
      0,
    );

    const totalHours = Math.round(totalMinutes / 60);
    // Derive gold/hour from raw minutes (not the rounded hours) so short
    // sessions aren't distorted — matches getCharacterStats below.
    const goldPerHour =
      totalMinutes > 0 ? Math.round((totalGold / totalMinutes) * 60) : 0;

    // Find the most-farmed dungeon
    const dungeonCounts = new Map<string, number>();
    for (const session of sessions) {
      const dungeonName = session.dungeons?.name;
      if (dungeonName) {
        dungeonCounts.set(
          dungeonName,
          (dungeonCounts.get(dungeonName) ?? 0) + 1,
        );
      }
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
      totalHours,
      goldPerHour,
      favoriteDungeon,
    };
  }

  async getCharacterStats(userId: string): Promise<CharacterStats[]> {
    const { data, error } = await this.supabase
      .from('sessions')
      .select(
        'character_id, gold_earned, duration_minutes, characters(name, level, classes(name))',
      )
      .eq('user_id', userId);

    if (error) throw error;

    const sessions = (data ?? []) as unknown as SessionWithCharRow[];

    const charMap = new Map<string, CharacterStats>();

    for (const session of sessions) {
      const charId = session.character_id;
      const existing = charMap.get(charId);

      if (existing) {
        existing.totalSessions += 1;
        existing.totalGold += session.gold_earned ?? 0;
        existing.totalMinutes += session.duration_minutes ?? 0;
      } else {
        charMap.set(charId, {
          characterId: charId,
          characterName: session.characters?.name ?? 'Unknown',
          className: session.characters?.classes?.name ?? 'Unknown',
          level: session.characters?.level ?? 1,
          totalSessions: 1,
          totalGold: session.gold_earned ?? 0,
          totalMinutes: session.duration_minutes ?? 0,
          goldPerHour: 0,
        });
      }
    }

    const result = Array.from(charMap.values()).map((stat) => ({
      ...stat,
      goldPerHour:
        stat.totalMinutes > 0
          ? Math.round((stat.totalGold / stat.totalMinutes) * 60)
          : 0,
    }));

    return result.sort((a, b) => b.totalGold - a.totalGold);
  }

  async getDungeonStats(userId: string): Promise<DungeonStats[]> {
    const { data, error } = await this.supabase
      .from('sessions')
      .select(
        'dungeon_id, gold_earned, duration_minutes, dungeons(name, dragon_core_cost)',
      )
      .eq('user_id', userId);

    if (error) throw error;

    const sessions = (data ?? []) as unknown as SessionWithDungeonRow[];

    const map = new Map<
      string,
      DungeonStats & { coreCostPerRun: number | null }
    >();

    for (const session of sessions) {
      // Sessions not tied to a dungeon can't be ranked by dungeon.
      if (!session.dungeon_id || !session.dungeons) continue;

      const id = session.dungeon_id;
      const existing = map.get(id);

      if (existing) {
        existing.totalSessions += 1;
        existing.totalGold += session.gold_earned ?? 0;
        existing.totalMinutes += session.duration_minutes ?? 0;
      } else {
        map.set(id, {
          dungeonId: id,
          dungeonName: session.dungeons.name,
          totalSessions: 1,
          totalGold: session.gold_earned ?? 0,
          totalMinutes: session.duration_minutes ?? 0,
          goldPerHour: 0,
          dragonCoreCost: session.dungeons.dragon_core_cost ?? null,
          goldPerCore: null,
          coreCostPerRun: session.dungeons.dragon_core_cost ?? null,
        });
      }
    }

    const result: DungeonStats[] = Array.from(map.values()).map((d) => {
      const goldPerHour =
        d.totalMinutes > 0
          ? Math.round((d.totalGold / d.totalMinutes) * 60)
          : 0;

      const totalCores =
        d.coreCostPerRun != null ? d.coreCostPerRun * d.totalSessions : 0;
      const goldPerCore =
        totalCores > 0 ? Math.round(d.totalGold / totalCores) : null;

      return {
        dungeonId: d.dungeonId,
        dungeonName: d.dungeonName,
        totalSessions: d.totalSessions,
        totalGold: d.totalGold,
        totalMinutes: d.totalMinutes,
        goldPerHour,
        dragonCoreCost: d.dragonCoreCost,
        goldPerCore,
      };
    });

    // Best farming spot first (gold per hour).
    return result.sort((a, b) => b.goldPerHour - a.goldPerHour);
  }
}
