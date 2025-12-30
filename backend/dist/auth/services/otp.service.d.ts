export declare class OtpService {
    private otpStore;
    generateOtp(identifier: string): string;
    verifyOtp(identifier: string, code: string): boolean;
    sendOtp(identifier: string, code: string, type: 'phone' | 'email'): Promise<void>;
}
