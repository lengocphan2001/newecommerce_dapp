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
  type: 'direct' | 'group' | 'management';
  status: 'pending' | 'paid' | 'blocked';
  amount: number | string;
  orderAmount: number | string;
  level?: number;
  side?: 'left' | 'right';
  notes?: string;
  createdAt: string;
}

export const commissionService = {
  getAll: (params?: {
    status?: 'pending' | 'paid' | 'blocked';
    type?: 'direct' | 'group' | 'management';
    userId?: string;
  }) => api.get('/affiliate/admin/commissions', { params }),
  
  getById: (id: string) => api.get(`/affiliate/admin/commissions/${id}`),
  
  approve: (id: string, notes?: string) => 
    api.put(`/affiliate/admin/commissions/${id}/approve`, { notes }),
  
  approveBatch: (commissionIds: string[]) => 
    api.post('/affiliate/admin/commissions/approve-batch', { commissionIds }),
};
