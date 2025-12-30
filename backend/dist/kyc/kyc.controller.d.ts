import { KycService } from './kyc.service';
import { SubmitKycDto, VerifyKycDto } from './dto';
export declare class KycController {
    private readonly kycService;
    constructor(kycService: KycService);
    submitKyc(kycDto: SubmitKycDto): Promise<{
        message: string;
    }>;
    getKycStatus(userId: string): Promise<{
        message: string;
    }>;
    verifyKyc(id: string, verifyDto: VerifyKycDto): Promise<{
        message: string;
    }>;
}
