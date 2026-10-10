/**
 * Shared number/currency formatting for the storefront.
 *
 * Every page used to carry its own `formatPrice` copy, which is why the same
 * amount could render with different decimal counts on different screens. Pass
 * the digit counts explicitly so each call site keeps the shape it needs.
 */

/**
 * Fallback USDT to VND rate used where a live rate is not loaded.
 *
 * The real rate lives in admin banking config (`usdtPriceVnd`); prefer that
 * whenever it is available on the page.
 */
export const USD_TO_VND_FALLBACK_RATE = 25000;

/** Invalid or missing input is treated as 0 so a money field never renders "NaN". */
const toNumber = (value: string | number | null | undefined): number => {
  if (value === null || value === undefined || value === '') return 0;
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return Number.isFinite(num) ? num : 0;
};

/** Format a USDT amount with en-US grouping. */
export function formatAmount(
  value: string | number | null | undefined,
  minimumFractionDigits = 2,
  maximumFractionDigits = 4,
): string {
  const num = toNumber(value);
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(num);
}

/** Convert a USDT amount to VND. */
export function usdToVnd(
  value: string | number | null | undefined,
  rate: number = USD_TO_VND_FALLBACK_RATE,
): number {
  const num = toNumber(value);
  return num * rate;
}

/** VND with the ₫ currency symbol, e.g. `1.500.000 ₫`. */
export function formatVnd(value: string | number | null | undefined): string {
  const num = toNumber(value);
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

/** VND with a trailing `VND` word instead of the symbol, e.g. `1.500.000 VND`. */
export function formatVndPlain(
  value: string | number | null | undefined,
): string {
  const num = toNumber(value);
  return `${num.toLocaleString('vi-VN')} VND`;
}
