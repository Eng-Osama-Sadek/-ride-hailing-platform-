import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role, User, UserStatus } from '@prisma/client';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditAction, AuditService } from '../audit/audit.service';
import { JwtPayload } from '../../common/types/authenticated-user';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  /** access-token lifetime in seconds */
  expiresIn: number;
}

export interface ClientMeta {
  deviceId?: string;
  ip?: string;
  userAgent?: string;
}

export const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

export const isInactive = (status: UserStatus): boolean =>
  status === UserStatus.BLOCKED || status === UserStatus.SUSPENDED;

/**
 * Access token  = short-lived JWT (15 min).
 * Refresh token = opaque random string, stored hashed, ROTATED on every use.
 * If an already-used refresh token shows up again (theft / replay), the whole
 * token family is revoked and the user must log in again.
 */
@Injectable()
export class TokenService {
  private readonly accessTtlSeconds: number;
  private readonly refreshTtlMs: number;

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    config: ConfigService,
  ) {
    this.accessTtlSeconds = Number(config.get('JWT_ACCESS_TTL_SECONDS', 900));
    this.refreshTtlMs = Number(config.get('REFRESH_TOKEN_TTL_DAYS', 30)) * 24 * 60 * 60 * 1000;
  }

  /** Start a brand-new session (login). */
  async issue(user: Pick<User, 'id' | 'role'>, meta: ClientMeta): Promise<TokenPair> {
    const { raw } = await this.createRefreshRecord(user.id, meta);
    return this.buildPair(user, raw);
  }

  /** Exchange a refresh token for a new pair; the old one becomes unusable. */
  async rotate(rawToken: string, meta: ClientMeta): Promise<{ user: User; tokens: TokenPair }> {
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(rawToken) },
      include: { user: true },
    });
    if (!existing) throw new UnauthorizedException('Invalid refresh token');

    if (existing.revokedAt) {
      await this.revokeFamily(existing.family);
      await this.audit.log({
        userId: existing.userId,
        action: AuditAction.TOKEN_REUSE_DETECTED,
        entity: 'RefreshToken',
        entityId: existing.id,
        ip: meta.ip,
      });
      throw new UnauthorizedException('Refresh token reuse detected, please log in again');
    }

    if (existing.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token expired');
    }
    if (isInactive(existing.user.status)) {
      throw new ForbiddenException('Account is not active');
    }

    // Atomic claim: only one concurrent request can flip revokedAt from null.
    const claimed = await this.prisma.refreshToken.updateMany({
      where: { id: existing.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (claimed.count !== 1) {
      await this.revokeFamily(existing.family);
      throw new UnauthorizedException('Refresh token already used');
    }

    const next = await this.createRefreshRecord(existing.userId, meta, existing.family);
    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { replacedById: next.id },
    });

    return { user: existing.user, tokens: this.buildPair(existing.user, next.raw) };
  }

  /** Logout: kill the whole session family this token belongs to. */
  async revoke(rawToken: string): Promise<{ userId: string } | null> {
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(rawToken) },
    });
    if (!existing) return null;
    await this.revokeFamily(existing.family);
    return { userId: existing.userId };
  }

  // ---------------------------------------------------------------- helpers

  private buildPair(user: Pick<User, 'id' | 'role'>, refreshToken: string): TokenPair {
    const payload: JwtPayload = { sub: user.id, role: user.role as Role };
    return {
      accessToken: this.jwt.sign(payload, { expiresIn: this.accessTtlSeconds }),
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.accessTtlSeconds,
    };
  }

  private async createRefreshRecord(userId: string, meta: ClientMeta, family?: string) {
    const raw = randomBytes(48).toString('base64url');
    const record = await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: sha256(raw),
        family: family ?? randomUUID(),
        expiresAt: new Date(Date.now() + this.refreshTtlMs),
        deviceId: meta.deviceId,
        userAgent: meta.userAgent?.slice(0, 255),
        ip: meta.ip,
      },
    });
    return { raw, id: record.id };
  }

  private revokeFamily(family: string) {
    return this.prisma.refreshToken.updateMany({
      where: { family, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
