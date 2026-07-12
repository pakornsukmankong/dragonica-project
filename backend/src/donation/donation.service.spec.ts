import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DonationService } from './donation.service';
import { PaymentProvider } from '../payment/payment-provider.interface';
import { createSupabaseMock } from '../test/supabase.mock';

const USER = 'user-1';
const OTHER = 'user-2';

const config = {
  get: () => 'http://localhost:3000',
} as unknown as ConfigService;

// Minimal i18n stub — tests assert on exception type, not localized text.
const i18n = {
  t: (key: string) => key,
} as unknown as import('nestjs-i18n').I18nService;

// A stand-in for the active payment provider. extractChargeId mirrors the real
// adapters by pulling `data.id` out of the webhook payload.
function providerMock(
  overrides: Partial<PaymentProvider> = {},
): PaymentProvider {
  return {
    name: 'omise',
    minAmount: 20,
    createCharge: jest.fn(),
    getCharge: jest.fn(),
    extractChargeId: jest.fn((event: unknown) => {
      const id = (event as { data?: { id?: unknown } })?.data?.id;
      return typeof id === 'string' ? id : null;
    }),
    ...overrides,
  } as unknown as PaymentProvider;
}

describe('DonationService (ownership & payment integrity)', () => {
  describe('findOneByUser', () => {
    it('throws NotFound for a donation the user does not own', async () => {
      const { service: supabase } = createSupabaseMock([
        { data: null, error: { code: 'PGRST116' } },
      ]);
      const svc = new DonationService(supabase, providerMock(), config, i18n);

      await expect(svc.findOneByUser('d1', OTHER)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('does not re-hit the gateway for an already-settled donation', async () => {
      const provider = providerMock();
      const { service: supabase } = createSupabaseMock([
        {
          data: {
            id: 'd1',
            user_id: USER,
            status: 'successful',
            omise_charge_id: 'chrg_1',
          },
          error: null,
        },
      ]);
      const svc = new DonationService(supabase, provider, config, i18n);

      const result = await svc.findOneByUser('d1', USER);
      expect(result.status).toBe('successful');
      expect(provider.getCharge).not.toHaveBeenCalled();
    });
  });

  describe('amount limits', () => {
    it('rejects a donation below the active provider minimum', async () => {
      const { service: supabase, fromTables } = createSupabaseMock([]);
      const svc = new DonationService(
        supabase,
        providerMock({ minAmount: 20 }),
        config,
        i18n,
      );

      await expect(
        svc.create(USER, 'u@example.com', {
          amount: 15,
          channel: 'promptpay',
          displayName: 'Tester',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      // Rejected before anything was written.
      expect(fromTables).toEqual([]);
    });

    it('reports the provider minimum via config (Stripe = ฿10)', () => {
      const { service: supabase } = createSupabaseMock([]);
      const svc = new DonationService(
        supabase,
        providerMock({
          name: 'stripe',
          minAmount: 10,
          supportedChannels: ['promptpay', 'card'],
        }),
        config,
        i18n,
      );

      expect(svc.getConfig()).toEqual({
        provider: 'stripe',
        channels: ['promptpay', 'card'],
        minAmount: 10,
      });
    });
  });

  describe('handleWebhook', () => {
    it('never trusts the payload status — verifies against the gateway', async () => {
      // Payload lies that the charge succeeded; the gateway says it failed.
      const provider = providerMock({
        getCharge: jest.fn().mockResolvedValue({
          providerChargeId: 'chrg_1',
          status: 'failed',
          qrImageUri: null,
          authorizeUri: null,
          expiresAt: null,
        }),
      });
      const { service: supabase, fromTables } = createSupabaseMock([
        // lookup by omise_charge_id
        {
          data: {
            id: 'd1',
            user_id: USER,
            status: 'pending',
            omise_charge_id: 'chrg_1',
            paid_at: null,
          },
          error: null,
        },
        // update reflecting the gateway's real (failed) status
        { data: { id: 'd1', status: 'failed' }, error: null },
      ]);
      const svc = new DonationService(supabase, provider, config, i18n);

      await expect(
        svc.handleWebhook({
          key: 'charge.complete',
          data: { id: 'chrg_1', status: 'successful' },
        }),
      ).resolves.toEqual({ received: true });

      expect(provider.getCharge).toHaveBeenCalledWith('chrg_1');
      expect(fromTables).toEqual(['donations', 'donations']);
    });

    it('ignores webhooks for charges it does not know', async () => {
      const provider = providerMock();
      const { service: supabase } = createSupabaseMock([
        { data: null, error: null }, // no matching donation
      ]);
      const svc = new DonationService(supabase, provider, config, i18n);

      await expect(
        svc.handleWebhook({ data: { id: 'chrg_unknown' } }),
      ).resolves.toEqual({ received: true });
      expect(provider.getCharge).not.toHaveBeenCalled();
    });
  });
});
