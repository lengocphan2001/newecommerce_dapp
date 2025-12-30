import api from './api';

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  status?: string;
  createdAt?: string;
}

export const userService = {
  getAll: () => api.get('/users'),
  getById: (id: string) => api.get(`/users/${id}`),
  create: (data: Partial<User>) => api.post('/users', data),
  update: (id: string, data: Partial<User>) => api.put(`/users/${id}`, data),
  delete: (id: string) => api.delete(`/users/${id}`),
};

