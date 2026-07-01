import { Injectable, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { CreateDropDto } from './dto/create-drop.dto';
import { UpdateDropDto } from './dto/update-drop.dto';

@Injectable()
export class SessionService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly i18n: I18nService,
  ) {}

  async findAllByUser(userId: string) {
    const { data, error } = await this.supabase
      .from('sessions')
      .select(
        '*, characters(*, classes(*)), dungeons(*), session_drops(*, items(*))',
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

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
        duration_minutes: dto.durationMinutes,
        gold_earned: dto.goldEarned ?? 0,
        gold_dropped: dto.goldDropped ?? 0,
      })
      .select('*, characters(*, classes(*)), dungeons(*)')
      .single();

    if (error) throw error;
    return data;
  }

  async update(id: string, userId: string, dto: UpdateSessionDto) {
    await this.findOneByUser(id, userId);

    const updateData: Record<string, unknown> = {};
    if (dto.characterId) updateData['character_id'] = dto.characterId;
    if (dto.dungeonId) updateData['dungeon_id'] = dto.dungeonId;
    if (dto.startedAt) updateData['started_at'] = dto.startedAt;
    if (dto.endedAt) updateData['ended_at'] = dto.endedAt;
    if (dto.durationMinutes !== undefined)
      updateData['duration_minutes'] = dto.durationMinutes;
    if (dto.goldEarned !== undefined)
      updateData['gold_earned'] = dto.goldEarned;
    if (dto.goldDropped !== undefined)
      updateData['gold_dropped'] = dto.goldDropped;

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

    const updateData: Record<string, unknown> = {};
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
}
