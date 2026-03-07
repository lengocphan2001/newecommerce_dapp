import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PackagesService } from './packages.service';
import { PackagesController } from './packages.controller';
import { PackagePurchaseService } from './package-purchase.service';
import { PackagePurchaseController } from './package-purchase.controller';
import { Package } from './entities/package.entity';
import { PackagePurchase } from './entities/package-purchase.entity';
import { User } from '../user/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Package, PackagePurchase, User]),
  ],
  controllers: [PackagesController, PackagePurchaseController],
  providers: [PackagesService, PackagePurchaseService],
  exports: [PackagesService, PackagePurchaseService],
})
export class PackagesModule {}
