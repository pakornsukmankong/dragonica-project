import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateDungeonDto } from './dto/create-dungeon.dto';
import { CreateItemDto } from './dto/create-item.dto';
import { CreateClassDto } from './dto/create-class.dto';

@Injectable()
export class AdminService {
  constructor(private readonly supabase: SupabaseService) {}

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
        dragon_core_cost: dto.dragonCoreCost,
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
