import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { I18nService } from 'nestjs-i18n';
import { SupabaseService } from '../supabase/supabase.service';
import { SaveBuildDto } from './dto/save-build.dto';
import { AdminUpdateBuildDto } from './dto/admin-update-build.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import {
  SkillDef,
  spBaseForClass,
  validateBuild,
} from './skill-build.validator';

interface SkillRow {
  id: number;
  max_level: number;
  req_level: number;
  prerequisites: { id: number; level: number }[] | null;
  class_bits: number[];
  levels: { level: number; reqLevel: number; sp?: number }[] | null;
}

@Injectable()
export class SkillService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly i18n: I18nService,
  ) {}

  // --- reference data ---------------------------------------------------------

  async listClasses() {
    const { data, error } = await this.supabase
      .from('skill_classes')
      .select('*')
      .order('sort_order');
    if (error) throw error;
    return data;
  }

  async listSkills(classId: number) {
    const { data, error } = await this.supabase
      .from('skills')
      .select('*')
      .contains('class_bits', [classId])
      .order('req_level');
    if (error) throw error;
    return data;
  }

  // Class metadata + its full skill tree in one call (drives the simulator page).
  async getClassTree(classId: number) {
    const { data: cls, error } = await this.supabase
      .from('skill_classes')
      .select('*')
      .eq('id', classId)
      .single();
    if (error || !cls) {
      throw new NotFoundException(this.i18n.t('errors.skill.class_not_found'));
    }
    const skills = await this.listSkills(classId);
    return { class: cls, skills };
  }

  // --- builds -----------------------------------------------------------------

  async listMyBuilds(userId: string) {
    const { data, error } = await this.supabase
      .from('skill_builds')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return data;
  }

  // Public community gallery: everyone's builds marked `public`.
  async listPublicBuilds(opts: {
    classId?: number;
    search?: string;
    sort?: string;
    page?: number;
  }) {
    const pageSize = 24;
    const page = Math.max(1, opts.page ?? 1);
    let query = this.supabase
      .from('skill_builds')
      .select(
        // profiles must name its FK: skill_build_likes adds a second
        // skill_builds<->profiles relationship, making a bare embed ambiguous.
        'id, share_slug, name, description, class_id, char_level, created_at, ' +
          'like_count, view_count, comment_count, ' +
          'profiles!skill_builds_user_id_fkey(username), skill_classes(name, base_class)',
        { count: 'exact' },
      )
      .eq('visibility', 'public');

    if (opts.classId) query = query.eq('class_id', opts.classId);
    if (opts.search) {
      // strip PostgREST filter syntax so free text cannot break the .or() expression
      const q = opts.search.replace(/[%,()\\]/g, '');
      if (q) query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`);
    }
    if (opts.sort === 'popular') {
      query = query
        .order('like_count', { ascending: false })
        .order('created_at', { ascending: false });
    } else {
      query = query.order('created_at', { ascending: false });
    }
    query = query.range((page - 1) * pageSize, page * pageSize - 1);

    const { data, error, count } = await query;
    if (error) throw error;
    return { builds: data ?? [], total: count ?? 0, page, pageSize };
  }

  // Anyone holding the share link may view the build (that is what an unlisted
  // link grants); the `visibility` flag only governs public gallery listing.
  // The class join feeds the share page's Open Graph metadata.
  async getBuildBySlug(slug: string) {
    const { data, error } = await this.supabase
      .from('skill_builds')
      .select('*, skill_classes(name, base_class)')
      .eq('share_slug', slug)
      .single();
    if (error || !data) {
      throw new NotFoundException(this.i18n.t('errors.skill.build_not_found'));
    }
    return data;
  }

  async createBuild(userId: string, dto: SaveBuildDto) {
    await this.assertValid(dto);
    const slug = this.uniqueSlug();
    const { data, error } = await this.supabase
      .from('skill_builds')
      .insert({
        user_id: userId,
        class_id: dto.classId,
        name: dto.name ?? 'Untitled Build',
        description: dto.description ?? null,
        char_level: dto.charLevel,
        bonus_sp: dto.bonusSp ?? 0,
        allocations: dto.allocations,
        visibility: dto.visibility ?? 'unlisted',
        share_slug: slug,
      })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async updateBuild(id: string, userId: string, dto: SaveBuildDto) {
    await this.assertOwned(id, userId);
    await this.assertValid(dto);
    const { data, error } = await this.supabase
      .from('skill_builds')
      .update({
        class_id: dto.classId,
        name: dto.name,
        description: dto.description ?? null,
        char_level: dto.charLevel,
        bonus_sp: dto.bonusSp ?? 0,
        allocations: dto.allocations,
        visibility: dto.visibility,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async deleteBuild(id: string, userId: string) {
    await this.assertOwned(id, userId);
    const { error } = await this.supabase
      .from('skill_builds')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    if (error) throw error;
    return { deleted: true };
  }

  // --- social: likes, comments, views ------------------------------------------

  // Insert-first toggle: the composite PK rejects a second like (23505), which
  // we treat as "already liked" and unlike instead. Never check-then-act, so
  // concurrent double-clicks cannot 500. A DB trigger keeps like_count exact.
  async toggleLike(slug: string, userId: string) {
    const buildId = await this.getBuildIdBySlug(slug);
    let liked = true;
    const { error } = await this.supabase
      .from('skill_build_likes')
      .insert({ build_id: buildId, user_id: userId });
    if (error?.code === '23505') {
      liked = false;
      const { error: delError } = await this.supabase
        .from('skill_build_likes')
        .delete()
        .eq('build_id', buildId)
        .eq('user_id', userId);
      if (delError) throw delError;
    } else if (error) {
      throw error;
    }
    const { data, error: countError } = await this.supabase
      .from('skill_builds')
      .select('like_count')
      .eq('id', buildId)
      .single();
    if (countError) throw countError;
    return { liked, likeCount: data.like_count };
  }

  async getLiked(slug: string, userId: string) {
    const buildId = await this.getBuildIdBySlug(slug);
    const { data, error } = await this.supabase
      .from('skill_build_likes')
      .select('build_id')
      .eq('build_id', buildId)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return { liked: !!data };
  }

  // Best-effort counter (deduped per session on the client, throttled per IP).
  async recordView(slug: string) {
    const { data, error } = await this.supabase.rpc('increment_build_view', {
      build_slug: slug,
    });
    if (error) throw error;
    if (data == null) {
      throw new NotFoundException(this.i18n.t('errors.skill.build_not_found'));
    }
    return { viewCount: Number(data) };
  }

  async listComments(slug: string) {
    const buildId = await this.getBuildIdBySlug(slug);
    const { data, error } = await this.supabase
      .from('skill_build_comments')
      .select('id, body, created_at, author_id, profiles(username)')
      .eq('build_id', buildId)
      .order('created_at', { ascending: true })
      .limit(200);
    if (error) throw error;
    return data ?? [];
  }

  async addComment(slug: string, userId: string, dto: CreateCommentDto) {
    const body = dto.body.trim();
    if (!body) {
      throw new BadRequestException(this.i18n.t('errors.skill.comment_empty'));
    }
    const buildId = await this.getBuildIdBySlug(slug);
    const { data, error } = await this.supabase
      .from('skill_build_comments')
      .insert({ build_id: buildId, author_id: userId, body })
      .select('id, body, created_at, author_id, profiles(username)')
      .single();
    if (error) throw error;
    return data;
  }

  // Authors delete their own comments; admins may moderate anyone's.
  async deleteComment(commentId: string, userId: string) {
    const { data: profile } = await this.supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();
    let query = this.supabase
      .from('skill_build_comments')
      .delete()
      .eq('id', commentId);
    if (profile?.role !== 'admin') {
      query = query.eq('author_id', userId);
    }
    const { data, error } = await query.select('id');
    if (error) throw error;
    if (!data?.length) {
      throw new NotFoundException(
        this.i18n.t('errors.skill.comment_not_found'),
      );
    }
    return { deleted: true };
  }

  // --- admin moderation ---------------------------------------------------------
  // Called from AdminController behind JwtAuthGuard + AdminGuard.

  // Every build (public and unlisted) with author + class, for the admin table.
  async listAllBuildsAsAdmin() {
    const { data, error } = await this.supabase
      .from('skill_builds')
      .select(
        'id, share_slug, name, description, class_id, char_level, visibility, ' +
          'like_count, view_count, comment_count, created_at, updated_at, ' +
          'profiles!skill_builds_user_id_fkey(username), skill_classes(name, base_class)',
      )
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  // Metadata-only moderation edit (rename, rewrite description, unlist).
  async updateBuildAsAdmin(id: string, dto: AdminUpdateBuildDto) {
    const patch: Record<string, unknown> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.description !== undefined)
      patch.description = dto.description || null;
    if (dto.visibility !== undefined) patch.visibility = dto.visibility;
    if (Object.keys(patch).length === 0) {
      throw new BadRequestException(
        this.i18n.t('errors.skill.nothing_to_update'),
      );
    }
    patch.updated_at = new Date().toISOString();
    const { data, error } = await this.supabase
      .from('skill_builds')
      .update(patch)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      throw new NotFoundException(this.i18n.t('errors.skill.build_not_found'));
    }
    return data;
  }

  async deleteBuildAsAdmin(id: string) {
    const { data, error } = await this.supabase
      .from('skill_builds')
      .delete()
      .eq('id', id)
      .select('id');
    if (error) throw error;
    if (!data?.length) {
      throw new NotFoundException(this.i18n.t('errors.skill.build_not_found'));
    }
    return { deleted: true };
  }

  // Comments of one build by id (the public route resolves by slug instead).
  async listCommentsByBuildId(buildId: string) {
    const { data, error } = await this.supabase
      .from('skill_build_comments')
      .select('id, body, created_at, author_id, profiles(username)')
      .eq('build_id', buildId)
      .order('created_at', { ascending: true })
      .limit(200);
    if (error) throw error;
    return data ?? [];
  }

  // --- helpers ----------------------------------------------------------------

  private async getBuildIdBySlug(slug: string): Promise<string> {
    const { data, error } = await this.supabase
      .from('skill_builds')
      .select('id')
      .eq('share_slug', slug)
      .single();
    if (error || !data) {
      throw new NotFoundException(this.i18n.t('errors.skill.build_not_found'));
    }
    return data.id;
  }

  private async assertOwned(id: string, userId: string) {
    const { data, error } = await this.supabase
      .from('skill_builds')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();
    if (error || !data) {
      throw new NotFoundException(this.i18n.t('errors.skill.build_not_found'));
    }
  }

  // Server-authoritative validation: re-fetch the class's real skills and check
  // the submitted allocations against them (a client cannot fake a legal build).
  private async assertValid(dto: SaveBuildDto) {
    const rows = (await this.listSkills(dto.classId)) as SkillRow[];
    const skills: SkillDef[] = rows.map((r) => ({
      id: r.id,
      maxLevel: r.max_level,
      reqLevel: r.req_level,
      prerequisites: r.prerequisites ?? [],
      classBits: r.class_bits,
      levels: (r.levels ?? []).map((l) => ({
        level: l.level,
        reqLevel: l.reqLevel,
        sp: l.sp ?? 0,
      })),
    }));
    const result = validateBuild(
      skills,
      dto.charLevel,
      dto.allocations,
      spBaseForClass(dto.classId),
      dto.bonusSp ?? 0,
    );
    if (!result.valid) {
      throw new BadRequestException({
        message: this.i18n.t('errors.skill.invalid_build'),
        errors: result.errors,
      });
    }
  }

  // 8 chars from 6 random bytes — collision odds are negligible, and the unique
  // index on share_slug is the real guard (a dup would fail the insert).
  private uniqueSlug(): string {
    return randomBytes(6).toString('hex').slice(0, 8);
  }
}
