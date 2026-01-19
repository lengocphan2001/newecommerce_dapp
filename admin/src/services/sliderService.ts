import api from './api';

export interface Slider {
  id: string;
  imageUrl: string;
  title?: string;
  description?: string;
  linkUrl?: string;
  order: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export const sliderService = {
  getAll: (activeOnly?: boolean) => api.get('/sliders', { params: { activeOnly } }),
  getById: (id: string) => api.get(`/sliders/${id}`),
  create: (data: Partial<Slider>) => api.post('/sliders', data),
  update: (id: string, data: Partial<Slider>) => api.put(`/sliders/${id}`, data),
  delete: (id: string) => api.delete(`/sliders/${id}`),
};
