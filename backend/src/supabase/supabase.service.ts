import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from './types/database.types';

@Injectable()
export class SupabaseService {
  private readonly client: SupabaseClient<Database>;

  constructor(private readonly configService: ConfigService) {
    this.client = createClient<Database>(
      this.configService.getOrThrow<string>('SUPABASE_URL'),
      this.configService.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY'),
    );
  }

  // Typed passthrough: table names and column shapes are checked against the
  // generated Database type (regenerate with `npm run db:types`).
  from<T extends keyof Database['public']['Tables']>(table: T) {
    return this.client.from(table);
  }

  /** Call a Postgres function (e.g. atomic counter increment). */
  rpc<F extends keyof Database['public']['Functions']>(
    fn: F,
    args?: Database['public']['Functions'][F]['Args'],
  ) {
    return this.client.rpc(fn, args);
  }

  get storage() {
    return this.client.storage;
  }

  /**
   * Map of userId → email, read from auth.users via the admin API (service-role
   * only; emails don't live on the public profiles table). Pages through all
   * users. Kept here so the GoTrue client's types stay internal to this service.
   */
  async listUserEmails(): Promise<Map<string, string>> {
    const emailById = new Map<string, string>();
    for (let page = 1; ; page++) {
      const { data, error } = await this.client.auth.admin.listUsers({
        page,
        perPage: 1000,
      });
      if (error) break; // degrade gracefully — callers just omit emails
      for (const u of data.users) {
        if (u.email) emailById.set(u.id, u.email);
      }
      if (data.users.length < 1000) break;
    }
    return emailById;
  }
}
