import { AuditLogService } from './audit-log.service';
import { CreateAuditLogDto } from './dto';
import { AuditLogAction, AuditLogEntityType } from './entities/audit-log.entity';
export declare class AuditLogController {
    private readonly auditLogService;
    constructor(auditLogService: AuditLogService);
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
        data: import("./entities/audit-log.entity").AuditLog[];
        total: number;
        page: number;
        limit: number;
    }>;
    getStatistics(startDate?: string, endDate?: string): Promise<{
        total: number;
        byAction: Record<string, number>;
        byEntityType: Record<string, number>;
        recentActions: import("./entities/audit-log.entity").AuditLog[];
    }>;
    getPayoutLogs(query: {
        batchId?: string;
        startDate?: string;
        endDate?: string;
        page?: number;
        limit?: number;
    }): Promise<{
        data: import("./entities/audit-log.entity").AuditLog[];
        total: number;
        page: number;
        limit: number;
    }>;
    findOne(id: string): Promise<import("./entities/audit-log.entity").AuditLog | null>;
    create(createAuditLogDto: CreateAuditLogDto): Promise<import("./entities/audit-log.entity").AuditLog>;
}
