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
  /** true = hoa hồng sản phẩm (%), false = chỉ hoa hồng theo gói (package). */
  useProductCommission?: boolean;
  /** Tỷ lệ hoa hồng gián tiếp F2 cho sản phẩm (%) */
  indirectCommissionRateF2?: number;
  /** Tỷ lệ % giá trị sản phẩm (chưa thuế) làm căn cứ tính hoa hồng (ví dụ: 85, 90, 95). Mặc định 95%. */
  commissionBasePercent?: number;

  /** Direct: commission % for buyer package TV/CTV/NPP (0–100). */
  commissionPercentTV?: number;
  commissionPercentCTV?: number;
  commissionPercentNPP?: number;
  /** Group: % hoa hồng nhóm theo gói người mua. */
  commissionPercentGroupTV?: number;
  commissionPercentGroupCTV?: number;
  commissionPercentGroupNPP?: number;
  /** Management: % hoa hồng quản lý (F1/F2/F3) khi nguồn là product group. */
  commissionPercentManagementTV?: number;
  commissionPercentManagementCTV?: number;
  commissionPercentManagementNPP?: number;
  /** Giống package */
  groupCommissionMinSales?: number;
  managementRateF1?: number;
  managementRateF2?: number;
  managementRateF3?: number;
  managementMinSales?: number;
  reconsumptionThreshold?: number;
  reconsumptionRequired?: number;
  /** Cấu hình hoa hồng theo từng gói (code) – cùng cấu trúc như Package. Rates trong DB là 0–1. */
  commissionConfigByPackage?: Record<string, {
    directCommissionRate?: number;
    groupCommissionRate?: number;
    groupCommissionMinSales?: number;
    managementRateF1?: number;
    managementRateF2?: number | null;
    managementRateF3?: number | null;
    managementMinSales?: number;
    reconsumptionThreshold?: number;
    reconsumptionRequired?: number;
  }>;
}

export const productService = {
  getAll: (params?: any) => api.get<Product[]>('/products', { params }),
  getById: (id: string) => api.get<Product>(`/products/${id}`),
  create: (data: Partial<Product>) => api.post<Product>('/products', data),
  update: (id: string, data: Partial<Product>) => api.put<Product>(`/products/${id}`, data),
  delete: (id: string) => api.delete<{ deleted: boolean }>(`/products/${id}`),
  togglePush: (id: string) => api.put<Product>(`/products/${id}/push`),
  reorder: (ids: string[]) => api.put<{ success: boolean }>('/products/reorder', { ids }),
  export: () => api.get('/products/export', { responseType: 'blob' }),
  importCsv: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/products/import', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

