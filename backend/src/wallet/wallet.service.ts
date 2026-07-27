import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { ethers } from 'ethers';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  WalletDepositRequest,
  WalletDepositStatus,
} from './entities/wallet-deposit-request.entity';
import { User } from '../user/entities/user.entity';
import { BankingConfig } from '../admin/entities/banking-config.entity';
import { CreateDepositRequestDto } from './dto/create-deposit-request.dto';
import { ProcessDepositRequestDto } from './dto/process-deposit-request.dto';
import {
  WalletWithdrawMethod,
  WalletWithdrawRequest,
  WalletWithdrawStatus,
} from './entities/wallet-withdraw-request.entity';
import { UserBankAccount } from './entities/user-bank-account.entity';
import {
  CreateBankAccountDto,
  UpdateBankAccountDto,
} from './dto/bank-account.dto';
import { CreateWithdrawRequestDto } from './dto/create-withdraw-request.dto';
import { ProcessWithdrawRequestDto } from './dto/process-withdraw-request.dto';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { ConfigService } from '@nestjs/config';
import { Web3Service } from '../blockchain/web3.service';
import { CommissionPayoutService as BlockchainCommissionPayoutService } from '../blockchain/commission-payout.service';
@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  private toSafeNumber(value: unknown): number {
    if (typeof value === 'number') return value;
    const normalized = String(value ?? '')
      .trim()
      .replace(/,/g, '');
    return Number(normalized);
  }

  constructor(
    @InjectRepository(WalletDepositRequest)
    private readonly depositRequestRepo: Repository<WalletDepositRequest>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(BankingConfig)
    private readonly bankingConfigRepo: Repository<BankingConfig>,
    @InjectRepository(WalletWithdrawRequest)
    private readonly withdrawRequestRepo: Repository<WalletWithdrawRequest>,
    @InjectRepository(UserBankAccount)
    private readonly userBankAccountRepo: Repository<UserBankAccount>,
    private readonly notificationsGateway: NotificationsGateway,
    private readonly configService: ConfigService,
    private readonly web3Service: Web3Service,
    private readonly blockchainPayoutService: BlockchainCommissionPayoutService,
  ) {}

  /** Số dư ví nạp tiền của user */
  async getBalance(
    userId: string,
  ): Promise<{ balance: number; withdrawBalance: number; pvBalance: number }> {
    // Obtenemos todos los balances relevantes del usuario, incluyendo el nuevo balance en PV.
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ['id', 'walletBalance', 'withdrawWalletBalance', 'pvWalletBalance'],
    });
    if (!user) throw new NotFoundException('User not found');
    const balance = Number(user.walletBalance ?? 0);
    const withdrawBalance = Number(user.withdrawWalletBalance ?? 0);
    const pvBalance = Number(user.pvWalletBalance ?? 0);
    return { balance, withdrawBalance, pvBalance };
  }

  async getWithdrawBalance(userId: string): Promise<{ withdrawBalance: number }> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ['id', 'withdrawWalletBalance'],
    });
    if (!user) throw new NotFoundException('User not found');
    return { withdrawBalance: Number(user.withdrawWalletBalance ?? 0) };
  }

  /** User tạo yêu cầu nạp tiền (số tiền VND đã chuyển). Admin duyệt sẽ dùng tỉ giá Banking Settings để cộng USDT. */
  async createDepositRequest(userId: string, dto: CreateDepositRequestDto) {
    const method = dto.method || 'BANKING';

    if (method === 'BANKING' && !dto.amountVnd) {
      throw new BadRequestException('Vui lòng nhập số tiền VND (amountVnd)');
    }
    if (method === 'USDT') {
      if (!dto.requestedUsdt) {
        throw new BadRequestException('Vui lòng nhập số lượng USDT (requestedUsdt)');
      }
      if (!dto.senderAddress) {
        throw new BadRequestException('Vui lòng cung cấp địa chỉ ví gửi tiền (senderAddress)');
      }
      if (!this.web3Service.isValidAddress(dto.senderAddress)) {
        throw new BadRequestException('Địa chỉ ví gửi tiền không hợp lệ');
      }
    }

    const request = this.depositRequestRepo.create({
      userId,
      method,
      amountVnd: method === 'BANKING' ? dto.amountVnd : null,
      requestedUsdt: method === 'USDT' ? dto.requestedUsdt : null,
      txHash: method === 'USDT' ? dto.txHash || null : null,
      senderAddress: method === 'USDT' && dto.senderAddress ? this.web3Service.formatAddress(dto.senderAddress) : null,
      amount: null,
      status: WalletDepositStatus.PENDING,
      proofImageUrl: dto.proofImageUrl,
      transferNote: dto.transferNote,
    });
    const saved = await this.depositRequestRepo.save(request);
    this.notificationsGateway.server.emit('new-deposit-request', {
      type: 'new-deposit-request',
      request: {
        id: saved.id,
        userId: saved.userId,
        method: saved.method,
        amountVnd: saved.amountVnd,
        requestedUsdt: saved.requestedUsdt,
        senderAddress: saved.senderAddress,
        createdAt: saved.createdAt,
      },
      message: `New deposit request #${saved.id.substring(0, 8)} received`,
    });
    return saved;
  }

  /** User xem danh sách yêu cầu nạp tiền của mình */
  async getMyDepositRequests(userId: string, status?: WalletDepositStatus) {
    const qb = this.depositRequestRepo
      .createQueryBuilder('r')
      .where('r.userId = :userId', { userId })
      .orderBy('r.createdAt', 'DESC')
      .take(15);
    if (status) qb.andWhere('r.status = :status', { status });
    return qb.getMany();
  }

  /** Admin: danh sách yêu cầu nạp tiền (lọc theo status) */
  async findAllDepositRequests(status?: WalletDepositStatus) {
    const qb = this.depositRequestRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.user', 'user')
      .addSelect([
        'user.id',
        'user.username',
        'user.fullName',
        'user.email',
        'user.phone',
      ])
      .orderBy('r.createdAt', 'DESC');
    if (status) qb.andWhere('r.status = :status', { status });
    return qb.getMany();
  }

  /** Admin: duyệt hoặc từ chối yêu cầu nạp tiền */
  async processDepositRequest(
    requestId: string,
    dto: ProcessDepositRequestDto,
    processedBy: string,
  ) {
    const request = await this.depositRequestRepo.findOne({
      where: { id: requestId },
      relations: ['user'],
    });
    if (!request) throw new NotFoundException('Yêu cầu nạp tiền không tồn tại');
    if (request.status !== WalletDepositStatus.PENDING) {
      throw new BadRequestException('Yêu cầu này đã được xử lý');
    }

    request.adminNote = dto.adminNote ?? null;
    request.processedAt = new Date();
    request.processedBy = processedBy;
    request.status = dto.status as WalletDepositStatus;

    if (dto.status === 'APPROVED') {
      const user = await this.userRepo.findOne({
        where: { id: request.userId },
      });
      if (!user) throw new NotFoundException('User not found');
      const amountVnd =
        request.amountVnd != null ? Number(request.amountVnd) : null;
      
      if (request.method === 'USDT') {
        let requestedUsdt = request.requestedUsdt != null ? Number(request.requestedUsdt) : 0;
        if (requestedUsdt <= 0) {
          // Si no tiene requestedUsdt, usamos amount como fallback
          requestedUsdt = request.amount != null ? Number(request.amount) : 0;
          if (requestedUsdt <= 0) throw new BadRequestException('Số lượng USDT không hợp lệ');
        }
        // Calculamos los PV a acreditar dividiendo los USDT enviados por la tasa fija de 1.08
        const pvAmount = requestedUsdt / 1.08;
        const currentPvBalance = Number(user.pvWalletBalance ?? 0);
        await this.userRepo.update(request.userId, {
          pvWalletBalance: currentPvBalance + pvAmount,
        });
        request.amount = pvAmount;
      } else if (amountVnd != null && amountVnd > 0) {
        const banking = await this.bankingConfigRepo.findOne({
          where: { isEnabled: true },
        });
        const rate =
          banking?.usdtPriceVnd != null ? Number(banking.usdtPriceVnd) : 0;
        if (!rate || rate <= 0)
          throw new BadRequestException(
            'Chưa cấu hình tỉ giá USDT/VND tại Banking Settings',
          );
        const creditedUsdt = amountVnd / rate;
        const currentBalance = Number(user.walletBalance ?? 0);
        await this.userRepo.update(request.userId, {
          walletBalance: currentBalance + creditedUsdt,
        });
        request.amount = creditedUsdt;
      } else {
        const legacyAmount =
          request.amount != null ? Number(request.amount) : 0;
        if (legacyAmount <= 0)
          throw new BadRequestException('Yêu cầu không có số tiền VND');
        const currentBalance = Number(user.walletBalance ?? 0);
        await this.userRepo.update(request.userId, {
          walletBalance: currentBalance + legacyAmount,
        });
        request.amount = legacyAmount;
      }
    }

    await this.depositRequestRepo.save(request);
    return request;
  }

  async getMyBankAccounts(userId: string): Promise<UserBankAccount[]> {
    return this.userBankAccountRepo.find({
      where: { userId },
      order: { isDefault: 'DESC', createdAt: 'DESC' },
    });
  }

  async createBankAccount(userId: string, dto: CreateBankAccountDto) {
    if (dto.isDefault) {
      await this.userBankAccountRepo.update({ userId }, { isDefault: false });
    }
    const account = this.userBankAccountRepo.create({
      userId,
      bankName: dto.bankName.trim(),
      accountNumber: dto.accountNumber.trim(),
      accountName: dto.accountName.trim(),
      bankCode: dto.bankCode?.trim() || null,
      qrImageUrl: dto.qrImageUrl?.trim() || null,
      isDefault: Boolean(dto.isDefault),
    });
    const saved = await this.userBankAccountRepo.save(account);

    if (!dto.isDefault) {
      const count = await this.userBankAccountRepo.count({ where: { userId } });
      if (count === 1) {
        await this.userBankAccountRepo.update(saved.id, { isDefault: true });
      }
    }
    return this.userBankAccountRepo.findOne({ where: { id: saved.id } });
  }

  async updateBankAccount(
    userId: string,
    bankAccountId: string,
    dto: UpdateBankAccountDto,
  ) {
    const account = await this.userBankAccountRepo.findOne({
      where: { id: bankAccountId, userId },
    });
    if (!account) throw new NotFoundException('Bank account not found');

    if (dto.isDefault) {
      await this.userBankAccountRepo.update({ userId }, { isDefault: false });
    }

    Object.assign(account, {
      bankName: dto.bankName?.trim() ?? account.bankName,
      accountNumber: dto.accountNumber?.trim() ?? account.accountNumber,
      accountName: dto.accountName?.trim() ?? account.accountName,
      bankCode:
        dto.bankCode !== undefined
          ? dto.bankCode?.trim() || null
          : account.bankCode,
      qrImageUrl:
        dto.qrImageUrl !== undefined
          ? dto.qrImageUrl?.trim() || null
          : account.qrImageUrl,
      isDefault: dto.isDefault ?? account.isDefault,
    });

    return this.userBankAccountRepo.save(account);
  }

  async deleteBankAccount(userId: string, bankAccountId: string) {
    const account = await this.userBankAccountRepo.findOne({
      where: { id: bankAccountId, userId },
    });
    if (!account) throw new NotFoundException('Bank account not found');

    await this.userBankAccountRepo.delete({ id: bankAccountId, userId });
    if (account.isDefault) {
      const fallback = await this.userBankAccountRepo.findOne({
        where: { userId },
        order: { createdAt: 'ASC' },
      });
      if (fallback) {
        await this.userBankAccountRepo.update(fallback.id, { isDefault: true });
      }
    }
    return { success: true };
  }

  async createWithdrawRequest(userId: string, dto: CreateWithdrawRequestDto) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ['id', 'walletAddress', 'withdrawWalletBalance'],
    });
    if (!user) throw new NotFoundException('User not found');

    const amount = Number(dto.amount || 0);
    const banking = await this.bankingConfigRepo.findOne({
      where: { isEnabled: true },
    });
    const rate =
      banking?.usdtWithdrawPriceVnd != null &&
      Number(banking.usdtWithdrawPriceVnd) > 0
        ? Number(banking.usdtWithdrawPriceVnd)
        : 24000;
    const amountVnd = Math.round(amount * rate);

    if (!Number.isFinite(amount) || amountVnd < 500000) {
      throw new BadRequestException('Số tiền rút tối thiểu là 500.000 VND');
    }
    const currentBalance = Number(user.withdrawWalletBalance ?? 0);
    if (amount > currentBalance) {
      throw new BadRequestException('Insufficient withdraw wallet balance');
    }

    let usdtWalletAddress: string | null = null;
    let bankName: string | null = null;
    let bankAccountNumber: string | null = null;
    let bankAccountName: string | null = null;
    let bankQrImageUrl: string | null = null;

    if (dto.method === WalletWithdrawMethod.USDT) {
      const walletAddress = (user.walletAddress || '').trim();
      if (!walletAddress) {
        throw new BadRequestException(
          'MISSING_USDT_WALLET: Please configure your USDT wallet address first',
        );
      }
      usdtWalletAddress = walletAddress;
    } else if (dto.method === WalletWithdrawMethod.BANKING) {
      if (!dto.bankAccountId) {
        throw new BadRequestException('bankAccountId is required for BANKING');
      }
      const bankAccount = await this.userBankAccountRepo.findOne({
        where: { id: dto.bankAccountId, userId },
      });
      if (!bankAccount) {
        throw new NotFoundException('Bank account not found');
      }
      bankName = bankAccount.bankName;
      bankAccountNumber = bankAccount.accountNumber;
      bankAccountName = bankAccount.accountName;
      bankQrImageUrl = bankAccount.qrImageUrl || null;
    } else {
      throw new BadRequestException('Invalid withdraw method');
    }

    await this.userRepo.update(userId, {
      withdrawWalletBalance: currentBalance - amount,
    });

    const request = this.withdrawRequestRepo.create({
      userId,
      amount,
      rate,
      amountVnd,
      method: dto.method,
      usdtWalletAddress,
      bankName,
      bankAccountNumber,
      bankAccountName,
      bankQrImageUrl,
      note: dto.note?.trim() || null,
      status: WalletWithdrawStatus.PENDING,
    });
    const saved = await this.withdrawRequestRepo.save(request);
    this.notificationsGateway.server.emit('new-withdraw-request', {
      type: 'new-withdraw-request',
      request: {
        id: saved.id,
        userId: saved.userId,
        amount: saved.amount,
        method: saved.method,
        createdAt: saved.createdAt,
      },
      message: `New withdraw request #${saved.id.substring(0, 8)} received`,
    });
    return saved;
  }

  async getMyWithdrawRequests(
    userId: string,
    status?: WalletWithdrawStatus,
  ): Promise<WalletWithdrawRequest[]> {
    const qb = this.withdrawRequestRepo
      .createQueryBuilder('r')
      .where('r.userId = :userId', { userId })
      .orderBy('r.createdAt', 'DESC')
      .take(15);
    if (status) qb.andWhere('r.status = :status', { status });
    return qb.getMany();
  }

  async findAllWithdrawRequests(status?: WalletWithdrawStatus, q?: string) {
    const qb = this.withdrawRequestRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.user', 'user')
      .leftJoinAndSelect('user.kycRequests', 'kyc')
      .addSelect([
        'user.id',
        'user.username',
        'user.fullName',
        'user.email',
        'user.phone',
        'user.packageType',
      ])
      .orderBy('r.createdAt', 'DESC');
    if (status) qb.andWhere('r.status = :status', { status });
    if (q && q.trim()) {
      const keyword = `%${q.trim()}%`;
      qb.andWhere(
        `(r.id LIKE :keyword
          OR r.userId LIKE :keyword
          OR r.usdtWalletAddress LIKE :keyword
          OR r.bankAccountNumber LIKE :keyword
          OR r.bankAccountName LIKE :keyword
          OR user.username LIKE :keyword
          OR user.fullName LIKE :keyword
          OR user.email LIKE :keyword
          OR user.phone LIKE :keyword)`,
        { keyword },
      );
    }
    const list = await qb.getMany();
    return list.map((req) => {
      const kycList = Array.isArray(req.user?.kycRequests) ? req.user.kycRequests : [];
      const approvedKyc = kycList.find((k) => k.status === 'APPROVED');
      const latestKyc = approvedKyc || kycList[0] || null;

      return {
        ...req,
        kycInfo: latestKyc
          ? {
              id: latestKyc.id,
              documentType: latestKyc.documentType,
              documentNumber: latestKyc.documentNumber,
              frontImage: latestKyc.frontImage,
              backImage: latestKyc.backImage,
              bankName: latestKyc.bankName,
              bankAccountNumber: latestKyc.bankAccountNumber,
              bankAccountHolder: latestKyc.bankAccountHolder,
              status: latestKyc.status,
              createdAt: latestKyc.createdAt,
            }
          : null,
      };
    });
  }

  async processWithdrawRequest(
    requestId: string,
    dto: ProcessWithdrawRequestDto,
    processedBy: string,
  ) {
    const request = await this.withdrawRequestRepo.findOne({
      where: { id: requestId },
      relations: ['user'],
    });
    if (!request)
      throw new NotFoundException('Yêu cầu rút tiền không tồn tại');
    if (request.status !== WalletWithdrawStatus.PENDING) {
      throw new BadRequestException('Yêu cầu này đã được xử lý');
    }

    request.adminNote = dto.adminNote ?? null;
    request.processedAt = new Date();
    request.processedBy = processedBy;
    request.status = dto.status as WalletWithdrawStatus;

    if (dto.status === WalletWithdrawStatus.REJECTED) {
      const user = await this.userRepo.findOne({
        where: { id: request.userId },
        select: ['id', 'withdrawWalletBalance'],
      });
      if (user) {
        const current = Number(user.withdrawWalletBalance ?? 0);
        const refundAmount = this.toSafeNumber(request.amount);
        if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
          throw new BadRequestException('Số tiền rút không hợp lệ');
        }
        await this.userRepo.update(request.userId, {
          withdrawWalletBalance: current + refundAmount,
        });
      }
    } else if (dto.status === WalletWithdrawStatus.APPROVED) {
      const requestedAmount = this.toSafeNumber(request.amount);
      if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
        throw new BadRequestException('Số tiền rút không hợp lệ');
      }
      // Banking approve không có tx on-chain, nhưng vẫn cần actualAmount hợp lệ để lưu lịch sử.
      request.actualAmount = requestedAmount;
    }

    if (dto.status === WalletWithdrawStatus.APPROVED && request.method === WalletWithdrawMethod.USDT) {
      if (!request.usdtWalletAddress) {
         throw new BadRequestException('Bắt buộc phải có địa chỉ ví USDT để chuyển tiền');
      }

      try {
        const toAddress = this.web3Service.formatAddress(request.usdtWalletAddress);

        // Withdraw from COMMISSION_PAYOUT_CONTRACT_ADDRESS (contract treasury).
        const requestedAmount = this.toSafeNumber(request.amount);

        const result = await this.blockchainPayoutService.emergencyWithdraw(
          toAddress,
          requestedAmount.toString(),
        );
        request.txHash = result.txHash;

      } catch (error: any) {
        const reason =
          error?.shortMessage ||
          error?.reason ||
          error?.info?.error?.message ||
          error?.message ||
          'Unknown error';
        throw new BadRequestException(`Lỗi xuất quỹ USDT: ${reason}`);
      }
    }

    if (
      request.actualAmount !== null &&
      request.actualAmount !== undefined &&
      !Number.isFinite(Number(request.actualAmount))
    ) {
      throw new BadRequestException('Giá trị thực nhận không hợp lệ');
    }

    await this.withdrawRequestRepo.save(request);
    return request;
  }

  /**
   * Xác minh tính hợp pháp của request từ QuickNode Stream
   * @param rawBody Buffer chứa raw body của request
   * @param signature Chữ ký HMAC-SHA256 nhận từ header (x-qn-signature hoặc x-quicknode-signature)
   * @param nonce Giá trị nonce ngẫu nhiên từ header x-qn-nonce (tùy chọn)
   * @param timestamp Giá trị timestamp từ header x-qn-timestamp (tùy chọn)
   */
  verifyWebhookSignature(rawBody: Buffer, signature: string, nonce?: string, timestamp?: string): boolean {
    const webhookSecret = this.configService.get<string>('QUICKNODE_WEBHOOK_SECRET');
    if (!webhookSecret || !signature) {
      return false;
    }

    // Nếu không có nonce và timestamp (ví dụ trong kịch bản test_webhook.js), xác thực trực tiếp trên rawBody
    if (!nonce || !timestamp) {
      const hash = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');
      return hash === signature;
    }

    // Theo tài liệu QuickNode: Chữ ký được tạo bằng cách băm chuỗi ghép: nonce + timestamp + payload
    const hmacInput = Buffer.concat([
      Buffer.from(nonce, 'utf8'),
      Buffer.from(timestamp, 'utf8'),
      rawBody
    ]);

    const hash = crypto
      .createHmac('sha256', webhookSecret)
      .update(hmacInput)
      .digest('hex');

    return hash === signature;
  }

  /**
   * Xử lý danh sách log giao dịch gửi từ QuickNode Stream
   * Payload từ QuickNode Stream chứa mảng log các giao dịch chuyển USDT hợp lệ tới ví hệ thống
   */
  async processWebhookLogs(logs: any[]): Promise<any> {
    // Leemos la dirección receptora del monedero PV desde la configuración
    const systemReceiver = (this.configService.get<string>('SYSTEM_PV_RECEIVER_ADDRESS') || '').toLowerCase();
    const usdtContractAddress = (this.configService.get<string>('USDT_CONTRACT_ADDRESS') || '').toLowerCase();
    const usdtDecimals = Number(this.configService.get<any>('USDT_DECIMALS') || 18);

    if (!systemReceiver || !usdtContractAddress) {
      this.logger.error('Chưa cấu hình địa chỉ ví nhận PV hoặc địa chỉ contract USDT trong hệ thống');
      throw new Error('Chưa cấu hình địa chỉ ví nhận PV hoặc địa chỉ contract USDT trong hệ thống');
    }

    const processedLogs: any[] = [];

    for (const item of logs) {
      const { txHash, from, to, value, blockNumber } = item;

      // 1. Kiểm tra tính hợp lệ cơ bản của log giao dịch
      if (!txHash || !from || !to || value === undefined) {
        continue;
      }

      const formattedFrom = this.web3Service.formatAddress(from);
      const formattedTo = this.web3Service.formatAddress(to);

      // Đối chiếu ví nhận có phải ví hệ thống không
      if (formattedTo.toLowerCase() !== systemReceiver) {
        continue;
      }

      // Đổi value (hex hoặc bigint string) sang số thực dựa trên decimals của USDT
      let amount: number;
      try {
        const rawAmount = BigInt(value);
        amount = Number(ethers.formatUnits(rawAmount, usdtDecimals));
      } catch (e: any) {
        continue;
      }

      // 2. Phòng chống Double Spend / Replay Attack: Kiểm tra xem txHash này đã APPROVED chưa
      const existingApproved = await this.depositRequestRepo.findOne({
        where: { txHash, status: WalletDepositStatus.APPROVED }
      });
      if (existingApproved) {
        this.logger.warn(`Giao dịch ${txHash} đã được duyệt từ trước. Bỏ qua.`);
        continue;
      }

      let depositReq: WalletDepositRequest | null = null;
      let user: User | null = null;

      // Hướng xử lý A: Tìm đơn nạp PENDING khớp chính xác với txHash (user đã nhập txHash trên Web)
      // Buscamos todas las solicitudes pendientes que coincidan con el hash de transacción
      const txHashMatches = await this.depositRequestRepo.find({
        where: {
          txHash,
          status: WalletDepositStatus.PENDING,
          method: 'USDT',
        },
      });

      if (txHashMatches.length > 0) {
        // Explicación en español: Si existe una solicitud de depósito pendiente con el txHash recibido, no buscaremos otras solicitudes ni crearemos una nueva de forma automática.
        // Esto previene que una transacción fallida en cantidad sea acreditada bajo otra solicitud o cuenta.
        for (const req of txHashMatches) {
          const reqRequested = Number(req.requestedUsdt || 0);
          if (reqRequested > 0) {
            // Explicación en español: Si el usuario especificó la cantidad solicitada, el monto transferido debe ser exactamente igual.
            // Si no coincide, evitamos asociar esta solicitud para no procesarla automáticamente.
            if (Math.abs(amount - reqRequested) < 1e-6) {
              depositReq = req;
              break;
            }
          } else {
            // Explicación en español: Si el usuario no especificó la cantidad (es cero o nulo), se aprueba usando el monto real transferido.
            depositReq = req;
            break;
          }
        }

        if (depositReq) {
          user = await this.userRepo.findOne({ where: { id: depositReq.userId } });
        } else {
          this.logger.warn(`Giao dịch ${txHash} khớp txHash nhưng sai số tiền so với đơn nạp yêu cầu (thực nạp: ${amount}, yêu cầu: ${txHashMatches[0].requestedUsdt}). Bỏ qua tự động duyệt.`);
        }
      }

      // Hướng xử lý B: Nếu không tìm thấy theo txHash (và không có bất kỳ yêu cầu nào khớp txHash này), tìm đơn nạp PENDING khớp theo senderAddress
      if (!depositReq && txHashMatches.length === 0) {
        // Buscamos todas las solicitudes pendientes del mismo remitente para evaluar la coincidencia del monto
        const senderMatches = await this.depositRequestRepo.find({
          where: {
            senderAddress: formattedFrom,
            status: WalletDepositStatus.PENDING,
            method: 'USDT',
          },
          order: { createdAt: 'ASC' }, // Priorizamos las solicitudes más antiguas
        });

        // Primero, intentamos emparejar con una solicitud que tenga el mismo monto exacto
        for (const req of senderMatches) {
          // Explicación en español: Si la solicitud ya tiene un txHash registrado que no coincide, la saltamos para evitar conflictos con otras transacciones.
          if (req.txHash && req.txHash !== txHash) {
            continue;
          }
          const reqRequested = Number(req.requestedUsdt || 0);
          if (reqRequested > 0 && Math.abs(amount - reqRequested) < 1e-6) {
            depositReq = req;
            break;
          }
        }

        // Si no encontramos coincidencia por monto exacto, tomamos la primera solicitud que no tenga monto especificado
        if (!depositReq) {
          for (const req of senderMatches) {
            if (req.txHash && req.txHash !== txHash) {
              continue;
            }
            const reqRequested = Number(req.requestedUsdt || 0);
            if (reqRequested <= 0) {
              depositReq = req;
              break;
            }
          }
        }

        if (depositReq) {
          user = await this.userRepo.findOne({ where: { id: depositReq.userId } });
        }
      }

      // Hướng xử lý C: Nếu vẫn không thấy đơn nạp nào PENDING (và không có bất kỳ yêu cầu nào khớp txHash này), tìm user qua địa chỉ ví liên kết để tạo đơn tự động
      if (!depositReq && txHashMatches.length === 0) {
        user = await this.userRepo.findOne({ where: { walletAddress: formattedFrom } });
        if (user) {
          // Explicación en español: Si no hay ninguna solicitud pendiente del remitente ni del hash, y la billetera emisora
          // está vinculada a un usuario, creamos y aprobamos automáticamente una solicitud por el monto real depositado.
          depositReq = this.depositRequestRepo.create({
            userId: user.id,
            method: 'USDT',
            requestedUsdt: amount,
            senderAddress: formattedFrom,
            txHash,
            status: WalletDepositStatus.PENDING,
            transferNote: 'Tự động tạo từ giao dịch chuyển khoản trực tiếp qua ví liên kết.'
          });
          depositReq = await this.depositRequestRepo.save(depositReq);
        }
      }

      // Trường hợp D: Giao dịch không xác định được User (ví gửi chưa liên kết và không có đơn nạp khớp)
      if (!user || !depositReq) {
        this.logger.warn(`Nhận giao dịch nạp ${amount} USDT từ ví gửi lạ ${formattedFrom} (tx: ${txHash}). Không thể tự động cộng tiền.`);
        continue;
      }

      // 4. Cập nhật đơn nạp thành APPROVED và cộng số dư ví cho user
      // Calculamos la cantidad en PV aplicando la tasa de conversión 1 PV = 1.08 USDT
      const pvAmount = amount / 1.08;

      depositReq.status = WalletDepositStatus.APPROVED;
      depositReq.amount = pvAmount;
      depositReq.txHash = txHash;
      depositReq.processedAt = new Date();
      depositReq.processedBy = 'SYSTEM_QUICKNODE_WEBHOOK';
      depositReq.adminNote = `Duyệt tự động qua QuickNode Stream tại block #${blockNumber}`;

      await this.depositRequestRepo.save(depositReq);

      const currentPvBalance = Number(user.pvWalletBalance ?? 0);
      await this.userRepo.update(user.id, {
        pvWalletBalance: currentPvBalance + pvAmount
      });

      this.logger.log(`[DUYỆT TỰ ĐỘNG] Đã cộng ${pvAmount} PV cho user ${user.username} (id: ${user.id}) từ ví gửi ${formattedFrom}`);

      // Phát websocket cập nhật realtime cho client hiển thị đơn vị PV
      this.notificationsGateway.server?.emit(`deposit-status-changed-${user.id}`, {
        requestId: depositReq.id,
        status: depositReq.status,
        amount: depositReq.amount,
        message: `Nạp tiền thành công ${pvAmount} PV.`
      });

      processedLogs.push({
        txHash,
        username: user.username,
        amount: pvAmount,
        status: 'APPROVED'
      });
    }

    return { status: 'success', processedCount: processedLogs.length, details: processedLogs };
  }
}
