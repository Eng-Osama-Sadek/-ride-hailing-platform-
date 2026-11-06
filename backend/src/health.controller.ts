import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from './common/decorators/public.decorator';
import { PrismaService } from './prisma/prisma.service';
import { RedisService } from './redis/redis.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Public()
  @SkipThrottle()
  @Get()
  async check() {
    const [db, cache] = await Promise.allSettled([
      this.prisma.$queryRaw`SELECT 1`,
      this.redis.client.ping(),
    ]);
    const dbUp = db.status === 'fulfilled';
    const redisUp = cache.status === 'fulfilled';

    if (!dbUp || !redisUp) {
      throw new ServiceUnavailableException(
        `Dependency down: db=${dbUp ? 'up' : 'down'}, redis=${redisUp ? 'up' : 'down'}`,
      );
    }
    return { status: 'ok', db: 'up', redis: 'up', uptimeSeconds: Math.round(process.uptime()) };
  }
}
