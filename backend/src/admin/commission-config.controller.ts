import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { CommissionConfigService } from './commission-config.service';
import { CreateCommissionConfigDto, UpdateCommissionConfigDto } from './dto/commission-config.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PackageType } from './entities/commission-config.entity';
import { CommissionService } from '../affiliate/commission.service';

@Controller('admin/commission-config')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class CommissionConfigController {
  constructor(
    private readonly configService: CommissionConfigService,
    @Inject(forwardRef(() => CommissionService))
    private readonly commissionService: CommissionService,
  ) {}

  @Get()
  async findAll() {
    return this.configService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.configService.findOne(id);
  }

  @Get('package/:packageType')
  async findByPackageType(@Param('packageType') packageType: PackageType) {
    return this.configService.findByPackageType(packageType);
  }

  @Post()
  async create(@Body() createDto: CreateCommissionConfigDto) {
    return this.configService.create(createDto);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateDto: UpdateCommissionConfigDto) {
    const result = await this.configService.update(id, updateDto);
    // Clear cache in CommissionService when config is updated
    this.commissionService.clearConfigCache();
    return result;
  }

  @Put('package/:packageType')
  async updateByPackageType(
    @Param('packageType') packageType: PackageType,
    @Body() updateDto: UpdateCommissionConfigDto,
  ) {
    const result = await this.configService.updateByPackageType(packageType, updateDto);
    // Clear cache in CommissionService when config is updated
    this.commissionService.clearConfigCache();
    return result;
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.configService.remove(id);
    return { message: 'Config deleted successfully' };
  }
}
