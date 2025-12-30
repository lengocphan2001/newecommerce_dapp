import { AffiliateService } from './affiliate.service';
import { RegisterAffiliateDto, WithdrawAffiliateDto } from './dto';
export declare class AffiliateController {
    private readonly affiliateService;
    constructor(affiliateService: AffiliateService);
    register(registerDto: RegisterAffiliateDto): Promise<{
        message: string;
    }>;
    getStats(userId: string): Promise<{
        message: string;
    }>;
    getCommissions(userId: string, query: any): Promise<{
        message: string;
    }>;
    withdraw(withdrawDto: WithdrawAffiliateDto): Promise<{
        message: string;
    }>;
}
