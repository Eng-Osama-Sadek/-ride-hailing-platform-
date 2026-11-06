import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  @MinLength(20)
  @MaxLength(256)
  refreshToken: string;
}
