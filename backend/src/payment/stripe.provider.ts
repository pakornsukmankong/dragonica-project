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

  constructor(private readonly stripe: StripeService) {}

  async createCharge(input: CreateChargeInput): Promise<NormalizedCharge> {
    // Cards go through hosted Stripe Checkout (Stripe hosts the form + 3DS);
    // the donor is redirected to the session URL and back.
    if (input.channel === 'card') {
      const session = await this.stripe.createCardCheckoutSession({
        amount: input.amount,
        referenceId: input.referenceId,
        returnUrl: input.returnUrl,
      });
      return {
        // Reconcile against the PaymentIntent, same as PromptPay.
        providerChargeId:
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : (session.payment_intent?.id ?? ''),
        status: 'pending',
        qrImageUri: null,
        authorizeUri: session.url,
        expiresAt: null,
      };
    }

    if (input.channel !== 'promptpay') {
      throw new BadRequestException(
        `Payment channel "${input.channel}" is not supported by Stripe`,
      );
    }
    const pi = await this.stripe.createPromptPayIntent({
      amount: input.amount,
      referenceId: input.referenceId,
      returnUrl: input.returnUrl,
    });
    return this.normalize(pi);
  }

  async getCharge(providerChargeId: string): Promise<NormalizedCharge> {
    return this.normalize(await this.stripe.retrieveIntent(providerChargeId));
  }

  extractChargeId(event: unknown): string | null {
    const id = (event as { data?: { object?: { id?: unknown } } })?.data?.object
      ?.id;
    // Only PaymentIntent-shaped events are ours (pi_...).
    return typeof id === 'string' && id.startsWith('pi_') ? id : null;
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
