import { JwtService } from '@nestjs/jwt';
import { Role, UserStatus } from '@prisma/client';
import { sha256, TokenService } from './token.service';

const user = { id: 'u1', role: Role.RIDER, status: UserStatus.ACTIVE };

function build() {
  const prisma = {
    refreshToken: {
      findUnique: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn().mockResolvedValue({ id: 'new-id' }),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const config = { get: (_k: string, d: unknown) => d };
  const service = new TokenService(
    new JwtService({ secret: 'x'.repeat(40) }),
    prisma as never,
    audit as never,
    config as never,
  );
  return { service, prisma, audit };
}

const record = (over: Record<string, unknown> = {}) => ({
  id: 'old-id',
  userId: 'u1',
  family: 'fam-1',
  revokedAt: null,
  expiresAt: new Date(Date.now() + 60_000),
  user,
  ...over,
});

describe('TokenService.rotate', () => {
  it('rejects an unknown refresh token', async () => {
    const { service, prisma } = build();
    prisma.refreshToken.findUnique.mockResolvedValue(null);
    await expect(service.rotate('nope', {})).rejects.toMatchObject({ status: 401 });
  });

  it('looks tokens up by hash, never by the raw value', async () => {
    const { service, prisma } = build();
    prisma.refreshToken.findUnique.mockResolvedValue(record());
    await service.rotate('raw-token', {});
    expect(prisma.refreshToken.findUnique.mock.calls[0][0].where).toEqual({ tokenHash: sha256('raw-token') });
  });

  it('rotates: revokes the old token, issues a new one in the same family', async () => {
    const { service, prisma } = build();
    prisma.refreshToken.findUnique.mockResolvedValue(record());

    const { tokens } = await service.rotate('raw-token', { ip: '1.1.1.1' });

    expect(tokens.accessToken).toEqual(expect.any(String));
    expect(tokens.refreshToken).not.toBe('raw-token');
    expect(prisma.refreshToken.create.mock.calls[0][0].data.family).toBe('fam-1');
    expect(prisma.refreshToken.update).toHaveBeenCalledWith({
      where: { id: 'old-id' },
      data: { replacedById: 'new-id' },
    });
  });

  it('detects reuse of an already-rotated token: revokes the family + audits + 401', async () => {
    const { service, prisma, audit } = build();
    prisma.refreshToken.findUnique.mockResolvedValue(record({ revokedAt: new Date() }));

    await expect(service.rotate('stolen', {})).rejects.toMatchObject({ status: 401 });

    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { family: 'fam-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'auth.refresh_reuse_detected' }));
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it('rejects an expired token', async () => {
    const { service, prisma } = build();
    prisma.refreshToken.findUnique.mockResolvedValue(record({ expiresAt: new Date(Date.now() - 1) }));
    await expect(service.rotate('old', {})).rejects.toMatchObject({ status: 401 });
  });

  it('refuses to rotate for a blocked user (403)', async () => {
    const { service, prisma } = build();
    prisma.refreshToken.findUnique.mockResolvedValue(record({ user: { ...user, status: UserStatus.BLOCKED } }));
    await expect(service.rotate('t', {})).rejects.toMatchObject({ status: 403 });
  });

  it('treats a lost concurrent-claim race as reuse', async () => {
    const { service, prisma } = build();
    prisma.refreshToken.findUnique.mockResolvedValue(record());
    prisma.refreshToken.updateMany.mockResolvedValueOnce({ count: 0 }); // claim failed
    await expect(service.rotate('t', {})).rejects.toMatchObject({ status: 401 });
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });
});
