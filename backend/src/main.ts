import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    // Keep the raw request body available (req.rawBody) so the Beam webhook can
    // verify its X-Beam-Signature over the exact bytes received.
    rawBody: true,
  });

  // Production sits behind Cloudflare → Railway's edge proxy. Trust that one
  // hop so req.ip/req.protocol come from the forwarded headers instead of the
  // edge's own address. Real client identity uses CF-Connecting-IP (see
  // ThrottlerBehindProxyGuard); deliberately not `true` so a client can't
  // spoof req.ip by seeding X-Forwarded-For.
  app.set('trust proxy', 1);

  app.use(helmet());

  // CORS: FRONTEND_URL may be a comma-separated allow-list. Requests without an
  // Origin header (server-to-server, curl, the Omise webhook) are allowed.
  // Set ALLOW_VERCEL_PREVIEWS=true to also accept *.vercel.app preview deploys.
  const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const allowVercelPreviews = process.env.ALLOW_VERCEL_PREVIEWS === 'true';

  app.enableCors({
    origin: (
      origin: string | undefined,
      cb: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      try {
        if (
          allowVercelPreviews &&
          new URL(origin).hostname.endsWith('.vercel.app')
        ) {
          return cb(null, true);
        }
      } catch {
        // fall through to reject on an unparseable origin
      }
      return cb(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3001;
  await app.listen(port);
  Logger.log(`🚀 API running on http://localhost:${port}/api`, 'Bootstrap');
}

bootstrap();
