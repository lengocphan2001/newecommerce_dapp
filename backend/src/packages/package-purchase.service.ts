import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PackagePurchase, PackagePurchaseStatus } from './entities/package-purchase.entity';
import { Package } from './entities/package.entity';
import { User } from '../user/entities/user.entity';
import { PackagesService } from './packages.service';

@Injectable()
export class PackagePurchaseService {
  constructor(
    @InjectRepository(PackagePurchase)
    private purchaseRepository: Repository<PackagePurchase>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private packagesService: PackagesService,
  ) {}

  async create(userId: string, packageId: string): Promise<PackagePurchase> {
    const pkg = await this.packagesService.findOne(packageId);
    if (!pkg || !pkg.isActive) {
      throw new BadRequestException('Package not found or inactive');
    }

    const purchase = this.purchaseRepository.create({
      userId,
      packageId: pkg.id,
      amount: Number(pkg.price),
      status: PackagePurchaseStatus.PENDING,
    });
    return this.purchaseRepository.save(purchase);
  }

  async findMyPurchases(userId: string): Promise<PackagePurchase[]> {
    return this.purchaseRepository.find({
      where: { userId },
      relations: ['package'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<PackagePurchase | null> {
    return this.purchaseRepository.findOne({
      where: { id },
      relations: ['package', 'user'],
    });
  }

  async findAllAdmin(status?: PackagePurchaseStatus): Promise<PackagePurchase[]> {
    const qb = this.purchaseRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.package', 'package')
      .leftJoinAndSelect('p.user', 'user')
      .orderBy('p.createdAt', 'DESC');

    if (status) {
      qb.andWhere('p.status = :status', { status });
    }
    return qb.getMany();
  }

  async confirm(id: string): Promise<PackagePurchase> {
    const purchase = await this.purchaseRepository.findOne({
      where: { id },
      relations: ['package', 'user'],
    });
    if (!purchase) {
      throw new NotFoundException('Purchase not found');
    }
    if (purchase.status !== PackagePurchaseStatus.PENDING) {
      throw new BadRequestException('Purchase is not pending');
    }

    const pkg = purchase.package;
    const user = purchase.user;

    await this.userRepository.update(user.id, {
      packageType: pkg.code,
      totalCommissionReceived: 0,
    });

    purchase.status = PackagePurchaseStatus.PAID;
    purchase.paidAt = new Date();
    await this.purchaseRepository.save(purchase);

    const updated = await this.purchaseRepository.findOne({
      where: { id },
      relations: ['package', 'user'],
    });
    return updated ?? purchase;
  }

  /** User confirms their own purchase with wallet transaction hash (after paying USDT). */
  async confirmPaymentByUser(userId: string, purchaseId: string, transactionHash: string): Promise<PackagePurchase> {
    const purchase = await this.purchaseRepository.findOne({
      where: { id: purchaseId },
      relations: ['package', 'user'],
    });
    if (!purchase) {
      throw new NotFoundException('Purchase not found');
    }
    if (purchase.userId !== userId) {
      throw new NotFoundException('Purchase not found');
    }
    if (purchase.status !== PackagePurchaseStatus.PENDING) {
      throw new BadRequestException('Purchase is not pending');
    }

    const pkg = purchase.package;
    const user = purchase.user;

    await this.userRepository.update(user.id, {
      packageType: pkg.code,
      totalCommissionReceived: 0,
    });

    purchase.status = PackagePurchaseStatus.PAID;
    purchase.paidAt = new Date();
    purchase.paymentReference = transactionHash;
    await this.purchaseRepository.save(purchase);

    const updated = await this.purchaseRepository.findOne({
      where: { id: purchaseId },
      relations: ['package', 'user'],
    });
    return updated ?? purchase;
  }

  /** Admin rejects/cancels a pending package purchase. */
  async reject(id: string): Promise<PackagePurchase> {
    const purchase = await this.purchaseRepository.findOne({
      where: { id },
      relations: ['package', 'user'],
    });
    if (!purchase) {
      throw new NotFoundException('Purchase not found');
    }
    if (purchase.status !== PackagePurchaseStatus.PENDING) {
      throw new BadRequestException('Only pending purchases can be rejected');
    }
    purchase.status = PackagePurchaseStatus.CANCELLED;
    await this.purchaseRepository.save(purchase);
    const updated = await this.purchaseRepository.findOne({
      where: { id },
      relations: ['package', 'user'],
    });
    return updated ?? purchase;
  }
}
