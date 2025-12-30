import api from './api';

export interface Kyc {
  id: string;
  userId: string;
  documentType: string;
  documentNumber: string;
  status: string;
  createdAt?: string;
}

export const kycService = {
  getStatus: (userId: string) => api.get(`/kyc/status/${userId}`),
  verify: (id: string, data: { approved: boolean; notes?: string }) => api.put(`/kyc/verify/${id}`, data),
  getAll: (params?: any) => api.get('/kyc', { params }),
};

