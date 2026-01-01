"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AffiliateModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const affiliate_controller_1 = require("./affiliate.controller");
const affiliate_service_1 = require("./affiliate.service");
const commission_service_1 = require("./commission.service");
const commission_entity_1 = require("./entities/commission.entity");
const user_entity_1 = require("../user/entities/user.entity");
const order_entity_1 = require("../order/entities/order.entity");
let AffiliateModule = class AffiliateModule {
};
exports.AffiliateModule = AffiliateModule;
exports.AffiliateModule = AffiliateModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([commission_entity_1.Commission, user_entity_1.User, order_entity_1.Order])],
        controllers: [affiliate_controller_1.AffiliateController],
        providers: [affiliate_service_1.AffiliateService, commission_service_1.CommissionService],
        exports: [affiliate_service_1.AffiliateService, commission_service_1.CommissionService],
    })
], AffiliateModule);
//# sourceMappingURL=affiliate.module.js.map