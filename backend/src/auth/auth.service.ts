import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

export interface Profile {
  id: string;
  username: string | null;
  avatar_url: string | null;
  created_at: string;
}

@Injectable()
export class AuthService {
  constructor(private readonly supabase: SupabaseService) {}

  async getOrCreateProfile(userId: string, email: string): Promise<Profile> {
    const { data: existing } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (existing) return existing as Profile;

    const { data, error } = await this.supabase
      .from('profiles')
      .insert({ id: userId, username: email.split('@')[0] })
      .select()
      .single();

    if (error) throw error;
    return data as Profile;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<Profile> {
    const updateData: Record<string, unknown> = {};
    // Store an empty display name as null so the app falls back to the email.
    if (dto.username !== undefined)
      updateData['username'] = dto.username.trim() || null;
    if (dto.avatarUrl !== undefined) updateData['avatar_url'] = dto.avatarUrl;

    const { data, error } = await this.supabase
      .from('profiles')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new NotFoundException('Profile not found');
    return data as Profile;
  }
}
