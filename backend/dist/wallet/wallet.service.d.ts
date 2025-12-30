export declare class WalletService {
    getBalance(userId: string): Promise<{
        message: string;
    }>;
    deposit(depositDto: any): Promise<{
        message: string;
    }>;
    withdraw(withdrawDto: any): Promise<{
        message: string;
    }>;
    getTransactions(userId: string, query: any): Promise<{
        message: string;
    }>;
}
