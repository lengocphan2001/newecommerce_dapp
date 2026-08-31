import React from 'react';
import { Tag } from 'antd';

/** Antd tag colour plus the label to show for one status value. */
export interface StatusTagSpec {
  color: string;
  label?: string;
}

export type StatusTagMap = Record<string, StatusTagSpec>;

/** Commission lifecycle, as used on the commission and payout screens. */
export const COMMISSION_STATUS_TAGS: StatusTagMap = {
  paid: { color: 'success' },
  pending: { color: 'warning' },
  blocked: { color: 'error' },
  cancelled: { color: 'default' },
  failed: { color: 'error' },
};

/** Package purchase lifecycle. */
export const PURCHASE_STATUS_TAGS: StatusTagMap = {
  paid: { color: 'green' },
  pending: { color: 'orange' },
  cancelled: { color: 'red' },
};

/** Monthly reward rows: whether the month has been closed and paid out. */
export const MONTHLY_PROCESSED_TAGS: StatusTagMap = {
  true: { color: 'success', label: 'Đã chốt & trả ví' },
  false: { color: 'warning', label: 'Chờ chốt' },
};

interface StatusTagProps {
  /** Raw status value from the API. */
  status: string | boolean | null | undefined;
  /** Colour/label lookup for this domain. */
  map: StatusTagMap;
  /** Colour used when the status is not in the map. */
  fallbackColor?: string;
  /** Uppercase the label when the map has no explicit one. */
  uppercase?: boolean;
}

/**
 * Renders a status as a coloured tag from a per-domain map, so a new status
 * value is added in one place instead of inside every page's column render.
 */
const StatusTag: React.FC<StatusTagProps> = ({
  status,
  map,
  fallbackColor = 'default',
  uppercase = false,
}) => {
  const key = String(status ?? '');
  const spec = map[key];
  const label = spec?.label ?? (uppercase ? key.toUpperCase() : key);
  return <Tag color={spec?.color ?? fallbackColor}>{label}</Tag>;
};

export default StatusTag;
