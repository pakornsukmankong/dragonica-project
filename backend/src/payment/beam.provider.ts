import { BadRequestException, Injectable } from '@nestjs/common';
import { BeamCharge, BeamService } from '../beam/beam.service';
import { DonationChannel } from '../donation/dto/create-donation.dto';
import {
  CreateChargeInput,
  NormalizedCharge,
  NormalizedChargeStatus,
  PaymentProvider,
} from './payment-provider.interface';

// Map our channel enum → a Beam `paymentMethod` object. Channels Beam does not
// support (GrabPay; BAY/BBL/KTB mobile banking) are intentionally absent — a
// charge for one of them fails fast with a clear error.
const PAYMENT_METHOD: Partial<
  Record<DonationChannel, () => Record<string, unknown>>
> = {
  promptpay: () => ({ paymentMethodType: 'QR_PROMPT_PAY', qrPromptPay: {} }),
  truemoney: () => ({ paymentMethodType: 'TRUE_MONEY', trueMoney: {} }),
  rabbit_linepay: () => ({ paymentMethodType: 'LINE_PAY', linePay: {} }),
  shopeepay: () => ({ paymentMethodType: 'SHOPEE_PAY', shopeePay: {} }),
  mobile_banking_kbank: () => ({ paymentMethodType: 'KPLUS', kplus: {} }),
  mobile_banking_scb: () => ({ paymentMethodType: 'SCB_EASY', scbEasy: {} }),
};

/**
 * Adapter mapping the Beam Charges API onto the PaymentProvider interface.
 */
@Injectable()
export class BeamProvider implements PaymentProvider {
  readonly name = 'beam' as const;

  constructor(private readonly beam: BeamService) {}

  async createCharge(input: CreateChargeInput): Promise<NormalizedCharge> {
    const method = PAYMENT_METHOD[input.channel];
    if (!method) {
      throw new BadRequestException(
        `Payment channel "${input.channel}" is not supported by Beam`,
      );
    }

    const charge = await this.beam.createCharge({
      amount: input.amount,
      currency: 'THB',
      paymentMethod: method(),
      referenceId: input.referenceId,
      returnUrl: input.returnUrl,
    });
    return this.normalize(charge);
  }

  async getCharge(providerChargeId: string): Promise<NormalizedCharge> {
    return this.normalize(await this.beam.getCharge(providerChargeId));
  }

  extractChargeId(event: unknown): string | null {
    if (!event || typeof event !== 'object') return null;
    const e = event as {
      chargeId?: unknown;
      data?: { chargeId?: unknown };
      charge?: { chargeId?: unknown };
    };
    const id = e.chargeId ?? e.data?.chargeId ?? e.charge?.chargeId;
    return typeof id === 'string' ? id : null;
  }

  private normalize(charge: BeamCharge): NormalizedCharge {
    const img = charge.encodedImage?.imageBase64Encoded;
    return {
      providerChargeId: charge.chargeId,
      status: this.mapStatus(charge.status),
      qrImageUri: img ? `data:image/png;base64,${img}` : null,
      authorizeUri: charge.redirect?.redirectUrl ?? null,
      expiresAt: charge.encodedImage?.expiry ?? null,
    };
  }

  // Beam's exact status strings aren't enumerated in the public docs; map
  // defensively. TODO: confirm the exact values against the sandbox.
  private mapStatus(status: string): NormalizedChargeStatus {
    const s = (status || '').toUpperCase();
    if (s.includes('SUCC') || s === 'PAID' || s === 'COMPLETED')
      return 'successful';
    if (s.includes('FAIL') || s.includes('CANCEL') || s.includes('REVERS'))
      return 'failed';
    if (s.includes('EXPIRE')) return 'expired';
    return 'pending';
  }
}
