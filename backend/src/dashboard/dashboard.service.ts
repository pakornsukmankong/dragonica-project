import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

// One dungeon run costs 20 stamina, so gold is rated per 20 — that reads as
// "what a run is worth" instead of a per-point figure nobody thinks in.
const STAMINA_UNIT = 20;

// Only runs that actually recorded stamina may feed the rate; a run logged
// without it would otherwise add gold to the numerator and nothing to the
// denominator.
function perStamina(gold: number, stamina: number): number {
  return stamina > 0 ? Math.round((gold / stamina) * STAMINA_UNIT) : 0;
}

export interface DashboardSummary {
  totalGold: number;
  totalStamina: number;
  goldPerStamina: number;
  favoriteDungeon: string | null;
}

export interface CharacterStats {
  characterId: string;
  characterName: string;
  className: string;
  level: number;
  totalSessions: number;
  totalGold: number;
  totalStamina: number;
  goldPerStamina: number;
}

interface SessionRow {
  gold_earned: number;
  stamina_used: number | null;
  dungeons: { name: string } | null;
}

interface SessionWithCharRow {
  character_id: string;
  gold_earned: number;
  stamina_used: number | null;
  characters: { name: string; level: number; classes: { name: string } } | null;
}

export interface DungeonStats {
  dungeonId: string;
  dungeonName: string;
  totalSessions: number;
  totalGold: number;
  totalStamina: number;
  goldPerStamina: number;
}

interface SessionWithDungeonRow {
  dungeon_id: string | null;
  gold_earned: number;
  stamina_used: number | null;
  dungeons: {
    name: string;
  } | null;
}

// Gold from runs that recorded stamina — the rate's numerator, tracked
// alongside the plain totals while grouping.
interface RatedGold {
  ratedGold: number;
}

function addRatedGold(
  totals: RatedGold,
  session: { gold_earned: number; stamina_used: number | null },
) {
  if ((session.stamina_used ?? 0) > 0)
    totals.ratedGold += session.gold_earned ?? 0;
}

@Injectable()
export class DashboardService {
  constructor(private readonly supabase: SupabaseService) {}

  async getSummary(userId: string): Promise<DashboardSummary> {
    const { data, error } = await this.supabase
      .from('sessions')
      .select('gold_earned, stamina_used, dungeons(name)')
      .eq('user_id', userId);

    if (error) throw error;

    const sessions = (data ?? []) as unknown as SessionRow[];

    const totalGold = sessions.reduce(
      (sum, s) => sum + (s.gold_earned ?? 0),
      0,
    );

    const totalStamina = sessions.reduce(
      (sum, s) => sum + (s.stamina_used ?? 0),
      0,
    );

    const rated: RatedGold = { ratedGold: 0 };
    for (const session of sessions) addRatedGold(rated, session);

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
      totalStamina,
      goldPerStamina: perStamina(rated.ratedGold, totalStamina),
      favoriteDungeon,
    };
  }

  async getCharacterStats(userId: string): Promise<CharacterStats[]> {
    const { data, error } = await this.supabase
      .from('sessions')
      .select(
        'character_id, gold_earned, stamina_used, characters(name, level, classes(name))',
      )
      .eq('user_id', userId);

    if (error) throw error;

    const sessions = (data ?? []) as unknown as SessionWithCharRow[];

    const charMap = new Map<string, CharacterStats & RatedGold>();

    for (const session of sessions) {
      const charId = session.character_id;
      let existing = charMap.get(charId);

      if (existing) {
        existing.totalSessions += 1;
        existing.totalGold += session.gold_earned ?? 0;
        existing.totalStamina += session.stamina_used ?? 0;
      } else {
        existing = {
          characterId: charId,
          characterName: session.characters?.name ?? 'Unknown',
          className: session.characters?.classes?.name ?? 'Unknown',
          level: session.characters?.level ?? 1,
          totalSessions: 1,
          totalGold: session.gold_earned ?? 0,
          totalStamina: session.stamina_used ?? 0,
          goldPerStamina: 0,
          ratedGold: 0,
        };
        charMap.set(charId, existing);
      }

      addRatedGold(existing, session);
    }

    const result = Array.from(charMap.values()).map(
      ({ ratedGold, ...stat }) => ({
        ...stat,
        goldPerStamina: perStamina(ratedGold, stat.totalStamina),
      }),
    );

    return result.sort((a, b) => b.totalGold - a.totalGold);
  }

  async getDungeonStats(userId: string): Promise<DungeonStats[]> {
    const { data, error } = await this.supabase
      .from('sessions')
      .select('dungeon_id, gold_earned, stamina_used, dungeons(name)')
      .eq('user_id', userId);

    if (error) throw error;

    const sessions = (data ?? []) as unknown as SessionWithDungeonRow[];

    const map = new Map<string, DungeonStats & RatedGold>();

    for (const session of sessions) {
      // Sessions not tied to a dungeon can't be ranked by dungeon.
      if (!session.dungeon_id || !session.dungeons) continue;

      const id = session.dungeon_id;
      let existing = map.get(id);

      if (existing) {
        existing.totalSessions += 1;
        existing.totalGold += session.gold_earned ?? 0;
        existing.totalStamina += session.stamina_used ?? 0;
      } else {
        existing = {
          dungeonId: id,
          dungeonName: session.dungeons.name,
          totalSessions: 1,
          totalGold: session.gold_earned ?? 0,
          totalStamina: session.stamina_used ?? 0,
          goldPerStamina: 0,
          ratedGold: 0,
        };
        map.set(id, existing);
      }

      addRatedGold(existing, session);
    }

    const result: DungeonStats[] = Array.from(map.values()).map(
      ({ ratedGold, ...d }) => ({
        ...d,
        goldPerStamina: perStamina(ratedGold, d.totalStamina),
      }),
    );

    // Best farming spot first (gold per 20 stamina).
    return result.sort((a, b) => b.goldPerStamina - a.goldPerStamina);
  }
}
