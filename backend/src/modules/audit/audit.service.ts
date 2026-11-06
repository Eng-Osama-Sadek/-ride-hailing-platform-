import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export enum AuditAction {
  OTP_REQUESTED = 'auth.otp_requested',
  LOGIN_SUCCESS = 'auth.login',
  ADMIN_LOGIN_FAILED = 'auth.admin_login_failed',
  LOGOUT = 'auth.logout',
  TOKEN_REUSE_DETECTED = 'auth.refresh_reuse_detected',
}

export interface AuditEntry {
  userId?: string | null;
  action: AuditAction | string;
  entity: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
  ip?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Best-effort: an audit failure must never break a login.
   * (Money-related actions will use a transactional variant later.)
   */
  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: entry.userId ?? null,
          action: entry.action,
          entity: entry.entity,
          entityId: entry.entityId,
          metadata: entry.metadata,
          ip: entry.ip,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to write audit log (${entry.action}): ${(err as Error).message}`);
    }
  }
}
