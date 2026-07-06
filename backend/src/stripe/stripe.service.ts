import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

/**
 * Thin wrapper over the Stripe SDK (PaymentIntents). The constructor tolerates
 * missing STRIPE_* env so an Omise/Beam-only deployment still boots; methods
 * throw a clear error only when Stripe is actually used.
 */
@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
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

  // Run a Stripe SDK call, converting a raw StripeError into a proper
  // HttpException. Otherwise the error (which also carries `code`/`message`)
  // gets mistaken for a Postgres error by the global filter and surfaces as a
  // misleading "Database request failed".
  private async call<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof Stripe.errors.StripeError) {
        this.logger.error(`Stripe ${err.type}: ${err.message}`);
        throw new InternalServerErrorException(`Stripe error: ${err.message}`);
      }
      throw err;
    }
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
    return this.call(() =>
      this.client().paymentIntents.create({
        amount: opts.amount,
        currency: 'thb',
        payment_method_types: ['promptpay'],
        payment_method_data: { type: 'promptpay' },
        confirm: true,
        return_url: opts.returnUrl,
        metadata: { donationId: opts.referenceId },
      }),
    );
  }

  retrieveIntent(id: string): Promise<Stripe.PaymentIntent> {
    return this.call(() => this.client().paymentIntents.retrieve(id));
  }

  /**
   * Create a hosted Checkout Session for a card payment. Stripe hosts the card
   * form + 3DS; the donor is redirected to `session.url` and back to
   * `returnUrl` afterwards. The underlying PaymentIntent id is what we reconcile
   * against (same as the PromptPay flow).
   */
  createCardCheckoutSession(opts: {
    amount: number; // satang
    referenceId: string;
    returnUrl: string;
  }): Promise<Stripe.Checkout.Session> {
    return this.call(() =>
      this.client().checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: 'thb',
              unit_amount: opts.amount,
              product_data: { name: 'Donation' },
            },
          },
        ],
        success_url: opts.returnUrl,
        cancel_url: opts.returnUrl.split('?')[0],
        metadata: { donationId: opts.referenceId },
        payment_intent_data: { metadata: { donationId: opts.referenceId } },
      }),
    );
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
