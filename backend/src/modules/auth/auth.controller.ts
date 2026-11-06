import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { AuthService } from './auth.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ClientMeta } from './token.service';

/** 5 requests / minute / IP on credential-sensitive endpoints. */
const STRICT = { default: { limit: 5, ttl: 60_000 } };

const metaOf = (req: Request): ClientMeta => ({
  ip: req.ip,
  userAgent: req.headers['user-agent'],
});

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle(STRICT)
  @Post('otp/request')
  @HttpCode(200)
  @ApiOperation({ summary: 'Send a verification code to the phone (Mock mode: fixed code, printed in logs)' })
  requestOtp(@Body() dto: RequestOtpDto, @Req() req: Request) {
    return this.auth.requestOtp(dto, metaOf(req));
  }

  @Public()
  @Throttle(STRICT)
  @Post('otp/verify')
  @HttpCode(200)
  @ApiOperation({ summary: 'Verify the code. Creates the account on first login.' })
  verifyOtp(@Body() dto: VerifyOtpDto, @Req() req: Request) {
    return this.auth.verifyOtp(dto, { ...metaOf(req), deviceId: dto.deviceId });
  }

  @Public()
  @Throttle(STRICT)
  @Post('admin/login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Admin dashboard login (email + password)' })
  adminLogin(@Body() dto: AdminLoginDto, @Req() req: Request) {
    return this.auth.adminLogin(dto, metaOf(req));
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotate the refresh token and get a new access token' })
  refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    return this.auth.refresh(dto.refreshToken, metaOf(req));
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Revoke the session that owns this refresh token' })
  async logout(@Body() dto: RefreshTokenDto, @Req() req: Request): Promise<void> {
    await this.auth.logout(dto.refreshToken, metaOf(req));
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current authenticated user' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.me(user.id);
  }
}
