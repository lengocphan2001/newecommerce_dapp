import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { UserService } from './user/user.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Create default admin user
  try {
    const userService = app.get(UserService);
    const adminEmail = 'admin@example.com';
    const existingAdmin = await userService.findByEmail(adminEmail);
    
    if (!existingAdmin) {
      await userService.create({
        email: adminEmail,
        password: 'admin123',
        fullName: 'Admin User',
        isAdmin: true,
        status: 'ACTIVE',
      });
      console.log('Default admin user created:');
      console.log('Email: admin@example.com');
      console.log('Password: admin123');
    }
  } catch (error) {
    console.error('Error creating admin user:', error.message);
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();
