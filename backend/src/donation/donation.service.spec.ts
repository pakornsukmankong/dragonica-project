import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DonationService } from './donation.service';
import { OmiseService } from '../omise/omise.service';
import { createSupabaseMock } from '../test/supabase.mock';

const USER = 'user-1';
const OTHER = 'user-2';

const config = {
  get: () => 'http://localhost:3000',
} as unknown as ConfigService;

function omiseMock(overrides: Partial<jest.Mocked<OmiseService>> = {}) {
  return {
    getCharge: jest.fn(),
    createCharge: jest.fn(),
    ...overrides,
  } as unknown as OmiseService;
}

describe('DonationService (ownership & payment integrity)', () => {
  describe('findOneByUser', () => {
    it('throws NotFound for a donation the user does not own', async () => {
      const { service: supabase } = createSupabaseMock([
        { data: null, error: { code: 'PGRST116' } },
      ]);
      const svc = new DonationService(supabase, omiseMock(), config);

      await expect(svc.findOneByUser('d1', OTHER)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('does not re-hit Omise for an already-settled donation', async () => {
      const omise = omiseMock();
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
      const svc = new DonationService(supabase, omise, config);

      const result = await svc.findOneByUser('d1', USER);
      expect(result.status).toBe('successful');
      expect(omise.getCharge).not.toHaveBeenCalled();
    });
  });

  describe('handleWebhook', () => {
    it('never trusts the payload status — verifies against Omise', async () => {
      // Payload lies that the charge succeeded; Omise says it actually failed.
      const omise = omiseMock({
        getCharge: jest
          .fn()
          .mockResolvedValue({ id: 'chrg_1', status: 'failed' }),
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
        // update reflecting Omise's real (failed) status
        { data: { id: 'd1', status: 'failed' }, error: null },
      ]);
      const svc = new DonationService(supabase, omise, config);

      await expect(
        svc.handleWebhook({
          key: 'charge.complete',
          data: { id: 'chrg_1', status: 'successful' },
        }),
      ).resolves.toEqual({ received: true });

      expect(omise.getCharge).toHaveBeenCalledWith('chrg_1');
      expect(fromTables).toEqual(['donations', 'donations']);
    });

    it('ignores webhooks for charges it does not know', async () => {
      const omise = omiseMock();
      const { service: supabase } = createSupabaseMock([
        { data: null, error: null }, // no matching donation
      ]);
      const svc = new DonationService(supabase, omise, config);

      await expect(
        svc.handleWebhook({ data: { id: 'chrg_unknown' } }),
      ).resolves.toEqual({ received: true });
      expect(omise.getCharge).not.toHaveBeenCalled();
    });
  });
});
