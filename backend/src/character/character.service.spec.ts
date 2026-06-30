import { ConflictException, NotFoundException } from '@nestjs/common';
import { CharacterService } from './character.service';
import { createSupabaseMock } from '../test/supabase.mock';

const USER = 'user-1';
const OTHER = 'user-2';

describe('CharacterService (user scoping)', () => {
  describe('findOneByUser', () => {
    it('returns the row when it belongs to the user', async () => {
      const char = { id: 'c1', user_id: USER, name: 'Hero' };
      const { service: supabase, fromTables } = createSupabaseMock([
        { data: char, error: null },
      ]);
      const svc = new CharacterService(supabase);

      await expect(svc.findOneByUser('c1', USER)).resolves.toEqual(char);
      expect(fromTables).toEqual(['characters']);
    });

    it('throws NotFound when the row is missing or owned by someone else', async () => {
      // Supabase returns no row because the user_id filter excluded it.
      const { service: supabase } = createSupabaseMock([
        { data: null, error: { code: 'PGRST116' } },
      ]);
      const svc = new CharacterService(supabase);

      await expect(svc.findOneByUser('c1', OTHER)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('runs the ownership check before updating', async () => {
      const existing = { id: 'c1', user_id: USER, name: 'Old' };
      const updated = { id: 'c1', user_id: USER, name: 'New' };
      const { service: supabase, fromTables } = createSupabaseMock([
        { data: existing, error: null }, // findOneByUser
        { data: updated, error: null }, // update
      ]);
      const svc = new CharacterService(supabase);

      await expect(svc.update('c1', USER, { name: 'New' })).resolves.toEqual(
        updated,
      );
      // Two queries: ownership check, then the update.
      expect(fromTables).toEqual(['characters', 'characters']);
    });

    it('does not update when ownership check fails', async () => {
      const { service: supabase, fromTables } = createSupabaseMock([
        { data: null, error: { code: 'PGRST116' } }, // findOneByUser fails
      ]);
      const svc = new CharacterService(supabase);

      await expect(
        svc.update('c1', OTHER, { name: 'Hack' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      // The update query must never run.
      expect(fromTables).toEqual(['characters']);
    });
  });

  describe('remove', () => {
    it('refuses to delete a character the user does not own', async () => {
      const { service: supabase, fromTables } = createSupabaseMock([
        { data: null, error: { code: 'PGRST116' } }, // findOneByUser fails
      ]);
      const svc = new CharacterService(supabase);

      await expect(svc.remove('c1', OTHER)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(fromTables).toEqual(['characters']);
    });

    it('blocks deletion (409) when the character still has sessions', async () => {
      const { service: supabase, fromTables } = createSupabaseMock([
        { data: { id: 'c1', user_id: USER, name: 'Hero' }, error: null }, // owned
        { data: null, error: null, count: 3 }, // sessions count
      ]);
      const svc = new CharacterService(supabase);

      await expect(svc.remove('c1', USER)).rejects.toBeInstanceOf(
        ConflictException,
      );
      // Stops after counting sessions — the delete query never runs.
      expect(fromTables).toEqual(['characters', 'sessions']);
    });

    it('deletes when the character has no sessions', async () => {
      const { service: supabase, fromTables } = createSupabaseMock([
        { data: { id: 'c1', user_id: USER, name: 'Hero' }, error: null }, // owned
        { data: null, error: null, count: 0 }, // no sessions
        { data: null, error: null }, // delete
      ]);
      const svc = new CharacterService(supabase);

      await expect(svc.remove('c1', USER)).resolves.toEqual({ deleted: true });
      expect(fromTables).toEqual(['characters', 'sessions', 'characters']);
    });
  });
});
