import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Kyc, KycStatus } from './entities/kyc.entity';
import { SubmitKycDto, VerifyKycDto } from './dto';

@Injectable()
export class KycService {
  constructor(
    @InjectRepository(Kyc)
    private kycRepository: Repository<Kyc>,
  ) {}

  private normalizeDocumentNumber(value: string): string {
    return String(value || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
  }

  async submitKyc(userId: string, kycDto: SubmitKycDto) {
    const normalizedDocumentNumber = this.normalizeDocumentNumber(
      kycDto.documentNumber,
    );
    if (!normalizedDocumentNumber) {
      throw new BadRequestException('Document number is required');
    }

    const existing = await this.kycRepository.findOne({
      where: { userId, status: KycStatus.PENDING },
    });

    if (existing) {
      throw new BadRequestException('You already have a pending KYC request');
    }



    const kyc = this.kycRepository.create({
      user: { id: userId },
      ...kycDto,
      documentNumber: normalizedDocumentNumber,
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
      relations: ['user'],
    });
  }

  /** Get all KYC records for export (with user relation for email, username, etc.) */
  async getAllForExport() {
    return this.kycRepository.find({
      order: { createdAt: 'DESC' },
      relations: ['user'],
    });
  }

  async deleteKycByUser(userId: string, id: string) {
    const kyc = await this.kycRepository.findOne({ where: { id, userId } });
    if (!kyc) {
      throw new NotFoundException('KYC request not found or unauthorized');
    }
    // Chỉ cho phép xóa nếu đang PENDING hoặc REJECTED (tùy theo logic)
    if (kyc.status === KycStatus.APPROVED) {
      throw new BadRequestException('Cannot delete an approved KYC request');
    }
    await this.kycRepository.remove(kyc);
    return { success: true, message: 'KYC request deleted successfully' };
  }

  async deleteKycByAdmin(id: string) {
    const kyc = await this.kycRepository.findOne({ where: { id } });
    if (!kyc) {
      throw new NotFoundException('KYC request not found');
    }
    await this.kycRepository.remove(kyc);
    return { success: true, message: 'KYC request deleted successfully' };
  }
}
