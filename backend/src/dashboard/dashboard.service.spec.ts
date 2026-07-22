import { DashboardService } from './dashboard.service';
import { createSupabaseMock } from '../test/supabase.mock';

const USER = 'user-1';

describe('DashboardService', () => {
  describe('getSummary', () => {
    it('aggregates gold and stamina and rates gold per 20 stamina', async () => {
      const { service: supabase } = createSupabaseMock([
        {
          data: [
            {
              gold_earned: 100,
              stamina_used: 20,
              dungeons: { name: 'Ruins' },
            },
            {
              gold_earned: 200,
              stamina_used: 40,
              dungeons: { name: 'Ruins' },
            },
            {
              gold_earned: 50,
              stamina_used: 20,
              dungeons: { name: 'Cave' },
            },
          ],
          error: null,
        },
      ]);
      const svc = new DashboardService(supabase);

      const summary = await svc.getSummary(USER);
      expect(summary.totalGold).toBe(350);
      expect(summary.totalStamina).toBe(80);
      expect(summary.goldPerStamina).toBe(88); // 350g / 80 sta, per 20
      expect(summary.favoriteDungeon).toBe('Ruins'); // 2 runs vs 1
    });

    it('returns zeros and a null favorite for a user with no sessions', async () => {
      const { service: supabase } = createSupabaseMock([
        { data: [], error: null },
      ]);
      const svc = new DashboardService(supabase);

      await expect(svc.getSummary(USER)).resolves.toEqual({
        totalGold: 0,
        totalStamina: 0,
        goldPerStamina: 0,
        favoriteDungeon: null,
      });
    });

    it('keeps gold from stamina-less runs out of the rate', async () => {
      const { service: supabase } = createSupabaseMock([
        {
          data: [
            { gold_earned: 900, stamina_used: null, dungeons: null },
            { gold_earned: 100, stamina_used: 20, dungeons: null },
          ],
          error: null,
        },
      ]);
      const svc = new DashboardService(supabase);

      const summary = await svc.getSummary(USER);
      // The old, time-logged run still counts toward lifetime gold...
      expect(summary.totalGold).toBe(1000);
      // ...but only the stamina run sets the rate: 100g / 20 sta.
      expect(summary.goldPerStamina).toBe(100);
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
            {
              character_id: 'a',
              gold_earned: 100,
              stamina_used: 20,
              characters: char('Alpha'),
            },
            {
              character_id: 'b',
              gold_earned: 500,
              stamina_used: 20,
              characters: char('Beta'),
            },
            {
              character_id: 'a',
              gold_earned: 200,
              stamina_used: 20,
              characters: char('Alpha'),
            },
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
      expect(alpha.totalStamina).toBe(40);
      expect(alpha.goldPerStamina).toBe(150); // 300g / 40 sta, per 20
    });

    it('rates a character only on its stamina runs', async () => {
      const char = { name: 'Alpha', level: 40, classes: { name: 'Knight' } };
      const { service: supabase } = createSupabaseMock([
        {
          data: [
            {
              character_id: 'a',
              gold_earned: 400,
              stamina_used: null,
              characters: char,
            },
            {
              character_id: 'a',
              gold_earned: 100,
              stamina_used: 20,
              characters: char,
            },
          ],
          error: null,
        },
      ]);
      const svc = new DashboardService(supabase);

      const [alpha] = await svc.getCharacterStats(USER);
      expect(alpha.totalGold).toBe(500);
      expect(alpha.totalStamina).toBe(20);
      expect(alpha.goldPerStamina).toBe(100); // 100g / 20 sta
    });

    it('falls back to Unknown when the character join is missing', async () => {
      const { service: supabase } = createSupabaseMock([
        {
          data: [
            {
              character_id: 'x',
              gold_earned: 10,
              stamina_used: 20,
              characters: null,
            },
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
    it('skips dungeonless sessions and ranks by gold per stamina', async () => {
      const { service: supabase } = createSupabaseMock([
        {
          data: [
            {
              dungeon_id: null,
              gold_earned: 999,
              stamina_used: 20,
              dungeons: null,
            },
            {
              dungeon_id: 'd1',
              gold_earned: 100,
              stamina_used: 20,
              dungeons: { name: 'Ruins' },
            },
            {
              dungeon_id: 'd2',
              gold_earned: 300,
              stamina_used: 20,
              dungeons: { name: 'Cave' },
            },
          ],
          error: null,
        },
      ]);
      const svc = new DashboardService(supabase);

      const stats = await svc.getDungeonStats(USER);
      expect(stats).toHaveLength(2); // the null-dungeon session is excluded
      expect(stats[0].dungeonName).toBe('Cave'); // 300/20 beats 100/20
      expect(stats[0].goldPerStamina).toBe(300);
    });
  });
});
