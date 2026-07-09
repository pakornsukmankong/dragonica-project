import { DashboardService } from './dashboard.service';
import { createSupabaseMock } from '../test/supabase.mock';

const USER = 'user-1';

describe('DashboardService', () => {
  describe('getSummary', () => {
    it('aggregates gold, rounds hours, and derives gold/hour from raw minutes', async () => {
      const { service: supabase } = createSupabaseMock([
        {
          data: [
            { gold_earned: 100, duration_minutes: 30, dungeons: { name: 'Ruins' } },
            { gold_earned: 200, duration_minutes: 60, dungeons: { name: 'Ruins' } },
            { gold_earned: 50, duration_minutes: 45, dungeons: { name: 'Cave' } },
          ],
          error: null,
        },
      ]);
      const svc = new DashboardService(supabase);

      const summary = await svc.getSummary(USER);
      expect(summary.totalGold).toBe(350);
      // 135 minutes → 2.25h rounds to 2, but gold/hour uses raw minutes
      expect(summary.totalHours).toBe(2);
      expect(summary.goldPerHour).toBe(Math.round((350 / 135) * 60));
      expect(summary.favoriteDungeon).toBe('Ruins'); // 2 runs vs 1
    });

    it('returns zeros and a null favorite for a user with no sessions', async () => {
      const { service: supabase } = createSupabaseMock([
        { data: [], error: null },
      ]);
      const svc = new DashboardService(supabase);

      await expect(svc.getSummary(USER)).resolves.toEqual({
        totalGold: 0,
        totalHours: 0,
        goldPerHour: 0,
        favoriteDungeon: null,
      });
    });

    it('ignores null durations instead of poisoning the totals', async () => {
      const { service: supabase } = createSupabaseMock([
        {
          data: [
            { gold_earned: 100, duration_minutes: null, dungeons: null },
            { gold_earned: 50, duration_minutes: 30, dungeons: null },
          ],
          error: null,
        },
      ]);
      const svc = new DashboardService(supabase);

      const summary = await svc.getSummary(USER);
      expect(summary.totalGold).toBe(150);
      expect(summary.goldPerHour).toBe(300); // 150g / 30min
    });
  });

  describe('getCharacterStats', () => {
    it('groups sessions per character and sorts by total gold', async () => {
      const char = (name: string) => ({
        name,
        level: 40,
        classes: { name: 'Knight' },
      });
      const { service: supabase } = createSupabaseMock([
        {
          data: [
            { character_id: 'a', gold_earned: 100, duration_minutes: 60, characters: char('Alpha') },
            { character_id: 'b', gold_earned: 500, duration_minutes: 60, characters: char('Beta') },
            { character_id: 'a', gold_earned: 200, duration_minutes: 30, characters: char('Alpha') },
          ],
          error: null,
        },
      ]);
      const svc = new DashboardService(supabase);

      const stats = await svc.getCharacterStats(USER);
      expect(stats.map((s) => s.characterName)).toEqual(['Beta', 'Alpha']);
      const alpha = stats[1];
      expect(alpha.totalSessions).toBe(2);
      expect(alpha.totalGold).toBe(300);
      expect(alpha.goldPerHour).toBe(200); // 300g / 90min
    });

    it('falls back to Unknown when the character join is missing', async () => {
      const { service: supabase } = createSupabaseMock([
        {
          data: [
            { character_id: 'x', gold_earned: 10, duration_minutes: 10, characters: null },
          ],
          error: null,
        },
      ]);
      const svc = new DashboardService(supabase);

      const [stat] = await svc.getCharacterStats(USER);
      expect(stat.characterName).toBe('Unknown');
      expect(stat.className).toBe('Unknown');
    });
  });

  describe('getDungeonStats', () => {
    it('skips dungeonless sessions and ranks by gold per hour', async () => {
      const { service: supabase } = createSupabaseMock([
        {
          data: [
            { dungeon_id: null, gold_earned: 999, duration_minutes: 1, dungeons: null },
            { dungeon_id: 'd1', gold_earned: 100, duration_minutes: 60, dungeons: { name: 'Ruins' } },
            { dungeon_id: 'd2', gold_earned: 300, duration_minutes: 60, dungeons: { name: 'Cave' } },
          ],
          error: null,
        },
      ]);
      const svc = new DashboardService(supabase);

      const stats = await svc.getDungeonStats(USER);
      expect(stats).toHaveLength(2); // the null-dungeon session is excluded
      expect(stats[0].dungeonName).toBe('Cave'); // 300 g/h beats 100 g/h
      expect(stats[0].goldPerHour).toBe(300);
    });
  });
});
