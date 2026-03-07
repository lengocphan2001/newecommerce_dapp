import api from './api';

export type PackagePurchaseStatus = 'pending' | 'paid' | 'cancelled';

export interface PackagePurchase {
  id: string;
  userId: string;
  packageId: string;
  amount: number;
  status: PackagePurchaseStatus;
  paymentReference?: string;
  paidAt?: string;
  createdAt: string;
  package?: { id: string; name: string; code: string; price: number };
  user?: { id: string; fullName: string; email: string; username?: string };
}

export const packagePurchaseService = {
  async getAll(status?: PackagePurchaseStatus): Promise<PackagePurchase[]> {
    const params = status ? { status } : {};
    const res = await api.get('/package-purchases', { params });
    return Array.isArray(res.data) ? res.data : res.data?.data ?? [];
  },

  async confirm(id: string): Promise<PackagePurchase> {
    const res = await api.patch(`/package-purchases/${id}/confirm`);
    return res.data?.data ?? res.data;
  },

  async reject(id: string): Promise<PackagePurchase> {
    const res = await api.patch(`/package-purchases/${id}/reject`);
    return res.data?.data ?? res.data;
  },
};
