import { Repository } from 'typeorm';
import { CommissionService } from './commission.service';
import { User } from '../user/entities/user.entity';
export declare class AffiliateService {
    private readonly commissionService;
    private userRepository;
    constructor(commissionService: CommissionService, userRepository: Repository<User>);
    register(registerDto: any): Promise<{
        message: string;
    }>;
    getStats(userId: string): Promise<any>;
    getCommissions(userId: string, query: any): Promise<import("./entities/commission.entity").Commission[]>;
    withdraw(withdrawDto: any): Promise<{
        message: string;
    }>;
    getAllStats(): Promise<any[]>;
    getAllCommissions(query: any): Promise<import("./entities/commission.entity").Commission[]>;
    approveCommission(commissionId: string, notes?: string): Promise<import("./entities/commission.entity").Commission>;
    approveCommissions(commissionIds: string[]): Promise<{
        approved: number;
        failed: number;
        errors: string[];
    }>;
    getCommissionDetail(commissionId: string): Promise<import("./entities/commission.entity").Commission>;
}
