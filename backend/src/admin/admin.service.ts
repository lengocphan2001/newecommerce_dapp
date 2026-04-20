import {
  Injectable,
  Inject,
  forwardRef,
  Logger,
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
import {
  Commission,
  CommissionStatus,
} from '../affiliate/entities/commission.entity';
import {
  WalletWithdrawRequest,
  WalletWithdrawStatus,
} from '../wallet/entities/wallet-withdraw-request.entity';
import { MatrixRewardLedger } from '../matrix-reward/entities/matrix-reward-ledger.entity';
import { FakeAnalyticsDashboardPayload } from './dto/fake-analytics-dashboard.dto';
import {
  FAKE_ANALYTICS_DASHBOARD_KEY,
  getDefaultFakeAnalyticsDashboardPayload,
} from './fake-analytics-defaults';
import { UserService } from '../user/user.service';
import { CommissionService } from '../affiliate/commission.service';
import { AffiliateService } from '../affiliate/affiliate.service';
import { CommissionPayoutService } from '../affiliate/commission-payout.service';
import { Web3Service } from '../blockchain/web3.service';
import { MailService } from '../mail/mail.service';

function roundWithdrawBalance(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 1e8) / 1e8;
}

const COMMISSION_PAYOUT_FEE_PERCENT = 12;

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  private readonly backendEnvPath = path.resolve(process.cwd(), '.env');
  private readonly defaultMinPayoutThreshold = 50;
  private readonly defaultCommissionDepositWalletPercent = 12;
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
    @InjectRepository(Commission)
    private commissionRepository: Repository<Commission>,
    @InjectRepository(WalletWithdrawRequest)
    private walletWithdrawRequestRepository: Repository<WalletWithdrawRequest>,
    @InjectRepository(MatrixRewardLedger)
    private matrixRewardLedgerRepository: Repository<MatrixRewardLedger>,
    private userService: UserService,
    @Inject(forwardRef(() => CommissionService))
    private commissionService: CommissionService,
    @Inject(forwardRef(() => AffiliateService))
    private affiliateService: AffiliateService,
    @Inject(forwardRef(() => CommissionPayoutService))
    private commissionPayoutService: CommissionPayoutService,
    private web3Service: Web3Service,
    private mailService: MailService,
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
      paymentWallet: process.env.NEXT_PUBLIC_PAYMENT_WALLET || '',
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
   * Trả về CSV **ngay lập tức** (< 100ms bất kể số lượng user).
   * bcrypt + lưu DB + gửi email chạy hoàn toàn trong background (fire-and-forget).
   * → Không bao giờ timeout dù Nginx/Cloudflare có giới hạn bao nhiêu giây.
   */
  async generateUserLoginCredentialsCsv(): Promise<{
    csvContent: string;
    stats: {
      total: number;
      emailQueued: number;
      emailSkipped: number;
      emailEnabled: boolean;
    };
  }> {
    const users = await this.userRepository.find({
      order: { createdAt: 'DESC' },
      select: ['id', 'username', 'email', 'fullName', 'walletAddress'],
    });

    const rows: string[][] = [['username', 'email', 'fullName', 'password']];
    const usedUsernames = new Set(
      users
        .map((u) => (u.username || '').trim().toLowerCase())
        .filter((u) => Boolean(u)),
    );

    // Bước 1: resolve username + plain password đồng bộ (không async, ~0ms)
    const prepared: Array<{
      id: string;
      username: string;
      email: string;
      plainPassword: string;
    }> = [];

    for (const user of users) {
      let username = (user.username || '').trim();
      if (!username) {
        const rawSeed =
          this.normalizeUsernameSeed(user.fullName || '') ||
          this.normalizeUsernameSeed((user.email || '').split('@')[0] || '') ||
          this.normalizeUsernameSeed(user.walletAddress || '') ||
          `user${user.id.replace(/-/g, '').slice(0, 6)}`;
        const seed = (rawSeed || 'user').slice(0, 24);
        let suffix = 0;
        let candidate = seed;
        while (usedUsernames.has(candidate.toLowerCase())) {
          suffix += 1;
          candidate = `${seed}${suffix}`.slice(0, 24);
        }
        username = candidate;
      }
      usedUsernames.add(username.toLowerCase());
      const plainPassword = this.generateRandomPassword();
      prepared.push({ id: user.id, username, email: user.email || '', plainPassword });
      rows.push([
        this.escapeCsv(username),
        this.escapeCsv(user.email || ''),
        this.escapeCsv(user.fullName || ''),
        this.escapeCsv(plainPassword),
      ]);
    }

    // Bước 2: tính email stats trước khi trả response
    const emailEnabled = this.mailService.isEnabled();
    const emailList = prepared.filter((u) => this.isValidEmail(u.email));
    const emailQueued = emailEnabled ? emailList.length : 0;
    const emailSkipped = prepared.length - emailList.length;

    // Bước 3: toàn bộ việc nặng (bcrypt + DB save + email) chạy BACKGROUND
    // KHÔNG await → response trả ngay, không bao giờ timeout
    void this.hashSaveAndEmailBackground(prepared, emailEnabled ? emailList : []);

    return {
      csvContent: '\uFEFF' + rows.map((r) => r.join(',')).join('\n'),
      stats: { total: prepared.length, emailQueued, emailSkipped, emailEnabled },
    };
  }

  /**
   * Background job: bcrypt → save DB → send emails.
   * Chạy sau khi response đã trả về client → không bao giờ gây timeout.
   */
  private async hashSaveAndEmailBackground(
    prepared: Array<{ id: string; username: string; email: string; plainPassword: string }>,
    emailList: Array<{ username: string; email: string; plainPassword: string }>,
  ): Promise<void> {
    try {
      // bcrypt song song theo batch 20, rounds=8 (~25ms/user)
      const BCRYPT_BATCH = 20;
      const usersToUpdate: Array<{ id: string; username: string; password: string }> = [];
      for (let i = 0; i < prepared.length; i += BCRYPT_BATCH) {
        const batch = prepared.slice(i, i + BCRYPT_BATCH);
        const hashed = await Promise.all(batch.map((u) => bcrypt.hash(u.plainPassword, 8)));
        for (let j = 0; j < batch.length; j++) {
          usersToUpdate.push({ id: batch[j].id, username: batch[j].username, password: hashed[j] });
        }
      }

      // Lưu DB theo batch 50 để tránh TypeORM tạo quá nhiều connection
      const DB_BATCH = 50;
      for (let i = 0; i < usersToUpdate.length; i += DB_BATCH) {
        await this.userRepository.save(usersToUpdate.slice(i, i + DB_BATCH));
      }

      // Gửi email
      if (emailList.length > 0) {
        await this.sendCredentialsEmailBackground(emailList);
      }
    } catch (err) {
      console.error('[AdminService] hashSaveAndEmailBackground error:', err);
    }
  }

  /**
   * Gửi email credentials trong background.
   * Chỉ qua SMTP_USER (xem MailService.sendLoginCredentials) — không dùng SMTP_USER_2/_3.
   */
  private async sendCredentialsEmailBackground(
    list: Array<{ username: string; email: string; plainPassword: string }>,
  ): Promise<void> {
    await Promise.all(
      list.map(({ username, email, plainPassword }) =>
        this.mailService
          .sendLoginCredentials(email.trim(), username, plainPassword)
          .catch((err) =>
            console.error(`[MailService] bulk send failed ${email}:`, err),
          ),
      ),
    );
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@gmail\.com$/i.test((email || '').trim());
  }

  /**
   * Generate a new random password for a single user, update in DB,
   * and send credentials email if the user has a valid email address.
   */
  async generatePasswordForUser(userId: string): Promise<{
    userId: string;
    username: string;
    email: string;
    emailSent: boolean;
    emailEnabled: boolean;
    emailValid: boolean;
  }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'username', 'email', 'fullName', 'walletAddress'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    let username = (user.username || '').trim();
    if (!username) {
      username = await this.ensureUniqueUsername(
        this.normalizeUsernameSeed(user.fullName || '') ||
          this.normalizeUsernameSeed((user.email || '').split('@')[0] || '') ||
          this.normalizeUsernameSeed(user.walletAddress || '') ||
          `user${user.id.replace(/-/g, '').slice(0, 6)}`,
      );
    }

    const plainPassword = this.generateRandomPassword();
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    await this.userRepository.update(userId, {
      username,
      password: hashedPassword,
    });

    const emailValid = this.isValidEmail(user.email);
    const emailEnabled = this.mailService.isPrimarySmtpConfigured();
    let emailSent = false;

    if (emailEnabled && emailValid) {
      emailSent = await this.mailService.sendLoginCredentials(
        user.email.trim(),
        username,
        plainPassword,
      );
    }

    return {
      userId,
      username,
      email: user.email || '',
      emailSent,
      emailEnabled,
      emailValid,
    };
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
   * Trừ số dư ví rút tiền (withdrawWalletBalance). Không tạo WalletWithdrawRequest.
   * Dùng transaction + khóa dòng để tránh race khi trừ.
   */
  async deductUserWithdrawWalletBalance(
    userId: string,
    amountRaw: number,
    reason: string | undefined,
    performedBy: string,
  ) {
    const amount = roundWithdrawBalance(Number(amountRaw));
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Số tiền trừ không hợp lệ');
    }

    await this.userRepository.manager.transaction(async (manager) => {
      const repo = manager.getRepository(User);
      const user = await repo
        .createQueryBuilder('u')
        .setLock('pessimistic_write')
        .where('u.id = :id', { id: userId })
        .getOne();

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const current = roundWithdrawBalance(Number(user.withdrawWalletBalance ?? 0));
      if (current + 1e-12 < amount) {
        throw new BadRequestException(
          `Số dư ví rút không đủ. Hiện có: ${current} USDT, yêu cầu trừ: ${amount} USDT`,
        );
      }

      const next = roundWithdrawBalance(current - amount);
      await repo.update(userId, { withdrawWalletBalance: next });
    });

    const reasonText = (reason || '').trim();
    this.logger.warn(
      `[ADMIN] deduct withdraw wallet userId=${userId} amount=${amount} USDT by=${performedBy}` +
        (reasonText ? ` reason=${reasonText.slice(0, 200)}` : ''),
    );

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

    // Tổng commission đã PAID, sau khi trừ phí 12% (net vào ví rút),
    // chỉ lấy phần phân bổ nội bộ, loại payout USDT on-chain.
    const paidCommissionToWithdrawRaw = await this.commissionRepository
      .createQueryBuilder('c')
      .select('COALESCE(SUM(c.amount),0)', 's')
      .where('c.userId = :userId', { userId })
      .andWhere('c.status = :paid', { paid: CommissionStatus.PAID })
      .andWhere('c.payoutTxHash IS NULL')
      .getRawOne<{ s: string }>();
    const paidCommissionGross = roundWithdrawBalance(
      Number(paidCommissionToWithdrawRaw?.s ?? 0),
    );
    const paidCommissionToWithdrawWallet = roundWithdrawBalance(
      paidCommissionGross * (1 - COMMISSION_PAYOUT_FEE_PERCENT / 100),
    );

    // Tổng matrix đã cộng/trừ ròng vào ví rút tiền.
    const matrixLedgerNetRaw = await this.matrixRewardLedgerRepository
      .createQueryBuilder('m')
      .select('COALESCE(SUM(m.amount),0)', 's')
      .where('m.beneficiaryUserId = :userId', { userId })
      .getRawOne<{ s: string }>();
    const matrixPoolNetAmount = roundWithdrawBalance(
      Number(matrixLedgerNetRaw?.s ?? 0),
    );

    // Tổng user đã rút và được admin duyệt.
    const approvedWithdrawRaw = await this.walletWithdrawRequestRepository
      .createQueryBuilder('w')
      .select('COALESCE(SUM(COALESCE(w.actualAmount, w.amount)),0)', 's')
      .where('w.userId = :userId', { userId })
      .andWhere('w.status = :approved', {
        approved: WalletWithdrawStatus.APPROVED,
      })
      .getRawOne<{ s: string }>();
    const approvedWithdrawnAmount = roundWithdrawBalance(
      Number(approvedWithdrawRaw?.s ?? 0),
    );

    const expectedWithdrawWalletBalance = roundWithdrawBalance(
      paidCommissionToWithdrawWallet + matrixPoolNetAmount - approvedWithdrawnAmount,
    );

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
        walletBalance: formatDecimal(user.walletBalance ?? 0),
        withdrawWalletBalance: formatDecimal(user.withdrawWalletBalance ?? 0),
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
      walletReconciliation: {
        paidCommissionToWithdrawWallet: formatDecimal(
          paidCommissionToWithdrawWallet,
        ),
        matrixPoolNetAmount: formatDecimal(matrixPoolNetAmount),
        approvedWithdrawnAmount: formatDecimal(approvedWithdrawnAmount),
        expectedWithdrawWalletBalance: formatDecimal(expectedWithdrawWalletBalance),
      },
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
    const rootUser = await this.userRepository.findOne({
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

    if (!rootUser) {
      throw new NotFoundException('User not found');
    }

    if (maxDepth <= 0) {
      return {
        id: rootUser.id,
        username: rootUser.username,
        fullName: rootUser.fullName,
        email: rootUser.email,
        packageType: rootUser.packageType,
        avatar: rootUser.avatar,
        leftBranchTotal: parseFloat(String(rootUser.leftBranchTotal || 0)),
        rightBranchTotal: parseFloat(String(rootUser.rightBranchTotal || 0)),
        totalPurchaseAmount: parseFloat(String(rootUser.totalPurchaseAmount || 0)),
        createdAt: rootUser.createdAt,
        children: [],
      };
    }

    const allNodes = new Map<string, any>();
    allNodes.set(rootUser.id, rootUser);

    let parentIds: string[] = [rootUser.id];
    let depth = 0;
    while (depth < maxDepth && parentIds.length > 0) {
      const levelChildren = await this.userRepository.find({
        where: { parentId: In(parentIds) },
        select: [
          'id',
          'parentId',
          'position',
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
        order: { createdAt: 'ASC' },
      });

      if (levelChildren.length === 0) {
        break;
      }

      for (const child of levelChildren) {
        if (!allNodes.has(child.id)) {
          allNodes.set(child.id, child);
        }
      }
      parentIds = levelChildren.map((child) => child.id);
      depth += 1;
    }

    const toTreeNode = (node: any): any => ({
      id: node.id,
      username: node.username,
      fullName: node.fullName,
      email: node.email,
      packageType: node.packageType,
      avatar: node.avatar,
      leftBranchTotal: parseFloat(String(node.leftBranchTotal || 0)),
      rightBranchTotal: parseFloat(String(node.rightBranchTotal || 0)),
      totalPurchaseAmount: parseFloat(String(node.totalPurchaseAmount || 0)),
      createdAt: node.createdAt,
      children: [],
    });

    const treeNodes = new Map<string, any>();
    for (const node of allNodes.values()) {
      treeNodes.set(node.id, toTreeNode(node));
    }

    for (const node of allNodes.values()) {
      if (!node.parentId) continue;
      const parent = treeNodes.get(node.parentId);
      const child = treeNodes.get(node.id);
      if (!parent || !child) continue;
      parent.children.push({ ...child, position: node.position });
    }

    return treeNodes.get(rootUser.id);
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
   * Get raw array of all system configurations
   */
  async getAllSystemConfigs() {
    return this.systemConfigRepository.find();
  }

  /**
   * Update a generic single configuration by key
   */
  async updateSingleSystemConfig(key: string, value: string) {
    let row = await this.systemConfigRepository.findOne({ where: { key } });
    if (!row) {
      row = this.systemConfigRepository.create({ key, value });
    } else {
      row.value = value;
    }
    return this.systemConfigRepository.save(row);
  }

  /** Factory template for demo analytics (not persisted until admin saves). */
  getDefaultFakeAnalyticsDashboard(): FakeAnalyticsDashboardPayload {
    return getDefaultFakeAnalyticsDashboardPayload();
  }

  private assertFakeAnalyticsPayload(o: any): FakeAnalyticsDashboardPayload {
    if (!o || typeof o !== 'object') {
      throw new BadRequestException('Body must be a JSON object');
    }
    const { overview, series, topProducts } = o;
    if (!overview || typeof overview !== 'object') {
      throw new BadRequestException('Missing overview');
    }
    for (const k of ['totalRevenue', 'totalOrders', 'totalUsers', 'totalProducts'] as const) {
      if (typeof overview[k] !== 'number' || Number.isNaN(overview[k])) {
        throw new BadRequestException(`overview.${k} must be a number`);
      }
    }
    if (!series || typeof series !== 'object') {
      throw new BadRequestException('Missing series');
    }
    const { revenue, orders, users } = series;
    if (!Array.isArray(revenue) || !Array.isArray(orders) || !Array.isArray(users)) {
      throw new BadRequestException('series.revenue, series.orders, series.users must be arrays');
    }
    for (const row of revenue) {
      if (!row || typeof row.date !== 'string' || typeof row.revenue !== 'number' || Number.isNaN(row.revenue)) {
        throw new BadRequestException('Each series.revenue item needs { date: string, revenue: number }');
      }
    }
    for (const row of orders) {
      if (!row || typeof row.date !== 'string' || typeof row.count !== 'number' || Number.isNaN(row.count)) {
        throw new BadRequestException('Each series.orders item needs { date: string, count: number }');
      }
    }
    for (const row of users) {
      if (!row || typeof row.date !== 'string' || typeof row.count !== 'number' || Number.isNaN(row.count)) {
        throw new BadRequestException('Each series.users item needs { date: string, count: number }');
      }
    }
    if (!Array.isArray(topProducts)) {
      throw new BadRequestException('topProducts must be an array');
    }
    for (const p of topProducts) {
      if (
        !p ||
        typeof p.name !== 'string' ||
        typeof p.quantity !== 'number' ||
        typeof p.revenue !== 'number' ||
        Number.isNaN(p.quantity) ||
        Number.isNaN(p.revenue)
      ) {
        throw new BadRequestException(
          'Each topProducts item needs { name: string, quantity: number, revenue: number }',
        );
      }
    }
    return o as FakeAnalyticsDashboardPayload;
  }

  /**
   * Demo analytics for admin (stored in system_config). Returns defaults if unset.
   */
  async getFakeAnalyticsDashboard(): Promise<FakeAnalyticsDashboardPayload> {
    const row = await this.systemConfigRepository.findOne({
      where: { key: FAKE_ANALYTICS_DASHBOARD_KEY },
    });
    if (!row?.value?.trim()) {
      return this.getDefaultFakeAnalyticsDashboard();
    }
    try {
      const parsed = JSON.parse(row.value);
      return this.assertFakeAnalyticsPayload(parsed);
    } catch (e) {
      if (e instanceof BadRequestException) {
        throw e;
      }
      throw new BadRequestException('Stored fake analytics JSON is invalid');
    }
  }

  async updateFakeAnalyticsDashboard(body: unknown): Promise<FakeAnalyticsDashboardPayload> {
    let payload: unknown = body;
    if (typeof body === 'string') {
      try {
        payload = JSON.parse(body);
      } catch {
        throw new BadRequestException('Invalid JSON string');
      }
    }
    const validated = this.assertFakeAnalyticsPayload(payload);
    let row = await this.systemConfigRepository.findOne({
      where: { key: FAKE_ANALYTICS_DASHBOARD_KEY },
    });
    if (!row) {
      row = this.systemConfigRepository.create({
        key: FAKE_ANALYTICS_DASHBOARD_KEY,
        value: JSON.stringify(validated),
      });
    } else {
      row.value = JSON.stringify(validated);
    }
    await this.systemConfigRepository.save(row);
    return validated;
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
    paymentWallet: string;
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
      paymentWallet: process.env.NEXT_PUBLIC_PAYMENT_WALLET || '',
    };
  }

  async updateBlockchainConfig(dto: {
    blockchainPrivateKey?: string;
    privateKey?: string;
    tokenAddress?: string;
    paymentWallet?: string;
  }): Promise<{
    blockchainPrivateKeyMasked: string;
    privateKeyMasked: string;
    hasBlockchainPrivateKey: boolean;
    hasPrivateKey: boolean;
    tokenAddress: string;
    paymentWallet: string;
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
    const isValidWalletAddress = (value: string) =>
      /^0x[a-fA-F0-9]{40}$/.test(value);

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

    if (
      dto.paymentWallet !== undefined &&
      normalize(dto.paymentWallet) &&
      !isValidWalletAddress(normalize(dto.paymentWallet))
    ) {
      throw new BadRequestException(
        'NEXT_PUBLIC_PAYMENT_WALLET is invalid (must be 0x + 40 hex chars)',
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
    if (dto.paymentWallet !== undefined) {
      content = this.upsertEnvValue(
        content,
        'NEXT_PUBLIC_PAYMENT_WALLET',
        normalize(dto.paymentWallet),
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
    if (dto.paymentWallet !== undefined) {
      process.env.NEXT_PUBLIC_PAYMENT_WALLET = normalize(dto.paymentWallet);
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
