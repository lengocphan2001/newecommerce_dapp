import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Between, Like } from 'typeorm';
import { AuditLog, AuditLogAction, AuditLogEntityType } from './entities/audit-log.entity';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
  ) {}

  /**
   * Create audit log entry
   */
  async create(
    createAuditLogDto: CreateAuditLogDto,
    userId?: string,
    username?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuditLog> {
    try {
      const auditLog = this.auditLogRepository.create({
        action: createAuditLogDto.action,
        entityType: createAuditLogDto.entityType,
        entityId: createAuditLogDto.entityId,
        description: createAuditLogDto.description,
        metadata: createAuditLogDto.metadata,
        userId,
        username,
        ipAddress,
        userAgent,
      });

      const saved = await this.auditLogRepository.save(auditLog);
      this.logger.debug(`Audit log created: ${saved.id} - ${saved.action}`);
      return saved;
    } catch (error) {
      this.logger.error('Failed to create audit log', error);
      throw error;
    }
  }

  /**
   * Find all audit logs with filters
   */
  async findAll(query: {
    action?: AuditLogAction;
    entityType?: AuditLogEntityType;
    entityId?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<{ data: AuditLog[]; total: number; page: number; limit: number }> {
    const page = query.page ? parseInt(query.page.toString(), 10) : 1;
    const limit = query.limit ? parseInt(query.limit.toString(), 10) : 50;
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<AuditLog> = {};

    if (query.action) {
      where.action = query.action;
    }

    if (query.entityType) {
      where.entityType = query.entityType;
    }

    if (query.entityId) {
      where.entityId = query.entityId;
    }

    if (query.userId) {
      where.userId = query.userId;
    }

    if (query.startDate || query.endDate) {
      const start = query.startDate ? new Date(query.startDate) : new Date(0);
      const end = query.endDate ? new Date(query.endDate) : new Date();
      where.createdAt = Between(start, end);
    }

    const queryBuilder = this.auditLogRepository.createQueryBuilder('audit_log');

    if (Object.keys(where).length > 0) {
      queryBuilder.where(where);
    }

    if (query.search) {
      queryBuilder.andWhere(
        '(audit_log.description LIKE :search OR audit_log.username LIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    queryBuilder
      .orderBy('audit_log.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
    };
  }

  /**
   * Find one audit log by ID
   */
  async findOne(id: string): Promise<AuditLog | null> {
    return await this.auditLogRepository.findOne({
      where: { id },
    });
  }

  /**
   * Find audit logs by entity
   */
  async findByEntity(
    entityType: AuditLogEntityType,
    entityId: string,
  ): Promise<AuditLog[]> {
    return await this.auditLogRepository.find({
      where: {
        entityType,
        entityId,
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  /**
   * Find payout audit logs
   */
  async findPayoutLogs(query: {
    batchId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: AuditLog[]; total: number; page: number; limit: number }> {
    const where: FindOptionsWhere<AuditLog> = {
      entityType: AuditLogEntityType.COMMISSION_PAYOUT,
    };

    if (query.batchId) {
      where.entityId = query.batchId;
    }

    if (query.startDate || query.endDate) {
      const start = query.startDate ? new Date(query.startDate) : new Date(0);
      const end = query.endDate ? new Date(query.endDate) : new Date();
      where.createdAt = Between(start, end);
    }

    const page = query.page ? parseInt(query.page.toString(), 10) : 1;
    const limit = query.limit ? parseInt(query.limit.toString(), 10) : 50;
    const skip = (page - 1) * limit;

    const [data, total] = await this.auditLogRepository.findAndCount({
      where,
      order: {
        createdAt: 'DESC',
      },
      skip,
      take: limit,
    });

    return {
      data,
      total,
      page,
      limit,
    };
  }

  /**
   * Get audit log statistics
   */
  async getStatistics(startDate?: Date, endDate?: Date): Promise<{
    total: number;
    byAction: Record<string, number>;
    byEntityType: Record<string, number>;
    recentActions: AuditLog[];
  }> {
    const where: FindOptionsWhere<AuditLog> = {};

    if (startDate || endDate) {
      where.createdAt = Between(
        startDate || new Date(0),
        endDate || new Date(),
      );
    }

    const allLogs = await this.auditLogRepository.find({ where });

    const byAction: Record<string, number> = {};
    const byEntityType: Record<string, number> = {};

    allLogs.forEach((log) => {
      byAction[log.action] = (byAction[log.action] || 0) + 1;
      byEntityType[log.entityType] = (byEntityType[log.entityType] || 0) + 1;
    });

    const recentActions = await this.auditLogRepository.find({
      where,
      order: {
        createdAt: 'DESC',
      },
      take: 10,
    });

    return {
      total: allLogs.length,
      byAction,
      byEntityType,
      recentActions,
    };
  }
}
