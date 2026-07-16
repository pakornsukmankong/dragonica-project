import { BadRequestException } from '@nestjs/common';
import { StripeProvider } from './stripe.provider';
import { StripeService } from '../stripe/stripe.service';

function stripeMock(overrides: Partial<jest.Mocked<StripeService>> = {}) {
  return {
    createPromptPayIntent: jest.fn(),
    createCardCheckoutSession: jest.fn(),
    retrieveIntent: jest.fn(),
    retrieveCheckoutSession: jest.fn(),
    constructWebhookEvent: jest.fn(),
    ...overrides,
  } as unknown as StripeService;
}

describe('StripeProvider', () => {
  it('creates a PromptPay intent and normalizes the QR', async () => {
    const stripe = stripeMock({
      createPromptPayIntent: jest.fn().mockResolvedValue({
        id: 'pi_1',
        status: 'requires_action',
        next_action: {
          promptpay_display_qr_code: {
            image_url_png: 'https://stripe/qr.png',
          },
        },
      }),
    });
    const provider = new StripeProvider(stripe);

    const charge = await provider.createCharge({
      channel: 'promptpay',
      amount: 2000,
      referenceId: 'd1',
      returnUrl: 'https://app/support?donation=d1',
    });

    expect(stripe.createPromptPayIntent).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 2000, referenceId: 'd1' }),
    );
    expect(charge.providerChargeId).toBe('pi_1');
    expect(charge.status).toBe('pending');
    expect(charge.qrImageUri).toBe('https://stripe/qr.png');
    expect(charge.authorizeUri).toBeNull();
    expect(charge.expiresAt).toBeNull();
  });

  it('creates a hosted Checkout session for a card and redirects', async () => {
    const stripe = stripeMock({
      createCardCheckoutSession: jest.fn().mockResolvedValue({
        id: 'cs_1',
        url: 'https://checkout.stripe.com/c/pay/cs_1',
        status: 'open',
        payment_status: 'unpaid',
      }),
    });
    const provider = new StripeProvider(stripe);

    const charge = await provider.createCharge({
      channel: 'card',
      amount: 5000,
      referenceId: 'd2',
      returnUrl: 'https://app/support?donation=d2',
    });

    expect(stripe.createCardCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 5000, referenceId: 'd2' }),
    );
    // Card is reconciled by the Checkout Session id (its PI is null at creation).
    expect(charge.providerChargeId).toBe('cs_1');
    expect(charge.authorizeUri).toBe('https://checkout.stripe.com/c/pay/cs_1');
    expect(charge.qrImageUri).toBeNull();
    expect(charge.status).toBe('pending');
  });

  it('reconciles a paid Checkout session to successful', async () => {
    const stripe = stripeMock({
      retrieveCheckoutSession: jest.fn().mockResolvedValue({
        id: 'cs_1',
        status: 'complete',
        payment_status: 'paid',
      }),
    });
    const provider = new StripeProvider(stripe);

    const charge = await provider.getCharge('cs_1');
    expect(stripe.retrieveCheckoutSession).toHaveBeenCalledWith('cs_1');
    expect(charge.status).toBe('successful');
  });

  it('rejects an unsupported channel without calling Stripe', async () => {
    const stripe = stripeMock();
    const provider = new StripeProvider(stripe);

    await expect(
      provider.createCharge({
        channel: 'truemoney',
        amount: 2000,
        referenceId: 'd1',
        returnUrl: 'https://app',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(stripe.createPromptPayIntent).not.toHaveBeenCalled();
  });

  it('maps a succeeded intent to successful', async () => {
    const stripe = stripeMock({
      retrieveIntent: jest
        .fn()
        .mockResolvedValue({ id: 'pi_1', status: 'succeeded' }),
    });
    const provider = new StripeProvider(stripe);

    expect((await provider.getCharge('pi_1')).status).toBe('successful');
  });

  it('maps an expired PromptPay intent (failed attempt) to expired', async () => {
    // The QR expired unpaid: Stripe drops the confirmed intent back to
    // requires_payment_method and sets last_payment_error.
    const stripe = stripeMock({
      retrieveIntent: jest.fn().mockResolvedValue({
        id: 'pi_1',
        status: 'requires_payment_method',
        last_payment_error: { code: 'payment_intent_authentication_failure' },
      }),
    });
    const provider = new StripeProvider(stripe);

    expect((await provider.getCharge('pi_1')).status).toBe('expired');
  });

  it('keeps a fresh requires_payment_method intent (no error) pending', async () => {
    const stripe = stripeMock({
      retrieveIntent: jest.fn().mockResolvedValue({
        id: 'pi_1',
        status: 'requires_payment_method',
        last_payment_error: null,
      }),
    });
    const provider = new StripeProvider(stripe);

    expect((await provider.getCharge('pi_1')).status).toBe('pending');
  });

  it('extracts the PaymentIntent id from a webhook event', () => {
    const provider = new StripeProvider(stripeMock());
    const id = provider.extractChargeId({
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_1' } },
    });
    expect(id).toBe('pi_1');
    // Non-PaymentIntent objects are ignored.
    expect(
      provider.extractChargeId({ data: { object: { id: 'ch_x' } } }),
    ).toBeNull();
  });
});
