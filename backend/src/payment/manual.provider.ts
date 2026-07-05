import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as QRCode from 'qrcode';
import {
  CreateChargeInput,
  NormalizedCharge,
  PaymentProvider,
} from './payment-provider.interface';
import { buildPromptPayPayload } from './promptpay';

// How long the QR is presented as valid. Manual confirmation is slower than a
// gateway (an admin has to check the bank statement), so keep it generous.
const PROMPTPAY_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * A gateway-free provider for the interim period while Omise/Beam are being
 * verified. It renders a PromptPay QR for our own account offline; the payment
 * itself is reconciled by hand — an admin confirms the donation once the
 * transfer lands, which writes the status to the DB directly (never here).
 */
@Injectable()
export class ManualProvider implements PaymentProvider {
  readonly name = 'manual' as const;

  constructor(private readonly config: ConfigService) {}

  async createCharge(input: CreateChargeInput): Promise<NormalizedCharge> {
    if (input.channel !== 'promptpay') {
      throw new BadRequestException(
        `Payment channel "${input.channel}" is not supported in manual mode (PromptPay only)`,
      );
    }

    const target = this.config.getOrThrow<string>('MANUAL_PROMPTPAY_ID');
    const payload = buildPromptPayPayload(target, input.amount / 100); // satang → baht
    const qrImageUri = await QRCode.toDataURL(payload, {
      margin: 1,
      width: 512,
    });

    return {
      providerChargeId: `manual_${input.referenceId}`,
      status: 'pending',
      qrImageUri,
      authorizeUri: null,
      expiresAt: new Date(Date.now() + PROMPTPAY_TTL_MS).toISOString(),
    };
  }

  async getCharge(providerChargeId: string): Promise<NormalizedCharge> {
    // There is no gateway to query. The status only ever moves when an admin
    // confirms/rejects the donation (which updates the DB directly), so report
    // it as still pending — a stray poll must never override an admin decision.
    return {
      providerChargeId,
      status: 'pending',
      qrImageUri: null,
      authorizeUri: null,
      expiresAt: null,
    };
  }

  extractChargeId(): string | null {
    return null; // manual mode has no webhook
  }
}
