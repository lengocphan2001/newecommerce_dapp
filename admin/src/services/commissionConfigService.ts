import api from './api';

export interface CommissionConfig {
  id: string;
  packageType: 'CTV' | 'NPP';
  directRate: number;
  groupRate: number;
  managementRateF1: number;
  managementRateF2: number | null;
  managementRateF3: number | null;
  packageValue: number;
  reconsumptionThreshold: number;
  reconsumptionRequired: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCommissionConfigDto {
  packageType: 'CTV' | 'NPP';
  directRate?: number;
  groupRate?: number;
  managementRateF1?: number;
  managementRateF2?: number | null;
  managementRateF3?: number | null;
  packageValue?: number;
  reconsumptionThreshold?: number;
  reconsumptionRequired?: number;
}

export interface UpdateCommissionConfigDto {
  directRate?: number;
  groupRate?: number;
  managementRateF1?: number;
  managementRateF2?: number | null;
  managementRateF3?: number | null;
  packageValue?: number;
  reconsumptionThreshold?: number;
  reconsumptionRequired?: number;
}

export const commissionConfigService = {
  async getAll(): Promise<CommissionConfig[]> {
    const response = await api.get('/admin/commission-config');
    // Handle different response formats
    if (Array.isArray(response.data)) {
      return response.data;
    }
    if (Array.isArray(response)) {
      return response;
    }
    return [];
  },

  async getById(id: string): Promise<CommissionConfig> {
    const response = await api.get(`/admin/commission-config/${id}`);
    return response.data;
  },

  async getByPackageType(packageType: 'CTV' | 'NPP'): Promise<CommissionConfig> {
    const response = await api.get(`/admin/commission-config/package/${packageType}`);
    return response.data;
  },

  async update(id: string, data: UpdateCommissionConfigDto): Promise<CommissionConfig> {
    const response = await api.put(`/admin/commission-config/${id}`, data);
    return response.data;
  },

  async updateByPackageType(
    packageType: 'CTV' | 'NPP',
    data: UpdateCommissionConfigDto,
  ): Promise<CommissionConfig> {
    const response = await api.put(`/admin/commission-config/package/${packageType}`, data);
    return response.data;
  },

  async create(data: CreateCommissionConfigDto): Promise<CommissionConfig> {
    const response = await api.post('/admin/commission-config', data);
    return response.data;
  },
};
