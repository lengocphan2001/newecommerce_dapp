import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { Order, OrderStatus } from '../order/entities/order.entity';
import { CategoryService } from '../category/category.service';
import { CreateProductDto, UpdateProductDto } from './dto';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly categoryService: CategoryService,
  ) {}

  /**
   * Calculate sold count for a product from orders
   */
  private async calculateSoldCount(productId: string): Promise<number> {
    const orders = await this.orderRepository.find({
      where: [
        { status: OrderStatus.CONFIRMED },
        { status: OrderStatus.PROCESSING },
        { status: OrderStatus.SHIPPED },
        { status: OrderStatus.DELIVERED },
      ],
    });

    let soldCount = 0;
    for (const order of orders) {
      const items = order.items || [];
      for (const item of items) {
        if (item.productId === productId) {
          soldCount += item.quantity || 0;
        }
      }
    }

    return soldCount;
  }

  async findAll(query: any) {
    // Build query with relations
    const queryBuilder = this.productRepository.createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .orderBy('product.createdAt', 'DESC');

    // Filter by category if provided
    if (query.categoryId) {
      queryBuilder.where('product.categoryId = :categoryId', { categoryId: query.categoryId });
    }

    let allProducts = await queryBuilder.getMany();

    // Filter by country if provided (check if countries array contains the country)
    if (query.country && (query.country === 'VIETNAM' || query.country === 'USA')) {
      allProducts = allProducts.filter((product) => {
        const countries = product.countries || [];
        return Array.isArray(countries) && countries.includes(query.country);
      });
    }

    // Calculate sold count for each product
    const productsWithSoldCount = await Promise.all(
      allProducts.map(async (product) => {
        const soldCount = await this.calculateSoldCount(product.id);
        return {
          ...product,
          soldCount,
        };
      })
    );

    return productsWithSoldCount;
  }

  async findOne(id: string) {
    const product = await this.productRepository.findOne({ 
      where: { id },
      relations: ['category'],
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    
    const soldCount = await this.calculateSoldCount(id);
    let categoryBreadcrumb: string[] = [];
    if (product.categoryId) {
      try {
        categoryBreadcrumb = await this.categoryService.getBreadcrumb(product.categoryId);
      } catch {
        // ignore
      }
    }
    
    return {
      ...product,
      soldCount,
      categoryBreadcrumb,
    };
  }

  async create(createProductDto: CreateProductDto) {
    const product = this.productRepository.create({
      ...createProductDto,
      stock: createProductDto.stock ?? 0,
      detailImageUrls: createProductDto.detailImageUrls ?? [],
      countries: createProductDto.countries && createProductDto.countries.length > 0 
        ? createProductDto.countries 
        : ['VIETNAM'], // Default to Vietnam if not provided
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

