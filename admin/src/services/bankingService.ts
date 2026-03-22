import api from './api';

export interface BankingConfig {
    id?: number;
    bankName: string;
    accountNumber: string;
    accountName: string;
    /** VietQR Bank ID (6 digits, e.g. 970436). When set, checkout shows dynamic VietQR with amount and transfer content. */
    bankId?: string;
    qrImageUrl?: string;
    isEnabled: boolean;
    /** Admin-set USDT price in VND. When set, checkout / deposit conversion uses this instead of CoinGecko. */
    usdtPriceVnd?: number | null;
    /** USDT→VND for withdraw-wallet UI only (not used for checkout or deposit). */
    usdtWithdrawPriceVnd?: number | null;
    usdtEnabled?: boolean;
    usdtWalletAddress?: string;
    usdtNetwork?: string;
    usdtQrImageUrl?: string;
    updatedAt?: string;
}

const ADMIN_API = process.env.REACT_APP_API_URL || 'http://localhost:3002';

export const bankingService = {
    getConfig: () => api.get<BankingConfig>('/admin/banking-config'),
    updateConfig: (data: Partial<BankingConfig>) => api.put<BankingConfig>('/admin/banking-config', data),
};
