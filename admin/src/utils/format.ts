/**
 * Shared USDT formatting for the admin panel.
 *
 * Four pages carried byte-identical copies of this function. Amounts come back
 * from the API as decimal strings, and raw float math leaves artefacts such as
 * `0.020000000000000004`, so round at 8 decimals (USDT precision) and trim.
 */

/** Format a USDT amount, keeping at least 2 decimals and dropping trailing zeros. */
export function formatUsdt(
  amount: number | string | null | undefined,
  options: { grouping?: boolean } = {},
): string {
  const { grouping = true } = options;

  if (
    amount === 0 ||
    amount === null ||
    amount === undefined ||
    amount === '0'
  ) {
    return '0.00';
  }

  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) {
    return '0.00';
  }

  let amountStr = num.toFixed(8).replace(/\.?0+$/, '');
  if (!amountStr.includes('.')) {
    amountStr += '.00';
  } else {
    const [integerPart, decimalPart] = amountStr.split('.');
    if (decimalPart.length < 2) {
      amountStr = `${integerPart}.${decimalPart.padEnd(2, '0')}`;
    }
  }

  if (!grouping) return amountStr;

  const [integerPart, decimalPart] = amountStr.split('.');
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${formattedInteger}.${decimalPart}`;
}

/**
 * Format a timestamp for display, tolerating the shapes the API can return.
 *
 * Several pages carried their own copy of this; some of them rendered
 * `Invalid Date` when a field came back empty or malformed.
 */
export function formatDateTime(
  value: string | Date | number | null | undefined,
  fallback = '-',
): string {
  if (value === null || value === undefined || value === '') return fallback;
  const date = value instanceof Date ? value : new Date(value);
  return isNaN(date.getTime()) ? fallback : date.toLocaleString();
}

/** Same as `formatDateTime` but date only, no clock time. */
export function formatDate(
  value: string | Date | number | null | undefined,
  fallback = '-',
): string {
  if (value === null || value === undefined || value === '') return fallback;
  const date = value instanceof Date ? value : new Date(value);
  return isNaN(date.getTime()) ? fallback : date.toLocaleDateString();
}
