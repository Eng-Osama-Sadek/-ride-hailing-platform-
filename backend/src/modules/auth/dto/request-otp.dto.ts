import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsString, Matches } from 'class-validator';
import { Role } from '@prisma/client';

/** Strips spaces/dashes so "+20 100-000-0001" and "+201000000001" are the same user. */
export const normalizePhone = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.replace(/[\s-]/g, '') : value;

export class RequestOtpDto {
  @ApiProperty({ example: '+201000000001', description: 'Phone number in E.164 format' })
  @Transform(normalizePhone)
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/, { message: 'phone must be in E.164 format, e.g. +201000000001' })
  phone: string;

  @ApiProperty({ enum: [Role.RIDER, Role.DRIVER], example: Role.RIDER })
  @IsIn([Role.RIDER, Role.DRIVER], { message: 'role must be RIDER or DRIVER' })
  role: Role;
}
