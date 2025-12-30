import { WalletService } from './wallet.service';
import { DepositDto, WithdrawDto } from './dto';
export declare class WalletController {
    private readonly walletService;
    constructor(walletService: WalletService);
    getBalance(userId: string): Promise<{
        message: string;
    }>;
    deposit(depositDto: DepositDto): Promise<{
        message: string;
    }>;
    withdraw(withdrawDto: WithdrawDto): Promise<{
        message: string;
    }>;
    getTransactions(userId: string, query: any): Promise<{
        message: string;
    }>;
}
