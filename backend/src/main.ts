import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { API_PREFIX, configureApp } from './app.setup';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  app.enableShutdownHooks();

  const port = Number(app.get(ConfigService).get('PORT', 3000));
  // 0.0.0.0 => reachable from the phone over the LAN
  await app.listen(port, '0.0.0.0');
  Logger.log(`API ready on http://0.0.0.0:${port}/${API_PREFIX}  |  Swagger: /docs`, 'Bootstrap');
}

void bootstrap();
