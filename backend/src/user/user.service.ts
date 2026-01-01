import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async findAll() {
    return this.userRepository.find({
      select: ['id', 'email', 'fullName', 'phone', 'status', 'isAdmin', 'createdAt'],
    });
  }

  async findOne(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async findByWalletAddress(walletAddress: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { walletAddress } });
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { username } });
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  async countChildren(parentId: string, position: 'left' | 'right'): Promise<number> {
    return this.userRepository.count({
      where: { parentId, position },
    });
  }

  async getWeakLeg(parentId: string): Promise<'left' | 'right'> {
    const leftCount = await this.countChildren(parentId, 'left');
    const rightCount = await this.countChildren(parentId, 'right');
    
    // Return the leg with fewer children (weak leg)
    // If equal, default to left
    return leftCount <= rightCount ? 'left' : 'right';
  }

  async getDownline(userId: string, position?: 'left' | 'right') {
    const where: any = { parentId: userId };
    if (position) {
      where.position = position;
    }
    return this.userRepository.find({
      where,
      select: ['id', 'username', 'fullName', 'position', 'createdAt'],
      order: { createdAt: 'ASC' },
    });
  }

  async getBinaryTreeStats(userId: string) {
    const leftChildren = await this.getDownline(userId, 'left');
    const rightChildren = await this.getDownline(userId, 'right');
    
    return {
      left: {
        count: leftChildren.length,
        members: leftChildren,
      },
      right: {
        count: rightChildren.length,
        members: rightChildren,
      },
      total: leftChildren.length + rightChildren.length,
    };
  }

  async create(createUserDto: any) {
    // Only hash password if it exists (wallet registration doesn't need password)
    const userData = { ...createUserDto };
    if (createUserDto.password) {
      userData.password = await bcrypt.hash(createUserDto.password, 10);
    } else {
      // Generate a random password for wallet users (they won't use it)
      userData.password = await bcrypt.hash(Math.random().toString(36), 10);
    }
    
    const user = this.userRepository.create(userData);
    const savedUser = await this.userRepository.save(user);
    // Remove password from response
    const { password: _, ...result } = savedUser as unknown as User;
    return result;
  }

  async update(id: string, updateUserDto: any) {
    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
    }
    await this.userRepository.update(id, updateUserDto);
    return this.findOne(id);
  }

  async remove(id: string) {
    return this.userRepository.delete(id);
  }
}
