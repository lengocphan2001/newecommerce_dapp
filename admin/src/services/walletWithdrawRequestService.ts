import api from './api';

export interface WalletWithdrawRequest {
  id: string;
  userId: string;
  amount: string | number;
  actualAmount?: string | number | null;
  rate?: string | number | null;
  amountVnd?: string | number | null;
  method: 'USDT' | 'BANKING';
  usdtWalletAddress?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountName?: string | null;
  bankQrImageUrl?: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  note?: string | null;
  adminNote?: string | null;
  processedAt?: string | null;
  processedBy?: string | null;
  createdAt: string;
  user?: {
    id: string;
    username?: string;
    fullName?: string;
    email?: string;
    phone?: string;
  };
}

export const walletWithdrawRequestService = {
  list: (status?: string, q?: string) =>
    api.get<WalletWithdrawRequest[]>('/admin/wallet/withdraw-requests', {
      params: {
        ...(status ? { status } : {}),
        ...(q ? { q } : {}),
      },
    }),
  exportToExcel: (status?: string, q?: string) =>
    api.get('/admin/wallet/withdraw-requests/export', {
      params: {
        ...(status ? { status } : {}),
        ...(q ? { q } : {}),
      },
      responseType: 'blob',
    }),
  process: (
    id: string,
    data: { status: 'APPROVED' | 'REJECTED'; adminNote?: string },
  ) => api.patch<WalletWithdrawRequest>(`/admin/wallet/withdraw-requests/${id}`, data),
};

