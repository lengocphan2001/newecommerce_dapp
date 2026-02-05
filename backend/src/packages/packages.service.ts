import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Package } from './entities/package.entity';

@Injectable()
export class PackagesService implements OnModuleInit {
    private readonly logger = new Logger(PackagesService.name);

    constructor(
        @InjectRepository(Package)
        private packagesRepository: Repository<Package>,
        private dataSource: DataSource,
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
                price: 0.0001,
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

        // Migration: Rename old NPP (Level 2) to TV (Thành Viên)
        // We look for a package with code 'NPP' and level 2. If found, we assume it's the old one.
        const oldNpp = await this.packagesRepository.findOne({ where: { code: 'NPP', level: 2 } });
        if (oldNpp) {
            this.logger.log('Migrating old NPP package to TV (Thành Viên)');
            // 1. Rename Package
            oldNpp.code = 'TV';
            oldNpp.name = 'Thành Viên';
            oldNpp.description = 'Gói Thành Viên (User)';
            await this.packagesRepository.save(oldNpp);

            // 2. Migrate Users
            this.logger.log('Migrating users from NPP to TV');
            await this.dataSource.query(`UPDATE users SET packageType = 'TV' WHERE packageType = 'NPP'`);
        }

        // Ensure TV exists (if it wasn't migrated just now, checking if it was already migrated or seeded)
        const tv = await this.packagesRepository.findOne({ where: { code: 'TV' } });
        if (!tv) {
            // If TV doesn't exist and we didn't migrate it (maybe database was empty), seed it.
            // But if we just migrated it, 'tv' variable check above might be stale unless we query again, 
            // but 'oldNpp' update essentially makes it exist.
            // Let's safe check:
            const tvCheck = await this.packagesRepository.findOne({ where: { code: 'TV' } });
            if (!tvCheck) {
                this.logger.log('Seeding default TV package');
                await this.packagesRepository.save({
                    name: 'Thành Viên',
                    code: 'TV',
                    description: 'Gói Thành Viên (User)',
                    price: 0.001, // Old NPP price
                    directCommissionRate: 0.25,
                    groupCommissionRate: 0.15,
                    managementRateF1: 0.15,
                    managementRateF2: 0.1,
                    managementRateF3: 0.1,
                    reconsumptionThreshold: 0.01,
                    reconsumptionRequired: 0.001,
                    level: 2,
                    isActive: true,
                });
            }
        }

        // Seed NEW NPP (Level 3)
        // Check for NPP again (it shouldn't exist if we migrated it, or it will exist if we already seeded new one)
        const newNpp = await this.packagesRepository.findOne({ where: { code: 'NPP' } });
        if (!newNpp) {
            this.logger.log('Seeding NEW NPP package (Level 3)');
            await this.packagesRepository.save({
                name: 'Nhà Phân Phối',
                code: 'NPP',
                description: 'Gói Nhà Phân Phối Chính Thức',
                price: 0.01, // Higher price for new NPP
                directCommissionRate: 0.3, // Higher comm?
                groupCommissionRate: 0.15,
                managementRateF1: 0.15,
                managementRateF2: 0.1,
                managementRateF3: 0.1,
                managementRateF4: 0.05, // Extra level?
                reconsumptionThreshold: 0.05,
                reconsumptionRequired: 0.005,
                level: 3,
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
