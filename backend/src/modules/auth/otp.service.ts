import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotImplementedException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import { RedisService } from '../../redis/redis.service';
import { OtpMode } from '../../config/env.validation';

/**
 * OTP lifecycle, stored entirely in Redis (never in PostgreSQL):
 *   otp:code:{role}:{phone}      -> HMAC(code)          TTL = OTP_TTL_SECONDS
 *   otp:attempts:{role}:{phone}  -> failed attempts      TTL = OTP_TTL_SECONDS
 *   otp:cooldown:{role}:{phone}  -> resend throttle      TTL = OTP_RESEND_COOLDOWN_SECONDS
 * The code itself is never stored — only an HMAC keyed with JWT_SECRET.
 */
@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly mode: OtpMode;
  private readonly mockCode: string;
  private readonly ttlSeconds: number;
  private readonly maxAttempts: number;
  private readonly cooldownSeconds: number;
  private readonly secret: string;

  constructor(
    private readonly redis: RedisService,
    config: ConfigService,
  ) {
    this.mode = config.getOrThrow<OtpMode>('OTP_MODE');
    this.mockCode = config.get<string>('MOCK_OTP_CODE', '123456');
    this.ttlSeconds = Number(config.get('OTP_TTL_SECONDS', 300));
    this.maxAttempts = Number(config.get('OTP_MAX_ATTEMPTS', 5));
    this.cooldownSeconds = Number(config.get('OTP_RESEND_COOLDOWN_SECONDS', 60));
    this.secret = config.getOrThrow<string>('JWT_SECRET');
  }

  async issue(phone: string, role: Role): Promise<{ expiresInSeconds: number }> {
    if (this.cooldownSeconds > 0) {
      const acquired = await this.redis.client.set(
        this.key('cooldown', phone, role),
        '1',
        'EX',
        this.cooldownSeconds,
        'NX',
      );
      if (acquired !== 'OK') {
        throw new HttpException(
          'Please wait before requesting a new code',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const code = this.mode === OtpMode.Mock ? this.mockCode : this.generateCode();

    await this.redis.client.set(
      this.key('code', phone, role),
      this.hash(phone, code),
      'EX',
      this.ttlSeconds,
    );
    await this.redis.client.del(this.key('attempts', phone, role));

    await this.deliver(phone, role, code);
    return { expiresInSeconds: this.ttlSeconds };
  }

  async verify(phone: string, role: Role, code: string): Promise<void> {
    const codeKey = this.key('code', phone, role);
    const attemptsKey = this.key('attempts', phone, role);

    const stored = await this.redis.client.get(codeKey);
    if (!stored) throw new BadRequestException('Code expired or not requested');

    const attempts = await this.redis.client.incr(attemptsKey);
    if (attempts === 1) await this.redis.client.expire(attemptsKey, this.ttlSeconds);
    if (attempts > this.maxAttempts) {
      await this.redis.client.del(codeKey);
      throw new HttpException(
        'Too many failed attempts, request a new code',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (!this.safeEqual(stored, this.hash(phone, code))) {
      throw new UnauthorizedException('Invalid code');
    }

    // Single-use: DEL returns 1 only for the request that actually removed the key,
    // so two parallel requests with the right code cannot both succeed.
    const removed = await this.redis.client.del(codeKey);
    await this.redis.client.del(attemptsKey);
    if (removed !== 1) throw new BadRequestException('Code expired or not requested');
  }

  // ---------------------------------------------------------------- helpers

  private async deliver(phone: string, role: Role, code: string): Promise<void> {
    if (this.mode === OtpMode.Mock) {
      this.logger.warn(`[MOCK OTP] ${role} ${phone} -> ${code}`);
      return;
    }
    // Production: plug Twilio (or a local SMS gateway) in here.
    throw new NotImplementedException('SMS provider is not configured yet');
  }

  private generateCode(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  private hash(phone: string, code: string): string {
    return createHmac('sha256', this.secret).update(`${phone}:${code}`).digest('hex');
  }

  private safeEqual(a: string, b: string): boolean {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    return ba.length === bb.length && timingSafeEqual(ba, bb);
  }

  private key(kind: 'code' | 'attempts' | 'cooldown', phone: string, role: Role): string {
    return `otp:${kind}:${role}:${phone}`;
  }
}
