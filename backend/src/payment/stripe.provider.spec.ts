import { BadRequestException } from '@nestjs/common';
import { StripeProvider } from './stripe.provider';
import { StripeService } from '../stripe/stripe.service';

function stripeMock(overrides: Partial<jest.Mocked<StripeService>> = {}) {
  return {
    createPromptPayIntent: jest.fn(),
    retrieveIntent: jest.fn(),
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

  it('rejects a non-PromptPay channel without calling Stripe', async () => {
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
