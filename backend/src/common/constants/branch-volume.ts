import { OrderStatus } from '../../order/entities/order.entity';

/**
 * Order statuses that count towards sales volume (personal and branch).
 * A pending or cancelled order never counts.
 */
export const SALES_ORDER_STATUSES = [
  OrderStatus.CONFIRMED,
  OrderStatus.PROCESSING,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
];

/**
 * First month the weak branch volume is accumulated from, per the current
 * commission policy. Anything before it is ignored.
 */
export const WEAK_BRANCH_ACCUMULATION_START = { year: 2026, month: 8 };

/**
 * Month a user starts accumulating weak branch volume from: the policy start,
 * or the month they registered when that is later.
 */
export function weakBranchAccumulationStart(registeredAt?: Date | string | null): {
  year: number;
  month: number;
} {
  const { year: startYear, month: startMonth } = WEAK_BRANCH_ACCUMULATION_START;
  const registered = registeredAt ? new Date(registeredAt) : null;
  if (!registered || isNaN(registered.getTime())) {
    return { year: startYear, month: startMonth };
  }

  const regYear = registered.getFullYear();
  const regMonth = registered.getMonth() + 1;
  if (regYear > startYear || (regYear === startYear && regMonth > startMonth)) {
    return { year: regYear, month: regMonth };
  }
  return { year: startYear, month: startMonth };
}
