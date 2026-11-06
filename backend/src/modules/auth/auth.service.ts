import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Role, User, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditAction, AuditService } from '../audit/audit.service';
import { OtpService } from './otp.service';
import { ClientMeta, isInactive, TokenService } from './token.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

const BCRYPT_ROUNDS = 12;

export const maskPhone = (phone: string): string =>
  phone.length > 7 ? `${phone.slice(0, 5)}****${phone.slice(-2)}` : '****';

export const toPublicUser = (user: User) => ({
  id: user.id,
  phone: user.phone,
  name: user.name,
  email: user.email,
  role: user.role,
  status: user.status,
});

@Injectable()
export class AuthService {
  /** Compared against when the email is unknown, so response time doesn't reveal valid emails. */
  private readonly dummyHash = bcrypt.hashSync(randomBytes(16).toString('hex'), BCRYPT_ROUNDS);

  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
  ) {}

  async requestOtp(dto: RequestOtpDto, meta: ClientMeta) {
    const { expiresInSeconds } = await this.otp.issue(dto.phone, dto.role);
    await this.audit.log({
      action: AuditAction.OTP_REQUESTED,
      entity: 'User',
      metadata: { phone: maskPhone(dto.phone), role: dto.role },
      ip: meta.ip,
    });
    return { message: 'Verification code sent', expiresInSeconds };
  }

  async verifyOtp(dto: VerifyOtpDto, meta: ClientMeta) {
    await this.otp.verify(dto.phone, dto.role, dto.code);

    let user = await this.prisma.user.findUnique({
      where: { phone_role: { phone: dto.phone, role: dto.role } },
    });

    let isNewUser = false;
    if (!user) {
      isNewUser = true;
      user = await this.prisma.user.create({
        data: {
          phone: dto.phone,
          role: dto.role,
          // Drivers can log in right away but stay PENDING_KYC until an admin approves their documents.
          status: dto.role === Role.DRIVER ? UserStatus.PENDING_KYC : UserStatus.ACTIVE,
          ...(dto.role === Role.RIDER ? { riderProfile: { create: {} } } : {}),
        },
      });
    }

    if (isInactive(user.status)) throw new ForbiddenException('Account is not active');

    return this.completeLogin(user, meta, isNewUser);
  }

  async adminLogin(dto: AdminLoginDto, meta: ClientMeta) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    const isAdmin = !!user && user.role === Role.ADMIN && !!user.passwordHash;

    // Always run one bcrypt comparison (real or dummy) to keep timing uniform.
    const matches = await bcrypt.compare(dto.password, isAdmin ? user!.passwordHash! : this.dummyHash);

    if (!isAdmin || !matches) {
      await this.audit.log({
        userId: isAdmin ? user!.id : null,
        action: AuditAction.ADMIN_LOGIN_FAILED,
        entity: 'User',
        metadata: { email: dto.email },
        ip: meta.ip,
      });
      throw new UnauthorizedException('Invalid email or password');
    }
    if (isInactive(user!.status)) throw new ForbiddenException('Account is not active');

    return this.completeLogin(user!, meta, false);
  }

  async refresh(refreshToken: string, meta: ClientMeta) {
    const { user, tokens } = await this.tokens.rotate(refreshToken, meta);
    return { ...tokens, user: toPublicUser(user) };
  }

  async logout(refreshToken: string, meta: ClientMeta): Promise<void> {
    const result = await this.tokens.revoke(refreshToken);
    if (result) {
      await this.audit.log({
        userId: result.userId,
        action: AuditAction.LOGOUT,
        entity: 'User',
        entityId: result.userId,
        ip: meta.ip,
      });
    }
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return toPublicUser(user);
  }

  private async completeLogin(user: User, meta: ClientMeta, isNewUser: boolean) {
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const tokens = await this.tokens.issue(user, meta);
    await this.audit.log({
      userId: user.id,
      action: AuditAction.LOGIN_SUCCESS,
      entity: 'User',
      entityId: user.id,
      metadata: { role: user.role, isNewUser },
      ip: meta.ip,
    });
    return { ...tokens, user: toPublicUser(user), isNewUser };
  }
}
