import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminService } from './admin.service';

@ApiTags('admin')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('dashboard')
  dashboard() {
    return this.admin.dashboard();
  }

  @Get('users')
  users(@Query('role') role?: Role) {
    return this.admin.users(role);
  }

  @Get('rides')
  rides() {
    return this.admin.rides();
  }

  @Get('payments')
  payments() {
    return this.admin.payments();
  }
}
