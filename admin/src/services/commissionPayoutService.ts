import api from './api';

export interface PayoutStats {
  pending: {
    count: number;
    totalAmount: number;
  };
  paid: {
    count: number;
  };
  blocked: {
    count: number;
  };
  contractBalance: number;
}

export interface PendingCommission {
  id: string;
  userId: string;
  user: {
    id: string;
    walletAddress: string;
    username?: string;
    fullName?: string;
    email?: string;
  };
  orderId: string;
  type: 'DIRECT' | 'GROUP' | 'MANAGEMENT';
  status: 'PENDING' | 'PAID' | 'BLOCKED';
  amount: number;
  orderAmount: number;
  createdAt: string;
}

export interface PayoutRecipient {
  userId: string;
  walletAddress: string;
  amount: string;
}

export interface BatchPayoutRequest {
  recipients: PayoutRecipient[];
  batchId?: string;
}

export interface BatchPayoutResponse {
  batchId: string;
  txHash: string;
  success: boolean;
  recipients: string[];
  amounts: string[];
  timestamp: string;
}

export interface AutoPayoutResponse {
  batchId: string;
  txHash: string;
  count: number;
}

export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId?: string;
  description: string;
  metadata?: any;
  userId?: string;
  username?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export const commissionPayoutService = {
  // Get payout statistics
  getStats: (): Promise<{ data: PayoutStats }> => {
    return api.get('/admin/commission-payout/stats');
  },

  // Get pending commissions
  // Backend returns array directly, API interceptor unwraps it
  getPending: async (params?: { limit?: number; minAmount?: number }): Promise<{ data: PendingCommission[] }> => {
    const response = await api.get('/admin/commission-payout/pending', { params });
    // API interceptor already unwraps, so response.data is the array
    // But we need to ensure it's wrapped in { data: ... } for consistency
    return {
      data: Array.isArray(response.data) ? response.data : (response.data?.data || [])
    };
  },

  // Execute batch payout manually
  executeBatch: (data: BatchPayoutRequest): Promise<{ data: BatchPayoutResponse }> => {
    return api.post('/admin/commission-payout/execute', data);
  },

  // Auto payout
  autoPayout: (params?: { batchSize?: number; minAmount?: number }): Promise<{ data: AutoPayoutResponse }> => {
    return api.post('/admin/commission-payout/auto-payout', {}, { params });
  },

  // Get audit logs
  getAuditLogs: (params?: {
    batchId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: AuditLog[]; total?: number; page?: number; limit?: number }> => {
    return api.get('/admin/commission-payout/audit-logs', { params });
  },
};
