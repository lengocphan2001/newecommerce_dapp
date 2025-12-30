import { AuditLogService } from './audit-log.service';
import { CreateAuditLogDto } from './dto';
export declare class AuditLogController {
    private readonly auditLogService;
    constructor(auditLogService: AuditLogService);
    findAll(query: any): Promise<{
        message: string;
    }>;
    findOne(id: string): Promise<{
        message: string;
    }>;
    create(createAuditLogDto: CreateAuditLogDto): Promise<{
        message: string;
    }>;
}
