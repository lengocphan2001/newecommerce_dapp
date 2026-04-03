import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { CategoryService } from '../category/category.service';
import { CreateProductDto, UpdateProductDto } from './dto';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    private readonly categoryService: CategoryService,
  ) {}

  async togglePush(id: string) {
    const product = await this.findOne(id);
    if (product.pushedAt) {
      product.pushedAt = null;
    } else {
      product.pushedAt = new Date();
    }
    return this.productRepository.save(product);
  }

  async findAll(query: any) {
    // Build query with relations
    const queryBuilder = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .orderBy('product.pushedAt', 'DESC')
      .addOrderBy('product.createdAt', 'DESC');

    // Filter by category if provided
    if (query.categoryId) {
      queryBuilder.where('product.categoryId = :categoryId', {
        categoryId: query.categoryId,
      });
    }

    // Filter by featured on home (for home page image strip)
    if (query.featuredOnHome === true || query.featuredOnHome === 'true') {
      if (query.categoryId) {
        queryBuilder.andWhere('product.featuredOnHome = :featuredOnHome', {
          featuredOnHome: true,
        });
      } else {
        queryBuilder.where('product.featuredOnHome = :featuredOnHome', {
          featuredOnHome: true,
        });
      }
    }

    let allProducts = await queryBuilder.getMany();

    // Filter by country if provided (check if countries array contains the country)
    if (
      query.country &&
      (query.country === 'VIETNAM' || query.country === 'USA')
    ) {
      allProducts = allProducts.filter((product) => {
        const countries = product.countries || [];
        return Array.isArray(countries) && countries.includes(query.country);
      });
    }

    // List: soldCount chỉ từ fakeSold (không quét orders).
    return allProducts.map((product) => ({
      ...product,
      soldCount: product.fakeSold ?? 0,
    }));
  }

  async findOne(id: string) {
    const product = await this.productRepository.findOne({
      where: { id },
      relations: ['category'],
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    let categoryBreadcrumb: string[] = [];
    if (product.categoryId) {
      try {
        categoryBreadcrumb = await this.categoryService.getBreadcrumb(
          product.categoryId,
        );
      } catch {
        // ignore
      }
    }

    return {
      ...product,
      soldCount: product.fakeSold ?? 0,
      categoryBreadcrumb,
    };
  }

  async create(createProductDto: CreateProductDto) {
    const product = this.productRepository.create({
      ...createProductDto,
      stock: createProductDto.stock ?? 0,
      detailImageUrls: createProductDto.detailImageUrls ?? [],
      countries:
        createProductDto.countries && createProductDto.countries.length > 0
          ? createProductDto.countries
          : ['VIETNAM'], // Default to Vietnam if not provided
    });
    return this.productRepository.save(product);
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    const product = await this.findOne(id);
    const merged = this.productRepository.merge(product, {
      ...updateProductDto,
      ...(updateProductDto.detailImageUrls
        ? { detailImageUrls: updateProductDto.detailImageUrls }
        : {}),
    });
    return this.productRepository.save(merged);
  }

  async remove(id: string) {
    const product = await this.findOne(id);
    await this.productRepository.remove(product);
    return { deleted: true };
  }

  private parseNumberMaybe(v: unknown): number | undefined {
    if (v === null || v === undefined) return undefined;
    const s = String(v).trim();
    if (!s) return undefined;
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
  }

  private parseBooleanMaybe(v: unknown): boolean | undefined {
    if (v === null || v === undefined) return undefined;
    const s = String(v).trim().toLowerCase();
    if (!s) return undefined;
    if (['true', '1', 'yes', 'y'].includes(s)) return true;
    if (['false', '0', 'no', 'n'].includes(s)) return false;
    return undefined;
  }

  // Minimal CSV parser for our own export format (commas + double quotes escaping).
  private parseCsv(content: string): string[][] {
    const rows: string[][] = [];
    const text = content.replace(/^\uFEFF/, ''); // strip BOM if present

    let row: string[] = [];
    let field = '';
    let inQuotes = false;

    const pushField = () => {
      row.push(field);
      field = '';
    };
    const pushRow = () => {
      // skip trailing empty line
      if (row.length === 1 && row[0] === '' && rows.length > 0) return;
      rows.push(row);
      row = [];
    };

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          const next = text[i + 1];
          if (next === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += ch;
        }
        continue;
      }

      if (ch === '"') {
        inQuotes = true;
        continue;
      }

      if (ch === ',') {
        pushField();
        continue;
      }

      if (ch === '\n') {
        pushField();
        pushRow();
        continue;
      }

      if (ch === '\r') {
        continue;
      }

      field += ch;
    }

    pushField();
    if (row.length) pushRow();
    return rows;
  }

  async importFromExportedCsv(fileBuffer: Buffer) {
    const csv = fileBuffer.toString('utf8');
    const rows = this.parseCsv(csv);
    if (rows.length < 2) {
      return { total: 0, created: 0, updated: 0, failed: [] as any[] };
    }

    const headers = rows[0].map((h) => h.trim());
    const idx = (name: string) => headers.findIndex((h) => h === name);

    const iId = idx('ID');
    const iName = idx('Name');
    const iPrice = idx('Price');
    const iStock = idx('Stock');
    const iCategory = idx('Category');
    const iUse = idx('Use Product Commission');
    const iDirectTV = idx('Direct % TV');
    const iDirectCTV = idx('Direct % CTV');
    const iDirectNPP = idx('Direct % NPP');
    const iGroupTV = idx('Group % TV');
    const iGroupCTV = idx('Group % CTV');
    const iGroupNPP = idx('Group % NPP');
    const iGroupMinSales = idx('Group Min Sales ($)');
    const iMgmtTV = idx('Management % TV');
    const iMgmtCTV = idx('Management % CTV');
    const iMgmtNPP = idx('Management % NPP');
    const iMgmtF1 = idx('Management F1 (%)');
    const iMgmtF2 = idx('Management F2 (%)');
    const iMgmtF3 = idx('Management F3 (%)');
    const iMgmtMinSales = idx('Management Min Sales ($)');
    const iReconThreshold = idx('Reconsumption Threshold ($)');
    const iReconRequired = idx('Reconsumption Required ($)');
    const iCfgByPkg = idx('Commission Config By Package (JSON)');

    if (iName === -1 || iPrice === -1) {
      throw new Error(
        'CSV headers not recognized. Please export products first and import that file.',
      );
    }

    const categories = await this.categoryService.findAll();
    const categoryByName = new Map<string, string>();
    for (const c of categories as any[]) {
      if (c?.name)
        categoryByName.set(String(c.name).trim().toLowerCase(), c.id);
    }

    let created = 0;
    let updated = 0;
    const failed: Array<{
      rowNumber: number;
      id?: string;
      name?: string;
      error: string;
    }> = [];

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const rowNumber = r + 1; // 1-based + header row

      const get = (i: number) => (i >= 0 ? (row[i] ?? '').trim() : '');

      const id = get(iId);
      const name = get(iName);
      const price = this.parseNumberMaybe(get(iPrice));

      try {
        if (!name) throw new Error('Missing Name');
        if (price === undefined) throw new Error('Missing Price');

        const dto: Partial<CreateProductDto & UpdateProductDto> = {
          name,
          price,
        };

        const stock = this.parseNumberMaybe(get(iStock));
        if (stock !== undefined) dto.stock = stock;

        const useProductCommission = this.parseBooleanMaybe(get(iUse));
        if (useProductCommission !== undefined)
          dto.useProductCommission = useProductCommission;

        const categoryName = get(iCategory);
        if (categoryName) {
          const categoryId = categoryByName.get(categoryName.toLowerCase());
          if (categoryId) dto.categoryId = categoryId;
        }

        const setNum = (
          key: keyof (CreateProductDto & UpdateProductDto),
          v: string,
        ) => {
          const n = this.parseNumberMaybe(v);
          if (n !== undefined) (dto as any)[key] = n;
        };

        setNum('commissionPercentTV', get(iDirectTV));
        setNum('commissionPercentCTV', get(iDirectCTV));
        setNum('commissionPercentNPP', get(iDirectNPP));
        setNum('commissionPercentGroupTV', get(iGroupTV));
        setNum('commissionPercentGroupCTV', get(iGroupCTV));
        setNum('commissionPercentGroupNPP', get(iGroupNPP));
        setNum('groupCommissionMinSales', get(iGroupMinSales));
        setNum('commissionPercentManagementTV', get(iMgmtTV));
        setNum('commissionPercentManagementCTV', get(iMgmtCTV));
        setNum('commissionPercentManagementNPP', get(iMgmtNPP));
        setNum('managementRateF1', get(iMgmtF1));
        setNum('managementRateF2', get(iMgmtF2));
        setNum('managementRateF3', get(iMgmtF3));
        setNum('managementMinSales', get(iMgmtMinSales));
        setNum('reconsumptionThreshold', get(iReconThreshold));
        setNum('reconsumptionRequired', get(iReconRequired));

        const cfgByPkgRaw = get(iCfgByPkg);
        if (cfgByPkgRaw) {
          try {
            (dto as any).commissionConfigByPackage = JSON.parse(cfgByPkgRaw);
          } catch {
            // ignore invalid JSON but record failure if everything else ok? keep strict:
            throw new Error(
              'Invalid JSON in Commission Config By Package (JSON)',
            );
          }
        }

        if (id) {
          const existing = await this.productRepository.findOne({
            where: { id },
          });
          if (existing) {
            const merged = this.productRepository.merge(existing, dto as any);
            await this.productRepository.save(merged);
            updated++;
          } else {
            const createdEntity = this.productRepository.create({
              id,
              ...(dto as any),
            });
            await this.productRepository.save(createdEntity);
            created++;
          }
        } else {
          const createdEntity = this.productRepository.create(dto as any);
          await this.productRepository.save(createdEntity);
          created++;
        }
      } catch (e: any) {
        failed.push({
          rowNumber,
          id: id || undefined,
          name: name || undefined,
          error: e?.message ? String(e.message) : 'Unknown error',
        });
      }
    }

    return { total: rows.length - 1, created, updated, failed };
  }
}
