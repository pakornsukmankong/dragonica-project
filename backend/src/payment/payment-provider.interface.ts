import { DonationChannel } from '../donation/dto/create-donation.dto';

// DI token for the *active* payment provider (resolved from PAYMENT_PROVIDER).
export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

export type NormalizedChargeStatus =
  'pending' | 'successful' | 'failed' | 'expired';

export interface CreateChargeInput {
  channel: DonationChannel;
  amount: number; // satang
  phoneNumber?: string; // TrueMoney (Omise)
  referenceId: string; // our donation id
  returnUrl: string; // where the gateway redirects back
}

// A gateway charge, normalized to a shape the DonationService (and, in turn, the
// frontend) understands regardless of which provider produced it.
export interface NormalizedCharge {
  providerChargeId: string;
  status: NormalizedChargeStatus;
  qrImageUri: string | null; // scannable QR (PromptPay) — url or data URI
  authorizeUri: string | null; // off-site redirect (cards/wallets)
  expiresAt: string | null;
}

/**
 * A payment gateway, normalized. Each concrete provider (Omise, Beam) maps its
 * own request/response shape to these methods so the donation flow stays
 * gateway-agnostic. Switch the active one with the PAYMENT_PROVIDER env flag.
 */
export interface PaymentProvider {
  readonly name: 'omise' | 'beam' | 'manual';
  /** Channels this provider can actually collect — drives the donor's options. */
  readonly supportedChannels: readonly DonationChannel[];
  createCharge(input: CreateChargeInput): Promise<NormalizedCharge>;
  getCharge(providerChargeId: string): Promise<NormalizedCharge>;
  /** Pull the provider charge id out of a webhook payload (for re-verify). */
  extractChargeId(event: unknown): string | null;
}
