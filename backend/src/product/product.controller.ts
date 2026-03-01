import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ProductService } from './product.service';
import { CreateProductDto, UpdateProductDto } from './dto';
import { JwtAuthGuard, AdminGuard } from '../common/guards';

@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) { }

  @Get()
  async findAll(@Query() query: any) {
    return this.productService.findAll(query);
  }

  @Get('export')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async exportProducts(@Query() query: any, @Res() res: Response) {
    const products = await this.productService.findAll(query);

    // Define the CSV header
    const headers = [
      'ID',
      'Name',
      'Price',
      'Stock',
      'Category',
      'Sold Count',
      'Created At'
    ];

    // Map products to CSV rows
    // Explicitly excluding description, imageUrl, and detailImageUrls
    const rows = products.map(product => [
      product.id,
      `"${(product.name || '').replace(/"/g, '""')}"`, // escape quotes in name
      product.price,
      product.stock,
      product.category?.name || '',
      product.soldCount || 0,
      product.createdAt
    ]);

    // Build the CSV string
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    res.header('Content-Type', 'text/csv');
    res.header('Content-Disposition', 'attachment; filename="products.csv"');
    return res.send(csvContent);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.productService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async create(@Body() createProductDto: CreateProductDto) {
    return this.productService.create(createProductDto);
  }

  @Put(':id/push')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async togglePush(@Param('id') id: string) {
    return this.productService.togglePush(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productService.update(id, updateProductDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async remove(@Param('id') id: string) {
    return this.productService.remove(id);
  }
}

