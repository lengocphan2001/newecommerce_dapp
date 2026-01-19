import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Slider } from './entities/slider.entity';
import { CreateSliderDto, UpdateSliderDto } from './dto';

@Injectable()
export class SliderService {
  constructor(
    @InjectRepository(Slider)
    private readonly sliderRepository: Repository<Slider>,
  ) {}

  async findAll(activeOnly: boolean = false) {
    const queryBuilder = this.sliderRepository.createQueryBuilder('slider');
    
    if (activeOnly) {
      queryBuilder.where('slider.isActive = :isActive', { isActive: true });
    }
    
    return queryBuilder
      .orderBy('slider.order', 'ASC')
      .addOrderBy('slider.createdAt', 'DESC')
      .getMany();
  }

  async findOne(id: string) {
    const slider = await this.sliderRepository.findOne({ where: { id } });
    if (!slider) {
      throw new NotFoundException('Slider not found');
    }
    return slider;
  }

  async create(createSliderDto: CreateSliderDto) {
    const slider = this.sliderRepository.create({
      ...createSliderDto,
      order: createSliderDto.order ?? 0,
      isActive: createSliderDto.isActive ?? true,
    });
    return this.sliderRepository.save(slider);
  }

  async update(id: string, updateSliderDto: UpdateSliderDto) {
    const slider = await this.findOne(id);
    const merged = this.sliderRepository.merge(slider, updateSliderDto);
    return this.sliderRepository.save(merged);
  }

  async remove(id: string) {
    const slider = await this.findOne(id);
    await this.sliderRepository.remove(slider);
    return { deleted: true };
  }
}
