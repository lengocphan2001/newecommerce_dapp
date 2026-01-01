import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { CreateProductDto, UpdateProductDto } from './dto';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async findAll(_query: any) {
    return this.productRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const product = await this.productRepository.findOne({ where: { id } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  async create(createProductDto: CreateProductDto) {
    const product = this.productRepository.create({
      ...createProductDto,
      stock: createProductDto.stock ?? 0,
      detailImageUrls: createProductDto.detailImageUrls ?? [],
    });
    return this.productRepository.save(product);
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    const product = await this.findOne(id);
    const merged = this.productRepository.merge(product, {
      ...updateProductDto,
      ...(updateProductDto.detailImageUrls ? { detailImageUrls: updateProductDto.detailImageUrls } : {}),
    });
    return this.productRepository.save(merged);
  }

  async remove(id: string) {
    const product = await this.findOne(id);
    await this.productRepository.remove(product);
    return { deleted: true };
  }
}

