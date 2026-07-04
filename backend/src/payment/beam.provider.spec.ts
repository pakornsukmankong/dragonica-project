import { BadRequestException } from '@nestjs/common';
import { BeamProvider } from './beam.provider';
import { BeamService } from '../beam/beam.service';

function beamMock(overrides: Partial<jest.Mocked<BeamService>> = {}) {
  return {
    createCharge: jest.fn(),
    getCharge: jest.fn(),
    ...overrides,
  } as unknown as BeamService;
}

describe('BeamProvider', () => {
  it('maps promptpay to a QR_PROMPT_PAY charge and normalizes the QR', async () => {
    const beam = beamMock({
      createCharge: jest.fn().mockResolvedValue({
        chargeId: 'ch_1',
        status: 'PENDING',
        actionRequired: 'ENCODED_IMAGE',
        encodedImage: {
          imageBase64Encoded: 'QUJD',
          expiry: '2026-01-01T00:00:00Z',
        },
      }),
    });
    const provider = new BeamProvider(beam);

    const charge = await provider.createCharge({
      channel: 'promptpay',
      amount: 2000,
      referenceId: 'd1',
      returnUrl: 'https://app/support?donation=d1',
    });

    expect(beam.createCharge).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 2000,
        currency: 'THB',
        paymentMethod: { paymentMethodType: 'QR_PROMPT_PAY', qrPromptPay: {} },
        referenceId: 'd1',
      }),
    );
    expect(charge.providerChargeId).toBe('ch_1');
    expect(charge.status).toBe('pending');
    expect(charge.qrImageUri).toBe('data:image/png;base64,QUJD');
    expect(charge.expiresAt).toBe('2026-01-01T00:00:00Z');
  });

  it('rejects a channel Beam does not support without calling the API', async () => {
    const beam = beamMock();
    const provider = new BeamProvider(beam);

    await expect(
      provider.createCharge({
        channel: 'grabpay',
        amount: 2000,
        referenceId: 'd1',
        returnUrl: 'https://app',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(beam.createCharge).not.toHaveBeenCalled();
  });

  it('maps a succeeded charge to successful', async () => {
    const beam = beamMock({
      getCharge: jest
        .fn()
        .mockResolvedValue({ chargeId: 'ch_1', status: 'SUCCEEDED' }),
    });
    const provider = new BeamProvider(beam);

    expect((await provider.getCharge('ch_1')).status).toBe('successful');
  });
});
