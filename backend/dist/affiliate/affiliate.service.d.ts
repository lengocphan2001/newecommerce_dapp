export declare class AffiliateService {
    register(registerDto: any): Promise<{
        message: string;
    }>;
    getStats(userId: string): Promise<{
        message: string;
    }>;
    getCommissions(userId: string, query: any): Promise<{
        message: string;
    }>;
    withdraw(withdrawDto: any): Promise<{
        message: string;
    }>;
}
