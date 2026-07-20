import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ItemCodeService } from './item-code.service';
import { createSupabaseMock } from '../test/supabase.mock';

const USER = 'user-1';
const OTHER = 'user-2';

// Minimal i18n stub — tests assert on exception type, not localized text.
const i18n = {
  t: (key: string) => key,
} as unknown as import('nestjs-i18n').I18nService;

describe('ItemCodeService', () => {
  describe('normalize (via create)', () => {
    it('trims and uppercases the code before writing', async () => {
      const { service: supabase, from } = createSupabaseMock([
        { data: { id: 'i1' }, error: null },
      ]);
      const svc = new ItemCodeService(supabase, i18n);

      await svc.create(USER, { code: '  dragon2026 ' });

      const insert = from.mock.results[0].value.insert as jest.Mock;
      expect(insert).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'DRAGON2026', created_by: USER }),
      );
    });

    it('stores a blank description as null', async () => {
      const { service: supabase, from } = createSupabaseMock([
        { data: { id: 'i1' }, error: null },
      ]);
      const svc = new ItemCodeService(supabase, i18n);

      await svc.create(USER, { code: 'ABC', description: '   ' });

      const insert = from.mock.results[0].value.insert as jest.Mock;
      expect(insert).toHaveBeenCalledWith(
        expect.objectContaining({ description: null }),
      );
    });

    it('rejects a code that is only whitespace', async () => {
      const { service: supabase, fromTables } = createSupabaseMock([]);
      const svc = new ItemCodeService(supabase, i18n);

      await expect(svc.create(USER, { code: '   ' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      // Nothing may reach the database.
      expect(fromTables).toEqual([]);
    });

    it('rejects a start date later than the expire date', async () => {
      const { service: supabase, fromTables } = createSupabaseMock([]);
      const svc = new ItemCodeService(supabase, i18n);

      await expect(
        svc.create(USER, {
          code: 'ABC',
          startDate: '2026-08-01T00:00:00.000Z',
          expireDate: '2026-07-01T00:00:00.000Z',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(fromTables).toEqual([]);
    });

    it('accepts a start date equal to the expire date (same-day code)', async () => {
      const sameDay = '2026-07-01T00:00:00.000Z';
      const { service: supabase } = createSupabaseMock([
        { data: { id: 'i1' }, error: null },
      ]);
      const svc = new ItemCodeService(supabase, i18n);

      await expect(
        svc.create(USER, {
          code: 'ABC',
          startDate: sameDay,
          expireDate: sameDay,
        }),
      ).resolves.toEqual({ id: 'i1' });
    });
  });

  describe('duplicate handling', () => {
    it('maps the unique-index violation to a 409', async () => {
      // 23505 = unique_violation on item_codes_code_unique (upper(code)).
      const { service: supabase } = createSupabaseMock([
        { data: null, error: { code: '23505' } },
      ]);
      const svc = new ItemCodeService(supabase, i18n);

      await expect(svc.create(USER, { code: 'DUPE' })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('update (ownership)', () => {
    it('runs the ownership check before writing', async () => {
      const { service: supabase, fromTables } = createSupabaseMock([
        { data: { id: 'i1' }, error: null }, // assertOwned
        { data: { id: 'i1', code: 'NEW' }, error: null }, // update
      ]);
      const svc = new ItemCodeService(supabase, i18n);

      await expect(svc.update('i1', USER, { code: 'NEW' })).resolves.toEqual({
        id: 'i1',
        code: 'NEW',
      });
      expect(fromTables).toEqual(['item_codes', 'item_codes']);
    });

    it('404s and never writes when the code belongs to someone else', async () => {
      const { service: supabase, fromTables } = createSupabaseMock([
        { data: null, error: { code: 'PGRST116' } }, // assertOwned fails
      ]);
      const svc = new ItemCodeService(supabase, i18n);

      await expect(
        svc.update('i1', OTHER, { code: 'HACK' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(fromTables).toEqual(['item_codes']);
    });
  });

  describe('remove (ownership)', () => {
    it('refuses to delete a code the user does not own', async () => {
      const { service: supabase, fromTables } = createSupabaseMock([
        { data: null, error: { code: 'PGRST116' } }, // assertOwned fails
      ]);
      const svc = new ItemCodeService(supabase, i18n);

      await expect(svc.remove('i1', OTHER)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(fromTables).toEqual(['item_codes']);
    });

    it('deletes a code the user owns', async () => {
      const { service: supabase, fromTables } = createSupabaseMock([
        { data: { id: 'i1' }, error: null }, // assertOwned
        { data: null, error: null }, // delete
      ]);
      const svc = new ItemCodeService(supabase, i18n);

      await expect(svc.remove('i1', USER)).resolves.toEqual({ deleted: true });
      expect(fromTables).toEqual(['item_codes', 'item_codes']);
    });
  });

  describe('admin moderation', () => {
    it('updates any row without an ownership check', async () => {
      const { service: supabase, fromTables } = createSupabaseMock([
        { data: { id: 'i1', code: 'FIXED' }, error: null },
      ]);
      const svc = new ItemCodeService(supabase, i18n);

      await expect(svc.updateAsAdmin('i1', { code: 'FIXED' })).resolves.toEqual(
        { id: 'i1', code: 'FIXED' },
      );
      // One query only — no assertOwned round trip.
      expect(fromTables).toEqual(['item_codes']);
    });

    it('404s when deleting a row that does not exist', async () => {
      const { service: supabase } = createSupabaseMock([
        { data: [], error: null }, // delete matched nothing
      ]);
      const svc = new ItemCodeService(supabase, i18n);

      await expect(svc.removeAsAdmin('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('searches code and description, and strips PostgREST filter syntax', async () => {
      const { service: supabase, from } = createSupabaseMock([
        { data: [], error: null, count: 0 },
      ]);
      const svc = new ItemCodeService(supabase, i18n);

      await svc.listAllAsAdmin({ search: 'mo,unt)' });

      const or = from.mock.results[0].value.or as jest.Mock;
      expect(or).toHaveBeenCalledWith(
        'code.ilike.%mount%,description.ilike.%mount%',
      );
    });

    it('clamps a page below 1 and reports the total', async () => {
      const { service: supabase } = createSupabaseMock([
        { data: [{ id: 'i1' }], error: null, count: 42 },
      ]);
      const svc = new ItemCodeService(supabase, i18n);

      await expect(svc.listAllAsAdmin({ page: 0 })).resolves.toEqual({
        codes: [{ id: 'i1' }],
        total: 42,
        page: 1,
        pageSize: 10,
      });
    });
  });
});
