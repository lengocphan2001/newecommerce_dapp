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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AffiliateService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const commission_service_1 = require("./commission.service");
const user_entity_1 = require("../user/entities/user.entity");
let AffiliateService = class AffiliateService {
    commissionService;
    userRepository;
    constructor(commissionService, userRepository) {
        this.commissionService = commissionService;
        this.userRepository = userRepository;
    }
    async register(registerDto) {
        return { message: 'Affiliate registration handled during user registration' };
    }
    async getStats(userId) {
        return this.commissionService.getStats(userId);
    }
    async getCommissions(userId, query) {
        const type = query.type;
        const status = query.status;
        return this.commissionService.getCommissions(userId, { type, status });
    }
    async withdraw(withdrawDto) {
        return { message: 'Affiliate withdraw - to be implemented' };
    }
    async getAllStats() {
        const users = await this.userRepository.find({
            select: [
                'id',
                'email',
                'fullName',
                'username',
                'packageType',
                'totalPurchaseAmount',
                'totalCommissionReceived',
                'totalReconsumptionAmount',
                'leftBranchTotal',
                'rightBranchTotal',
                'referralUser',
                'parentId',
                'position',
                'createdAt',
            ],
            order: { createdAt: 'DESC' },
        });
        const statsPromises = users.map(async (user) => {
            const stats = await this.commissionService.getStats(user.id);
            return {
                userId: user.id,
                email: user.email,
                fullName: user.fullName,
                username: user.username,
                referralUser: user.referralUser,
                parentId: user.parentId,
                position: user.position,
                ...stats,
                createdAt: user.createdAt,
            };
        });
        return Promise.all(statsPromises);
    }
};
exports.AffiliateService = AffiliateService;
exports.AffiliateService = AffiliateService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [commission_service_1.CommissionService,
        typeorm_2.Repository])
], AffiliateService);
//# sourceMappingURL=affiliate.service.js.map