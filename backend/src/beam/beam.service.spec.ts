import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { BeamService } from './beam.service';

const SECRET_B64 = Buffer.from('super-secret-key').toString('base64');

function makeService(secret?: string) {
  const config = {
    get: (k: string) => (k === 'BEAM_WEBHOOK_SECRET' ? secret : undefined),
  } as unknown as ConfigService;
  return new BeamService(config);
}

const sign = (body: Buffer, secretB64: string) =>
  createHmac('sha256', Buffer.from(secretB64, 'base64'))
    .update(body)
    .digest('base64');

describe('BeamService.verifyWebhookSignature', () => {
  const body = Buffer.from(
    JSON.stringify({ chargeId: 'ch_1', status: 'SUCCEEDED' }),
  );

  it('accepts a correctly signed body', () => {
    const svc = makeService(SECRET_B64);
    expect(svc.verifyWebhookSignature(body, sign(body, SECRET_B64))).toBe(true);
  });

  it('rejects a tampered signature', () => {
    const svc = makeService(SECRET_B64);
    const wrong = sign(Buffer.from('{"chargeId":"ch_2"}'), SECRET_B64);
    expect(svc.verifyWebhookSignature(body, wrong)).toBe(false);
  });

  it('rejects when no secret is configured', () => {
    const svc = makeService(undefined);
    expect(svc.verifyWebhookSignature(body, sign(body, SECRET_B64))).toBe(false);
  });

  it('rejects when the signature header is missing', () => {
    const svc = makeService(SECRET_B64);
    expect(svc.verifyWebhookSignature(body, undefined)).toBe(false);
  });
});
