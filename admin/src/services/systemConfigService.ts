import api from './api';

export interface SystemConfig {
    minPayoutThreshold: number;
    commissionDepositWalletPercent: number;
    commissionWithdrawWalletPercent: number;
}

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
