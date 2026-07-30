import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventService } from './event.service';
import { createSupabaseMock } from '../test/supabase.mock';

const USER = 'user-1';
const OTHER = 'user-2';

// Minimal i18n stub — tests assert on exception type, not localized text.
const i18n = {
  t: (key: string) => key,
} as unknown as import('nestjs-i18n').I18nService;

const base = {
  title: 'Summer Event',
  startDate: '2026-07-01',
  endDate: '2026-07-10',
};

describe('EventService', () => {
  describe('normalize (via create)', () => {
    it('trims the title and stores the date-only range', async () => {
      const { service: supabase, from } = createSupabaseMock([
        { data: { id: 'e1' }, error: null },
      ]);
      const svc = new EventService(supabase, i18n);

      await svc.create(USER, {
        ...base,
        title: '  Summer Event  ',
        // A full timestamp must be truncated to its day, not shifted.
        startDate: '2026-07-01T17:00:00.000Z',
        endDate: '2026-07-10T00:00:00.000Z',
      });

      const insert = from.mock.results[0].value.insert as jest.Mock;
      expect(insert).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Summer Event',
          start_date: '2026-07-01',
          end_date: '2026-07-10',
          created_by: USER,
        }),
      );
    });

    it('stores a blank detail and link as null', async () => {
      const { service: supabase, from } = createSupabaseMock([
        { data: { id: 'e1' }, error: null },
      ]);
      const svc = new EventService(supabase, i18n);

      await svc.create(USER, { ...base, detail: '   ', link: '  ' });

      const insert = from.mock.results[0].value.insert as jest.Mock;
      expect(insert).toHaveBeenCalledWith(
        expect.objectContaining({ detail: null, link: null }),
      );
    });

    it('rejects a title that is only whitespace', async () => {
      const { service: supabase, fromTables } = createSupabaseMock([]);
      const svc = new EventService(supabase, i18n);

      await expect(
        svc.create(USER, { ...base, title: '   ' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      // Nothing may reach the database.
      expect(fromTables).toEqual([]);
    });

    it('rejects an end date earlier than the start date', async () => {
      const { service: supabase, fromTables } = createSupabaseMock([]);
      const svc = new EventService(supabase, i18n);

      await expect(
        svc.create(USER, {
          ...base,
          startDate: '2026-07-10',
          endDate: '2026-07-01',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(fromTables).toEqual([]);
    });

    it('accepts a single-day event (end equal to start)', async () => {
      const { service: supabase } = createSupabaseMock([
        { data: { id: 'e1' }, error: null },
      ]);
      const svc = new EventService(supabase, i18n);

      await expect(
        svc.create(USER, {
          ...base,
          startDate: '2026-07-01',
          endDate: '2026-07-01',
        }),
      ).resolves.toEqual({ id: 'e1' });
    });
  });

  describe('update (ownership)', () => {
    it('runs the ownership check before writing', async () => {
      const { service: supabase, fromTables } = createSupabaseMock([
        { data: { id: 'e1' }, error: null }, // assertOwned
        { data: { id: 'e1', title: 'New' }, error: null }, // update
      ]);
      const svc = new EventService(supabase, i18n);

      await expect(
        svc.update('e1', USER, { ...base, title: 'New' }),
      ).resolves.toEqual({ id: 'e1', title: 'New' });
      expect(fromTables).toEqual(['game_events', 'game_events']);
    });

    it('404s and never writes when the event belongs to someone else', async () => {
      const { service: supabase, fromTables } = createSupabaseMock([
        { data: null, error: { code: 'PGRST116' } }, // assertOwned fails
      ]);
      const svc = new EventService(supabase, i18n);

      await expect(svc.update('e1', OTHER, base)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(fromTables).toEqual(['game_events']);
    });
  });

  describe('remove (ownership)', () => {
    it('refuses to delete an event the user does not own', async () => {
      const { service: supabase, fromTables } = createSupabaseMock([
        { data: null, error: { code: 'PGRST116' } }, // assertOwned fails
      ]);
      const svc = new EventService(supabase, i18n);

      await expect(svc.remove('e1', OTHER)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(fromTables).toEqual(['game_events']);
    });

    it('deletes an event the user owns', async () => {
      const { service: supabase, fromTables } = createSupabaseMock([
        { data: { id: 'e1' }, error: null }, // assertOwned
        { data: null, error: null }, // delete
      ]);
      const svc = new EventService(supabase, i18n);

      await expect(svc.remove('e1', USER)).resolves.toEqual({ deleted: true });
      expect(fromTables).toEqual(['game_events', 'game_events']);
    });
  });

  describe('admin moderation', () => {
    it('updates any row without an ownership check', async () => {
      const { service: supabase, fromTables } = createSupabaseMock([
        { data: { id: 'e1', title: 'Fixed' }, error: null },
      ]);
      const svc = new EventService(supabase, i18n);

      await expect(
        svc.updateAsAdmin('e1', { ...base, title: 'Fixed' }),
      ).resolves.toEqual({ id: 'e1', title: 'Fixed' });
      // One query only — no assertOwned round trip.
      expect(fromTables).toEqual(['game_events']);
    });

    it('404s when deleting a row that does not exist', async () => {
      const { service: supabase } = createSupabaseMock([
        { data: [], error: null }, // delete matched nothing
      ]);
      const svc = new EventService(supabase, i18n);

      await expect(svc.removeAsAdmin('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('searches title and detail, and strips PostgREST filter syntax', async () => {
      const { service: supabase, from } = createSupabaseMock([
        { data: [], error: null, count: 0 },
      ]);
      const svc = new EventService(supabase, i18n);

      await svc.listAllAsAdmin({ search: 'sum,mer)' });

      const or = from.mock.results[0].value.or as jest.Mock;
      expect(or).toHaveBeenCalledWith(
        'title.ilike.%summer%,detail.ilike.%summer%',
      );
    });

    it('clamps a page below 1 and reports the total', async () => {
      const { service: supabase } = createSupabaseMock([
        { data: [{ id: 'e1' }], error: null, count: 42 },
      ]);
      const svc = new EventService(supabase, i18n);

      await expect(svc.listAllAsAdmin({ page: 0 })).resolves.toEqual({
        events: [{ id: 'e1' }],
        total: 42,
        page: 1,
        pageSize: 10,
      });
    });
  });
});
