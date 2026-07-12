import { Injectable } from '@nestjs/common';
import {
  OmiseCharge,
  OmiseChargeStatus,
  OmiseService,
} from '../omise/omise.service';
import { DONATION_CHANNELS } from '../donation/dto/create-donation.dto';
import {
  CreateChargeInput,
  NormalizedCharge,
  NormalizedChargeStatus,
  PaymentProvider,
} from './payment-provider.interface';

// How long a PromptPay QR stays valid (Omise wants an explicit expiry).
const PROMPTPAY_TTL_MS = 15 * 60 * 1000;

/**
 * Adapter that presents the existing (untouched) OmiseService through the
 * PaymentProvider interface. All Omise-specific mapping lives here.
 */
@Injectable()
export class OmiseProvider implements PaymentProvider {
  readonly name = 'omise' as const;
  // Everything except `card` — the Omise card flow (tokenization) isn't built.
  readonly supportedChannels = DONATION_CHANNELS.filter((c) => c !== 'card');
  // Omise's minimum charge is ฿20.
  readonly minAmount = 20;

  constructor(private readonly omise: OmiseService) {}

  async createCharge(input: CreateChargeInput): Promise<NormalizedCharge> {
    const charge = await this.omise.createCharge({
      type: input.channel,
      amount: input.amount,
      phoneNumber: input.phoneNumber,
      returnUri: input.returnUrl,
      expiresAt:
        input.channel === 'promptpay'
          ? new Date(Date.now() + PROMPTPAY_TTL_MS).toISOString()
          : undefined,
      metadata: { donationId: input.referenceId },
    });
    return this.normalize(charge);
  }

  async getCharge(providerChargeId: string): Promise<NormalizedCharge> {
    return this.normalize(await this.omise.getCharge(providerChargeId));
  }

  extractChargeId(event: unknown): string | null {
    if (!event || typeof event !== 'object') return null;
    const data = (event as { data?: unknown }).data;
    if (!data || typeof data !== 'object') return null;
    const id = (data as { id?: unknown }).id;
    return typeof id === 'string' && id.startsWith('chrg_') ? id : null;
  }

  private normalize(charge: OmiseCharge): NormalizedCharge {
    return {
      providerChargeId: charge.id,
      status: this.mapStatus(charge.status),
      qrImageUri: charge.source?.scannable_code?.image?.download_uri ?? null,
      authorizeUri: charge.authorize_uri ?? null,
      expiresAt: charge.expires_at ?? null,
    };
  }

  private mapStatus(status: OmiseChargeStatus): NormalizedChargeStatus {
    switch (status) {
      case 'successful':
        return 'successful';
      case 'expired':
        return 'expired';
      case 'failed':
      case 'reversed':
        return 'failed';
      default:
        return 'pending';
    }
  }
}
