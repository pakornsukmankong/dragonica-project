import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';

/**
 * Rate-limit tracker aware of the Cloudflare → Railway proxy chain. The
 * default ThrottlerGuard keys on req.ip, which behind the proxies is the
 * edge's address — every visitor would share a single rate-limit bucket.
 *
 * Cloudflare always overwrites CF-Connecting-IP with the real client address
 * (unlike X-Forwarded-For, which a client can seed with a fake first entry),
 * so prefer it and fall back to req.ip for local dev / direct hits.
 */
@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
  protected getTracker(req: Request): Promise<string> {
    const cfConnectingIp = req.headers['cf-connecting-ip'];
    if (typeof cfConnectingIp === 'string' && cfConnectingIp) {
      return Promise.resolve(cfConnectingIp);
    }
    return Promise.resolve(req.ip ?? 'unknown');
  }
}
