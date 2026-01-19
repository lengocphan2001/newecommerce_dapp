import api from './api';

export interface Staff {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  avatar?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  isSuperAdmin: boolean;
  roles?: Role[];
  createdBy?: Staff;
  createdAt?: string;
  updatedAt?: string;
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions?: Permission[];
}

export interface Permission {
  id: string;
  code: string;
  name: string;
  description?: string;
  module?: string;
}

export const staffService = {
  getAll: () => api.get('/staffs'),
  getById: (id: string) => api.get(`/staffs/${id}`),
  create: (data: Partial<Staff>) => api.post('/staffs', data),
  update: (id: string, data: Partial<Staff>) => api.patch(`/staffs/${id}`, data),
  delete: (id: string) => api.delete(`/staffs/${id}`),
};
