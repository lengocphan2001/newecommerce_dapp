import api from './api';

export type RewardSource =
  | 'commission'
  | 'heap'
  | 'matrix'
  | 'agent_pool'
  | 'salary'
  | 'rank_salary';

export type RewardStatus = 'paid' | 'pending' | 'blocked' | 'cancelled';

export interface RewardReportFilter {
  from: string;
  to: string;
  sources?: RewardSource[];
  subTypes?: string[];
  statuses?: RewardStatus[];
  userId?: string;
  search?: string;
}

export interface RewardSummaryGroup {
  amount: number;
  withdrawAmount: number;
  reconsumptionAmount: number;
  taxAmount: number;
  count: number;
  users: number;
  byStatus: Partial<Record<RewardStatus, { amount: number; count: number }>>;
}

export interface RewardSummary {
  from: string;
  to: string;
  totals: RewardSummaryGroup;
  sources: Array<
    RewardSummaryGroup & {
      source: RewardSource;
      subTypes: Array<RewardSummaryGroup & { subType: string | null }>;
    }
  >;
}

export interface RewardTimeseries {
  groupBy: 'day' | 'month';
  sources: RewardSource[];
  points: Array<{
    bucket: string;
    total: number;
    count: number;
    bySource: Partial<Record<RewardSource, number>>;
  }>;
}

export interface RewardUserInfo {
  id: string;
  username: string | null;
  fullName: string | null;
  email: string | null;
}

export interface RewardEntry {
  source: RewardSource;
  subType: string | null;
  id: string;
  userId: string;
  user: RewardUserInfo | null;
  fromUserId: string | null;
  fromUser: RewardUserInfo | null;
  amount: number;
  withdrawAmount: number;
  reconsumptionAmount: number;
  taxAmount: number;
  status: RewardStatus;
  refId: string | null;
  occurredAt: string;
  period: string;
}

export interface RewardTopUser {
  rank: number;
  userId: string;
  user: RewardUserInfo | null;
  amount: number;
  withdrawAmount: number;
  reconsumptionAmount: number;
  taxAmount: number;
  count: number;
  bySource: Partial<Record<RewardSource, number>>;
}

/** Arrays go as comma lists, empty values are left out. */
const toParams = (f: RewardReportFilter, extra: Record<string, unknown> = {}) => {
  const params: Record<string, unknown> = { from: f.from, to: f.to, ...extra };
  if (f.sources?.length) params.sources = f.sources.join(',');
  if (f.subTypes?.length) params.subTypes = f.subTypes.join(',');
  if (f.statuses?.length) params.statuses = f.statuses.join(',');
  if (f.userId) params.userId = f.userId;
  if (f.search?.trim()) params.search = f.search.trim();
  return params;
};

export const rewardReportService = {
  async getSummary(f: RewardReportFilter): Promise<RewardSummary> {
    const res = await api.get('/admin/reward-report/summary', { params: toParams(f) });
    return res.data;
  },

  async getTimeseries(
    f: RewardReportFilter,
    groupBy: 'day' | 'month',
  ): Promise<RewardTimeseries> {
    const res = await api.get('/admin/reward-report/timeseries', {
      params: toParams(f, { groupBy }),
    });
    return res.data;
  },

  async getEntries(
    f: RewardReportFilter,
    page: number,
    limit: number,
  ): Promise<{ items: RewardEntry[]; total: number; page: number; limit: number }> {
    const res = await api.get('/admin/reward-report/entries', {
      params: toParams(f, { page, limit }),
    });
    return res.data;
  },

  /** Every entry of the filter, fetched in pages of 5000, for the Excel export. */
  async getAllEntries(f: RewardReportFilter): Promise<RewardEntry[]> {
    const limit = 5000;
    const all: RewardEntry[] = [];
    for (let page = 1; ; page++) {
      const { items, total } = await this.getEntries(f, page, limit);
      all.push(...items);
      if (items.length < limit || all.length >= total) return all;
    }
  },

  async getTopUsers(f: RewardReportFilter, limit = 20): Promise<RewardTopUser[]> {
    const res = await api.get('/admin/reward-report/top-users', {
      params: toParams(f, { limit }),
    });
    return res.data;
  },
};
