import api from './api';

export interface FakeAnalyticsDashboardConfig {
  overview: {
    totalRevenue: number;
    totalOrders: number;
    totalUsers: number;
    totalProducts: number;
  };
  series: {
    revenue: { date: string; revenue: number }[];
    orders: { date: string; count: number }[];
    users: { date: string; count: number }[];
  };
  topProducts: { name: string; quantity: number; revenue: number }[];
}

export const fakeAnalyticsService = {
  get: async (): Promise<FakeAnalyticsDashboardConfig> => {
    const { data } = await api.get<FakeAnalyticsDashboardConfig>('/admin/fake-analytics');
    return data;
  },

  getDefaultTemplate: async (): Promise<FakeAnalyticsDashboardConfig> => {
    const { data } = await api.get<FakeAnalyticsDashboardConfig>('/admin/fake-analytics/default');
    return data;
  },

  save: async (payload: FakeAnalyticsDashboardConfig): Promise<FakeAnalyticsDashboardConfig> => {
    const { data } = await api.put<FakeAnalyticsDashboardConfig>('/admin/fake-analytics', payload);
    return data;
  },
};
