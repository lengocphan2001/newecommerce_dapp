import { AuditLogAction, AuditLogEntityType } from '../entities/audit-log.entity';
export declare class CreateAuditLogDto {
    action: AuditLogAction;
    entityType: AuditLogEntityType;
    entityId?: string;
    description?: string;
    metadata?: Record<string, any>;
}
