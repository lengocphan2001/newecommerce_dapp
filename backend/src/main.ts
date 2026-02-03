import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { StaffSeedService } from './common/seed/staff-seed.service';

import { PermissionService } from './permission/permission.service';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Trust proxy headers (for HTTPS detection behind reverse proxy)
  app.set('trust proxy', true);

  // Increase body size limit for JSON (to handle base64 avatar uploads)
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Serve uploaded files
  const uploadDir = join(process.cwd(), 'uploads');
  if (!existsSync(uploadDir)) {
    mkdirSync(uploadDir, { recursive: true });
  }
  // IMPORTANT: don't use "/uploads" here because it conflicts with UploadController routes
  // (e.g. POST /uploads/image). Serve files under a different prefix.
  app.useStaticAssets(uploadDir, { prefix: '/files' });

  // Enable CORS
  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
    : [
      'https://vinmall.org',
      'https://www.vinmall.org',
      'http://localhost:3000',
      'http://localhost:3001',
    ];

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      // Check if origin is in allowed list
      if (allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 86400, // 24 hours
  });

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
    // eslint-disable-next-line no-console
    console.error('Failed to seed super admin staff:', error);
  }

  // Initialize default commission configs


  // Seed permissions
  try {
    const permissionService = app.get(PermissionService);
    await permissionService.seedPermissions();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to seed permissions:', error);
  }

  // Default to 3002 to avoid clashing with:
  // - Next.js frontend (usually 3000)
  // - Admin React app (usually 3001)
  const port = process.env.PORT || 3002;
  await app.listen(port);
}
bootstrap();
