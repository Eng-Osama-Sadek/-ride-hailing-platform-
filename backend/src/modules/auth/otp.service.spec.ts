import { OtpService } from './otp.service';
import { Role } from '@prisma/client';

/** Minimal in-memory stand-in for the ioredis commands OtpService uses. */
function fakeRedis() {
  const data = new Map<string, string>();
  return {
    client: {
      set: jest.fn(async (key: string, value: string, ...args: (string | number)[]) => {
        if (args.includes('NX') && data.has(key)) return null;
        data.set(key, value);
        return 'OK';
      }),
      get: jest.fn(async (key: string) => data.get(key) ?? null),
      incr: jest.fn(async (key: string) => {
        const n = Number(data.get(key) ?? 0) + 1;
        data.set(key, String(n));
        return n;
      }),
      expire: jest.fn(async () => 1),
      del: jest.fn(async (...keys: string[]) => keys.filter((k) => data.delete(k)).length),
    },
  };
}

function build(overrides: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = {
    OTP_MODE: 'mock',
    MOCK_OTP_CODE: '123456',
    OTP_TTL_SECONDS: 300,
    OTP_MAX_ATTEMPTS: 3,
    OTP_RESEND_COOLDOWN_SECONDS: 60,
    JWT_SECRET: 'x'.repeat(40),
    ...overrides,
  };
  const config = {
    get: (k: string, d?: unknown) => values[k] ?? d,
    getOrThrow: (k: string) => values[k],
  };
  const redis = fakeRedis();
  const service = new OtpService(redis as never, config as never);
  return { service, redis };
}

const PHONE = '+201000000001';

describe('OtpService', () => {
  it('accepts the right code once, then rejects reuse', async () => {
    const { service } = build({ OTP_RESEND_COOLDOWN_SECONDS: 0 });
    await service.issue(PHONE, Role.RIDER);

    await expect(service.verify(PHONE, Role.RIDER, '123456')).resolves.toBeUndefined();
    await expect(service.verify(PHONE, Role.RIDER, '123456')).rejects.toMatchObject({ status: 400 });
  });

  it('rejects a wrong code with 401', async () => {
    const { service } = build({ OTP_RESEND_COOLDOWN_SECONDS: 0 });
    await service.issue(PHONE, Role.RIDER);
    await expect(service.verify(PHONE, Role.RIDER, '000000')).rejects.toMatchObject({ status: 401 });
  });

  it('locks out after too many failed attempts (429) and burns the code', async () => {
    const { service } = build({ OTP_RESEND_COOLDOWN_SECONDS: 0, OTP_MAX_ATTEMPTS: 3 });
    await service.issue(PHONE, Role.RIDER);

    for (let i = 0; i < 3; i++) {
      await expect(service.verify(PHONE, Role.RIDER, '000000')).rejects.toMatchObject({ status: 401 });
    }
    await expect(service.verify(PHONE, Role.RIDER, '123456')).rejects.toMatchObject({ status: 429 });
    // code was deleted: even the right one is now "expired"
    await expect(service.verify(PHONE, Role.RIDER, '123456')).rejects.toMatchObject({ status: 400 });
  });

  it('throttles resend requests within the cooldown window (429)', async () => {
    const { service } = build({ OTP_RESEND_COOLDOWN_SECONDS: 60 });
    await service.issue(PHONE, Role.RIDER);
    await expect(service.issue(PHONE, Role.RIDER)).rejects.toMatchObject({ status: 429 });
  });

  it('keeps RIDER and DRIVER codes separate for the same phone', async () => {
    const { service } = build({ OTP_RESEND_COOLDOWN_SECONDS: 0 });
    await service.issue(PHONE, Role.RIDER);
    await expect(service.verify(PHONE, Role.DRIVER, '123456')).rejects.toMatchObject({ status: 400 });
  });

  it('fails verification when no code was requested', async () => {
    const { service } = build();
    await expect(service.verify(PHONE, Role.RIDER, '123456')).rejects.toMatchObject({ status: 400 });
  });

  it('never stores the plain code in Redis', async () => {
    const { service, redis } = build({ OTP_RESEND_COOLDOWN_SECONDS: 0 });
    await service.issue(PHONE, Role.RIDER);
    const storedValues = redis.client.set.mock.calls.map((c) => c[1]);
    expect(storedValues).not.toContain('123456');
  });
});
