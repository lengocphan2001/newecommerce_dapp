import { Injectable, Inject, forwardRef, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { Address } from '../user/entities/address.entity';
import { Order } from '../order/entities/order.entity';
import { UserService } from '../user/user.service';
import { CommissionService } from '../affiliate/commission.service';
import { AffiliateService } from '../affiliate/affiliate.service';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Address)
    private addressRepository: Repository<Address>,
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    private userService: UserService,
    @Inject(forwardRef(() => CommissionService))
    private commissionService: CommissionService,
    @Inject(forwardRef(() => AffiliateService))
    private affiliateService: AffiliateService,
  ) {}

  async getDashboard() {
    // TODO: Implement get dashboard stats logic
    return { message: 'Get dashboard stats' };
  }

  async getUsers(query: any) {
    // TODO: Implement get users logic
    return { message: 'Get users' };
  }

  async getOrders(query: any) {
    // TODO: Implement get orders logic
    return { message: 'Get orders' };
  }

  async updateUserStatus(id: string, statusDto: any) {
    // TODO: Implement update user status logic
    return { message: `Update user status ${id}` };
  }

  /**
   * Get detailed user information including addresses, commissions, orders, tree stats
   */
  async getUserDetail(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get addresses
    const addresses = await this.userService.getAddresses(userId);

    // Get commissions stats
    const commissionStats = await this.commissionService.getStats(userId);

    // Get all commissions
    const allCommissions = await this.commissionService.getCommissions(userId, {});

    // Get orders
    const orders = await this.orderRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 50, // Limit to last 50 orders
    });

    // Get binary tree stats
    const treeStats = await this.userService.getBinaryTreeStats(userId);

    // Get downline (direct children)
    const leftChildren = await this.userService.getDownline(userId, 'left');
    const rightChildren = await this.userService.getDownline(userId, 'right');

    // Get parent info if exists
    let parentInfo: {
      id: string;
      username: string | null;
      fullName: string;
      email: string;
      packageType: 'NONE' | 'CTV' | 'NPP';
    } | null = null;
    if (user.parentId) {
      const parent = await this.userRepository.findOne({
        where: { id: user.parentId },
        select: ['id', 'username', 'fullName', 'email', 'packageType'],
      });
      if (parent) {
        parentInfo = {
          id: parent.id,
          username: parent.username,
          fullName: parent.fullName,
          email: parent.email,
          packageType: parent.packageType,
        };
      }
    }

    // Get referrer info if exists
    let referrerInfo: {
      id: string;
      username: string | null;
      fullName: string;
      email: string;
      packageType: 'NONE' | 'CTV' | 'NPP';
    } | null = null;
    if (user.referralUserId) {
      const referrer = await this.userRepository.findOne({
        where: { id: user.referralUserId },
        select: ['id', 'username', 'fullName', 'email', 'packageType'],
      });
      if (referrer) {
        referrerInfo = {
          id: referrer.id,
          username: referrer.username,
          fullName: referrer.fullName,
          email: referrer.email,
          packageType: referrer.packageType,
        };
      }
    }

    // Format decimal numbers
    const formatDecimal = (value: number | string): string => {
      if (value === null || value === undefined || value === 0) return '0.00';
      if (typeof value === 'string') {
        const [intPart, decPart] = value.split('.');
        if (decPart) {
          return `${intPart}.${decPart}`;
        }
        return `${intPart}.00`;
      }
      const numStr = value.toFixed(18);
      const [intPart, decPart] = numStr.split('.');
      return `${intPart}.${decPart}`;
    };

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        username: user.username,
        country: user.country,
        address: user.address,
        walletAddress: user.walletAddress,
        chainId: user.chainId,
        packageType: user.packageType,
        status: user.status,
        isAdmin: user.isAdmin,
        totalPurchaseAmount: formatDecimal(user.totalPurchaseAmount),
        totalCommissionReceived: formatDecimal(user.totalCommissionReceived),
        totalReconsumptionAmount: formatDecimal(user.totalReconsumptionAmount),
        leftBranchTotal: formatDecimal(user.leftBranchTotal),
        rightBranchTotal: formatDecimal(user.rightBranchTotal),
        referralUser: user.referralUser,
        referralUserId: user.referralUserId,
        parentId: user.parentId,
        position: user.position,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      addresses,
      commissionStats,
      commissions: allCommissions.slice(0, 100), // Limit to 100 most recent
      orders,
      treeStats: {
        ...treeStats,
        left: {
          ...treeStats.left,
          members: leftChildren,
        },
        right: {
          ...treeStats.right,
          members: rightChildren,
        },
      },
      parentInfo,
      referrerInfo,
    };
  }
}

