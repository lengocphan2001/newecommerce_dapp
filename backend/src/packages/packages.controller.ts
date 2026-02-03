import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    UseGuards,
} from '@nestjs/common';
import { PackagesService } from './packages.service';
import { Package } from './entities/package.entity';
// Assuming JwtAuthGuard exists and is appropriate or AdminGuard
// import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
// import { RolesGuard } from '../auth/guards/roles.guard';
// import { Roles } from '../auth/decorators/roles.decorator';

@Controller('packages')
export class PackagesController {
    constructor(private readonly packagesService: PackagesService) { }

    @Get()
    findAll() {
        return this.packagesService.findAll();
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.packagesService.findOne(id);
    }

    @Post()
    create(@Body() createPackageDto: Partial<Package>) {
        return this.packagesService.create(createPackageDto);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() updatePackageDto: Partial<Package>) {
        return this.packagesService.update(id, updatePackageDto);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.packagesService.remove(id);
    }
}
