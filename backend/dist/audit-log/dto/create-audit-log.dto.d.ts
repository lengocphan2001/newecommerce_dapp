export declare class CreateAuditLogDto {
    action: string;
    entityType: string;
    entityId?: string;
    metadata?: Record<string, any>;
}
