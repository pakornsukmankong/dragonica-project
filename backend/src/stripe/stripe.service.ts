import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

/**
 * Thin wrapper over the Stripe SDK (PaymentIntents). The constructor tolerates
 * missing STRIPE_* env so an Omise/Beam-only deployment still boots; methods
 * throw a clear error only when Stripe is actually used.
 */
@Injectable()
export class StripeService {
  private readonly stripe: Stripe | null;
  private readonly webhookSecret?: string;

  constructor(private readonly config: ConfigService) {
    const key = this.config.get<string>('STRIPE_SECRET_KEY');
    this.stripe = key ? new Stripe(key) : null;
    this.webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
  }

  private client(): Stripe {
    if (!this.stripe) {
      throw new InternalServerErrorException(
        'Stripe is not configured (STRIPE_SECRET_KEY missing)',
      );
    }
    return this.stripe;
  }

  /**
   * Create + confirm a PromptPay PaymentIntent. The scannable QR is returned on
   * `next_action.promptpay_display_qr_code` (image url + expiry).
   */
  createPromptPayIntent(opts: {
    amount: number; // satang
    referenceId: string;
    returnUrl: string;
  }): Promise<Stripe.PaymentIntent> {
    return this.client().paymentIntents.create({
      amount: opts.amount,
      currency: 'thb',
      payment_method_types: ['promptpay'],
      payment_method_data: { type: 'promptpay' },
      confirm: true,
      return_url: opts.returnUrl,
      metadata: { donationId: opts.referenceId },
    });
  }

  retrieveIntent(id: string): Promise<Stripe.PaymentIntent> {
    return this.client().paymentIntents.retrieve(id);
  }

  /**
   * Verify + parse a Stripe webhook from the raw body and the Stripe-Signature
   * header. Throws if the signature does not match.
   */
  constructWebhookEvent(rawBody: Buffer, signature?: string): Stripe.Event {
    if (!this.webhookSecret) {
      throw new InternalServerErrorException(
        'Stripe webhook secret not configured (STRIPE_WEBHOOK_SECRET missing)',
      );
    }
    return this.client().webhooks.constructEvent(
      rawBody,
      signature ?? '',
      this.webhookSecret,
    );
  }
}
