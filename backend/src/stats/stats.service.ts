import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

const COUNTER_KEY = 'page_views';
const CACHE_MS = 60 * 1000; // Serve the count from memory for up to a minute.

/**
 * Site-wide page-view counter. Every visit atomically bumps a single Postgres
 * row; the total is cached in memory so the public GET doesn't hit the DB on
 * every request.
 */
@Injectable()
export class StatsService {
  private cache: { total: number; expiresAt: number } | null = null;

  constructor(private readonly supabase: SupabaseService) {}

  /** Count a visit and return the new total. */
  async recordVisit(): Promise<{ total: number }> {
    const { data, error } = await this.supabase.rpc('increment_counter', {
      counter_key: COUNTER_KEY,
    });
    if (error) throw error;

    const total = Number(data);
    this.cache = { total, expiresAt: Date.now() + CACHE_MS };
    return { total };
  }

  /** Current total page views (cached). */
  async getVisits(): Promise<{ total: number }> {
    if (this.cache && this.cache.expiresAt > Date.now()) {
      return { total: this.cache.total };
    }

    const { data, error } = await this.supabase
      .from('site_counters')
      .select('count')
      .eq('key', COUNTER_KEY)
      .single();
    if (error) throw error;

    const total = Number((data as { count: number }).count);
    this.cache = { total, expiresAt: Date.now() + CACHE_MS };
    return { total };
  }
}
