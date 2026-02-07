import api from './api';

export const adminService = {
  getDashboard: () => api.get('/admin/dashboard'),
  getUsers: (params?: any) => api.get('/admin/users', { params }),
  getUserDetail: (id: string) => api.get(`/admin/users/${id}/detail`),
  getOrders: (params?: any) => api.get('/admin/orders', { params }),
  updateUserStatus: (id: string, status: string) => api.put(`/admin/users/${id}/status`, { status }),
  getFullTree: (userId: string, maxDepth?: number) => api.get(`/admin/tree/${userId}`, { params: { maxDepth } }),
  withdrawFromContract: (recipient: string, amount: string) => api.post('/admin/commission-payout/withdraw', { recipient, amount }),

  // Analytics
  getAnalyticsOverview: () => api.get('/analytics/overview'),
  getRevenueChart: (days?: number) => api.get('/analytics/revenue-chart', { params: { days } }),
  getOrderChart: (days?: number) => api.get('/analytics/order-chart', { params: { days } }),
  getUserGrowth: (days?: number) => api.get('/analytics/user-growth', { params: { days } }),
  getTopProducts: (limit?: number) => api.get('/analytics/top-products', { params: { limit } }),
};

