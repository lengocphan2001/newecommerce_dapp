import { Injectable, NotFoundException, ConflictException, InternalServerErrorException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { User } from './entities/user.entity';
import { Address } from './entities/address.entity';
import { Order, OrderStatus } from '../order/entities/order.entity';
import { Commission } from '../affiliate/entities/commission.entity';
import { UserMilestone } from '../admin/entities/user-milestone.entity';
import { AuditLog } from '../audit-log/entities/audit-log.entity';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Address)
    private addressRepository: Repository<Address>,
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(Commission)
    private commissionRepository: Repository<Commission>,
    @InjectRepository(UserMilestone)
    private milestoneRepository: Repository<UserMilestone>,
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
  ) { }

  async findAll(search?: string) {
    const where: any = {};
    if (search) {
      where.email = ILike(`%${search}%`);
    }

    // Since we want to search across multiple fields, we can use an array of OR conditions
    if (search) {
      return this.userRepository.find({
        where: [
          { email: ILike(`%${search}%`) },
          { fullName: ILike(`%${search}%`) },
          { username: ILike(`%${search}%`) },
        ],
        select: ['id', 'email', 'fullName', 'phone', 'status', 'isAdmin', 'createdAt'],
      });
    }

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

  async findByEmailVerificationToken(token: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { emailVerificationToken: token },
    });
  }

  async setEmailVerificationToken(
    userId: string,
    token: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.userRepository.update(userId, {
      emailVerificationToken: token,
      emailVerificationExpiresAt: expiresAt,
    });
  }

  async setEmailVerified(userId: string): Promise<void> {
    await this.userRepository.update(userId, {
      emailVerified: true,
      emailVerificationToken: null as any,
      emailVerificationExpiresAt: null as any,
    });
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

  /**
   * Tìm vị trí "ngoài cùng" của nhánh (Extreme Left hoặc Extreme Right)
   * Chỉ đi theo 1 hướng (targetPosition) cho đến khi gặp slot trống
   * Dùng cho việc xếp cây theo kiểu "Power Leg" (dây)
   */
  async findExtremeSlotInBranch(
    startUserId: string,
    targetPosition: 'left' | 'right',
  ): Promise<{ parentId: string; position: 'left' | 'right' }> {
    let currentId = startUserId;

    while (true) {
      // Kiểm tra xem node hiện tại có child ở vị trí targetPosition không
      const child = await this.userRepository.findOne({
        where: { parentId: currentId, position: targetPosition },
      });

      if (!child) {
        // Không có child ở vị trí này -> Đây là slot trống cần tìm
        return { parentId: currentId, position: targetPosition };
      }

      // Có child, tiếp tục đi xuống theo nhánh đó
      currentId = child.id;
    }
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

    const leftMembers = await this.getAllDescendants(userId, 'left');
    const rightMembers = await this.getAllDescendants(userId, 'right');

    return {
      left: {
        count: leftMembers.length,
        members: leftMembers,
        volume: user.leftBranchTotal || 0,
        total: user.leftBranchTotal || 0, // Total sales for left branch
      },
      right: {
        count: rightMembers.length,
        members: rightMembers,
        volume: user.rightBranchTotal || 0,
        total: user.rightBranchTotal || 0, // Total sales for right branch
      },
      total: leftMembers.length + rightMembers.length,
    };
  }

  /**
   * Lấy tất cả thành viên trong một nhánh (đệ quy)
   */
  private async getAllDescendants(parentId: string, position?: 'left' | 'right', currentDepth: number = 1): Promise<any[]> {
    const query = this.userRepository.createQueryBuilder('user')
      .select(['user.id', 'user.username', 'user.fullName', 'user.avatar', 'user.packageType', 'user.position', 'user.leftBranchTotal', 'user.rightBranchTotal', 'user.totalPurchaseAmount', 'user.createdAt'])
      .where('user.parentId = :parentId', { parentId });

    if (position) {
      query.andWhere('user.position = :position', { position });
    }

    const children = await query.getMany();
    let descendants: any[] = [];

    for (const child of children) {
      const member = { ...child, depth: currentDepth };
      descendants.push(member);

      const subDescendants = await this.getAllDescendants(child.id, undefined, currentDepth + 1);
      descendants = [...descendants, ...subDescendants];
    }

    return descendants;
  }

  /**
   * Đếm tất cả thành viên trong một nhánh (đệ quy)
   */
  private async countAllDescendants(parentId: string, position?: 'left' | 'right'): Promise<number> {
    const query = this.userRepository.createQueryBuilder('user')
      .where('user.parentId = :parentId', { parentId });

    if (position) {
      query.andWhere('user.position = :position', { position });
    }

    const children = await query.getMany();
    let count = children.length;

    for (const child of children) {
      count += await this.countAllDescendants(child.id);
    }

    return count;
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
    try {
      // Handle isActive -> status mapping (legacy/frontend compatibility)
      if ('isActive' in updateUserDto) {
        if (updateUserDto.isActive !== undefined && !updateUserDto.status) {
          updateUserDto.status = updateUserDto.isActive ? 'ACTIVE' : 'INACTIVE';
        }
        delete updateUserDto.isActive;
      }

      if (updateUserDto.password) {
        updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
      }
      await this.userRepository.update(id, updateUserDto);
      return this.findOne(id);
    } catch (error) {
      // Check for unique constraint violation (MySQL: ER_DUP_ENTRY, Postgres: 23505)
      if (error.code === 'ER_DUP_ENTRY' || error.code === '23505') {
        throw new ConflictException('Email or username already exists');
      }
      // Log the actual error for debugging
      Logger.error(`Failed to update user ${id}`, error.stack, 'UserService');
      throw new InternalServerErrorException('Failed to update user');
    }
  }

  async remove(id: string) {
    // Check if user exists
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // 1. Get all confirmed orders to subtract volume from ancestors
    const confirmedOrders = await this.orderRepository.find({
      where: { userId: id, status: OrderStatus.CONFIRMED },
    });

    for (const order of confirmedOrders) {
      await this.subtractBranchVolumes(order, user);
    }

    // 2. Delete all addresses associated with this user
    await this.addressRepository.delete({ userId: id });

    // 3. Delete all orders associated with this user
    await this.orderRepository.delete({ userId: id });

    // 4. Delete all commissions (both received and generated by this user)
    await this.commissionRepository.delete({ userId: id });
    await this.commissionRepository.delete({ fromUserId: id });

    // 5. Delete all milestones and audit logs
    await this.milestoneRepository.delete({ userId: id });
    await this.auditLogRepository.delete({ userId: id });

    // 6. Update children in the referral tree (orphan them)
    await this.userRepository.update({ parentId: id }, { parentId: null as any });

    // 7. Finally delete the user
    return this.userRepository.delete(id);
  }

  /**
   * Subtract branch volume from all ancestors when an order is "deleted" along with its user
   */
  private async subtractBranchVolumes(order: Order, buyer: User): Promise<void> {
    if (!buyer.parentId) return;

    const ancestors = await this.getAncestorsForVolumeAdjustment(buyer);

    for (const ancestor of ancestors) {
      // Determine which side the buyer originates from relative to this ancestor
      const buyerSide = await this.findBuyerSideForAncestor(buyer, ancestor);

      // Subtract volume using Atomical update
      await this.userRepository.createQueryBuilder()
        .update(User)
        .set({
          [buyerSide === 'left' ? 'leftBranchTotal' : 'rightBranchTotal']: () =>
            `${buyerSide === 'left' ? 'leftBranchTotal' : 'rightBranchTotal'} - ${order.totalAmount}`
        })
        .where("id = :id", { id: ancestor.id })
        .execute();
    }
  }

  private async getAncestorsForVolumeAdjustment(user: User): Promise<User[]> {
    const ancestors: User[] = [];
    let current = user;
    while (current && current.parentId) {
      const parent = await this.userRepository.findOne({ where: { id: current.parentId } });
      if (parent) {
        ancestors.push(parent);
        current = parent;
      } else {
        break;
      }
    }
    return ancestors;
  }

  private async findBuyerSideForAncestor(buyer: User, ancestor: User): Promise<'left' | 'right'> {
    let current = buyer;
    while (current.parentId && current.parentId !== ancestor.id) {
      const parent = await this.userRepository.findOne({ where: { id: current.parentId } });
      if (!parent) break;
      current = parent;
    }

    if (current.parentId === ancestor.id) {
      return current.position;
    }

    return 'left'; // Fallback
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

  /**
   * Count total users excluding admin users
   * Used to determine if this is the first user registration
   */
  async countNonAdminUsers(): Promise<number> {
    return this.userRepository.count({
      where: { isAdmin: false },
    });
  }
}
