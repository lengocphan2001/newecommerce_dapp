import { Repository } from 'typeorm';
import { AuditLog, AuditLogAction, AuditLogEntityType } from './entities/audit-log.entity';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';
export declare class AuditLogService {
    private auditLogRepository;
    private readonly logger;
    constructor(auditLogRepository: Repository<AuditLog>);
    create(createAuditLogDto: CreateAuditLogDto, userId?: string, username?: string, ipAddress?: string, userAgent?: string): Promise<AuditLog>;
    findAll(query: {
        action?: AuditLogAction;
        entityType?: AuditLogEntityType;
        entityId?: string;
        userId?: string;
        startDate?: string;
        endDate?: string;
        page?: number;
        limit?: number;
        search?: string;
    }): Promise<{
        data: AuditLog[];
        total: number;
        page: number;
        limit: number;
    }>;
    findOne(id: string): Promise<AuditLog | null>;
    findByEntity(entityType: AuditLogEntityType, entityId: string): Promise<AuditLog[]>;
    findPayoutLogs(query: {
        batchId?: string;
        startDate?: string;
        endDate?: string;
        page?: number;
        limit?: number;
    }): Promise<{
        data: AuditLog[];
        total: number;
        page: number;
        limit: number;
    }>;
    getStatistics(startDate?: Date, endDate?: Date): Promise<{
        total: number;
        byAction: Record<string, number>;
        byEntityType: Record<string, number>;
        recentActions: AuditLog[];
    }>;
}
