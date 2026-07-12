import { BadRequestException, Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { StripeService } from '../stripe/stripe.service';
import {
  CreateChargeInput,
  NormalizedCharge,
  NormalizedChargeStatus,
  PaymentProvider,
} from './payment-provider.interface';

/**
 * Adapter mapping Stripe PaymentIntents onto the PaymentProvider interface.
 * Stripe (Thailand) supports PromptPay + cards for THB; cards need a
 * client-side Payment Element, so Phase 1 exposes PromptPay only.
 */
@Injectable()
export class StripeProvider implements PaymentProvider {
  readonly name = 'stripe' as const;
  readonly supportedChannels = ['promptpay', 'card'] as const;
  // Stripe's minimum charge for THB is ฿10.
  readonly minAmount = 10;

  constructor(private readonly stripe: StripeService) {}

  async createCharge(input: CreateChargeInput): Promise<NormalizedCharge> {
    // Cards go through hosted Stripe Checkout (Stripe hosts the form + 3DS);
    // the donor is redirected to the session URL and back. Reconcile against
    // the Checkout Session id — its PaymentIntent isn't populated at creation.
    if (input.channel === 'card') {
      const session = await this.stripe.createCardCheckoutSession({
        amount: input.amount,
        referenceId: input.referenceId,
        returnUrl: input.returnUrl,
      });
      return this.normalizeSession(session);
    }

    if (input.channel !== 'promptpay') {
      throw new BadRequestException(
        `Payment channel "${input.channel}" is not supported by Stripe`,
      );
    }
    const pi = await this.stripe.createPromptPayIntent({
      amount: input.amount,
      email: input.email ?? '',
      referenceId: input.referenceId,
      returnUrl: input.returnUrl,
    });
    return this.normalize(pi);
  }

  async getCharge(providerChargeId: string): Promise<NormalizedCharge> {
    // Card donations are keyed by the Checkout Session (cs_…); PromptPay by the
    // PaymentIntent (pi_…).
    if (providerChargeId.startsWith('cs_')) {
      return this.normalizeSession(
        await this.stripe.retrieveCheckoutSession(providerChargeId),
      );
    }
    return this.normalize(await this.stripe.retrieveIntent(providerChargeId));
  }

  extractChargeId(event: unknown): string | null {
    const id = (event as { data?: { object?: { id?: unknown } } })?.data?.object
      ?.id;
    // PaymentIntent (PromptPay) or Checkout Session (card) events are ours.
    return typeof id === 'string' &&
      (id.startsWith('pi_') || id.startsWith('cs_'))
      ? id
      : null;
  }

  private normalizeSession(session: Stripe.Checkout.Session): NormalizedCharge {
    return {
      providerChargeId: session.id,
      status:
        session.status === 'expired'
          ? 'expired'
          : session.payment_status === 'paid'
            ? 'successful'
            : 'pending',
      qrImageUri: null,
      authorizeUri: session.url,
      expiresAt: session.expires_at
        ? new Date(session.expires_at * 1000).toISOString()
        : null,
    };
  }

  private normalize(pi: Stripe.PaymentIntent): NormalizedCharge {
    const qr = pi.next_action?.promptpay_display_qr_code;
    return {
      providerChargeId: pi.id,
      status: this.mapStatus(pi.status),
      qrImageUri: qr?.image_url_png ?? null,
      authorizeUri: null,
      // Stripe's PromptPay QR object doesn't expose an expiry; the frontend
      // polls until the intent settles, so leave it unset.
      expiresAt: null,
    };
  }

  private mapStatus(
    status: Stripe.PaymentIntent.Status,
  ): NormalizedChargeStatus {
    switch (status) {
      case 'succeeded':
        return 'successful';
      case 'canceled':
        return 'failed';
      // requires_payment_method / requires_confirmation / requires_action /
      // processing / requires_capture → still awaiting the shopper.
      default:
        return 'pending';
    }
  }
}
