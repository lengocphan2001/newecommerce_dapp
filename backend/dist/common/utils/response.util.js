"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResponseUtil = void 0;
class ResponseUtil {
    static success(data, message = 'Success') {
        return {
            success: true,
            message,
            data,
        };
    }
    static error(message, errors) {
        return {
            success: false,
            message,
            errors,
        };
    }
}
exports.ResponseUtil = ResponseUtil;
//# sourceMappingURL=response.util.js.map