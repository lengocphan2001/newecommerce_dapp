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

    const headers = [
      'ID',
      'Name',
      'Price',
      'Stock',
      'Category',
      'Sold Count',
      'Created At',
      'Use Product Commission',
      'Direct % TV', 'Direct % CTV', 'Direct % NPP',
      'Group % TV', 'Group % CTV', 'Group % NPP',
      'Group Min Sales ($)',
      'Management % TV', 'Management % CTV', 'Management % NPP',
      'Management F1 (%)', 'Management F2 (%)', 'Management F3 (%)',
      'Management Min Sales ($)',
      'Reconsumption Threshold ($)', 'Reconsumption Required ($)',
      'Commission Config By Package (JSON)',
    ];

    const escapeCsv = (v: any): string => {
      if (v == null || v === '') return '';
      const s = String(v);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const rows = products.map((product: any) => [
      product.id,
      product.name ?? '',
      product.price ?? '',
      product.stock ?? '',
      product.category?.name ?? '',
      product.soldCount ?? 0,
      product.createdAt ?? '',
      product.useProductCommission ? 'Yes' : 'No',
      product.commissionPercentTV ?? '',
      product.commissionPercentCTV ?? '',
      product.commissionPercentNPP ?? '',
      product.commissionPercentGroupTV ?? '',
      product.commissionPercentGroupCTV ?? '',
      product.commissionPercentGroupNPP ?? '',
      product.groupCommissionMinSales ?? '',
      product.commissionPercentManagementTV ?? '',
      product.commissionPercentManagementCTV ?? '',
      product.commissionPercentManagementNPP ?? '',
      product.managementRateF1 ?? '',
      product.managementRateF2 ?? '',
      product.managementRateF3 ?? '',
      product.managementMinSales ?? '',
      product.reconsumptionThreshold ?? '',
      product.reconsumptionRequired ?? '',
      product.commissionConfigByPackage
        ? JSON.stringify(product.commissionConfigByPackage)
        : '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row: any[]) => row.map((cell: any) => escapeCsv(cell)).join(',')),
    ].join('\n');

    res.header('Content-Type', 'text/csv; charset=utf-8');
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

