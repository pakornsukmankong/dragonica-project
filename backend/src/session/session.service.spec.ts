import { NotFoundException } from '@nestjs/common';
import { SessionService } from './session.service';
import { createSupabaseMock } from '../test/supabase.mock';

const USER = 'user-1';
const OTHER = 'user-2';

// Minimal i18n stub — tests assert on exception type, not localized text.
const i18n = {
  t: (key: string) => key,
} as unknown as import('nestjs-i18n').I18nService;

describe('SessionService (drop ownership)', () => {
  describe('addDrop', () => {
    it('inserts the drop after confirming the session belongs to the user', async () => {
      const session = { id: 's1', user_id: USER };
      const inserted = { id: 'd1', session_id: 's1', quantity: 2 };
      const { service: supabase, fromTables } = createSupabaseMock([
        { data: session, error: null }, // findOneByUser(session)
        { data: inserted, error: null }, // insert drop
      ]);
      const svc = new SessionService(supabase, i18n);

      await expect(
        svc.addDrop(USER, { sessionId: 's1', itemId: 'i1', quantity: 2 }),
      ).resolves.toEqual(inserted);
      expect(fromTables).toEqual(['sessions', 'session_drops']);
    });

    it('rejects adding a drop to a session the user does not own', async () => {
      const { service: supabase, fromTables } = createSupabaseMock([
        { data: null, error: { code: 'PGRST116' } }, // session not found for user
      ]);
      const svc = new SessionService(supabase, i18n);

      await expect(
        svc.addDrop(OTHER, { sessionId: 's1', itemId: 'i1', quantity: 1 }),
      ).rejects.toBeInstanceOf(NotFoundException);
      // Never reaches the insert.
      expect(fromTables).toEqual(['sessions']);
    });
  });

  describe('removeDrop', () => {
    it('deletes the drop when the parent session is owned by the user', async () => {
      const { service: supabase, fromTables } = createSupabaseMock([
        { data: { id: 'd1', session_id: 's1' }, error: null }, // drop lookup
        { data: { id: 's1', user_id: USER }, error: null }, // session ownership
        { data: null, error: null }, // delete
      ]);
      const svc = new SessionService(supabase, i18n);

      await expect(svc.removeDrop(USER, 'd1')).resolves.toEqual({
        deleted: true,
      });
      expect(fromTables).toEqual([
        'session_drops',
        'sessions',
        'session_drops',
      ]);
    });

    it('throws NotFound when the drop does not exist', async () => {
      const { service: supabase, fromTables } = createSupabaseMock([
        { data: null, error: { code: 'PGRST116' } }, // drop lookup fails
      ]);
      const svc = new SessionService(supabase, i18n);

      await expect(svc.removeDrop(USER, 'missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(fromTables).toEqual(['session_drops']);
    });

    it('refuses to delete a drop whose session belongs to another user', async () => {
      const { service: supabase, fromTables } = createSupabaseMock([
        { data: { id: 'd1', session_id: 's1' }, error: null }, // drop exists
        { data: null, error: { code: 'PGRST116' } }, // session not owned by OTHER
      ]);
      const svc = new SessionService(supabase, i18n);

      await expect(svc.removeDrop(OTHER, 'd1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      // Stops after the ownership check — no delete query.
      expect(fromTables).toEqual(['session_drops', 'sessions']);
    });
  });

  describe('updateDrop', () => {
    it('refuses to update a drop whose session belongs to another user', async () => {
      const { service: supabase, fromTables } = createSupabaseMock([
        { data: { id: 'd1', session_id: 's1' }, error: null }, // drop exists
        { data: null, error: { code: 'PGRST116' } }, // session not owned
      ]);
      const svc = new SessionService(supabase, i18n);

      await expect(
        svc.updateDrop(OTHER, 'd1', { quantity: 99 }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(fromTables).toEqual(['session_drops', 'sessions']);
    });
  });
});
