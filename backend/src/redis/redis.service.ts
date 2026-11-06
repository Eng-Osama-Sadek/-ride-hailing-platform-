import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/** Thin wrapper that owns the single shared ioredis connection. */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  readonly client: Redis;

  constructor(config: ConfigService) {
    this.client = new Redis({
      host: config.getOrThrow<string>('REDIS_HOST'),
      port: Number(config.get('REDIS_PORT', 6379)),
      password: config.get<string>('REDIS_PASSWORD') || undefined,
      maxRetriesPerRequest: 3,
    });
    this.client.on('error', (err) => this.logger.error(`Redis error: ${err.message}`));
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
