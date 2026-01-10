"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const app_module_1 = require("./app.module");
const admin_seed_service_1 = require("./common/seed/admin-seed.service");
const path_1 = require("path");
const fs_1 = require("fs");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const uploadDir = (0, path_1.join)(process.cwd(), 'uploads');
    if (!(0, fs_1.existsSync)(uploadDir)) {
        (0, fs_1.mkdirSync)(uploadDir, { recursive: true });
    }
    app.useStaticAssets(uploadDir, { prefix: '/files' });
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
        const adminSeedService = app.get(admin_seed_service_1.AdminSeedService);
        await adminSeedService.seed();
    }
    catch (error) {
    }
    const port = process.env.PORT || 3002;
    await app.listen(port);
}
bootstrap();
//# sourceMappingURL=main.js.map