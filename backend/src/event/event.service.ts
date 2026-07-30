import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateEventDto } from './dto/create-event.dto';

// Fields the public calendar needs. `created_by` is included so the client can
// show edit/delete only on the viewer's own rows (a UUID, no email); the
// backend is still the real gate on every mutation.
const LIST_COLUMNS =
  'id, title, start_date, end_date, detail, link, created_at, created_by';

// How far back the public calendar carries ended events. All upcoming/ongoing
// events (end_date >= today) are always returned; only events that ended more
// than this many days ago are dropped, so the payload of this public, SEO page
// stays bounded as community entries accumulate instead of shipping the whole
// history on every load.
const LIST_WINDOW_DAYS = 90;

@Injectable()
export class EventService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly i18n: I18nService,
  ) {}

  // Public: the timetable from LIST_WINDOW_DAYS ago onward, soonest-starting
  // first. The calendar renders a month at a time client-side, so the (bounded)
  // list is returned and the month windowing happens on the client where "now"
  // is the viewer's clock. The limit is a safety net; the date window is the
  // real bound.
  async list() {
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - LIST_WINDOW_DAYS);
    const from = cutoff.toISOString().slice(0, 10);
    const { data, error } = await this.supabase
      .from('game_events')
      .select(LIST_COLUMNS)
      .gte('end_date', from)
      .order('start_date', { ascending: true })
      .limit(1000);
    if (error) throw error;
    return data ?? [];
  }

  async create(userId: string, dto: CreateEventDto) {
    const { title, startDate, endDate, detail, link } = this.normalize(dto);
    const { data, error } = await this.supabase
      .from('game_events')
      .insert({
        title,
        start_date: startDate,
        end_date: endDate,
        detail,
        link,
        created_by: userId,
      })
      .select(LIST_COLUMNS)
      .single();
    if (error) throw error;
    return data;
  }

  // Owner-only edit; assertOwned 404s for anyone else (and the `created_by`
  // filter on the write is a second guard).
  async update(id: string, userId: string, dto: CreateEventDto) {
    await this.assertOwned(id, userId);
    return this.writeUpdate(id, dto, userId);
  }

  async remove(id: string, userId: string) {
    await this.assertOwned(id, userId);
    const { error } = await this.supabase
      .from('game_events')
      .delete()
      .eq('id', id)
      .eq('created_by', userId);
    if (error) throw error;
    return { deleted: true };
  }

  // --- admin moderation ---------------------------------------------------------
  // Called from AdminController behind JwtAuthGuard + AdminGuard.

  // Every event with its author, paged + searched so the payload stays bounded.
  async listAllAsAdmin(opts: { search?: string; page?: number } = {}) {
    const pageSize = 10;
    const page = Math.max(1, opts.page ?? 1);
    let query = this.supabase
      .from('game_events')
      .select(
        'id, title, start_date, end_date, detail, link, created_at, ' +
          'updated_at, created_by, profiles(username)',
        { count: 'exact' },
      );
    if (opts.search) {
      // strip PostgREST filter syntax so free text cannot break the expression
      const q = opts.search.replace(/[%,()\\]/g, '');
      // Match title OR detail, mirroring the public page's filter.
      if (q) query = query.or(`title.ilike.%${q}%,detail.ilike.%${q}%`);
    }
    const { data, error, count } = await query
      .order('start_date', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);
    if (error) throw error;
    return { events: data ?? [], total: count ?? 0, page, pageSize };
  }

  async updateAsAdmin(id: string, dto: CreateEventDto) {
    return this.writeUpdate(id, dto, null);
  }

  async removeAsAdmin(id: string) {
    const { data, error } = await this.supabase
      .from('game_events')
      .delete()
      .eq('id', id)
      .select('id');
    if (error) throw error;
    if (!data?.length) {
      throw new NotFoundException(this.i18n.t('errors.event.not_found'));
    }
    return { deleted: true };
  }

  // --- helpers ----------------------------------------------------------------

  // Trim the title, trim the detail, normalise the dates to YYYY-MM-DD, and
  // reject an end date earlier than the start date.
  private normalize(dto: CreateEventDto) {
    const title = dto.title.trim();
    if (!title) {
      throw new BadRequestException(this.i18n.t('errors.event.required'));
    }
    const detail = dto.detail?.trim() || null;
    const link = dto.link?.trim() || null;
    const startDate = this.toDateOnly(dto.startDate);
    const endDate = this.toDateOnly(dto.endDate);
    if (endDate < startDate) {
      throw new BadRequestException(this.i18n.t('errors.event.date_order'));
    }
    return { title, startDate, endDate, detail, link };
  }

  // A `date` column stores day granularity; keep only the YYYY-MM-DD part so a
  // timestamp with a timezone offset can't shift the stored day.
  private toDateOnly(value: string): string {
    return value.slice(0, 10);
  }

  // Shared write for owner and admin edits. `ownerId` scopes the update to the
  // author (owner path); admins pass null to touch any row.
  private async writeUpdate(
    id: string,
    dto: CreateEventDto,
    ownerId: string | null,
  ) {
    const { title, startDate, endDate, detail, link } = this.normalize(dto);
    let query = this.supabase
      .from('game_events')
      .update({
        title,
        start_date: startDate,
        end_date: endDate,
        detail,
        link,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (ownerId) query = query.eq('created_by', ownerId);

    const { data, error } = await query.select(LIST_COLUMNS).maybeSingle();
    if (error) throw error;
    if (!data) {
      throw new NotFoundException(this.i18n.t('errors.event.not_found'));
    }
    return data;
  }

  private async assertOwned(id: string, userId: string) {
    const { data, error } = await this.supabase
      .from('game_events')
      .select('id')
      .eq('id', id)
      .eq('created_by', userId)
      .single();
    if (error || !data) {
      throw new NotFoundException(this.i18n.t('errors.event.not_found'));
    }
  }
}
