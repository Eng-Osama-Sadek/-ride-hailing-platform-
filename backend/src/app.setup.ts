import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

export const API_PREFIX = 'api/v1';

/**
 * Shared by main.ts and the e2e tests so tests exercise the exact same pipeline
 * (prefix, validation, error format) as production.
 */
export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService);

  const proxyHops = Number(config.get('TRUST_PROXY_HOPS', 0));
  if (proxyHops > 0) (app as NestExpressApplication).set('trust proxy', proxyHops);

  app.setGlobalPrefix(API_PREFIX);
  app.use(helmet());

  const origins = String(config.get('CORS_ORIGINS', ''))
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({ origin: origins, credentials: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // drop unknown properties
      forbidNonWhitelisted: true, // ...and reject the request that sent them
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  if (config.get('SWAGGER_ENABLED', 'true') === 'true') {
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Ride-Hailing API')
        .setDescription('Rider / Driver / Admin API')
        .setVersion('0.1.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('docs', app, doc); // http://localhost:3000/docs
  }
}
