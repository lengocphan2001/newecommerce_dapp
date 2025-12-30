export declare class KycService {
    submitKyc(kycDto: any): Promise<{
        message: string;
    }>;
    getKycStatus(userId: string): Promise<{
        message: string;
    }>;
    verifyKyc(id: string, verifyDto: any): Promise<{
        message: string;
    }>;
}
