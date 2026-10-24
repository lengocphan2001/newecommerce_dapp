import api from './api';

export interface SystemConfig {
    minPayoutThreshold: number;
    indirectCommissionRateF2: number;
    commissionDepositWalletPercent: number;
    commissionWithdrawWalletPercent: number;
    depositWalletPaymentEnabled: boolean;
    pvWalletPaymentEnabled: boolean;
    withdrawWalletPaymentEnabled: boolean;
    userRewardHistoryVisible: boolean;
    userOrderHistoryVisible: boolean;
    userF1ListVisible: boolean;
    userSalesVisible: boolean;
    userNetworkStructureVisible: boolean;
}

export type WalletPaymentToggleKey =
    | 'depositWalletPaymentEnabled'
    | 'pvWalletPaymentEnabled'
    | 'withdrawWalletPaymentEnabled';

export type UserVisibilityToggleKey =
    | 'userRewardHistoryVisible'
    | 'userOrderHistoryVisible'
    | 'userF1ListVisible'
    | 'userSalesVisible'
    | 'userNetworkStructureVisible';

export const systemConfigService = {
    async get(): Promise<SystemConfig> {
        const response = await api.get('/admin/system-config');
        return response.data;
    },

    async update(data: Partial<SystemConfig>): Promise<SystemConfig> {
        const response = await api.patch('/admin/system-config', data);
        return response.data;
    },
};
