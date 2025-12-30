import api from './api';

export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId?: string;
  userId?: string;
  metadata?: any;
  createdAt?: string;
}

export const auditLogService = {
  getAll: (params?: any) => api.get('/audit-logs', { params }),
  getById: (id: string) => api.get(`/audit-logs/${id}`),
};

