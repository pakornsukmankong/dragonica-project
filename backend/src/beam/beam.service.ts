import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

export type BeamActionRequired = 'NONE' | 'REDIRECT' | 'ENCODED_IMAGE';

export interface BeamCharge {
  chargeId: string;
  status: string;
  actionRequired?: BeamActionRequired;
  paymentMethodType?: string;
  redirect?: { redirectUrl?: string };
  encodedImage?: {
    imageBase64Encoded?: string;
    rawData?: string;
    expiry?: string;
  };
}

/**
 * Thin wrapper over the Beam Checkout REST API (Charges). Uses HTTP Basic auth
 * with `merchantId:apiKey` (server-side, never exposed). Config is read lazily —
 * the constructor tolerates missing BEAM_* env so an Omise-only deployment still
 * boots; methods throw a clear error only when Beam is actually used.
 */
@Injectable()
export class BeamService {
  private readonly logger = new Logger(BeamService.name);
  private readonly apiUrl: string;
  private readonly merchantId?: string;
  private readonly apiKey?: string;
  private readonly webhookSecret?: string;

  constructor(private readonly config: ConfigService) {
    this.apiUrl =
      this.config.get<string>('BEAM_API_URL') || 'https://api.beamcheckout.com';
    this.merchantId = this.config.get<string>('BEAM_MERCHANT_ID');
    this.apiKey = this.config.get<string>('BEAM_API_KEY');
    this.webhookSecret = this.config.get<string>('BEAM_WEBHOOK_SECRET');
  }

  private authHeader(): string {
    if (!this.merchantId || !this.apiKey) {
      throw new InternalServerErrorException(
        'Beam is not configured (BEAM_MERCHANT_ID / BEAM_API_KEY missing)',
      );
    }
    return `Basic ${Buffer.from(`${this.merchantId}:${this.apiKey}`).toString(
      'base64',
    )}`;
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    // Temporary (Phase 2) debug: trace the outgoing request (no auth header).
    this.logger.log(
      `Beam → ${method} ${this.apiUrl}${path}${
        body ? ` body=${JSON.stringify(body)}` : ''
      }`,
    );

    const res = await fetch(`${this.apiUrl}${path}`, {
      method,
      headers: {
        Authorization: this.authHeader(),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const json = (await res.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    // Temporary (Phase 2) debug: trace the response status + body.
    this.logger.log(
      `Beam ← ${method} ${path} status=${res.status} body=${JSON.stringify(
        json,
      )}`,
    );

    if (!res.ok) {
      const message =
        (json['message'] as string) || `Beam request failed (${res.status})`;
      this.logger.error(`Beam ${method} ${path} → ${message}`);
      throw new InternalServerErrorException(message);
    }

    return json as T;
  }

  createCharge(body: Record<string, unknown>): Promise<BeamCharge> {
    return this.request<BeamCharge>('POST', '/api/v1/charges', body);
  }

  getCharge(chargeId: string): Promise<BeamCharge> {
    return this.request<BeamCharge>('GET', `/api/v1/charges/${chargeId}`);
  }

  /**
   * Verify a Beam webhook: HMAC-SHA256 over the *raw* request body using the
   * base64-decoded webhook secret, base64-encoded, compared timing-safely with
   * the `X-Beam-Signature` header. The raw body must be used verbatim — a
   * re-serialized object will not match.
   */
  verifyWebhookSignature(rawBody: Buffer, signature?: string): boolean {
    if (!this.webhookSecret || !signature || !rawBody) return false;
    const key = Buffer.from(this.webhookSecret, 'base64');
    const expected = createHmac('sha256', key).update(rawBody).digest('base64');
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
