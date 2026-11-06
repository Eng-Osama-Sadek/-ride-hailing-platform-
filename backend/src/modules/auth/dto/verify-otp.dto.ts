import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { RequestOtpDto } from './request-otp.dto';

export class VerifyOtpDto extends RequestOtpDto {
  @ApiProperty({ example: '123456', description: '6-digit code (Mock mode: see MOCK_OTP_CODE)' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  code: string;

  @ApiPropertyOptional({ description: 'Stable device identifier (used for session management)' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  deviceId?: string;
}

