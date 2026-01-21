import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommissionConfig, PackageType } from './entities/commission-config.entity';
import { CreateCommissionConfigDto, UpdateCommissionConfigDto } from './dto/commission-config.dto';
import { formatDecimalsInObject } from '../common/utils/number.util';

@Injectable()
export class CommissionConfigService {
  constructor(
    @InjectRepository(CommissionConfig)
    private configRepository: Repository<CommissionConfig>,
  ) {}

  /**
   * Get all commission configs
   */
  async findAll(): Promise<CommissionConfig[]> {
    const configs = await this.configRepository.find({
      order: { packageType: 'ASC' },
    });
    // Format decimal numbers to fix floating-point precision issues
    return formatDecimalsInObject(configs) as CommissionConfig[];
  }

  /**
   * Get config by package type
   */
  async findByPackageType(packageType: PackageType): Promise<CommissionConfig | null> {
    const config = await this.configRepository.findOne({
      where: { packageType },
    });
    if (!config) return null;
    // Format decimal numbers to fix floating-point precision issues
    return formatDecimalsInObject(config) as CommissionConfig;
  }

  /**
   * Get config by ID
   */
  async findOne(id: string): Promise<CommissionConfig> {
    const config = await this.configRepository.findOne({ where: { id } });
    if (!config) {
      throw new NotFoundException(`Commission config with ID ${id} not found`);
    }
    // Format decimal numbers to fix floating-point precision issues
    return formatDecimalsInObject(config) as CommissionConfig;
  }

  /**
   * Create new config
   */
  async create(createDto: CreateCommissionConfigDto): Promise<CommissionConfig> {
    // Check if config for this package type already exists
    const existing = await this.findByPackageType(createDto.packageType);
    if (existing) {
      throw new Error(`Config for package type ${createDto.packageType} already exists`);
    }

    const config = this.configRepository.create(createDto);
    const saved = await this.configRepository.save(config);
    // Format decimal numbers to fix floating-point precision issues
    return formatDecimalsInObject(saved) as CommissionConfig;
  }

  /**
   * Update config
   */
  async update(id: string, updateDto: UpdateCommissionConfigDto): Promise<CommissionConfig> {
    const config = await this.findOne(id);
    Object.assign(config, updateDto);
    const saved = await this.configRepository.save(config);
    // Format decimal numbers to fix floating-point precision issues
    return formatDecimalsInObject(saved) as CommissionConfig;
  }

  /**
   * Update config by package type
   */
  async updateByPackageType(
    packageType: PackageType,
    updateDto: UpdateCommissionConfigDto,
  ): Promise<CommissionConfig> {
    const config = await this.findByPackageType(packageType);
    if (!config) {
      throw new NotFoundException(`Config for package type ${packageType} not found`);
    }
    Object.assign(config, updateDto);
    const saved = await this.configRepository.save(config);
    // Format decimal numbers to fix floating-point precision issues
    return formatDecimalsInObject(saved) as CommissionConfig;
  }

  /**
   * Delete config
   */
  async remove(id: string): Promise<void> {
    const config = await this.findOne(id);
    await this.configRepository.remove(config);
  }

  /**
   * Initialize default configs if they don't exist
   */
  async initializeDefaults(): Promise<void> {
    // CTV defaults
    const ctvExists = await this.findByPackageType(PackageType.CTV);
    if (!ctvExists) {
      await this.configRepository.save({
        packageType: PackageType.CTV,
        directRate: 0.2, // 20%
        groupRate: 0.1, // 10%
        managementRateF1: 0.15, // 15%
        managementRateF2: null,
        managementRateF3: null,
        packageValue: 0.0001,
        reconsumptionThreshold: 0.001,
        reconsumptionRequired: 0.0001,
      });
    }

    // NPP defaults
    const nppExists = await this.findByPackageType(PackageType.NPP);
    if (!nppExists) {
      await this.configRepository.save({
        packageType: PackageType.NPP,
        directRate: 0.25, // 25%
        groupRate: 0.15, // 15%
        managementRateF1: 0.15, // 15%
        managementRateF2: 0.1, // 10%
        managementRateF3: 0.1, // 10%
        packageValue: 0.001,
        reconsumptionThreshold: 0.01,
        reconsumptionRequired: 0.001,
      });
    }
  }
}
