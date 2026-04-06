import api from './api';

export interface WalletDepositRequest {
  id: string;
  userId: string;
  amountVnd: string | number | null;
  amount: string | number | null;
  method: 'BANKING' | 'USDT';
  requestedUsdt: string | number | null;
  txHash: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  proofImageUrl?: string;
  transferNote?: string;
  adminNote?: string;
  processedAt?: string;
  processedBy?: string;
  createdAt: string;
  user?: {
    id: string;
    username?: string;
    fullName?: string;
    email?: string;
    phone?: string;
  };
}

export const walletDepositRequestService = {
  list: (status?: string) => api.get<WalletDepositRequest[]>('/admin/wallet/deposit-requests', { params: status ? { status } : {} }),
  process: (id: string, data: { status: 'APPROVED' | 'REJECTED'; adminNote?: string }) =>
    api.patch<WalletDepositRequest>(`/admin/wallet/deposit-requests/${id}`, data),
};
