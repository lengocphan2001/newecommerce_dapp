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
