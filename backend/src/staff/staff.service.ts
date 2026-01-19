import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Staff } from './entities/staff.entity';
import { Role } from '../role/entities/role.entity';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class StaffService {
  constructor(
    @InjectRepository(Staff)
    private staffRepository: Repository<Staff>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
  ) {}

  async create(createStaffDto: CreateStaffDto, createdById?: string): Promise<Staff> {
    // Check if email already exists
    const existingStaff = await this.staffRepository.findOne({
      where: { email: createStaffDto.email },
    });

    if (existingStaff) {
      throw new ConflictException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(createStaffDto.password, 10);

    const staff = this.staffRepository.create({
      email: createStaffDto.email,
      password: hashedPassword,
      fullName: createStaffDto.fullName,
      phone: createStaffDto.phone,
      createdById,
      status: createStaffDto.status || 'ACTIVE',
      isSuperAdmin: false, // Only seed service can create super admin
    });

    // Assign roles if provided
    if (createStaffDto.roleIds && createStaffDto.roleIds.length > 0) {
      const roles = await this.roleRepository.findBy({ id: In(createStaffDto.roleIds) });
      staff.roles = roles;
    }

    return this.staffRepository.save(staff);
  }

  async findAll(): Promise<Staff[]> {
    return this.staffRepository.find({
      relations: ['roles', 'roles.permissions', 'createdBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Staff> {
    const staff = await this.staffRepository.findOne({
      where: { id },
      relations: ['roles', 'roles.permissions', 'createdBy'],
    });

    if (!staff) {
      throw new NotFoundException(`Staff with ID ${id} not found`);
    }

    return staff;
  }

  async findByEmail(email: string): Promise<Staff | null> {
    return this.staffRepository.findOne({
      where: { email },
      relations: ['roles', 'roles.permissions'],
    });
  }

  async update(id: string, updateStaffDto: UpdateStaffDto): Promise<Staff> {
    const staff = await this.findOne(id);

    // Check email uniqueness if email is being updated
    if (updateStaffDto.email && updateStaffDto.email !== staff.email) {
      const existingStaff = await this.staffRepository.findOne({
        where: { email: updateStaffDto.email },
      });

      if (existingStaff) {
        throw new ConflictException('Email already exists');
      }
    }

    // Hash password if provided
    if (updateStaffDto.password) {
      updateStaffDto.password = await bcrypt.hash(updateStaffDto.password, 10);
    }

    // Update roles if provided
    if (updateStaffDto.roleIds) {
      const roles = await this.roleRepository.findBy({ id: In(updateStaffDto.roleIds) });
      staff.roles = roles;
    }

    Object.assign(staff, updateStaffDto);
    return this.staffRepository.save(staff);
  }

  async remove(id: string): Promise<void> {
    const staff = await this.findOne(id);
    await this.staffRepository.remove(staff);
  }

  async hasPermission(staffId: string, permissionCode: string): Promise<boolean> {
    const staff = await this.staffRepository.findOne({
      where: { id: staffId },
      relations: ['roles', 'roles.permissions'],
    });

    if (!staff) {
      return false;
    }

    // Super admin has all permissions
    if (staff.isSuperAdmin) {
      return true;
    }

    // Check if any role has the permission
    for (const role of staff.roles || []) {
      for (const permission of role.permissions || []) {
        if (permission.code === permissionCode) {
          return true;
        }
      }
    }

    return false;
  }
}
