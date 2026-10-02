import React from 'react';
import type { ColumnType } from 'antd/es/table';
import { formatDateTime, formatUsdt } from './format';

/**
 * Column builders for the shapes that repeat across every admin table: a USDT
 * amount, a timestamp, and a truncated UUID. They return a plain antd column
 * object, so a page can spread extra props onto the result.
 */

/** Right-aligned USDT amount with a `$` prefix and a numeric sorter. */
export function moneyColumn<T>(
  title: React.ReactNode,
  dataIndex: keyof T & string,
  options: { sorter?: boolean; prefix?: string; width?: number } = {},
): ColumnType<T> {
  const { sorter = true, prefix = '$', width } = options;
  return {
    title,
    dataIndex,
    key: dataIndex,
    width,
    align: 'right',
    render: (value: unknown) => `${prefix}${formatUsdt(value as number | string)}`,
    ...(sorter
      ? {
          sorter: (a: T, b: T) =>
            Number((a as never)[dataIndex] ?? 0) -
            Number((b as never)[dataIndex] ?? 0),
        }
      : {}),
  };
}

/** Timestamp column; empty and malformed values render as `-`, never `Invalid Date`. */
export function dateTimeColumn<T>(
  title: React.ReactNode,
  dataIndex: keyof T & string,
  options: { sorter?: boolean; width?: number } = {},
): ColumnType<T> {
  const { sorter = true, width } = options;
  return {
    title,
    dataIndex,
    key: dataIndex,
    width,
    render: (value: unknown) =>
      formatDateTime(value as string | Date | null | undefined),
    ...(sorter
      ? {
          sorter: (a: T, b: T) =>
            new Date((a as never)[dataIndex] ?? 0).getTime() -
            new Date((b as never)[dataIndex] ?? 0).getTime(),
        }
      : {}),
  };
}

/** UUID shown truncated in a monospace font, with the full value on hover. */
export function shortIdColumn<T>(
  title: React.ReactNode,
  dataIndex: keyof T & string,
  options: { length?: number; width?: number } = {},
): ColumnType<T> {
  const { length = 8, width } = options;
  return {
    title,
    dataIndex,
    key: dataIndex,
    width,
    render: (value: unknown) => {
      const id = String(value ?? '');
      if (!id) return '-';
      return (
        <span style={{ fontFamily: 'monospace' }} title={id}>
          {id.length > length ? `${id.slice(0, length)}...` : id}
        </span>
      );
    },
  };
}
