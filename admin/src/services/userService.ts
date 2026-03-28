import api from './api';

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  status?: string;
  createdAt?: string;
  parentId?: string | null;
  referralUserId?: string | null;
  childIds?: string[];
}

export type ParentFilter = 'all' | 'no_parent' | 'has_parent' | 'orphan';

export const userService = {
  getAll: (search?: string, parentFilter: ParentFilter = 'all') =>
    api.get('/users', { params: { search, parentFilter } }),
  getById: (id: string) => api.get(`/users/${id}`),
  create: (data: Partial<User>) => api.post('/users', data),
  update: (id: string, data: Partial<User>) => api.put(`/users/${id}`, data),
  delete: (id: string) => api.delete(`/users/${id}`),
};

