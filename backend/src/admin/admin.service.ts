import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateDungeonDto } from './dto/create-dungeon.dto';
import { CreateItemDto } from './dto/create-item.dto';
import { CreateClassDto } from './dto/create-class.dto';

interface ProfileRow {
  id: string;
  username: string | null;
  avatar_url: string | null;
  role: string | null;
  created_at: string;
}

@Injectable()
export class AdminService {
  constructor(private readonly supabase: SupabaseService) {}

  // ===== USERS =====
  /**
   * Every registered user with their email (from auth.users, via the admin
   * API), profile fields, and aggregated grind stats (session count + total
   * gold earned). Admin-only — reachable through AdminController.
   */
  async getUsers() {
    const { data: profiles, error } = await this.supabase
      .from('profiles')
      .select('id, username, avatar_url, role, created_at')
      .order('created_at', { ascending: false });
    if (error) throw error;

    // Emails live on auth.users, not profiles — fetched via the admin API.
    const emailById = await this.supabase.listUserEmails();

    // Aggregate session count + total gold per user in one pass.
    const { data: sessions, error: sessionError } = await this.supabase
      .from('sessions')
      .select('user_id, gold_earned');
    if (sessionError) throw sessionError;

    const stats = new Map<
      string,
      { sessionCount: number; totalGold: number }
    >();
    for (const s of (sessions ?? []) as {
      user_id: string;
      gold_earned: number | null;
    }[]) {
      const cur = stats.get(s.user_id) ?? { sessionCount: 0, totalGold: 0 };
      cur.sessionCount += 1;
      cur.totalGold += Number(s.gold_earned) || 0;
      stats.set(s.user_id, cur);
    }

    return (profiles as ProfileRow[]).map((p) => ({
      id: p.id,
      username: p.username,
      email: emailById.get(p.id) ?? null,
      avatarUrl: p.avatar_url,
      role: p.role ?? 'user',
      createdAt: p.created_at,
      sessionCount: stats.get(p.id)?.sessionCount ?? 0,
      totalGold: stats.get(p.id)?.totalGold ?? 0,
    }));
  }

  // ===== DUNGEONS =====
  async getDungeons() {
    const { data, error } = await this.supabase
      .from('dungeons')
      .select('*')
      .order('name');
    if (error) throw error;
    return data;
  }

  async createDungeon(dto: CreateDungeonDto) {
    const { data, error } = await this.supabase
      .from('dungeons')
      .insert({
        name: dto.name,
        image_url: dto.imageUrl,
      })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async deleteDungeon(id: string) {
    const { error } = await this.supabase
      .from('dungeons')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return { deleted: true };
  }

  // ===== ITEMS =====
  async getItems() {
    const { data, error } = await this.supabase
      .from('items')
      .select('*')
      .order('name');
    if (error) throw error;
    return data;
  }

  async createItem(dto: CreateItemDto) {
    const { data, error } = await this.supabase
      .from('items')
      .insert({
        name: dto.name,
        rarity: dto.rarity,
        icon_url: dto.iconUrl,
        default_price: dto.defaultPrice,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async deleteItem(id: string) {
    const { error } = await this.supabase.from('items').delete().eq('id', id);
    if (error) throw error;
    return { deleted: true };
  }

  // ===== CLASSES =====
  async getClasses() {
    const { data, error } = await this.supabase
      .from('classes')
      .select('*')
      .order('name');
    if (error) throw error;
    return data;
  }

  async createClass(dto: CreateClassDto) {
    const { data, error } = await this.supabase
      .from('classes')
      .insert({
        name: dto.name,
        parent_class: dto.parentClass ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async deleteClass(id: string) {
    const { error } = await this.supabase.from('classes').delete().eq('id', id);
    if (error) throw error;
    return { deleted: true };
  }
}
