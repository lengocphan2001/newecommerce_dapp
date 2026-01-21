/**
 * Utility functions for formatting decimal numbers
 * Fixes floating-point precision issues when serializing to JSON
 */

/**
 * Format a decimal number to string with proper precision
 * Removes floating-point precision artifacts like 0.020000000000000004
 * @param value - Number or string to format
 * @param maxDecimals - Maximum decimal places (default: 8 for USDT)
 * @returns Formatted string representation
 */
export function formatDecimal(value: number | string | null | undefined, maxDecimals: number = 8): string {
  if (value === null || value === undefined) {
    return '0.00';
  }

  // Convert to number if string
  const num = typeof value === 'string' ? parseFloat(value) : value;

  // Handle NaN and zero
  if (isNaN(num) || num === 0) {
    return '0.00';
  }

  // Use toFixed to remove floating-point precision issues
  let formatted = num.toFixed(maxDecimals);

  // Remove trailing zeros but keep at least 2 decimal places
  formatted = formatted.replace(/\.?0+$/, '');
  if (!formatted.includes('.')) {
    formatted += '.00';
  } else {
    const [intPart, decPart] = formatted.split('.');
    if (decPart.length < 2) {
      formatted = `${intPart}.${decPart.padEnd(2, '0')}`;
    }
  }

  return formatted;
}

/**
 * Format a decimal number and convert back to number
 * Useful when you need to return a number but want to fix precision issues
 * @param value - Number or string to format
 * @param maxDecimals - Maximum decimal places (default: 8 for USDT)
 * @returns Number with fixed precision
 */
export function fixDecimalPrecision(value: number | string | null | undefined, maxDecimals: number = 8): number {
  const formatted = formatDecimal(value, maxDecimals);
  return parseFloat(formatted);
}

/**
 * Recursively format all decimal numbers in an object
 * Useful for formatting entire response objects
 */
export function formatDecimalsInObject(obj: any, maxDecimals: number = 8): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'number') {
    // Check if it's a decimal number (has decimal part)
    if (obj % 1 !== 0) {
      return fixDecimalPrecision(obj, maxDecimals);
    }
    return obj;
  }

  if (typeof obj === 'string') {
    // Try to parse as number
    const num = parseFloat(obj);
    if (!isNaN(num) && num % 1 !== 0) {
      return formatDecimal(num, maxDecimals);
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => formatDecimalsInObject(item, maxDecimals));
  }

  if (typeof obj === 'object') {
    const formatted: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        formatted[key] = formatDecimalsInObject(obj[key], maxDecimals);
      }
    }
    return formatted;
  }

  return obj;
}
