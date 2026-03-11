import api from './api';

export interface Package {
    id: string;
    name: string;
    code: string;
    description: string;
    price: number;
    directCommissionRate: number;
    groupCommissionRate: number;
    groupCommissionMinSales: number;
    managementRateF1: number;
    managementRateF2: number | null;
    managementRateF3: number | null;
    managementMinSales: number;
    reconsumptionThreshold: number;
    reconsumptionRequired: number;
    level: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface CreatePackageDto {
    name: string;
    code: string;
    description?: string;
    price: number;
    directCommissionRate: number;
    groupCommissionRate: number;
    groupCommissionMinSales?: number;
    managementRateF1: number;
    managementRateF2?: number | null;
    managementRateF3?: number | null;
    managementMinSales?: number;
    reconsumptionThreshold: number;
    reconsumptionRequired: number;
    level: number;
    isActive?: boolean;
}

export interface UpdatePackageDto {
    name?: string;
    code?: string;
    description?: string;
    price?: number;
    directCommissionRate?: number;
    groupCommissionRate?: number;
    groupCommissionMinSales?: number;
    managementRateF1?: number;
    managementRateF2?: number | null;
    managementRateF3?: number | null;
    managementMinSales?: number;
    reconsumptionThreshold?: number;
    reconsumptionRequired?: number;
    level?: number;
    isActive?: boolean;
}

export const packagesService = {
    async getAll(): Promise<Package[]> {
        const response = await api.get('/packages');
        if (Array.isArray(response.data)) {
            return response.data;
        }
        // Handle case where data might be wrapped
        if (response.data && Array.isArray(response.data.data)) {
            return response.data.data;
        }
        // Also handle direct array return if axios interceptor unwraps it
        if (Array.isArray(response)) {
            return response;
        }
        return [];
    },

    async getById(id: string): Promise<Package> {
        const response = await api.get(`/packages/${id}`);
        return response.data;
    },

    async getByCode(code: string): Promise<Package> {
        const response = await api.get(`/packages/code/${code}`);
        return response.data;
    },

    async create(data: CreatePackageDto): Promise<Package> {
        const response = await api.post('/packages', data);
        return response.data;
    },

    async update(id: string, data: UpdatePackageDto): Promise<Package> {
        const response = await api.patch(`/packages/${id}`, data);
        return response.data;
    },

    async delete(id: string): Promise<void> {
        await api.delete(`/packages/${id}`);
    },
};
