import { Injectable, Inject, forwardRef, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
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
import { CommissionPayoutService as BlockchainCommissionPayoutService } from '../blockchain/commission-payout.service';

@Injectable()
export class AdminService {
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
    private blockchainCommissionPayoutService: BlockchainCommissionPayoutService,
  ) { }

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

  async getOrders(query: any) {
    // TODO: Implement get orders logic
    return { message: 'Get orders' };
  }

  async updateUserStatus(id: string, statusDto: any) {
    // TODO: Implement update user status logic
    return { message: `Update user status ${id}` };
  }

  async updateUserFakeReceivedCommission(userId: string, fakeReceivedCommission: number) {
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
    let f1Users = await this.userRepository.find({
      where: { referralUserId: userId },
      select: ['id', 'username', 'fullName', 'email', 'packageType', 'createdAt'],
    });

    const f1Ids = f1Users.map(u => u.id);
    let f2Users: any[] = [];
    if (f1Ids.length > 0) {
      f2Users = await this.userRepository.find({
        where: { referralUserId: In(f1Ids) },
        select: ['id', 'username', 'fullName', 'email', 'packageType', 'createdAt'],
      });
    }

    const f2Ids = f2Users.map(u => u.id);
    let f3Users: any[] = [];
    if (f2Ids.length > 0) {
      f3Users = await this.userRepository.find({
        where: { referralUserId: In(f2Ids) },
        select: ['id', 'username', 'fullName', 'email', 'packageType', 'createdAt'],
      });
    }

    // Enrich F1 with purchase history + commissions generated for `userId` from those purchases.
    // UI requirement:
    // - "Mỗi F1 mua bao lần" → purchaseCount (confirmed orders)
    // - "mỗi lần được hoa hồng gì, bao nhiêu, thời gian mua hàng" → purchases[] (per order)
    if (f1Ids.length > 0) {
      // Exact purchase count per F1 (confirmed orders only).
      const countRows = await this.orderRepository
        .createQueryBuilder('o')
        .select('o.userId', 'userId')
        .addSelect('COUNT(*)', 'count')
        .where('o.userId IN (:...f1Ids)', { f1Ids })
        .andWhere('o.status = :status', { status: OrderStatus.CONFIRMED })
        .groupBy('o.userId')
        .getRawMany<{ userId: string; count: string }>();

      const purchaseCountMap = new Map<string, number>(
        countRows.map((r) => [r.userId, parseInt(r.count, 10) || 0]),
      );

      // Load latest N orders per F1 for display.
      const ordersByF1 = await Promise.all(
        f1Users.map(async (f1) => {
          const orders = await this.orderRepository.find({
            where: { userId: f1.id, status: OrderStatus.CONFIRMED },
            order: { createdAt: 'DESC' },
            take: 20,
            select: ['id', 'createdAt', 'userId'],
          });
          return { f1Id: f1.id, orders };
        }),
      );

      const allOrderIds = ordersByF1.flatMap((x) => x.orders.map((o) => o.id));
      const commissions = allOrderIds.length
        ? await this.commissionService.getCommissionsForRecipientFromUsersOrders({
          recipientUserId: userId,
          fromUserIds: f1Ids,
          orderIds: allOrderIds,
        })
        : [];

      const commissionsByOrderId = new Map<string, any[]>();
      for (const c of commissions as any[]) {
        if (!c.orderId) continue;
        const list = commissionsByOrderId.get(c.orderId) || [];
        list.push(c);
        commissionsByOrderId.set(c.orderId, list);
      }

      const ordersByF1Map = new Map<string, any[]>(
        ordersByF1.map((x) => [x.f1Id, x.orders]),
      );

      f1Users = f1Users.map((f1) => {
        const orders = ordersByF1Map.get(f1.id) || [];
        return {
          ...f1,
          purchaseCount: purchaseCountMap.get(f1.id) || 0,
          purchases: orders.map((o) => ({
            orderId: o.id,
            purchasedAt: o.createdAt,
            commissions: (commissionsByOrderId.get(o.id) || []).map((c) => ({
              id: c.id,
              type: c.type,
              amount: c.amount,
              status: c.status,
              notes: c.notes,
            })),
          })),
        };
      });
    } else {
      // Keep consistent shape for the UI.
      f1Users = f1Users.map((f1) => ({
        ...f1,
        purchaseCount: 0,
        purchases: [],
      }));
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
      select: ['id', 'username', 'fullName', 'email', 'packageType', 'avatar', 'leftBranchTotal', 'rightBranchTotal', 'totalPurchaseAmount', 'createdAt'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const buildTree = async (currentUserId: string, depth: number): Promise<any> => {
      if (depth >= maxDepth) {
        return null;
      }

      const currentUser = await this.userRepository.findOne({
        where: { id: currentUserId },
        select: ['id', 'username', 'fullName', 'email', 'packageType', 'avatar', 'leftBranchTotal', 'rightBranchTotal', 'totalPurchaseAmount', 'createdAt'],
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
        totalPurchaseAmount: parseFloat(String(currentUser.totalPurchaseAmount || 0)),
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
    let config = await this.bankingConfigRepository.findOne({ where: { id: 1 } });
    if (!config) {
      config = this.bankingConfigRepository.create({
        id: 1,
        bankName: '',
        accountNumber: '',
        accountName: '',
        isEnabled: false,
        usdtPriceVnd: null,
      });
      config = await this.bankingConfigRepository.save(config);
    }
    return config;
  }

  /**
   * Upsert banking config (admin only)
   */
  async upsertBankingConfig(dto: Partial<BankingConfig>): Promise<BankingConfig> {
    let config = await this.bankingConfigRepository.findOne({ where: { id: 1 } });
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
  async getSystemConfig(): Promise<{ minPayoutThreshold: number }> {
    const row = await this.systemConfigRepository.findOne({ where: { key: 'minPayoutThreshold' } });
    return {
      minPayoutThreshold: row ? parseFloat(row.value) : 50,
    };
  }

  /**
   * Update system config values
   */
  async updateSystemConfig(dto: { minPayoutThreshold?: number }): Promise<{ minPayoutThreshold: number }> {
    if (dto.minPayoutThreshold !== undefined) {
      let row = await this.systemConfigRepository.findOne({ where: { key: 'minPayoutThreshold' } });
      if (!row) {
        row = this.systemConfigRepository.create({ key: 'minPayoutThreshold', value: String(dto.minPayoutThreshold) });
      } else {
        row.value = String(dto.minPayoutThreshold);
      }
      await this.systemConfigRepository.save(row);
    }
    return this.getSystemConfig();
  }

  /**
   * Get minPayoutThreshold as a raw number (used internally by payout service)
   */
  async getMinPayoutThreshold(): Promise<number> {
    const row = await this.systemConfigRepository.findOne({ where: { key: 'minPayoutThreshold' } });
    return row ? parseFloat(row.value) : 50;
  }

  private getBackendEnvPath(): string {
    return resolve(process.cwd(), '.env');
  }

  private readEnvValue(envPath: string, key: string): string {
    if (!existsSync(envPath)) return '';
    const content = readFileSync(envPath, 'utf8');
    const lines = content.split(/\r?\n/);
    const line = lines.find((l) => l.startsWith(`${key}=`));
    if (!line) return '';
    return line.slice(`${key}=`.length).trim();
  }

  private upsertEnvValue(envPath: string, key: string, value: string): void {
    let content = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
    const lines = content ? content.split(/\r?\n/) : [];
    const targetPrefix = `${key}=`;
    const idx = lines.findIndex((l) => l.startsWith(targetPrefix));
    const nextLine = `${key}=${value}`;
    if (idx >= 0) {
      lines[idx] = nextLine;
    } else {
      lines.push(nextLine);
    }
    content = `${lines.join('\n').replace(/\n{3,}/g, '\n\n')}\n`;
    writeFileSync(envPath, content);
    if (value) {
      process.env[key] = value;
    } else {
      delete process.env[key];
    }
  }

  private maskSecret(secret: string): string {
    if (!secret) return '';
    if (secret.length <= 10) return '********';
    return `${secret.slice(0, 6)}...${secret.slice(-4)}`;
  }

  async getRuntimeEnvConfig(): Promise<{
    nextPublicPaymentWallet: string;
    blockchainPrivateKeyMasked: string;
    hasBlockchainPrivateKey: boolean;
    privateKeyMasked: string;
    hasPrivateKey: boolean;
  }> {
    const backendEnvPath = this.getBackendEnvPath();

    const nextPublicPaymentWallet =
      this.readEnvValue(backendEnvPath, 'NEXT_PUBLIC_PAYMENT_WALLET') ||
      process.env.NEXT_PUBLIC_PAYMENT_WALLET ||
      '';

    const blockchainPrivateKey =
      this.readEnvValue(backendEnvPath, 'BLOCKCHAIN_PRIVATE_KEY') ||
      process.env.BLOCKCHAIN_PRIVATE_KEY ||
      '';
    const privateKey =
      this.readEnvValue(backendEnvPath, 'PRIVATE_KEY') ||
      process.env.PRIVATE_KEY ||
      '';

    return {
      nextPublicPaymentWallet,
      blockchainPrivateKeyMasked: this.maskSecret(blockchainPrivateKey),
      hasBlockchainPrivateKey: !!blockchainPrivateKey,
      privateKeyMasked: this.maskSecret(privateKey),
      hasPrivateKey: !!privateKey,
    };
  }

  async updateRuntimeEnvConfig(dto: {
    nextPublicPaymentWallet?: string;
    blockchainPrivateKey?: string;
    privateKey?: string;
  }): Promise<{
    nextPublicPaymentWallet: string;
    blockchainPrivateKeyMasked: string;
    hasBlockchainPrivateKey: boolean;
    privateKeyMasked: string;
    hasPrivateKey: boolean;
    requiresRestart: boolean;
  }> {
    const backendEnvPath = this.getBackendEnvPath();
    let requiresRestart = false;

    if (dto.nextPublicPaymentWallet !== undefined) {
      const wallet = dto.nextPublicPaymentWallet.trim();
      if (wallet && !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
        throw new BadRequestException('NEXT_PUBLIC_PAYMENT_WALLET must be a valid EVM address');
      }
      // Store in backend env only; frontend should read this via API at runtime.
      this.upsertEnvValue(backendEnvPath, 'NEXT_PUBLIC_PAYMENT_WALLET', wallet);
    }

    if (dto.blockchainPrivateKey !== undefined) {
      const privateKey = dto.blockchainPrivateKey.trim();
      if (privateKey && !/^(0x)?[a-fA-F0-9]{64}$/.test(privateKey)) {
        throw new BadRequestException('BLOCKCHAIN_PRIVATE_KEY must be a valid 64-hex private key');
      }
      this.upsertEnvValue(backendEnvPath, 'BLOCKCHAIN_PRIVATE_KEY', privateKey);
      // Hot-reload signer and contract binding so backend keeps working without restart.
      await this.web3Service.reloadWalletFromPrivateKey(privateKey || undefined);
      this.blockchainCommissionPayoutService.refreshRuntimeBinding();
      requiresRestart = false;
    }

    if (dto.privateKey !== undefined) {
      const privateKey = dto.privateKey.trim();
      if (privateKey && !/^(0x)?[a-fA-F0-9]{64}$/.test(privateKey)) {
        throw new BadRequestException('PRIVATE_KEY must be a valid 64-hex private key');
      }
      this.upsertEnvValue(backendEnvPath, 'PRIVATE_KEY', privateKey);
    }

    const latest = await this.getRuntimeEnvConfig();
    return {
      ...latest,
      // Private key requires backend restart to re-init wallet.
      requiresRestart,
    };
  }

  async getPublicPaymentWallet(): Promise<{ paymentWallet: string }> {
    const backendEnvPath = this.getBackendEnvPath();
    const paymentWallet =
      this.readEnvValue(backendEnvPath, 'NEXT_PUBLIC_PAYMENT_WALLET') ||
      process.env.NEXT_PUBLIC_PAYMENT_WALLET ||
      '';
    return { paymentWallet };
  }
}
