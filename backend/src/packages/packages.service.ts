import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Package } from './entities/package.entity';

@Injectable()
export class PackagesService implements OnModuleInit {
    private readonly logger = new Logger(PackagesService.name);

    constructor(
        @InjectRepository(Package)
        private packagesRepository: Repository<Package>,
    ) { }

    async onModuleInit() {
        await this.seedDefaults();
    }

    async seedDefaults() {
        // Seed CTV
        const ctv = await this.packagesRepository.findOne({ where: { code: 'CTV' } });
        if (!ctv) {
            this.logger.log('Seeding default CTV package');
            await this.packagesRepository.save({
                name: 'Cộng Tác Viên',
                code: 'CTV',
                description: 'Gói Cộng Tác Viên cơ bản',
                price: 0.0001, // Matches existing code logic defaults or config
                directCommissionRate: 0.2, // 20%
                groupCommissionRate: 0.1, // 10%
                managementRateF1: 0.15, // 15%
                managementRateF2: null,
                managementRateF3: null,
                reconsumptionThreshold: 0.001,
                reconsumptionRequired: 0.0001,
                level: 1,
                isActive: true,
            });
        }

        // Seed NPP
        const npp = await this.packagesRepository.findOne({ where: { code: 'NPP' } });
        if (!npp) {
            this.logger.log('Seeding default NPP package');
            await this.packagesRepository.save({
                name: 'Nhà Phân Phối',
                code: 'NPP',
                description: 'Gói Nhà Phân Phối cao cấp',
                price: 0.001,
                directCommissionRate: 0.25, // 25%
                groupCommissionRate: 0.15, // 15%
                managementRateF1: 0.15, // 15%
                managementRateF2: 0.1, // 10%
                managementRateF3: 0.1, // 10%
                reconsumptionThreshold: 0.01,
                reconsumptionRequired: 0.001,
                level: 2,
                isActive: true,
            });
        }
    }

    async findAll(): Promise<Package[]> {
        return this.packagesRepository.find({ order: { level: 'ASC' } });
    }

    async findOne(id: string): Promise<Package | null> {
        return this.packagesRepository.findOne({ where: { id } });
    }

    async findByCode(code: string): Promise<Package | null> {
        return this.packagesRepository.findOne({ where: { code } });
    }

    async create(createPackageDto: Partial<Package>): Promise<Package> {
        const newPackage = this.packagesRepository.create(createPackageDto);
        return this.packagesRepository.save(newPackage);
    }

    async update(id: string, updatePackageDto: Partial<Package>): Promise<Package | null> {
        await this.packagesRepository.update(id, updatePackageDto);
        return this.packagesRepository.findOne({ where: { id } });
    }

    async remove(id: string): Promise<void> {
        await this.packagesRepository.delete(id);
    }
}
