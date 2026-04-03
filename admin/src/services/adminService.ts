import api from './api';

export const adminService = {
  getDashboard: () => api.get('/admin/dashboard'),
  getUsers: (params?: any) => api.get('/admin/users', { params }),
  getUserDetail: (id: string) => api.get(`/admin/users/${id}/detail`),
  getOrders: (params?: any) => api.get('/admin/orders', { params }),
  updateUserStatus: (id: string, status: string) => api.put(`/admin/users/${id}/status`, { status }),
  updateUserFakeCommission: (id: string, fakeReceivedCommission: number) =>
    api.patch(`/admin/users/${id}/fake-commission`, { fakeReceivedCommission }),
  getFullTree: (userId: string, maxDepth?: number) => api.get(`/admin/tree/${userId}`, { params: { maxDepth } }),
  withdrawFromContract: (recipient: string, amount: string) => api.post('/admin/commission-payout/withdraw', { recipient, amount }),
  exportUsers: () => api.get('/admin/users/export', { responseType: 'blob' }),
  exportLoginCredentials: () =>
    api.post<{ csvContent: string; stats: { total: number; emailQueued: number; emailSkipped: number; emailEnabled: boolean } }>(
      '/admin/users/export-login-credentials',
    ),
  generatePasswordForUser: (id: string) =>
    api.post(`/admin/users/${id}/generate-password`),
  getBlockchainConfig: () => api.get('/admin/blockchain-config'),
  updateBlockchainConfig: (data: {
    blockchainPrivateKey?: string;
    privateKey?: string;
    tokenAddress?: string;
  }) => api.patch('/admin/blockchain-config', data),

  // Analytics
  getAnalyticsOverview: () => api.get('/analytics/overview'),
  getRevenueChart: (days?: number) => api.get('/analytics/revenue-chart', { params: { days } }),
  getOrderChart: (days?: number) => api.get('/analytics/order-chart', { params: { days } }),
  getUserGrowth: (days?: number) => api.get('/analytics/user-growth', { params: { days } }),
  getTopProducts: (limit?: number) => api.get('/analytics/top-products', { params: { limit } }),

  // Matrix reward pool (binary trees by level)
  getMatrixRewardConfig: () => api.get('/admin/matrix-reward/config'),
  updateMatrixRewardConfig: (data: {
    minOrderUsd?: number;
    perSlotUsd?: number;
    maxEarnPerTreeUsd?: number;
    maxUplines?: number;
    prevTreeQualifyPercent?: number;
    enabled?: boolean;
  }) => api.put('/admin/matrix-reward/config', data),
  getMatrixRewardLevels: () => api.get('/admin/matrix-reward/trees/levels'),
  getMatrixRewardTreeView: (level: number) =>
    api.get(`/admin/matrix-reward/trees/${level}/view`),
  prepareMatrixRewardTrees: (maxLevel: number) =>
    api.post('/admin/matrix-reward/trees/prepare', { maxLevel }),
  backfillMatrixRewardOrders: (data?: {
    maxOrders?: number;
    fromDate?: string;
    onlyUnprocessed?: boolean;
  }) => api.post('/admin/matrix-reward/orders/backfill', data || {}),
  getMatrixRewardLedgerHistory: (params?: {
    page?: number;
    limit?: number;
    userId?: string;
    orderId?: string;
    type?: 'all' | 'credit' | 'debit';
  }) => api.get('/admin/matrix-reward/ledger/history', { params }),
  reverseMatrixRewardByOrder: (data: {
    userId: string;
    orderId: string;
    reason?: string;
  }) => api.post('/admin/matrix-reward/reverse', data),
  reverseAllMatrixRewardOutstanding: () => api.post('/admin/matrix-reward/reverse-all'),
  setMatrixRewardTreeRoot: (level: number, userId: string) =>
    api.put(`/admin/matrix-reward/trees/${level}/root`, { userId }),
};

