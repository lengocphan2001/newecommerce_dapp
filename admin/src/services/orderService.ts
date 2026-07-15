import api from './api';

export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  status: string;
  totalAmount: number;
  shippingFee?: number;
  vatRate?: number;
  vatAmount?: number;
  transactionHash?: string;
  shippingAddress?: string;
  isReconsumption?: boolean;
  paymentMethod?: string; // 'wallet' | 'banking' | 'deposit_wallet' | 'usdt'
  createdAt?: string;
  updatedAt?: string;
  user?: {
    username: string;
    email: string;
    fullName: string;
  };
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}

export const orderService = {
  getAll: (params?: any) => api.get('/orders', { params }),
  exportOrders: (params?: any) =>
    api.get('/orders/export', { params, responseType: 'blob' }),
  getById: (id: string) => api.get(`/orders/${id}`),
  create: (data: Partial<Order>) => api.post('/orders', data),
  updateStatus: (id: string, data: { status: string }) => api.put(`/orders/${id}/status`, data),
  cancel: (id: string) => api.post(`/orders/${id}/cancel`),
};

