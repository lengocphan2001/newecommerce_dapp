import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Kyc, KycStatus } from './entities/kyc.entity';
import { SubmitKycDto, VerifyKycDto } from './dto';

@Injectable()
export class KycService {
  constructor(
    @InjectRepository(Kyc)
    private kycRepository: Repository<Kyc>,
  ) { }

  async submitKyc(userId: string, kycDto: SubmitKycDto) {
    const existing = await this.kycRepository.findOne({
      where: { userId, status: KycStatus.PENDING },
    });

    if (existing) {
      throw new BadRequestException('You already have a pending KYC request');
    }

    const kyc = this.kycRepository.create({
      user: { id: userId },
      ...kycDto,
    });
    return this.kycRepository.save(kyc);
  }

  async getKycStatus(userId: string) {
    const kyc = await this.kycRepository.findOne({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    if (!kyc) {
      return { status: 'UNVERIFIED' };
    }
    return kyc;
  }

  async verifyKyc(id: string, verifyDto: VerifyKycDto) {
    const kyc = await this.kycRepository.findOne({ where: { id } });
    if (!kyc) {
      throw new NotFoundException('KYC request not found');
    }

    kyc.status = verifyDto.approved ? KycStatus.APPROVED : KycStatus.REJECTED;
    kyc.notes = verifyDto.notes ?? '';
    return this.kycRepository.save(kyc);
  }

  async getAll(params?: any) {
    return this.kycRepository.find({
      order: { createdAt: 'DESC' },
      relations: ['user']
    });
  }
}
