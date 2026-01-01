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
exports.AffiliateController = void 0;
const common_1 = require("@nestjs/common");
const affiliate_service_1 = require("./affiliate.service");
const dto_1 = require("./dto");
const guards_1 = require("../common/guards");
let AffiliateController = class AffiliateController {
    affiliateService;
    constructor(affiliateService) {
        this.affiliateService = affiliateService;
    }
    async register(registerDto) {
        return this.affiliateService.register(registerDto);
    }
    async getAllStats(req) {
        if (!req.user.isAdmin) {
            throw new Error('Unauthorized: Only admin can view all affiliate stats');
        }
        return this.affiliateService.getAllStats();
    }
    async getStats(userId, req) {
        if (!req.user.isAdmin && userId !== (req.user.userId || req.user.sub)) {
            throw new Error('Unauthorized');
        }
        return this.affiliateService.getStats(userId);
    }
    async getCommissions(userId, query, req) {
        if (!req.user.isAdmin && userId !== (req.user.userId || req.user.sub)) {
            throw new Error('Unauthorized');
        }
        return this.affiliateService.getCommissions(userId, query);
    }
    async withdraw(withdrawDto, req) {
        const userId = req.user.userId || req.user.sub;
        return this.affiliateService.withdraw({ ...withdrawDto, userId });
    }
};
exports.AffiliateController = AffiliateController;
__decorate([
    (0, common_1.Post)('register'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.RegisterAffiliateDto]),
    __metadata("design:returntype", Promise)
], AffiliateController.prototype, "register", null);
__decorate([
    (0, common_1.Get)('all-stats'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AffiliateController.prototype, "getAllStats", null);
__decorate([
    (0, common_1.Get)('stats/:userId'),
    __param(0, (0, common_1.Param)('userId')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AffiliateController.prototype, "getStats", null);
__decorate([
    (0, common_1.Get)('commissions/:userId'),
    __param(0, (0, common_1.Param)('userId')),
    __param(1, (0, common_1.Query)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], AffiliateController.prototype, "getCommissions", null);
__decorate([
    (0, common_1.Post)('withdraw'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.WithdrawAffiliateDto, Object]),
    __metadata("design:returntype", Promise)
], AffiliateController.prototype, "withdraw", null);
exports.AffiliateController = AffiliateController = __decorate([
    (0, common_1.Controller)('affiliate'),
    (0, common_1.UseGuards)(guards_1.JwtAuthGuard),
    __metadata("design:paramtypes", [affiliate_service_1.AffiliateService])
], AffiliateController);
//# sourceMappingURL=affiliate.controller.js.map