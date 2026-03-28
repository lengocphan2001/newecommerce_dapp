import api from './api';

export interface Commission {
  id: string;
  userId: string;
  user?: {
    id: string;
    username: string;
    email: string;
    fullName: string;
  };
  orderId: string;
  fromUserId?: string;
  fromUser?: {
    id: string;
    username?: string;
    email?: string;
    fullName?: string;
  };
  type: 'direct' | 'group' | 'management' | 'product' | 'milestone';
  status: 'pending' | 'paid' | 'blocked' | 'cancelled';
  amount: number | string;
  orderAmount: number | string;
  level?: number;
  side?: 'left' | 'right';
  notes?: string;
  createdAt: string;
  payoutTxHash?: string;
  payoutBatchId?: string;
  payoutDate?: string;
}

export const commissionService = {
  getAll: (params?: {
    status?: 'pending' | 'paid' | 'blocked' | 'cancelled';
    type?: 'direct' | 'group' | 'management' | 'product' | 'milestone';
    userId?: string;
  }) => api.get('/affiliate/admin/commissions', { params }),
  
  getById: (id: string) => api.get(`/affiliate/admin/commissions/${id}`),
  
  approve: (id: string, notes?: string) => 
    api.put(`/affiliate/admin/commissions/${id}/approve`, { notes }),
  
  approveBatch: (commissionIds: string[]) => 
    api.post('/affiliate/admin/commissions/approve-batch', { commissionIds }),

  cancel: (id: string, reason?: string) =>
    api.put(`/affiliate/admin/commissions/${id}/cancel`, { reason }),

  cancelBatch: (commissionIds: string[], reason?: string) =>
    api.post('/affiliate/admin/commissions/cancel-batch', { commissionIds, reason }),
};
