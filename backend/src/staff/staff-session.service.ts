import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { StaffSession } from './entities/staff-session.entity';

@Injectable()
export class StaffSessionService {
  constructor(
    @InjectRepository(StaffSession)
    private sessionRepository: Repository<StaffSession>,
  ) {}

  async createSession(
    staffId: string,
    token: string,
    expiresAt: Date,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<StaffSession> {
    const session = this.sessionRepository.create({
      staffId,
      token,
      expiresAt,
      ipAddress,
      userAgent,
      lastActivityAt: new Date(),
      isActive: true,
    });

    return this.sessionRepository.save(session);
  }

  async findActiveSessionByToken(token: string): Promise<StaffSession | null> {
    return this.sessionRepository.findOne({
      where: {
        token,
        isActive: true,
        expiresAt: LessThan(new Date()),
      },
      relations: ['staff'],
    });
  }

  async updateLastActivity(sessionId: string): Promise<void> {
    await this.sessionRepository.update(sessionId, {
      lastActivityAt: new Date(),
    });
  }

  async deactivateSession(sessionId: string): Promise<void> {
    await this.sessionRepository.update(sessionId, {
      isActive: false,
    });
  }

  async deactivateAllSessions(staffId: string): Promise<void> {
    await this.sessionRepository.update(
      { staffId, isActive: true },
      { isActive: false },
    );
  }

  async deactivateExpiredSessions(): Promise<void> {
    await this.sessionRepository.update(
      {
        isActive: true,
        expiresAt: LessThan(new Date()),
      },
      { isActive: false },
    );
  }

  async getActiveSessions(staffId: string): Promise<StaffSession[]> {
    return this.sessionRepository.find({
      where: {
        staffId,
        isActive: true,
      },
      order: { lastActivityAt: 'DESC' },
    });
  }
}
