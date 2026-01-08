import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../common/guards';

@Controller('user')
export class MeController {
    constructor(private readonly userService: UserService) { }

    @UseGuards(JwtAuthGuard)
    @Get('addresses')
    async getAddresses(@Request() req: any) {
        return this.userService.getAddresses(req.user.sub);
    }

    @UseGuards(JwtAuthGuard)
    @Post('addresses')
    async addAddress(@Request() req: any, @Body() data: any) {
        return this.userService.addAddress(req.user.sub, data);
    }

    @UseGuards(JwtAuthGuard)
    @Put('addresses/:id')
    async updateAddress(@Request() req: any, @Param('id') id: string, @Body() data: any) {
        return this.userService.updateAddress(req.user.sub, id, data);
    }

    @UseGuards(JwtAuthGuard)
    @Delete('addresses/:id')
    async deleteAddress(@Request() req: any, @Param('id') id: string) {
        return this.userService.deleteAddress(req.user.sub, id);
    }
}
