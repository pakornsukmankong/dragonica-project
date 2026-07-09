import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SkillService } from './skill.service';
import { createSupabaseMock } from '../test/supabase.mock';

const USER = 'user-1';

// Minimal i18n stub — tests assert on exception type, not localized text.
const i18n = {
  t: (key: string) => key,
} as unknown as import('nestjs-i18n').I18nService;

describe('SkillService (social)', () => {
  describe('toggleLike', () => {
    it('likes on first toggle and returns the fresh count', async () => {
      const { service: supabase, fromTables } = createSupabaseMock([
        { data: { id: 'b1' }, error: null }, // slug -> build id
        { data: null, error: null }, // insert like
        { data: { like_count: 1 }, error: null }, // re-read count
      ]);
      const svc = new SkillService(supabase, i18n);

      const result = await svc.toggleLike('slug1', USER);
      expect(result).toEqual({ liked: true, likeCount: 1 });
      expect(fromTables).toEqual([
        'skill_builds',
        'skill_build_likes',
        'skill_builds',
      ]);
    });

    it('unlikes when the insert hits the unique key (23505)', async () => {
      const { service: supabase, fromTables } = createSupabaseMock([
        { data: { id: 'b1' }, error: null }, // slug -> build id
        { data: null, error: { code: '23505' } }, // insert rejected: already liked
        { data: null, error: null }, // delete like
        { data: { like_count: 0 }, error: null }, // re-read count
      ]);
      const svc = new SkillService(supabase, i18n);

      const result = await svc.toggleLike('slug1', USER);
      expect(result).toEqual({ liked: false, likeCount: 0 });
      expect(fromTables).toEqual([
        'skill_builds',
        'skill_build_likes',
        'skill_build_likes',
        'skill_builds',
      ]);
    });

    it('throws NotFound for an unknown slug before touching likes', async () => {
      const { service: supabase, fromTables } = createSupabaseMock([
        { data: null, error: { code: 'PGRST116' } },
      ]);
      const svc = new SkillService(supabase, i18n);

      await expect(svc.toggleLike('nope', USER)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(fromTables).toEqual(['skill_builds']);
    });
  });

  describe('recordView', () => {
    it('returns the incremented count from the RPC', async () => {
      const { service: supabase } = createSupabaseMock([]);
      (supabase as unknown as { rpc: jest.Mock }).rpc = jest
        .fn()
        .mockResolvedValue({ data: 5, error: null });
      const svc = new SkillService(supabase, i18n);

      await expect(svc.recordView('slug1')).resolves.toEqual({ viewCount: 5 });
    });

    it('throws NotFound when the slug matches no build', async () => {
      const { service: supabase } = createSupabaseMock([]);
      (supabase as unknown as { rpc: jest.Mock }).rpc = jest
        .fn()
        .mockResolvedValue({ data: null, error: null });
      const svc = new SkillService(supabase, i18n);

      await expect(svc.recordView('nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('addComment', () => {
    it('rejects whitespace-only bodies before any query', async () => {
      const { service: supabase, fromTables } = createSupabaseMock([]);
      const svc = new SkillService(supabase, i18n);

      await expect(
        svc.addComment('slug1', USER, { body: '   ' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(fromTables).toEqual([]);
    });

    it('trims the body and returns the inserted row', async () => {
      const inserted = {
        id: 'c1',
        body: 'nice build',
        author_id: USER,
        profiles: { username: 'flok' },
      };
      const { service: supabase, fromTables } = createSupabaseMock([
        { data: { id: 'b1' }, error: null }, // slug -> build id
        { data: inserted, error: null }, // insert comment
      ]);
      const svc = new SkillService(supabase, i18n);

      const result = await svc.addComment('slug1', USER, {
        body: '  nice build  ',
      });
      expect(result).toEqual(inserted);
      expect(fromTables).toEqual(['skill_builds', 'skill_build_comments']);
    });
  });

  describe('deleteComment', () => {
    it("throws NotFound when the comment is not the caller's", async () => {
      const { service: supabase, fromTables } = createSupabaseMock([
        { data: { role: 'user' }, error: null }, // role lookup
        { data: [], error: null }, // delete matched no rows
      ]);
      const svc = new SkillService(supabase, i18n);

      await expect(svc.deleteComment('c1', USER)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(fromTables).toEqual(['profiles', 'skill_build_comments']);
    });

    it('deletes own comment', async () => {
      const { service: supabase } = createSupabaseMock([
        { data: { role: 'user' }, error: null },
        { data: [{ id: 'c1' }], error: null },
      ]);
      const svc = new SkillService(supabase, i18n);

      await expect(svc.deleteComment('c1', USER)).resolves.toEqual({
        deleted: true,
      });
    });

    it("lets an admin delete someone else's comment (no author filter)", async () => {
      const { service: supabase } = createSupabaseMock([
        { data: { role: 'admin' }, error: null },
        { data: [{ id: 'c1' }], error: null },
      ]);
      const svc = new SkillService(supabase, i18n);

      await expect(svc.deleteComment('c1', 'admin-1')).resolves.toEqual({
        deleted: true,
      });
    });
  });

  describe('admin moderation', () => {
    it('updateBuildAsAdmin patches only provided fields', async () => {
      const updated = { id: 'b1', name: 'Renamed', visibility: 'unlisted' };
      const { service: supabase, fromTables } = createSupabaseMock([
        { data: updated, error: null },
      ]);
      const svc = new SkillService(supabase, i18n);

      await expect(
        svc.updateBuildAsAdmin('b1', { visibility: 'unlisted' }),
      ).resolves.toEqual(updated);
      expect(fromTables).toEqual(['skill_builds']);
    });

    it('updateBuildAsAdmin rejects an empty patch before any query', async () => {
      const { service: supabase, fromTables } = createSupabaseMock([]);
      const svc = new SkillService(supabase, i18n);

      await expect(svc.updateBuildAsAdmin('b1', {})).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(fromTables).toEqual([]);
    });

    it('updateBuildAsAdmin throws NotFound for an unknown id', async () => {
      const { service: supabase } = createSupabaseMock([
        { data: null, error: null },
      ]);
      const svc = new SkillService(supabase, i18n);

      await expect(
        svc.updateBuildAsAdmin('nope', { name: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('deleteBuildAsAdmin deletes any build without an owner filter', async () => {
      const { service: supabase } = createSupabaseMock([
        { data: [{ id: 'b1' }], error: null },
      ]);
      const svc = new SkillService(supabase, i18n);

      await expect(svc.deleteBuildAsAdmin('b1')).resolves.toEqual({
        deleted: true,
      });
    });

    it('deleteBuildAsAdmin throws NotFound when nothing matched', async () => {
      const { service: supabase } = createSupabaseMock([
        { data: [], error: null },
      ]);
      const svc = new SkillService(supabase, i18n);

      await expect(svc.deleteBuildAsAdmin('nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
