import api from './api';

export interface Affiliate {
  id: string;
  userId: string;
  referralCode: string;
  totalCommissions: number;
  status: string;
}

export const affiliateService = {
  getStats: (userId: string) => api.get(`/affiliate/stats/${userId}`),
  getCommissions: (userId: string, params?: any) => api.get(`/affiliate/commissions/${userId}`, { params }),
};

