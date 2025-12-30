export declare class AuditLogService {
    findAll(query: any): Promise<{
        message: string;
    }>;
    findOne(id: string): Promise<{
        message: string;
    }>;
    create(createAuditLogDto: any): Promise<{
        message: string;
    }>;
}
