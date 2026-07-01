import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateCharacterDto } from './dto/create-character.dto';
import { UpdateCharacterDto } from './dto/update-character.dto';

@Injectable()
export class CharacterService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly i18n: I18nService,
  ) {}

  async findAllByUser(userId: string) {
    const { data, error } = await this.supabase
      .from('characters')
      .select('*, classes(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  async findOneByUser(id: string, userId: string) {
    const { data, error } = await this.supabase
      .from('characters')
      .select('*, classes(*)')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      throw new NotFoundException(this.i18n.t('errors.character.not_found'));
    }

    return data;
  }

  async create(userId: string, dto: CreateCharacterDto) {
    const { data, error } = await this.supabase
      .from('characters')
      .insert({
        user_id: userId,
        class_id: dto.classId,
        name: dto.name,
        level: dto.level ?? 1,
      })
      .select('*, classes(*)')
      .single();

    if (error) throw error;
    return data;
  }

  async update(id: string, userId: string, dto: UpdateCharacterDto) {
    await this.findOneByUser(id, userId);

    const updateData: Record<string, unknown> = {};
    if (dto.name) updateData['name'] = dto.name;
    if (dto.classId) updateData['class_id'] = dto.classId;
    if (dto.level !== undefined) updateData['level'] = dto.level;

    const { data, error } = await this.supabase
      .from('characters')
      .update(updateData)
      .eq('id', id)
      .select('*, classes(*)')
      .single();

    if (error) throw error;
    return data;
  }

  async remove(id: string, userId: string) {
    const character = await this.findOneByUser(id, userId);

    // Block deletion while sessions still reference this character, and return
    // a clear message instead of a raw foreign-key violation (Postgres 23503).
    const { count, error: countError } = await this.supabase
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .eq('character_id', id)
      .eq('user_id', userId);

    if (countError) throw countError;

    if (count && count > 0) {
      throw new ConflictException(
        this.i18n.t('errors.character.delete_has_sessions', {
          args: { name: character.name, count },
        }),
      );
    }

    const { error } = await this.supabase
      .from('characters')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return { deleted: true };
  }
}
