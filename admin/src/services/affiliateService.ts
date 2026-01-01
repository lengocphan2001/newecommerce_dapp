import api from './api';

export interface Affiliate {
  userId: string;
  email: string;
  fullName: string;
  username?: string;
  referralUser?: string;
  parentId?: string;
  position?: 'left' | 'right';
  packageType: 'NONE' | 'CTV' | 'NPP';
  totalPurchaseAmount: number;
  totalCommissionReceived: number;
  totalReconsumptionAmount: number;
  leftBranchTotal: number;
  rightBranchTotal: number;
  commissions: {
    direct: number;
    group: number;
    management: number;
  };
  pending: number;
  paid: number;
  createdAt?: string;
}

export const affiliateService = {
  getAllStats: () => api.get('/affiliate/all-stats'),
  getStats: (userId: string) => api.get(`/affiliate/stats/${userId}`),
  getCommissions: (userId: string, params?: any) => api.get(`/affiliate/commissions/${userId}`, { params }),
};

