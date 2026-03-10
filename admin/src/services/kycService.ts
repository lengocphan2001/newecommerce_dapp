import api from './api';

export interface Kyc {
  id: string;
  userId: string;
  documentType: string;
  documentNumber: string;
  frontImage?: string;
  backImage?: string;
  status: string;
  createdAt?: string;
}

export const kycService = {
  getStatus: (userId: string) => api.get(`/kyc/status/${userId}`),
  verify: (id: string, data: { approved: boolean; notes?: string }) => api.put(`/kyc/verify/${id}`, data),
  getAll: (params?: any) => api.get('/kyc', { params }),
  /** Export all KYC records to CSV (Excel-compatible). Returns blob for download. */
  exportToExcel: () =>
    api.get('/kyc/export', { responseType: 'blob' }),
};

