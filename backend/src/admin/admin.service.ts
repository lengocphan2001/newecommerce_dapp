import {
  Injectable,
  Inject,
  forwardRef,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as bcrypt from 'bcryptjs';
import { User } from '../user/entities/user.entity';
import { Address } from '../user/entities/address.entity';
import { Order, OrderStatus } from '../order/entities/order.entity';
import { Product } from '../product/entities/product.entity';
import { BankingConfig } from './entities/banking-config.entity';
import { SystemConfig } from './entities/system-config.entity';
import { UserService } from '../user/user.service';
import { CommissionService } from '../affiliate/commission.service';
import { AffiliateService } from '../affiliate/affiliate.service';
import { CommissionPayoutService } from '../affiliate/commission-payout.service';
import { Web3Service } from '../blockchain/web3.service';

@Injectable()
export class AdminService {
  private readonly backendEnvPath = path.resolve(process.cwd(), '.env');
  private readonly defaultMinPayoutThreshold = 50;
  private readonly defaultCommissionDepositWalletPercent = 10;
  private readonly defaultCommissionWithdrawWalletPercent = 80;

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Address)
    private addressRepository: Repository<Address>,
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(BankingConfig)
    private bankingConfigRepository: Repository<BankingConfig>,
    @InjectRepository(SystemConfig)
    private systemConfigRepository: Repository<SystemConfig>,
    private userService: UserService,
    @Inject(forwardRef(() => CommissionService))
    private commissionService: CommissionService,
    @Inject(forwardRef(() => AffiliateService))
    private affiliateService: AffiliateService,
    @Inject(forwardRef(() => CommissionPayoutService))
    private commissionPayoutService: CommissionPayoutService,
    private web3Service: Web3Service,
  ) {}

  async getDashboard() {
    // Get total counts
    const [totalUsers, totalProducts, totalOrders] = await Promise.all([
      this.userRepository.count(),
      this.productRepository.count(),
      this.orderRepository.count(),
    ]);

    // Calculate total revenue from all delivered orders
    const deliveredOrders = await this.orderRepository.find({
      where: { status: OrderStatus.DELIVERED },
    });
    const totalRevenue = deliveredOrders.reduce(
      (sum, order) => sum + (parseFloat(String(order.totalAmount)) || 0),
      0,
    );

    // Get recent orders (last 10)
    const recentOrders = await this.orderRepository.find({
      order: { createdAt: 'DESC' },
      take: 10,
      relations: [],
    });

    // Format recent orders for frontend
    const formattedRecentOrders = recentOrders.map((order) => ({
      id: order.id,
      userId: order.userId,
      totalAmount: parseFloat(String(order.totalAmount || 0)),
      status: order.status,
      items: order.items,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    }));

    // Get payout stats to include contract balance
    const payoutStats = await this.commissionPayoutService.getPayoutStats();

    return {
      totalUsers,
      totalProducts,
      totalOrders,
      totalRevenue,
      recentOrders: formattedRecentOrders,
      contractBalance: payoutStats.contractBalance,
      contractAddress: payoutStats.contractAddress,
      tokenAddress: payoutStats.tokenAddress,
    };
  }

  async getUsers(query: any) {
    // TODO: Implement get users logic
    return { message: 'Get users' };
  }

  async exportUsers() {
    const users = await this.userRepository.find({
      order: { createdAt: 'DESC' },
    });

    return users;
  }

  private escapeCsv(val: string | number | null | undefined): string {
    if (val === null || val === undefined) return '';
    const s = String(val);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }

  private normalizeUsernameSeed(input: string): string {
    const noDiacritics = (input || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    return noDiacritics
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 16);
  }

  private generateRandomPassword(length = 12): string {
    const alphabet =
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    }
    return result;
  }

  private async ensureUniqueUsername(desired: string): Promise<string> {
    const base = (desired && desired.trim()) || 'user';
    let candidate = base;
    let suffix = 0;
    while (true) {
      const existing = await this.userRepository.findOne({
        where: { username: candidate },
        select: ['id'],
      });
      if (!existing) return candidate;
      suffix += 1;
      candidate = `${base}${suffix}`.slice(0, 24);
    }
  }

  /**
   * Generate/update username+password for users and return CSV content.
   * CSV can be opened directly by Excel.
   */
  async generateUserLoginCredentialsCsv(): Promise<string> {
    const users = await this.userRepository.find({
      order: { createdAt: 'DESC' },
      select: ['id', 'username', 'email', 'fullName', 'walletAddress'],
    });

    const rows: string[][] = [['username', 'email', 'fullName', 'password']];

    for (const user of users) {
      let username = (user.username || '').trim();
      if (!username) {
        const seed =
          this.normalizeUsernameSeed(user.fullName || '') ||
          this.normalizeUsernameSeed((user.email || '').split('@')[0] || '') ||
          this.normalizeUsernameSeed(user.walletAddress || '') ||
          `user${user.id.replace(/-/g, '').slice(0, 6)}`;
        username = await this.ensureUniqueUsername(seed);
      }

      const plainPassword = this.generateRandomPassword();
      const hashedPassword = await bcrypt.hash(plainPassword, 10);
      await this.userRepository.update(user.id, {
        username,
        password: hashedPassword,
      });

      rows.push([
        this.escapeCsv(username),
        this.escapeCsv(user.email || ''),
        this.escapeCsv(user.fullName || ''),
        this.escapeCsv(plainPassword),
      ]);
    }

    const csvContent = rows.map((r) => r.join(',')).join('\n');
    const BOM = '\uFEFF';
    return BOM + csvContent;
  }

  async getOrders(query: any) {
    // TODO: Implement get orders logic
    return { message: 'Get orders' };
  }

  async updateUserStatus(id: string, statusDto: any) {
    // TODO: Implement update user status logic
    return { message: `Update user status ${id}` };
  }

  async updateUserFakeReceivedCommission(
    userId: string,
    fakeReceivedCommission: number,
  ) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.userRepository.update(userId, { fakeReceivedCommission });
    return this.getUserDetail(userId);
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
    const allCommissions = await this.commissionService.getCommissions(
      userId,
      {},
    );

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
      packageType: string;
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
      packageType: string;
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

    // Get F1, F2, F3 Referrals
    const f1Users = await this.userRepository.find({
      where: { referralUserId: userId },
      select: [
        'id',
        'username',
        'fullName',
        'email',
        'packageType',
        'createdAt',
      ],
    });

    const f1Ids = f1Users.map((u) => u.id);
    let f2Users: any[] = [];
    if (f1Ids.length > 0) {
      f2Users = await this.userRepository.find({
        where: { referralUserId: In(f1Ids) },
        select: [
          'id',
          'username',
          'fullName',
          'email',
          'packageType',
          'createdAt',
        ],
      });
    }

    const f2Ids = f2Users.map((u) => u.id);
    let f3Users: any[] = [];
    if (f2Ids.length > 0) {
      f3Users = await this.userRepository.find({
        where: { referralUserId: In(f2Ids) },
        select: [
          'id',
          'username',
          'fullName',
          'email',
          'packageType',
          'createdAt',
        ],
      });
    }

    // F1 purchase details: mỗi F1 mua bao lần, mỗi lần user này nhận hoa hồng gì/bao nhiêu/thời gian nào
    const f1Orders =
      f1Ids.length > 0
        ? await this.orderRepository.find({
            where: { userId: In(f1Ids) },
            select: ['id', 'userId', 'totalAmount', 'status', 'createdAt'],
            order: { createdAt: 'DESC' },
          })
        : [];
    const commissionsByF1Order = new Map<string, any[]>();
    for (const c of allCommissions || []) {
      if (!c?.fromUserId || !c?.orderId) continue;
      if (!f1Ids.includes(c.fromUserId)) continue;
      const key = `${c.fromUserId}:${c.orderId}`;
      if (!commissionsByF1Order.has(key)) commissionsByF1Order.set(key, []);
      commissionsByF1Order.get(key)!.push(c);
    }
    const f1PurchaseDetails = f1Users.map((f1) => {
      const orders = f1Orders.filter((o) => o.userId === f1.id);
      const purchases = orders.map((o) => {
        const key = `${f1.id}:${o.id}`;
        const orderCommissions = commissionsByF1Order.get(key) || [];
        const totalCommissionFromOrder = orderCommissions.reduce(
          (sum, item) => sum + (Number(item.amount) || 0),
          0,
        );
        return {
          orderId: o.id,
          orderAmount: Number(o.totalAmount) || 0,
          orderStatus: o.status,
          purchasedAt: o.createdAt,
          totalCommissionFromOrder,
          commissions: orderCommissions.map((item) => ({
            id: item.id,
            type: item.type,
            amount: Number(item.amount) || 0,
            status: item.status,
            createdAt: item.createdAt,
            notes: item.notes,
          })),
        };
      });
      const totalCommissionFromF1 = purchases.reduce(
        (sum, p) => sum + (Number(p.totalCommissionFromOrder) || 0),
        0,
      );
      return {
        userId: f1.id,
        username: f1.username,
        fullName: f1.fullName,
        email: f1.email,
        packageType: f1.packageType,
        totalPurchases: purchases.length,
        totalCommissionFromF1,
        purchases,
      };
    });

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
        fakeReceivedCommission: formatDecimal(user.fakeReceivedCommission ?? 0),
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
      f1: f1Users,
      f1PurchaseDetails,
      f2: f2Users,
      f3: f3Users,
    };
  }

  /**
   * Get full binary tree structure recursively
   */
  async getFullTree(userId: string, maxDepth: number = 5): Promise<any> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: [
        'id',
        'username',
        'fullName',
        'email',
        'packageType',
        'avatar',
        'leftBranchTotal',
        'rightBranchTotal',
        'totalPurchaseAmount',
        'createdAt',
      ],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const buildTree = async (
      currentUserId: string,
      depth: number,
    ): Promise<any> => {
      if (depth >= maxDepth) {
        return null;
      }

      const currentUser = await this.userRepository.findOne({
        where: { id: currentUserId },
        select: [
          'id',
          'username',
          'fullName',
          'email',
          'packageType',
          'avatar',
          'leftBranchTotal',
          'rightBranchTotal',
          'totalPurchaseAmount',
          'createdAt',
        ],
      });

      if (!currentUser) {
        return null;
      }

      const leftChild = await this.userRepository.findOne({
        where: { parentId: currentUserId, position: 'left' },
        order: { createdAt: 'ASC' },
      });

      const rightChild = await this.userRepository.findOne({
        where: { parentId: currentUserId, position: 'right' },
        order: { createdAt: 'ASC' },
      });

      const node: any = {
        id: currentUser.id,
        username: currentUser.username,
        fullName: currentUser.fullName,
        email: currentUser.email,
        packageType: currentUser.packageType,
        avatar: currentUser.avatar,
        leftBranchTotal: parseFloat(String(currentUser.leftBranchTotal || 0)),
        rightBranchTotal: parseFloat(String(currentUser.rightBranchTotal || 0)),
        totalPurchaseAmount: parseFloat(
          String(currentUser.totalPurchaseAmount || 0),
        ),
        createdAt: currentUser.createdAt,
        children: [],
      };

      if (leftChild) {
        const leftTree = await buildTree(leftChild.id, depth + 1);
        if (leftTree) {
          node.children.push({ ...leftTree, position: 'left' });
        }
      }

      if (rightChild) {
        const rightTree = await buildTree(rightChild.id, depth + 1);
        if (rightTree) {
          node.children.push({ ...rightTree, position: 'right' });
        }
      }

      return node;
    };

    return buildTree(userId, 0);
  }

  /**
   * Get (or create default) banking config
   */
  async getBankingConfig(): Promise<BankingConfig> {
    let config = await this.bankingConfigRepository.findOne({
      where: { id: 1 },
    });
    if (!config) {
      config = this.bankingConfigRepository.create({
        id: 1,
        bankName: '',
        accountNumber: '',
        accountName: '',
        isEnabled: false,
        usdtPriceVnd: null,
        usdtWithdrawPriceVnd: null,
        usdtEnabled: false,
        usdtWalletAddress: '',
        usdtNetwork: 'TRC20',
        usdtQrImageUrl: undefined,
      });
      config = await this.bankingConfigRepository.save(config);
    }
    return config;
  }

  /**
   * Upsert banking config (admin only)
   */
  async upsertBankingConfig(
    dto: Partial<BankingConfig>,
  ): Promise<BankingConfig> {
    let config = await this.bankingConfigRepository.findOne({
      where: { id: 1 },
    });
    if (!config) {
      config = this.bankingConfigRepository.create({ id: 1, ...dto });
    } else {
      Object.assign(config, dto);
    }
    return this.bankingConfigRepository.save(config);
  }

  /**
   * Get system config as a plain object { minPayoutThreshold: number }
   */
  async getSystemConfig(): Promise<{
    minPayoutThreshold: number;
    commissionDepositWalletPercent: number;
    commissionWithdrawWalletPercent: number;
  }> {
    const [thresholdRow, depositPercentRow, withdrawPercentRow] =
      await Promise.all([
        this.systemConfigRepository.findOne({
          where: { key: 'minPayoutThreshold' },
        }),
        this.systemConfigRepository.findOne({
          where: { key: 'commissionDepositWalletPercent' },
        }),
        this.systemConfigRepository.findOne({
          where: { key: 'commissionWithdrawWalletPercent' },
        }),
      ]);
    return {
      minPayoutThreshold: thresholdRow
        ? parseFloat(thresholdRow.value)
        : this.defaultMinPayoutThreshold,
      commissionDepositWalletPercent: depositPercentRow
        ? parseFloat(depositPercentRow.value)
        : this.defaultCommissionDepositWalletPercent,
      commissionWithdrawWalletPercent: withdrawPercentRow
        ? parseFloat(withdrawPercentRow.value)
        : this.defaultCommissionWithdrawWalletPercent,
    };
  }

  /**
   * Update system config values
   */
  async updateSystemConfig(dto: {
    minPayoutThreshold?: number;
    commissionDepositWalletPercent?: number;
    commissionWithdrawWalletPercent?: number;
  }): Promise<{
    minPayoutThreshold: number;
    commissionDepositWalletPercent: number;
    commissionWithdrawWalletPercent: number;
  }> {
    if (dto.commissionDepositWalletPercent !== undefined) {
      const value = Number(dto.commissionDepositWalletPercent);
      if (!Number.isFinite(value) || value < 0 || value > 100) {
        throw new BadRequestException(
          'commissionDepositWalletPercent must be between 0 and 100',
        );
      }
    }
    if (dto.commissionWithdrawWalletPercent !== undefined) {
      const value = Number(dto.commissionWithdrawWalletPercent);
      if (!Number.isFinite(value) || value < 0 || value > 100) {
        throw new BadRequestException(
          'commissionWithdrawWalletPercent must be between 0 and 100',
        );
      }
    }

    const nextDepositPercent =
      dto.commissionDepositWalletPercent !== undefined
        ? Number(dto.commissionDepositWalletPercent)
        : (await this.getSystemConfig()).commissionDepositWalletPercent;
    const nextWithdrawPercent =
      dto.commissionWithdrawWalletPercent !== undefined
        ? Number(dto.commissionWithdrawWalletPercent)
        : (await this.getSystemConfig()).commissionWithdrawWalletPercent;
    if (nextDepositPercent + nextWithdrawPercent > 100) {
      throw new BadRequestException(
        'commissionDepositWalletPercent + commissionWithdrawWalletPercent must be <= 100',
      );
    }

    if (dto.minPayoutThreshold !== undefined) {
      let row = await this.systemConfigRepository.findOne({
        where: { key: 'minPayoutThreshold' },
      });
      if (!row) {
        row = this.systemConfigRepository.create({
          key: 'minPayoutThreshold',
          value: String(dto.minPayoutThreshold),
        });
      } else {
        row.value = String(dto.minPayoutThreshold);
      }
      await this.systemConfigRepository.save(row);
    }
    if (dto.commissionDepositWalletPercent !== undefined) {
      let row = await this.systemConfigRepository.findOne({
        where: { key: 'commissionDepositWalletPercent' },
      });
      if (!row) {
        row = this.systemConfigRepository.create({
          key: 'commissionDepositWalletPercent',
          value: String(dto.commissionDepositWalletPercent),
        });
      } else {
        row.value = String(dto.commissionDepositWalletPercent);
      }
      await this.systemConfigRepository.save(row);
    }
    if (dto.commissionWithdrawWalletPercent !== undefined) {
      let row = await this.systemConfigRepository.findOne({
        where: { key: 'commissionWithdrawWalletPercent' },
      });
      if (!row) {
        row = this.systemConfigRepository.create({
          key: 'commissionWithdrawWalletPercent',
          value: String(dto.commissionWithdrawWalletPercent),
        });
      } else {
        row.value = String(dto.commissionWithdrawWalletPercent);
      }
      await this.systemConfigRepository.save(row);
    }
    return this.getSystemConfig();
  }

  /**
   * Get minPayoutThreshold as a raw number (used internally by payout service)
   */
  async getMinPayoutThreshold(): Promise<number> {
    const row = await this.systemConfigRepository.findOne({
      where: { key: 'minPayoutThreshold' },
    });
    return row ? parseFloat(row.value) : this.defaultMinPayoutThreshold;
  }

  /**
   * Tỷ lệ chia hoa hồng vào ví nội bộ.
   * - depositPercent: vào ví nạp tiền
   * - withdrawPercent: vào ví rút tiền
   */
  async getCommissionWalletDistribution(): Promise<{
    depositPercent: number;
    withdrawPercent: number;
  }> {
    const [depositPercentRow, withdrawPercentRow] = await Promise.all([
      this.systemConfigRepository.findOne({
        where: { key: 'commissionDepositWalletPercent' },
      }),
      this.systemConfigRepository.findOne({
        where: { key: 'commissionWithdrawWalletPercent' },
      }),
    ]);

    const depositPercent = depositPercentRow
      ? parseFloat(depositPercentRow.value)
      : this.defaultCommissionDepositWalletPercent;
    const withdrawPercent = withdrawPercentRow
      ? parseFloat(withdrawPercentRow.value)
      : this.defaultCommissionWithdrawWalletPercent;

    return { depositPercent, withdrawPercent };
  }

  async getBlockchainConfig(): Promise<{
    blockchainPrivateKeyMasked: string;
    privateKeyMasked: string;
    hasBlockchainPrivateKey: boolean;
    hasPrivateKey: boolean;
    tokenAddress: string;
  }> {
    const blockchainPrivateKey = process.env.BLOCKCHAIN_PRIVATE_KEY || '';
    const privateKey = process.env.PRIVATE_KEY || '';
    const mask = (value: string) => {
      if (!value) return '';
      if (value.length <= 10) return '**********';
      return `${value.slice(0, 6)}...${value.slice(-4)}`;
    };
    return {
      blockchainPrivateKeyMasked: mask(blockchainPrivateKey),
      privateKeyMasked: mask(privateKey),
      hasBlockchainPrivateKey: Boolean(blockchainPrivateKey),
      hasPrivateKey: Boolean(privateKey),
      tokenAddress: process.env.TOKEN_ADDRESS || '',
    };
  }

  async updateBlockchainConfig(dto: {
    blockchainPrivateKey?: string;
    privateKey?: string;
    tokenAddress?: string;
  }): Promise<{
    blockchainPrivateKeyMasked: string;
    privateKeyMasked: string;
    hasBlockchainPrivateKey: boolean;
    hasPrivateKey: boolean;
    tokenAddress: string;
  }> {
    let content = '';
    try {
      content = await fs.readFile(this.backendEnvPath, 'utf8');
    } catch {
      content = '';
    }

    const normalize = (v: string | undefined) =>
      (v ?? '').replace(/\r?\n/g, '').trim();
    const isValidPrivateKey = (value: string) =>
      /^(0x)?[a-fA-F0-9]{64}$/.test(value);

    if (
      dto.blockchainPrivateKey !== undefined &&
      normalize(dto.blockchainPrivateKey) &&
      !isValidPrivateKey(normalize(dto.blockchainPrivateKey))
    ) {
      throw new BadRequestException(
        'BLOCKCHAIN_PRIVATE_KEY is invalid (must be 64 hex chars, optional 0x)',
      );
    }

    if (
      dto.privateKey !== undefined &&
      normalize(dto.privateKey) &&
      !isValidPrivateKey(normalize(dto.privateKey))
    ) {
      throw new BadRequestException(
        'PRIVATE_KEY is invalid (must be 64 hex chars, optional 0x)',
      );
    }

    if (dto.blockchainPrivateKey !== undefined) {
      content = this.upsertEnvValue(
        content,
        'BLOCKCHAIN_PRIVATE_KEY',
        normalize(dto.blockchainPrivateKey),
      );
    }
    if (dto.privateKey !== undefined) {
      content = this.upsertEnvValue(
        content,
        'PRIVATE_KEY',
        normalize(dto.privateKey),
      );
    }
    if (dto.tokenAddress !== undefined) {
      content = this.upsertEnvValue(
        content,
        'TOKEN_ADDRESS',
        normalize(dto.tokenAddress),
      );
    }

    await fs.writeFile(this.backendEnvPath, content, 'utf8');

    // Keep process.env in sync for current process
    if (dto.blockchainPrivateKey !== undefined) {
      process.env.BLOCKCHAIN_PRIVATE_KEY = normalize(dto.blockchainPrivateKey);
    }
    if (dto.privateKey !== undefined) {
      process.env.PRIVATE_KEY = normalize(dto.privateKey);
    }
    if (dto.tokenAddress !== undefined) {
      process.env.TOKEN_ADDRESS = normalize(dto.tokenAddress);
    }

    // Apply new blockchain key immediately for current runtime.
    if (dto.blockchainPrivateKey !== undefined) {
      await this.web3Service.reloadWalletFromEnv();
    }

    return this.getBlockchainConfig();
  }

  private upsertEnvValue(content: string, key: string, value: string): string {
    const lines = content ? content.split(/\r?\n/) : [];
    const nextLine = `${key}=${value}`;
    const idx = lines.findIndex((line) => line.startsWith(`${key}=`));
    if (idx >= 0) {
      lines[idx] = nextLine;
    } else {
      lines.push(nextLine);
    }
    return lines.join('\n');
  }
}
