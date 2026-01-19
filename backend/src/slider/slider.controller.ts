import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { SliderService } from './slider.service';
import { CreateSliderDto, UpdateSliderDto } from './dto';
import { JwtAuthGuard, AdminGuard } from '../common/guards';

@Controller('sliders')
export class SliderController {
  constructor(private readonly sliderService: SliderService) {}

  @Get()
  async findAll(@Query('activeOnly') activeOnly?: string) {
    const active = activeOnly === 'true';
    return this.sliderService.findAll(active);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.sliderService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async create(@Body() createSliderDto: CreateSliderDto) {
    return this.sliderService.create(createSliderDto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async update(@Param('id') id: string, @Body() updateSliderDto: UpdateSliderDto) {
    return this.sliderService.update(id, updateSliderDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async remove(@Param('id') id: string) {
    return this.sliderService.remove(id);
  }
}
