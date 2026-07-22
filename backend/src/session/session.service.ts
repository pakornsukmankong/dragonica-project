import { Injectable, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { SupabaseService } from '../supabase/supabase.service';
import { TablesUpdate } from '../supabase/types/database.types';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { CreateDropDto } from './dto/create-drop.dto';
import { CreateDropsBulkDto } from './dto/create-drops-bulk.dto';
import { ListSessionsQueryDto } from './dto/list-sessions-query.dto';
import { UpdateDropDto } from './dto/update-drop.dto';

@Injectable()
export class SessionService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly i18n: I18nService,
  ) {}

  async findAllByUser(userId: string, query?: ListSessionsQueryDto) {
    let q = this.supabase
      .from('sessions')
      .select(
        '*, characters(*, classes(*)), dungeons(*), session_drops(*, items(*))',
        { count: 'exact' },
      )
      .eq('user_id', userId);

    if (query?.characterId) q = q.eq('character_id', query.characterId);
    if (query?.dateFrom) q = q.gte('started_at', query.dateFrom);
    if (query?.dateTo) {
      // Inclusive through the end of the given day.
      q = q.lte('started_at', `${query.dateTo}T23:59:59.999Z`);
    }

    if (query?.sortBy === 'gold') {
      q = q.order('gold_earned', { ascending: false });
    } else {
      q = q
        .order('started_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });
    }

    // Paginated shape only when the client asks for a page; the dashboard
    // still consumes the whole history as a plain array.
    if (query?.page) {
      const limit = query.limit ?? 10;
      const from = (query.page - 1) * limit;
      const { data, count, error } = await q.range(from, from + limit - 1);
      if (error) throw error;
      return { data, total: count ?? 0 };
    }

    const { data, error } = await q;
    if (error) throw error;
    return data;
  }

  async findOneByUser(id: string, userId: string) {
    const { data, error } = await this.supabase
      .from('sessions')
      .select(
        '*, characters(*, classes(*)), dungeons(*), session_drops(*, items(*))',
      )
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      throw new NotFoundException(this.i18n.t('errors.session.not_found'));
    }

    return data;
  }

  async create(userId: string, dto: CreateSessionDto) {
    const { data, error } = await this.supabase
      .from('sessions')
      .insert({
        user_id: userId,
        character_id: dto.characterId,
        dungeon_id: dto.dungeonId,
        started_at: dto.startedAt,
        ended_at: dto.endedAt,
        stamina_used: dto.staminaUsed,
        gold_earned: dto.goldEarned ?? 0,
        gold_dropped: dto.goldDropped ?? 0,
        note: dto.note,
      })
      .select('*, characters(*, classes(*)), dungeons(*)')
      .single();

    if (error) throw error;
    return data;
  }

  async update(id: string, userId: string, dto: UpdateSessionDto) {
    await this.findOneByUser(id, userId);

    const updateData: TablesUpdate<'sessions'> = {};
    if (dto.characterId) updateData['character_id'] = dto.characterId;
    if (dto.dungeonId) updateData['dungeon_id'] = dto.dungeonId;
    if (dto.startedAt) updateData['started_at'] = dto.startedAt;
    if (dto.endedAt) updateData['ended_at'] = dto.endedAt;
    if (dto.staminaUsed !== undefined)
      updateData['stamina_used'] = dto.staminaUsed;
    if (dto.goldEarned !== undefined)
      updateData['gold_earned'] = dto.goldEarned;
    if (dto.goldDropped !== undefined)
      updateData['gold_dropped'] = dto.goldDropped;
    if (dto.note !== undefined) updateData['note'] = dto.note;

    const { data, error } = await this.supabase
      .from('sessions')
      .update(updateData)
      .eq('id', id)
      .select('*, characters(*, classes(*)), dungeons(*)')
      .single();

    if (error) throw error;
    return data;
  }

  async remove(id: string, userId: string) {
    await this.findOneByUser(id, userId);

    await this.supabase.from('session_drops').delete().eq('session_id', id);

    const { error } = await this.supabase
      .from('sessions')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return { deleted: true };
  }

  // ===== ADMIN =====
  // These operate on a session by id alone (no user-ownership filter). They are
  // only reachable through AdminController, which is behind AdminGuard.

  async findOneAsAdmin(id: string) {
    const { data, error } = await this.supabase
      .from('sessions')
      .select(
        '*, characters(*, classes(*)), dungeons(*), session_drops(*, items(*))',
      )
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundException(this.i18n.t('errors.session.not_found'));
    }
    return data;
  }

  async updateAsAdmin(id: string, dto: UpdateSessionDto) {
    await this.findOneAsAdmin(id);

    const updateData: TablesUpdate<'sessions'> = {};
    if (dto.characterId) updateData['character_id'] = dto.characterId;
    if (dto.dungeonId) updateData['dungeon_id'] = dto.dungeonId;
    if (dto.startedAt) updateData['started_at'] = dto.startedAt;
    if (dto.endedAt) updateData['ended_at'] = dto.endedAt;
    if (dto.staminaUsed !== undefined)
      updateData['stamina_used'] = dto.staminaUsed;
    if (dto.goldEarned !== undefined)
      updateData['gold_earned'] = dto.goldEarned;
    if (dto.goldDropped !== undefined)
      updateData['gold_dropped'] = dto.goldDropped;
    if (dto.note !== undefined) updateData['note'] = dto.note;

    const { data, error } = await this.supabase
      .from('sessions')
      .update(updateData)
      .eq('id', id)
      .select('*, characters(*, classes(*)), dungeons(*)')
      .single();

    if (error) throw error;
    return data;
  }

  async removeAsAdmin(id: string) {
    await this.findOneAsAdmin(id);

    await this.supabase.from('session_drops').delete().eq('session_id', id);

    const { error } = await this.supabase
      .from('sessions')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return { deleted: true };
  }

  async removeAllByUser(userId: string) {
    // Collect the user's session ids so we can clear their drops first
    // (FK), then delete the sessions. Scoped to the user — RLS is bypassed.
    const { data: sessions, error: listError } = await this.supabase
      .from('sessions')
      .select('id')
      .eq('user_id', userId);

    if (listError) throw listError;

    const ids = (sessions ?? []).map((s: { id: string }) => s.id);
    if (ids.length === 0) return { deleted: 0 };

    await this.supabase.from('session_drops').delete().in('session_id', ids);

    const { error } = await this.supabase
      .from('sessions')
      .delete()
      .eq('user_id', userId);

    if (error) throw error;
    return { deleted: ids.length };
  }

  async addDropsBulk(userId: string, dto: CreateDropsBulkDto) {
    // RLS is bypassed (service-role key), so verify the session belongs to
    // the user before attaching drops to it — once for the whole batch.
    await this.findOneByUser(dto.sessionId, userId);

    const { data, error } = await this.supabase
      .from('session_drops')
      .insert(
        dto.drops.map((d) => ({
          session_id: dto.sessionId,
          item_id: d.itemId,
          quantity: d.quantity,
          price_each: d.priceEach ?? 0,
        })),
      )
      .select('*, items(*)');

    if (error) throw error;
    return data;
  }

  async addDrop(userId: string, dto: CreateDropDto) {
    // RLS is bypassed (service-role key), so verify the session belongs to
    // the user before attaching a drop to it.
    await this.findOneByUser(dto.sessionId, userId);

    const { data, error } = await this.supabase
      .from('session_drops')
      .insert({
        session_id: dto.sessionId,
        item_id: dto.itemId,
        quantity: dto.quantity,
        price_each: dto.priceEach ?? 0,
      })
      .select('*, items(*)')
      .single();

    if (error) throw error;
    return data;
  }

  // Look up which session a drop belongs to and verify the user owns it.
  // RLS is bypassed, so this ownership check is enforced in code.
  private async assertDropOwnership(userId: string, dropId: string) {
    const { data: drop, error } = await this.supabase
      .from('session_drops')
      .select('id, session_id')
      .eq('id', dropId)
      .single();

    if (error || !drop) {
      throw new NotFoundException(this.i18n.t('errors.session.drop_not_found'));
    }

    await this.findOneByUser(drop.session_id, userId);
  }

  async updateDrop(userId: string, dropId: string, dto: UpdateDropDto) {
    await this.assertDropOwnership(userId, dropId);

    const updateData: TablesUpdate<'session_drops'> = {};
    if (dto.quantity !== undefined) updateData['quantity'] = dto.quantity;
    if (dto.priceEach !== undefined) updateData['price_each'] = dto.priceEach;

    const { data, error } = await this.supabase
      .from('session_drops')
      .update(updateData)
      .eq('id', dropId)
      .select('*, items(*)')
      .single();

    if (error) throw error;
    return data;
  }

  async removeDrop(userId: string, dropId: string) {
    await this.assertDropOwnership(userId, dropId);

    const { error } = await this.supabase
      .from('session_drops')
      .delete()
      .eq('id', dropId);

    if (error) throw error;
    return { deleted: true };
  }

  // Admin drop mutations: RLS is bypassed and there is no ownership check —
  // an admin may edit the drops of any user's session. We only verify the
  // parent session exists before attaching a new drop.
  async addDropAsAdmin(dto: CreateDropDto) {
    await this.findOneAsAdmin(dto.sessionId);

    const { data, error } = await this.supabase
      .from('session_drops')
      .insert({
        session_id: dto.sessionId,
        item_id: dto.itemId,
        quantity: dto.quantity,
        price_each: dto.priceEach ?? 0,
      })
      .select('*, items(*)')
      .single();

    if (error) throw error;
    return data;
  }

  async updateDropAsAdmin(dropId: string, dto: UpdateDropDto) {
    const updateData: TablesUpdate<'session_drops'> = {};
    if (dto.quantity !== undefined) updateData['quantity'] = dto.quantity;
    if (dto.priceEach !== undefined) updateData['price_each'] = dto.priceEach;

    const { data, error } = await this.supabase
      .from('session_drops')
      .update(updateData)
      .eq('id', dropId)
      .select('*, items(*)')
      .single();

    if (error || !data) {
      throw new NotFoundException(this.i18n.t('errors.session.drop_not_found'));
    }
    return data;
  }

  async removeDropAsAdmin(dropId: string) {
    const { error } = await this.supabase
      .from('session_drops')
      .delete()
      .eq('id', dropId);

    if (error) throw error;
    return { deleted: true };
  }
}
