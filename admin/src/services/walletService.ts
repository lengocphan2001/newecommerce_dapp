import api from './api';

export interface Wallet {
  userId: string;
  balance: number;
  currency: string;
}

export interface Transaction {
  id: string;
  userId: string;
  type: string;
  amount: number;
  status: string;
  createdAt?: string;
}

export const walletService = {
  getBalance: (userId: string) => api.get(`/wallet/balance/${userId}`),
  getTransactions: (userId: string, params?: any) => api.get(`/wallet/transactions/${userId}`, { params }),
};

