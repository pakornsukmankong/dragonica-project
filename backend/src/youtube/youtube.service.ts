import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const DEFAULT_CHANNEL_ID = 'UC2HoBQZT88jlscMBsWzg8KA';
const CACHE_MS = 60 * 60 * 1000; // 1 hour — stay well within the daily quota.

export interface ChannelInfo {
  subscriberCount: number | null;
  title: string | null;
  avatarUrl: string | null;
}

const EMPTY: ChannelInfo = {
  subscriberCount: null,
  title: null,
  avatarUrl: null,
};

/**
 * Reads public channel stats from the YouTube Data API v3. The API key is
 * backend-only (never exposed to the frontend) and results are cached in memory
 * so page views don't burn the daily quota. Degrades gracefully — if the key is
 * missing or the request fails, it returns nulls and the frontend falls back to
 * its static values.
 */
@Injectable()
export class YoutubeService {
  private readonly logger = new Logger(YoutubeService.name);
  private readonly apiKey?: string;
  private readonly channelId: string;
  private cache: { data: ChannelInfo; expiresAt: number } | null = null;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('YOUTUBE_API_KEY');
    this.channelId =
      this.config.get<string>('YOUTUBE_CHANNEL_ID') || DEFAULT_CHANNEL_ID;
  }

  async getChannel(): Promise<ChannelInfo> {
    if (this.cache && this.cache.expiresAt > Date.now()) {
      return this.cache.data;
    }

    const data = await this.fetchChannel();
    if (data) {
      this.cache = { data, expiresAt: Date.now() + CACHE_MS };
      return data;
    }

    // On failure, serve the last known value if we have one; otherwise empty.
    return this.cache?.data ?? EMPTY;
  }

  private async fetchChannel(): Promise<ChannelInfo | null> {
    if (!this.apiKey) return null;

    try {
      const url =
        'https://www.googleapis.com/youtube/v3/channels' +
        `?part=statistics,snippet&id=${this.channelId}&key=${this.apiKey}`;
      const res = await fetch(url);
      if (!res.ok) {
        this.logger.warn(`YouTube API responded ${res.status}`);
        return null;
      }

      const json = (await res.json()) as {
        items?: {
          statistics?: {
            subscriberCount?: string;
            hiddenSubscriberCount?: boolean;
          };
          snippet?: {
            title?: string;
            thumbnails?: Record<string, { url?: string }>;
          };
        }[];
      };

      const item = json.items?.[0];
      if (!item) return null;

      const raw = item.statistics?.subscriberCount;
      const thumbs = item.snippet?.thumbnails;

      return {
        subscriberCount: raw ? Number(raw) : null,
        title: item.snippet?.title ?? null,
        avatarUrl: thumbs?.medium?.url ?? thumbs?.default?.url ?? null,
      };
    } catch (err) {
      this.logger.warn(`YouTube API request failed: ${(err as Error).message}`);
      return null;
    }
  }
}
