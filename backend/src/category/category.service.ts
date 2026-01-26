import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { CreateCategoryDto, UpdateCategoryDto } from './dto';

@Injectable()
export class CategoryService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
  ) {}

  async findAll() {
    return this.categoryRepository.find({
      relations: ['parent'],
      order: { createdAt: 'DESC' },
    });
  }

  /** Get category tree (flat list with parent; max 3 levels) */
  async findTree() {
    const all = await this.categoryRepository.find({
      relations: ['parent', 'children'],
      order: { createdAt: 'DESC' },
    });
    return all;
  }

  async findOne(id: string) {
    const category = await this.categoryRepository.findOne({
      where: { id },
      relations: ['parent'],
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  /** Get breadcrumb path for a category (e.g. ["Thời Trang Nữ", "Bộ", "Đồ lẻ"]) */
  async getBreadcrumb(categoryId: string): Promise<string[]> {
    const path: string[] = [];
    let current = await this.categoryRepository.findOne({
      where: { id: categoryId },
      relations: ['parent'],
    });
    while (current) {
      path.unshift(current.name);
      if (!current.parentId) break;
      current = await this.categoryRepository.findOne({
        where: { id: current.parentId },
        relations: ['parent'],
      });
    }
    return path;
  }

  async create(createCategoryDto: CreateCategoryDto) {
    if (createCategoryDto.parentId) {
      const depth = await this.getDepth(createCategoryDto.parentId);
      if (depth >= 2) {
        throw new Error('Category tree max depth is 3. Parent already has 2 levels.');
      }
    }
    const category = this.categoryRepository.create(createCategoryDto);
    return this.categoryRepository.save(category);
  }

  private async getDepth(categoryId: string): Promise<number> {
    let d = 0;
    let current = await this.categoryRepository.findOne({ where: { id: categoryId } });
    while (current?.parentId) {
      d++;
      current = await this.categoryRepository.findOne({ where: { id: current.parentId } });
    }
    return d;
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto) {
    const category = await this.findOne(id);
    const raw = updateCategoryDto as Record<string, unknown>;
    if (raw.parentId !== undefined) {
      const newParentId = raw.parentId === null || raw.parentId === '' ? null : (raw.parentId as string);
      if (newParentId === id) {
        throw new Error('Category cannot be its own parent');
      }
      if (newParentId) {
        const depth = await this.getDepth(newParentId);
        if (depth >= 2) {
          throw new Error('Category tree max depth is 3. Selected parent already has 2 levels.');
        }
      }
      category.parentId = newParentId ?? undefined;
    }
    const merged = this.categoryRepository.merge(category, updateCategoryDto as DeepPartial<Category>);
    if (raw.parentId !== undefined) {
      (merged as any).parentId = raw.parentId === null || raw.parentId === '' ? null : (merged.parentId ?? null);
    }
    return this.categoryRepository.save(merged);
  }

  async remove(id: string) {
    const category = await this.findOne(id);
    await this.categoryRepository.remove(category);
    return { deleted: true };
  }
}
