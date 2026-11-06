import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

export enum OtpMode {
  Mock = 'mock',
  Sms = 'sms',
}

/**
 * Typed + validated environment. The app refuses to boot when something is wrong,
 * which is far better than failing later at the first login.
 */
class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @IsInt() @Min(1) @Max(65535)
  PORT: number = 3000;

  @IsString() @MinLength(1)
  DATABASE_URL: string;

  @IsString() @MinLength(1)
  REDIS_HOST: string;

  @IsInt() @Min(1) @Max(65535)
  REDIS_PORT: number = 6379;

  @IsOptional() @IsString()
  REDIS_PASSWORD?: string;

  @IsString() @MinLength(32, { message: 'JWT_SECRET must be at least 32 characters' })
  JWT_SECRET: string;

  @IsInt() @Min(60)
  JWT_ACCESS_TTL_SECONDS: number = 900;

  @IsInt() @Min(1)
  REFRESH_TOKEN_TTL_DAYS: number = 30;

  @IsEnum(OtpMode)
  OTP_MODE: OtpMode = OtpMode.Mock;

  @IsString() @MinLength(4)
  MOCK_OTP_CODE: string = '123456';

  @IsInt() @Min(30)
  OTP_TTL_SECONDS: number = 300;

  @IsInt() @Min(1)
  OTP_MAX_ATTEMPTS: number = 5;

  @IsInt() @Min(0)
  OTP_RESEND_COOLDOWN_SECONDS: number = 60;

  @IsString()
  CORS_ORIGINS: string = 'http://localhost:5173';

  @IsIn(['true', 'false'])
  SWAGGER_ENABLED: string = 'true';

  @IsInt() @Min(0)
  TRUST_PROXY_HOPS: number = 0;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    const details = errors
      .map((e) => `  - ${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  if (validated.NODE_ENV === NodeEnv.Production) {
    if (validated.OTP_MODE === OtpMode.Mock) {
      throw new Error('OTP_MODE=mock is not allowed when NODE_ENV=production');
    }
    if (/change_me/i.test(validated.JWT_SECRET)) {
      throw new Error('JWT_SECRET still contains the placeholder value');
    }
  }

  return validated;
}
