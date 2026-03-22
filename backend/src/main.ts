import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { StaffSeedService } from './common/seed/staff-seed.service';

import { PermissionService } from './permission/permission.service';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import * as express from 'express';
import rateLimit from 'express-rate-limit';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Trust proxy headers (for HTTPS detection behind reverse proxy)
  app.set('trust proxy', true);

  // CORS must run BEFORE express.json / rate-limit so browser preflight (OPTIONS) gets
  // Access-Control-* headers. Otherwise /auth/username-login/verify etc. fail in the browser.
  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((origin) => origin.trim())
    : [
        'https://vinmall.org',
        'https://www.vinmall.org',
        'http://localhost:3000',
        'http://localhost:3001',
      ];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        process.env.NODE_ENV !== 'production'
      ) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 86400,
  });

  // Increase body size limit for JSON (to handle base64 avatar uploads)
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  /** Đặt DISABLE_RATE_LIMIT=true trong .env để tắt toàn bộ express-rate-limit (chỉ nên dùng khi dev/test). Production không set. */
  const disableRateLimit =
    process.env.DISABLE_RATE_LIMIT === 'true' ||
    process.env.DISABLE_RATE_LIMIT === '1';

  if (disableRateLimit) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        '[main] DISABLE_RATE_LIMIT: all express rate limits are disabled.',
      );
    }
  } else {
    const skipOptions = (req: express.Request) => req.method === 'OPTIONS';

    const authLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 30,
      standardHeaders: true,
      legacyHeaders: false,
      skip: skipOptions,
      message: {
        message: 'Too many auth requests, please try again later.',
      },
    });
    const authLoginLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 10,
      standardHeaders: true,
      legacyHeaders: false,
      skip: skipOptions,
      message: {
        message: 'Too many login attempts, please try again later.',
      },
    });
    const walletMutationLimiter = rateLimit({
      windowMs: 10 * 60 * 1000,
      max: 25,
      standardHeaders: true,
      legacyHeaders: false,
      skip: skipOptions,
      message: {
        message: 'Too many wallet actions, please try again later.',
      },
    });
    const uploadLimiter = rateLimit({
      windowMs: 10 * 60 * 1000,
      max: 20,
      standardHeaders: true,
      legacyHeaders: false,
      skip: skipOptions,
      message: {
        message: 'Too many upload requests, please try again later.',
      },
    });
    const adminSensitiveLimiter = rateLimit({
      windowMs: 10 * 60 * 1000,
      max: 10,
      standardHeaders: true,
      legacyHeaders: false,
      skip: skipOptions,
      message: {
        message: 'Too many sensitive admin actions, please try again later.',
      },
    });

    app.use('/auth', authLimiter);
    app.use('/auth/login', authLoginLimiter);
    app.use('/auth/admin/login', authLoginLimiter);
    app.use('/auth/wallet/login', authLoginLimiter);
    app.use('/auth/username-login', authLoginLimiter);
    app.use('/wallet/deposit-requests', walletMutationLimiter);
    app.use('/wallet/withdraw-requests', walletMutationLimiter);
    app.use('/uploads', uploadLimiter);
    app.use(
      '/admin/users/export-login-credentials',
      adminSensitiveLimiter,
    );
  }

  // Serve uploaded files
  const uploadDir = join(process.cwd(), 'uploads');
  if (!existsSync(uploadDir)) {
    mkdirSync(uploadDir, { recursive: true });
  }
  // IMPORTANT: don't use "/uploads" here because it conflicts with UploadController routes
  // (e.g. POST /uploads/image). Serve files under a different prefix.
  app.useStaticAssets(uploadDir, { prefix: '/files' });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Seed default super admin staff
  try {
    const staffSeedService = app.get(StaffSeedService);
    await staffSeedService.seed();
  } catch (error) {
    console.error('Failed to seed super admin staff:', error);
  }

  // Initialize default commission configs

  // Seed permissions
  try {
    const permissionService = app.get(PermissionService);
    await permissionService.seedPermissions();
  } catch (error) {
    console.error('Failed to seed permissions:', error);
  }

  // Default to 3002 to avoid clashing with:
  // - Next.js frontend (usually 3000)
  // - Admin React app (usually 3001)
  const port = process.env.PORT || 3002;
  await app.listen(port);
}
bootstrap();
