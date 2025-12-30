"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OtpService = void 0;
const common_1 = require("@nestjs/common");
let OtpService = class OtpService {
    otpStore = new Map();
    generateOtp(identifier) {
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = Date.now() + 5 * 60 * 1000;
        this.otpStore.set(identifier, { code, expiresAt });
        setTimeout(() => {
            this.otpStore.delete(identifier);
        }, 5 * 60 * 1000);
        return code;
    }
    verifyOtp(identifier, code) {
        const stored = this.otpStore.get(identifier);
        if (!stored) {
            return false;
        }
        if (Date.now() > stored.expiresAt) {
            this.otpStore.delete(identifier);
            return false;
        }
        if (stored.code !== code) {
            return false;
        }
        this.otpStore.delete(identifier);
        return true;
    }
    async sendOtp(identifier, code, type) {
        console.log(`OTP for ${identifier} (${type}): ${code}`);
    }
};
exports.OtpService = OtpService;
exports.OtpService = OtpService = __decorate([
    (0, common_1.Injectable)()
], OtpService);
//# sourceMappingURL=otp.service.js.map