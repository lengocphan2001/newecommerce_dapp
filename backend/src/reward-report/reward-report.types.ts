/** Every way the system rewards a user, one per table that records it. */
export enum RewardSource {
  /** `commissions`: direct, indirect, product, group, management, milestone, monthly shares. */
  COMMISSION = 'commission',
  /** `heap_reward_histories`, credited 100% to the withdraw wallet. */
  HEAP = 'heap',
  /** `matrix_reward_ledger`, credited 100% to the withdraw wallet. */
  MATRIX = 'matrix',
  /** `agent_pool_histories`. */
  AGENT_POOL = 'agent_pool',
  /** `salary_payments`, monthly salary by tier (T1..T4). */
  SALARY = 'salary',
  /** `rank_salary_payments`, monthly C1 / C2 rank salary. */
  RANK_SALARY = 'rank_salary',
}

export const REWARD_SOURCES = Object.values(RewardSource) as string[];

/**
 * Commissions carry their own status; every other source only records rewards
 * already credited, so its rows are `paid`.
 */
export const REWARD_STATUSES = ['paid', 'pending', 'blocked', 'cancelled'];

export interface RewardAmounts {
  amount: number;
  withdrawAmount: number;
  reconsumptionAmount: number;
  taxAmount: number;
  count: number;
}

export interface RewardSummaryGroup extends RewardAmounts {
  /** Distinct users rewarded. */
  users: number;
  byStatus: Record<string, { amount: number; count: number }>;
}

export interface RewardSummary {
  from: string;
  to: string;
  totals: RewardSummaryGroup;
  sources: Array<
    RewardSummaryGroup & {
      source: string;
      subTypes: Array<RewardSummaryGroup & { subType: string | null }>;
    }
  >;
}

export interface RewardUserInfo {
  id: string;
  username: string | null;
  fullName: string | null;
  email: string | null;
}

export interface RewardEntry {
  source: string;
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
  status: string;
  /** Order id, milestone ref or heap placement id, depending on the source. */
  refId: string | null;
  occurredAt: string;
  /** YYYY-MM: sales month for salaries, month of `occurredAt` otherwise. */
  period: string;
}
