import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { I18nService } from 'nestjs-i18n';
import type { DonationChannel } from '../donation/dto/create-donation.dto';

const OMISE_API = 'https://api.omise.co';

// Our channel values are 1:1 with Omise source `type` strings, so the channel
// doubles as the source type when creating a source.
type OmiseSourceType = DonationChannel;

export type OmiseChargeStatus =
  'pending' | 'successful' | 'failed' | 'expired' | 'reversed';

export interface OmiseCharge {
  id: string;
  status: OmiseChargeStatus;
  paid: boolean;
  amount: number;
  currency: string;
  // PromptPay: a QR image is exposed on the source's scannable_code.
  source?: {
    type?: string;
    scannable_code?: {
      image?: { download_uri?: string };
    };
  };
  // TrueMoney Wallet: redirect the customer here to authorize with an OTP.
  authorize_uri?: string | null;
  expires_at?: string | null;
  failure_code?: string | null;
  failure_message?: string | null;
}

/**
 * Thin wrapper over the Omise REST API. Uses the SECRET key (backend-only —
 * never expose it to the frontend, same rule as the Supabase service-role key)
 * and HTTP Basic auth. Sources and charges are both created server-side so the
 * public key never leaves the server either.
 */
@Injectable()
export class OmiseService {
  private readonly logger = new Logger(OmiseService.name);
  private readonly authHeader: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly i18n: I18nService,
  ) {
    const secretKey = this.configService.getOrThrow<string>('OMISE_SECRET_KEY');
    this.authHeader = `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`;
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    form?: Record<string, string | number | undefined>,
  ): Promise<T> {
    const init: RequestInit = {
      method,
      headers: {
        Authorization: this.authHeader,
        ...(form
          ? { 'Content-Type': 'application/x-www-form-urlencoded' }
          : {}),
      },
    };

    if (form) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(form)) {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      }
      init.body = params.toString();
    }

    const res = await fetch(`${OMISE_API}${path}`, init);
    const json = (await res.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    if (!res.ok || json['object'] === 'error') {
      const message =
        (json['message'] as string) || `Omise request failed (${res.status})`;
      this.logger.error(`Omise ${method} ${path} → ${message}`);
      throw new InternalServerErrorException(
        this.i18n.t('errors.payment.provider_error', { args: { message } }),
      );
    }

    return json as T;
  }

  /**
   * Create a payment source. `amount` is in satang. For TrueMoney Wallet a
   * `phoneNumber` (10 digits) is required; the other channels (PromptPay,
   * mobile banking, e-wallets) need none.
   */
  private createSource(
    type: OmiseSourceType,
    amount: number,
    phoneNumber?: string,
  ): Promise<{ id: string }> {
    return this.request<{ id: string }>('POST', '/sources', {
      type,
      amount,
      currency: 'THB',
      phone_number: type === 'truemoney' ? phoneNumber : undefined,
    });
  }

  /**
   * Create a charge for a freshly-created source and return the charge —
   * including the PromptPay QR (`source.scannable_code.image.download_uri`)
   * or the TrueMoney `authorize_uri`.
   */
  async createCharge(opts: {
    type: OmiseSourceType;
    amount: number; // satang
    phoneNumber?: string;
    returnUri?: string; // where TrueMoney redirects back after OTP
    expiresAt?: string; // ISO; PromptPay QR lifetime
    metadata?: Record<string, string>;
  }): Promise<OmiseCharge> {
    const source = await this.createSource(
      opts.type,
      opts.amount,
      opts.phoneNumber,
    );

    const form: Record<string, string | number | undefined> = {
      amount: opts.amount,
      currency: 'THB',
      source: source.id,
      return_uri: opts.returnUri,
      expires_at: opts.expiresAt,
    };
    // Omise expects nested params in bracket notation for form encoding.
    for (const [key, value] of Object.entries(opts.metadata ?? {})) {
      form[`metadata[${key}]`] = value;
    }

    return this.request<OmiseCharge>('POST', '/charges', form);
  }

  getCharge(chargeId: string): Promise<OmiseCharge> {
    return this.request<OmiseCharge>('GET', `/charges/${chargeId}`);
  }
}
