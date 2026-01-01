import { AffiliateService } from './affiliate.service';
import { RegisterAffiliateDto, WithdrawAffiliateDto } from './dto';
export declare class AffiliateController {
    private readonly affiliateService;
    constructor(affiliateService: AffiliateService);
    register(registerDto: RegisterAffiliateDto): Promise<{
        message: string;
    }>;
    getAllStats(req: any): Promise<any[]>;
    getStats(userId: string, req: any): Promise<any>;
    getCommissions(userId: string, query: any, req: any): Promise<import("./entities/commission.entity").Commission[]>;
    withdraw(withdrawDto: WithdrawAffiliateDto, req: any): Promise<{
        message: string;
    }>;
}
