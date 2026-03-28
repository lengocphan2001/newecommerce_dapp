import api from './api';

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  username?: string;
  country?: string;
  address?: string;
  walletAddress?: string;
  chainId?: string;
  avatar?: string;
  referralUser?: string;
  referralUserId?: string | null;
  parentId?: string | null;
  position?: 'left' | 'right' | null;
  packageType?: string;
  status?: string;
  isAdmin?: boolean;
  emailVerified?: boolean;
  totalPurchaseAmount?: number;
  totalCommissionReceived?: number;
  fakeReceivedCommission?: number;
  totalReconsumptionAmount?: number;
  leftBranchTotal?: number;
  rightBranchTotal?: number;
  walletBalance?: number;
  withdrawWalletBalance?: number;
  createdAt?: string;
}

/** Payload PUT /users/:id (admin) — các field tùy chọn */
export type AdminUserUpdatePayload = Partial<
  Omit<User, 'id' | 'createdAt'> & { password?: string }
>;

export const userService = {
  getAll: (search?: string) => api.get('/users', { params: { search } }),
  getById: (id: string) => api.get(`/users/${id}`),
  create: (data: Partial<User>) => api.post('/users', data),
  update: (id: string, data: AdminUserUpdatePayload) =>
    api.put(`/users/${id}`, data),
  delete: (id: string) => api.delete(`/users/${id}`),
};
