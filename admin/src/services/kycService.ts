import api from './api';

export interface Kyc {
  id: string;
  userId: string;
  documentType: string;
  documentNumber: string;
  frontImage?: string;
  backImage?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountHolder?: string;
  bankBranch?: string;
  status: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  user?: {
    id?: string;
    email?: string;
    fullName?: string;
    username?: string;
    phone?: string;
    country?: string;
    walletAddress?: string;
  };
}

export const kycService = {
  getStatus: (userId: string) => api.get(`/kyc/status/${userId}`),
  verify: (id: string, data: { approved: boolean; notes?: string }) => api.put(`/kyc/verify/${id}`, data),
  getAll: (params?: any) => api.get('/kyc', { params }),
  delete: (id: string) => api.delete(`/kyc/${id}`),
};

