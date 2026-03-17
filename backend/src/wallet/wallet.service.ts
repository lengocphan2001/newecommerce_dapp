import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WalletDepositRequest, WalletDepositStatus } from './entities/wallet-deposit-request.entity';
import { User } from '../user/entities/user.entity';
import { BankingConfig } from '../admin/entities/banking-config.entity';
import { CreateDepositRequestDto } from './dto/create-deposit-request.dto';
import { ProcessDepositRequestDto } from './dto/process-deposit-request.dto';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(WalletDepositRequest)
    private readonly depositRequestRepo: Repository<WalletDepositRequest>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(BankingConfig)
    private readonly bankingConfigRepo: Repository<BankingConfig>,
  ) {}

  /** Số dư ví nạp tiền của user */
  async getBalance(userId: string): Promise<{ balance: number }> {
    const user = await this.userRepo.findOne({ where: { id: userId }, select: ['id', 'walletBalance'] });
    if (!user) throw new NotFoundException('User not found');
    const balance = Number(user.walletBalance ?? 0);
    return { balance };
  }

  /** User tạo yêu cầu nạp tiền (số tiền VND đã chuyển). Admin duyệt sẽ dùng tỉ giá Banking Settings để cộng USDT. */
  async createDepositRequest(userId: string, dto: CreateDepositRequestDto) {
    const request = this.depositRequestRepo.create({
      userId,
      amountVnd: dto.amountVnd,
      amount: null,
      status: WalletDepositStatus.PENDING,
      proofImageUrl: dto.proofImageUrl,
      transferNote: dto.transferNote,
    });
    return this.depositRequestRepo.save(request);
  }

  /** User xem danh sách yêu cầu nạp tiền của mình */
  async getMyDepositRequests(userId: string, status?: WalletDepositStatus) {
    const qb = this.depositRequestRepo
      .createQueryBuilder('r')
      .where('r.userId = :userId', { userId })
      .orderBy('r.createdAt', 'DESC');
    if (status) qb.andWhere('r.status = :status', { status });
    return qb.getMany();
  }

  /** Admin: danh sách yêu cầu nạp tiền (lọc theo status) */
  async findAllDepositRequests(status?: WalletDepositStatus) {
    const qb = this.depositRequestRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.user', 'user')
      .addSelect(['user.id', 'user.username', 'user.fullName', 'user.email', 'user.phone'])
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
      const user = await this.userRepo.findOne({ where: { id: request.userId } });
      if (!user) throw new NotFoundException('User not found');
      const amountVnd = request.amountVnd != null ? Number(request.amountVnd) : null;
      let creditedUsdt: number;
      if (amountVnd != null && amountVnd > 0) {
        const banking = await this.bankingConfigRepo.findOne({ where: { isEnabled: true } });
        const rate = banking?.usdtPriceVnd != null ? Number(banking.usdtPriceVnd) : 0;
        if (!rate || rate <= 0) throw new BadRequestException('Chưa cấu hình tỉ giá USDT/VND tại Banking Settings');
        creditedUsdt = amountVnd / rate;
      } else {
        const legacyAmount = request.amount != null ? Number(request.amount) : 0;
        if (legacyAmount <= 0) throw new BadRequestException('Yêu cầu không có số tiền VND');
        creditedUsdt = legacyAmount;
      }
      const currentBalance = Number(user.walletBalance ?? 0);
      await this.userRepo.update(request.userId, {
        walletBalance: currentBalance + creditedUsdt,
      });
      request.amount = creditedUsdt;
    }

    await this.depositRequestRepo.save(request);
    return request;
  }
}
