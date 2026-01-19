import api from './api';

export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions?: Permission[];
  staffs?: Staff[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Permission {
  id: string;
  code: string;
  name: string;
  description?: string;
  module?: string;
}

export interface Staff {
  id: string;
  email: string;
  fullName: string;
}

export const roleService = {
  getAll: () => api.get('/roles'),
  getById: (id: string) => api.get(`/roles/${id}`),
  create: (data: Partial<Role>) => api.post('/roles', data),
  update: (id: string, data: Partial<Role>) => api.patch(`/roles/${id}`, data),
  delete: (id: string) => api.delete(`/roles/${id}`),
};

export const permissionService = {
  getAll: () => api.get('/permissions'),
  getByModule: (module: string) => api.get(`/permissions/module/${module}`),
  getById: (id: string) => api.get(`/permissions/${id}`),
};
