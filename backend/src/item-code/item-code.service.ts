import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateItemCodeDto } from './dto/create-item-code.dto';

// Fields the public list needs. `created_by` is included so the client can show
// edit/delete only on the viewer's own rows (a UUID, no email); the backend is
// still the real gate on every mutation.
const LIST_COLUMNS =
  'id, code, description, start_date, expire_date, created_at, created_by';

@Injectable()
export class ItemCodeService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly i18n: I18nService,
  ) {}

  // Public: the whole list, newest first. Active-first / soonest-expiry
  // ordering is done on the client, where "now" is the viewer's clock and the
  // status badge is computed from the same value.
  async list() {
    const { data, error } = await this.supabase
      .from('item_codes')
      .select(LIST_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) throw error;
    return data ?? [];
  }

  async create(userId: string, dto: CreateItemCodeDto) {
    const { code, description, start, expire } = this.normalize(dto);
    const { data, error } = await this.supabase
      .from('item_codes')
      .insert({
        code,
        description,
        start_date: start,
        expire_date: expire,
        created_by: userId,
      })
      .select(LIST_COLUMNS)
      .single();
    if (error) throw this.mapWriteError(error);
    return data;
  }

  // Owner-only edit; assertOwned 404s for anyone else (and the `created_by`
  // filter on the write is a second guard).
  async update(id: string, userId: string, dto: CreateItemCodeDto) {
    await this.assertOwned(id, userId);
    return this.writeUpdate(id, dto, userId);
  }

  async remove(id: string, userId: string) {
    await this.assertOwned(id, userId);
    const { error } = await this.supabase
      .from('item_codes')
      .delete()
      .eq('id', id)
      .eq('created_by', userId);
    if (error) throw error;
    return { deleted: true };
  }

  // --- admin moderation ---------------------------------------------------------
  // Called from AdminController behind JwtAuthGuard + AdminGuard.

  // Every code with its author, paged + searched so the payload stays bounded.
  async listAllAsAdmin(opts: { search?: string; page?: number } = {}) {
    const pageSize = 10;
    const page = Math.max(1, opts.page ?? 1);
    let query = this.supabase
      .from('item_codes')
      .select(
        'id, code, description, start_date, expire_date, created_at, ' +
          'updated_at, created_by, profiles(username)',
        { count: 'exact' },
      );
    if (opts.search) {
      // strip PostgREST filter syntax so free text cannot break the expression
      const q = opts.search.replace(/[%,()\\]/g, '');
      // Match code OR description, mirroring the public page's filter — an
      // admin searching "mount" should find the code that grants one.
      if (q) query = query.or(`code.ilike.%${q}%,description.ilike.%${q}%`);
    }
    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);
    if (error) throw error;
    return { codes: data ?? [], total: count ?? 0, page, pageSize };
  }

  async updateAsAdmin(id: string, dto: CreateItemCodeDto) {
    return this.writeUpdate(id, dto, null);
  }

  async removeAsAdmin(id: string) {
    const { data, error } = await this.supabase
      .from('item_codes')
      .delete()
      .eq('id', id)
      .select('id');
    if (error) throw error;
    if (!data?.length) {
      throw new NotFoundException(this.i18n.t('errors.itemCode.not_found'));
    }
    return { deleted: true };
  }

  // --- helpers ----------------------------------------------------------------

  // Trim + uppercase the code, trim the description, parse the dates, and
  // reject start-after-expire.
  private normalize(dto: CreateItemCodeDto) {
    const code = dto.code.trim().toUpperCase();
    if (!code) {
      throw new BadRequestException(this.i18n.t('errors.itemCode.required'));
    }
    const description = dto.description?.trim() || null;
    const start = dto.startDate ? new Date(dto.startDate) : null;
    const expire = dto.expireDate ? new Date(dto.expireDate) : null;
    if (start && expire && start.getTime() > expire.getTime()) {
      throw new BadRequestException(this.i18n.t('errors.itemCode.date_order'));
    }
    return {
      code,
      description,
      start: start ? start.toISOString() : null,
      expire: expire ? expire.toISOString() : null,
    };
  }

  // Shared write for owner and admin edits. `ownerId` scopes the update to the
  // author (owner path); admins pass null to touch any row.
  private async writeUpdate(
    id: string,
    dto: CreateItemCodeDto,
    ownerId: string | null,
  ) {
    const { code, description, start, expire } = this.normalize(dto);
    let query = this.supabase
      .from('item_codes')
      .update({
        code,
        description,
        start_date: start,
        expire_date: expire,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (ownerId) query = query.eq('created_by', ownerId);

    const { data, error } = await query.select(LIST_COLUMNS).maybeSingle();
    if (error) throw this.mapWriteError(error);
    if (!data) {
      throw new NotFoundException(this.i18n.t('errors.itemCode.not_found'));
    }
    return data;
  }

  private async assertOwned(id: string, userId: string) {
    const { data, error } = await this.supabase
      .from('item_codes')
      .select('id')
      .eq('id', id)
      .eq('created_by', userId)
      .single();
    if (error || !data) {
      throw new NotFoundException(this.i18n.t('errors.itemCode.not_found'));
    }
  }

  // Unique index on upper(code) — a duplicate slipped past the client's
  // pre-check (race) or came in via a direct API call.
  private mapWriteError(error: { code?: string }) {
    if (error.code === '23505') {
      return new ConflictException(this.i18n.t('errors.itemCode.duplicate'));
    }
    return error;
  }
}
