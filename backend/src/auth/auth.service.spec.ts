import { NotFoundException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { createSupabaseMock } from '../test/supabase.mock';

const USER = 'user-1';
const EMAIL = 'flok@example.com';

const i18n = {
  t: (key: string) => key,
} as unknown as import('nestjs-i18n').I18nService;

const profile = {
  id: USER,
  username: 'flok',
  avatar_url: null,
  role: 'user',
  created_at: '2026-01-01T00:00:00Z',
};

describe('AuthService', () => {
  describe('getOrCreateProfile', () => {
    it('returns the existing profile without inserting', async () => {
      const { service: supabase, fromTables } = createSupabaseMock([
        { data: profile, error: null },
      ]);
      const svc = new AuthService(supabase, i18n);

      await expect(svc.getOrCreateProfile(USER, EMAIL)).resolves.toEqual(
        profile,
      );
      expect(fromTables).toEqual(['profiles']);
    });

    it('creates a profile from the email local-part when none exists', async () => {
      const {
        service: supabase,
        from,
        fromTables,
      } = createSupabaseMock([
        { data: null, error: { code: 'PGRST116' } }, // no row yet
        { data: { ...profile, username: 'flok' }, error: null }, // insert
      ]);
      const svc = new AuthService(supabase, i18n);

      const result = await svc.getOrCreateProfile(USER, EMAIL);
      expect(result.username).toBe('flok');
      expect(fromTables).toEqual(['profiles', 'profiles']);

      const insertArg = (from.mock.results[1].value.insert as jest.Mock).mock
        .calls[0][0];
      expect(insertArg).toEqual({ id: USER, username: 'flok' });
    });

    it('propagates an insert failure', async () => {
      const boom = { message: 'duplicate key' };
      const { service: supabase } = createSupabaseMock([
        { data: null, error: { code: 'PGRST116' } },
        { data: null, error: boom },
      ]);
      const svc = new AuthService(supabase, i18n);

      await expect(svc.getOrCreateProfile(USER, EMAIL)).rejects.toBe(boom);
    });
  });

  describe('updateProfile', () => {
    it('stores a blank username as null so the app falls back to email', async () => {
      const updated = { ...profile, username: null };
      const { service: supabase, from } = createSupabaseMock([
        { data: updated, error: null },
      ]);
      const svc = new AuthService(supabase, i18n);

      await expect(
        svc.updateProfile(USER, { username: '   ' }),
      ).resolves.toEqual(updated);

      const updateArg = (from.mock.results[0].value.update as jest.Mock).mock
        .calls[0][0];
      expect(updateArg).toEqual({ username: null });
    });

    it('trims the username before saving', async () => {
      const { service: supabase, from } = createSupabaseMock([
        { data: profile, error: null },
      ]);
      const svc = new AuthService(supabase, i18n);

      await svc.updateProfile(USER, { username: '  flok  ' });

      const updateArg = (from.mock.results[0].value.update as jest.Mock).mock
        .calls[0][0];
      expect(updateArg).toEqual({ username: 'flok' });
    });

    it('throws NotFound when no profile row matched', async () => {
      const { service: supabase } = createSupabaseMock([
        { data: null, error: null },
      ]);
      const svc = new AuthService(supabase, i18n);

      await expect(
        svc.updateProfile(USER, { username: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
