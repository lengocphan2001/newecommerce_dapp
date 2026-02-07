import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { KycModule } from './kyc/kyc.module';
import { ProductModule } from './product/product.module';
import { CategoryModule } from './category/category.module';
import { OrderModule } from './order/order.module';
import { WalletModule } from './wallet/wallet.module';
import { AffiliateModule } from './affiliate/affiliate.module';
import { AdminModule } from './admin/admin.module';
import { AuditLogModule } from './audit-log/audit-log.module';
import { CommonModule } from './common/common.module';
import { User } from './user/entities/user.entity';
import { Address } from './user/entities/address.entity';
import { Product } from './product/entities/product.entity';
import { Order } from './order/entities/order.entity';
import { Commission } from './affiliate/entities/commission.entity';
import { AuditLog } from './audit-log/entities/audit-log.entity';
import { MilestoneRewardConfig } from './admin/entities/milestone-reward-config.entity';
import { UserMilestone } from './admin/entities/user-milestone.entity';
import { Category } from './category/entities/category.entity';
import { Slider } from './slider/entities/slider.entity';
import { SliderModule } from './slider/slider.module';
import { UploadModule } from './upload/upload.module';
import { Staff } from './staff/entities/staff.entity';
import { StaffSession } from './staff/entities/staff-session.entity';
import { Role } from './role/entities/role.entity';
import { Permission } from './permission/entities/permission.entity';
import { StaffModule } from './staff/staff.module';
import { RoleModule } from './role/role.module';
import { PermissionModule } from './permission/permission.module';
import { NotificationsModule } from './notifications/notifications.module';
import { MailModule } from './mail/mail.module';
import { PackagesModule } from './packages/packages.module';
import { Package } from './packages/entities/package.entity';
import { AnalyticsModule } from './analytics/analytics.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    MailModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: (configService.get<string>('DB_TYPE') || 'postgres') as any,
        host: configService.get<string>('DB_HOST') || 'localhost',
        port:
          configService.get<number>('DB_PORT') ||
          ((configService.get<string>('DB_TYPE') || 'postgres') === 'mysql' ? 3306 : 5432),
        username:
          configService.get<string>('DB_USERNAME') ||
          ((configService.get<string>('DB_TYPE') || 'postgres') === 'mysql' ? 'root' : 'postgres'),
        password:
          configService.get<string>('DB_PASSWORD') ||
          ((configService.get<string>('DB_TYPE') || 'postgres') === 'mysql' ? 'root' : 'postgres'),
        database: configService.get<string>('DB_NAME') || 'ecommerce_dapp',
        entities: [User, Address, Product, Order, Commission, AuditLog, MilestoneRewardConfig, UserMilestone, Category, Slider, Staff, StaffSession, Role, Permission, Package],
        synchronize:
          configService.get<string>('FORCE_SYNC') === 'true' ||
          configService.get<string>('NODE_ENV') !== 'production',
        logging: configService.get<string>('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),
    CommonModule,
    AuthModule,
    UserModule,
    KycModule,
    CategoryModule,
    ProductModule,
    SliderModule,
    OrderModule,
    WalletModule,
    AffiliateModule,
    AdminModule,
    AuditLogModule,
    UploadModule,
    StaffModule,
    RoleModule,
    PermissionModule,
    NotificationsModule,
    PackagesModule,
    AnalyticsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
