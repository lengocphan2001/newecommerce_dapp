import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permission } from './entities/permission.entity';

@Injectable()
export class PermissionService {
  constructor(
    @InjectRepository(Permission)
    private permissionRepository: Repository<Permission>,
  ) {}

  async findAll(): Promise<Permission[]> {
    return this.permissionRepository.find({
      order: { module: 'ASC', code: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Permission> {
    const permission = await this.permissionRepository.findOne({
      where: { id },
      relations: ['roles'],
    });

    if (!permission) {
      throw new NotFoundException(`Permission with ID ${id} not found`);
    }

    return permission;
  }

  async findByModule(module: string): Promise<Permission[]> {
    return this.permissionRepository.find({
      where: { module },
      order: { code: 'ASC' },
    });
  }

  async seedPermissions(): Promise<void> {
    const permissions = [
      // Products
      { code: 'products.view', name: 'View Products', module: 'products', description: 'View products list' },
      { code: 'products.create', name: 'Create Products', module: 'products', description: 'Create new products' },
      { code: 'products.update', name: 'Update Products', module: 'products', description: 'Update existing products' },
      { code: 'products.delete', name: 'Delete Products', module: 'products', description: 'Delete products' },
      
      // Categories
      { code: 'categories.view', name: 'View Categories', module: 'categories', description: 'View categories list' },
      { code: 'categories.create', name: 'Create Categories', module: 'categories', description: 'Create new categories' },
      { code: 'categories.update', name: 'Update Categories', module: 'categories', description: 'Update existing categories' },
      { code: 'categories.delete', name: 'Delete Categories', module: 'categories', description: 'Delete categories' },
      
      // Orders
      { code: 'orders.view', name: 'View Orders', module: 'orders', description: 'View orders list' },
      { code: 'orders.update', name: 'Update Orders', module: 'orders', description: 'Update order status' },
      
      // Users
      { code: 'users.view', name: 'View Users', module: 'users', description: 'View users list' },
      { code: 'users.update', name: 'Update Users', module: 'users', description: 'Update user information' },
      
      // Staffs
      { code: 'staffs.view', name: 'View Staffs', module: 'staffs', description: 'View staff list' },
      { code: 'staffs.create', name: 'Create Staffs', module: 'staffs', description: 'Create new staff accounts' },
      { code: 'staffs.update', name: 'Update Staffs', module: 'staffs', description: 'Update staff information' },
      { code: 'staffs.delete', name: 'Delete Staffs', module: 'staffs', description: 'Delete staff accounts' },
      
      // Roles
      { code: 'roles.view', name: 'View Roles', module: 'roles', description: 'View roles list' },
      { code: 'roles.create', name: 'Create Roles', module: 'roles', description: 'Create new roles' },
      { code: 'roles.update', name: 'Update Roles', module: 'roles', description: 'Update existing roles' },
      { code: 'roles.delete', name: 'Delete Roles', module: 'roles', description: 'Delete roles' },
      
      // Sliders
      { code: 'sliders.view', name: 'View Sliders', module: 'sliders', description: 'View sliders list' },
      { code: 'sliders.create', name: 'Create Sliders', module: 'sliders', description: 'Create new sliders' },
      { code: 'sliders.update', name: 'Update Sliders', module: 'sliders', description: 'Update existing sliders' },
      { code: 'sliders.delete', name: 'Delete Sliders', module: 'sliders', description: 'Delete sliders' },
      
      // Commission Config
      { code: 'commission.view', name: 'View Commission Config', module: 'commission', description: 'View commission configuration' },
      { code: 'commission.update', name: 'Update Commission Config', module: 'commission', description: 'Update commission configuration' },
    ];

    for (const perm of permissions) {
      const existing = await this.permissionRepository.findOne({
        where: { code: perm.code },
      });

      if (!existing) {
        await this.permissionRepository.save(this.permissionRepository.create(perm));
      }
    }
  }
}
