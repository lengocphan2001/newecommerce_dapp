"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const app_module_1 = require("./app.module");
const user_service_1 = require("./user/user.service");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.enableCors({
        origin: true,
        credentials: true,
    });
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    try {
        const userService = app.get(user_service_1.UserService);
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
    }
    catch (error) {
        console.error('Error creating admin user:', error.message);
    }
    const port = process.env.PORT || 3000;
    await app.listen(port);
    console.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();
//# sourceMappingURL=main.js.map