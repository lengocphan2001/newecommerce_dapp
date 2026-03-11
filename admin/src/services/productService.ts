import api from './api';

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  stock?: number;
  shippingFee?: number;
  thumbnailUrl?: string;
  detailImageUrls?: string[];
  countries?: ('VIETNAM' | 'USA')[];
  tags?: string[];
  properties?: { name: string; values: string[] }[];
  categoryId?: string;
  category?: {
    id: string;
    name: string;
    description?: string;
    imageUrl?: string;
  };
  brand?: string;
  origin?: string;
  clothingType?: string;
  fakeSold?: number;
  /** Show in home page image strip (under title). */
  featuredOnHome?: boolean;
  createdAt?: string;
  pushedAt?: string;
  salePercentage?: number;
  combos?: { quantity: number; price: number; label?: string }[];
  /** Commission % for buyer package TV (0–100). Referrer gets this % of (price × qty). */
  commissionPercentTV?: number;
  /** Commission % for buyer package CTV (0–100). */
  commissionPercentCTV?: number;
  /** Commission % for buyer package NPP (0–100). */
  commissionPercentNPP?: number;
}

export const productService = {
  getAll: (params?: any) => api.get<Product[]>('/products', { params }),
  getById: (id: string) => api.get<Product>(`/products/${id}`),
  create: (data: Partial<Product>) => api.post<Product>('/products', data),
  update: (id: string, data: Partial<Product>) => api.put<Product>(`/products/${id}`, data),
  delete: (id: string) => api.delete<{ deleted: boolean }>(`/products/${id}`),
  togglePush: (id: string) => api.put<Product>(`/products/${id}/push`),
  export: () => api.get('/products/export', { responseType: 'blob' }),
};

