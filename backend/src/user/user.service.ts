import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Address } from './entities/address.entity';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Address)
    private addressRepository: Repository<Address>,
  ) { }

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

  /**
   * Đếm số direct children (chỉ con trực tiếp, không phải toàn bộ downline)
   * Mỗi node chỉ có tối đa 1 left direct child và 1 right direct child
   */
  async countChildren(parentId: string, position: 'left' | 'right'): Promise<number> {
    return this.userRepository.count({
      where: { parentId, position },
    });
  }

  /**
   * Xác định nhánh yếu (nhánh có ít direct children hơn)
   * Mỗi node chỉ có tối đa 1 left và 1 right direct child
   */
  async getWeakLeg(parentId: string): Promise<'left' | 'right'> {
    const leftCount = await this.countChildren(parentId, 'left');
    const rightCount = await this.countChildren(parentId, 'right');

    // Return the leg with fewer children (weak leg)
    // If equal, default to left
    // Note: leftCount và rightCount chỉ có thể là 0 hoặc 1 (vì mỗi node chỉ có tối đa 1 left và 1 right)
    return leftCount <= rightCount ? 'left' : 'right';
  }

  /**
   * Tìm node đầu tiên trong nhánh chỉ định còn slot trống (chưa đủ 2 direct children)
   * Sử dụng BFS (Breadth First Search) để tìm slot trống từ trên xuống
   * 
   * Logic:
   * - Mỗi node chỉ có tối đa 1 left direct child và 1 right direct child
   * - Nếu node đã đủ 2 direct children, tìm trong downline (con của các direct children)
   * 
   * @param startUserId - User ID bắt đầu tìm kiếm (referral user)
   * @param targetPosition - Nhánh cần tìm ('left' hoặc 'right')
   * @returns { parentId: string, position: 'left' | 'right' } - Thông tin parent và position để đặt user mới
   */
  async findAvailableSlotInBranch(
    startUserId: string,
    targetPosition: 'left' | 'right',
  ): Promise<{ parentId: string; position: 'left' | 'right' }> {
    // Kiểm tra node bắt đầu có slot trống ở nhánh chỉ định không
    // Mỗi node chỉ có tối đa 1 left và 1 right direct child
    const directChildCount = await this.countChildren(startUserId, targetPosition);

    if (directChildCount === 0) {
      // Node này chưa có direct child ở nhánh chỉ định, có thể đặt trực tiếp
      return { parentId: startUserId, position: targetPosition };
    }

    // Node này đã có direct child ở nhánh chỉ định (chỉ có thể là 1)
    // Tìm direct child đó
    const directChild = await this.userRepository.findOne({
      where: { parentId: startUserId, position: targetPosition },
      order: { createdAt: 'ASC' }, // Lấy con đầu tiên (theo thời gian đăng ký)
    });

    if (!directChild) {
      // Không tìm thấy con (không nên xảy ra nhưng để an toàn)
      return { parentId: startUserId, position: targetPosition };
    }

    // Tìm node đầu tiên trong downline có slot trống
    // Duyệt theo thứ tự từ trên xuống (BFS - Breadth First Search)
    const queue: string[] = [directChild.id];

    while (queue.length > 0) {
      const currentNodeId = queue.shift()!;

      // Kiểm tra node này có đủ 2 direct children chưa
      const leftCount = await this.countChildren(currentNodeId, 'left');
      const rightCount = await this.countChildren(currentNodeId, 'right');

      // Nếu chưa đủ 2 direct children, tìm nhánh yếu để đặt
      if (leftCount === 0 || rightCount === 0) {
        // Có ít nhất 1 slot trống, đặt vào nhánh yếu
        const weakLeg = leftCount <= rightCount ? 'left' : 'right';
        return { parentId: currentNodeId, position: weakLeg };
      }

      // Node này đã đủ 2 direct children, thêm các direct children của nó vào queue để tiếp tục tìm
      const leftChild = await this.userRepository.findOne({
        where: { parentId: currentNodeId, position: 'left' },
      });
      const rightChild = await this.userRepository.findOne({
        where: { parentId: currentNodeId, position: 'right' },
      });

      // Thêm các direct children vào queue theo thứ tự (left trước, right sau)
      if (leftChild) {
        queue.push(leftChild.id);
      }
      if (rightChild) {
        queue.push(rightChild.id);
      }
    }

    // Nếu không tìm thấy slot (không nên xảy ra trong thực tế), 
    // trả về direct child với nhánh yếu của nó
    const weakLeg = await this.getWeakLeg(directChild.id);
    return { parentId: directChild.id, position: weakLeg };
  }

  async getDownline(userId: string, position?: 'left' | 'right') {
    const where: any = { parentId: userId };
    if (position) {
      where.position = position;
    }
    return this.userRepository.find({
      where,
      select: ['id', 'username', 'fullName', 'position', 'createdAt', 'totalPurchaseAmount', 'packageType', 'avatar', 'leftBranchTotal', 'rightBranchTotal'],
      order: { createdAt: 'ASC' },
    });
  }

  async getBinaryTreeStats(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    const leftChildren = await this.getDownline(userId, 'left');
    const rightChildren = await this.getDownline(userId, 'right');

    return {
      left: {
        count: leftChildren.length,
        members: leftChildren,
        volume: user.leftBranchTotal || 0,
      },
      right: {
        count: rightChildren.length,
        members: rightChildren,
        volume: user.rightBranchTotal || 0,
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

  // Address Methods
  async getAddresses(userId: string) {
    return this.addressRepository.find({ where: { userId } });
  }

  async addAddress(userId: string, data: any) {
    const address = this.addressRepository.create({ ...data, userId });
    // If default, unset others first? Or handle in frontend? Ideally backend constraint.
    if (data.isDefault) {
      await this.addressRepository.update({ userId }, { isDefault: false });
    }
    return this.addressRepository.save(address);
  }

  async updateAddress(userId: string, addressId: string, data: any) {
    if (data.isDefault) {
      await this.addressRepository.update({ userId }, { isDefault: false });
    }
    const updateResult = await this.addressRepository.update({ id: addressId, userId }, data);
    if (updateResult.affected === 0) {
      throw new NotFoundException(`Address with ID ${addressId} not found`);
    }
    return this.addressRepository.findOne({ where: { id: addressId } });
  }

  async deleteAddress(userId: string, addressId: string) {
    return this.addressRepository.delete({ id: addressId, userId });
  }
}
