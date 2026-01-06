import { AffiliateService } from './affiliate.service';
import { RegisterAffiliateDto, WithdrawAffiliateDto, ApproveCommissionDto, ApproveSingleCommissionDto } from './dto';
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
    getAllCommissions(query: any): Promise<import("./entities/commission.entity").Commission[]>;
    getCommissionDetail(id: string): Promise<import("./entities/commission.entity").Commission>;
    approveCommission(id: string, approveDto: ApproveSingleCommissionDto): Promise<import("./entities/commission.entity").Commission>;
    approveCommissions(approveDto: ApproveCommissionDto): Promise<{
        approved: number;
        failed: number;
        errors: string[];
    }>;
}
