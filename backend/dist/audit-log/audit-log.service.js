"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var AuditLogService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLogService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const audit_log_entity_1 = require("./entities/audit-log.entity");
let AuditLogService = AuditLogService_1 = class AuditLogService {
    auditLogRepository;
    logger = new common_1.Logger(AuditLogService_1.name);
    constructor(auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }
    async create(createAuditLogDto, userId, username, ipAddress, userAgent) {
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
        }
        catch (error) {
            this.logger.error('Failed to create audit log', error);
            throw error;
        }
    }
    async findAll(query) {
        const page = query.page ? parseInt(query.page.toString(), 10) : 1;
        const limit = query.limit ? parseInt(query.limit.toString(), 10) : 50;
        const skip = (page - 1) * limit;
        const where = {};
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
            where.createdAt = (0, typeorm_2.Between)(start, end);
        }
        const queryBuilder = this.auditLogRepository.createQueryBuilder('audit_log');
        if (Object.keys(where).length > 0) {
            queryBuilder.where(where);
        }
        if (query.search) {
            queryBuilder.andWhere('(audit_log.description LIKE :search OR audit_log.username LIKE :search)', { search: `%${query.search}%` });
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
    async findOne(id) {
        return await this.auditLogRepository.findOne({
            where: { id },
        });
    }
    async findByEntity(entityType, entityId) {
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
    async findPayoutLogs(query) {
        const where = {
            entityType: audit_log_entity_1.AuditLogEntityType.COMMISSION_PAYOUT,
        };
        if (query.batchId) {
            where.entityId = query.batchId;
        }
        if (query.startDate || query.endDate) {
            const start = query.startDate ? new Date(query.startDate) : new Date(0);
            const end = query.endDate ? new Date(query.endDate) : new Date();
            where.createdAt = (0, typeorm_2.Between)(start, end);
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
    async getStatistics(startDate, endDate) {
        const where = {};
        if (startDate || endDate) {
            where.createdAt = (0, typeorm_2.Between)(startDate || new Date(0), endDate || new Date());
        }
        const allLogs = await this.auditLogRepository.find({ where });
        const byAction = {};
        const byEntityType = {};
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
};
exports.AuditLogService = AuditLogService;
exports.AuditLogService = AuditLogService = AuditLogService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(audit_log_entity_1.AuditLog)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], AuditLogService);
//# sourceMappingURL=audit-log.service.js.map