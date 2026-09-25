/**
 * Helpers for retrying database work that failed on a transient lock error.
 *
 * MySQL aborts one transaction of a deadlock cycle with errno 1213 and rolls it
 * back completely, so the safe recovery is to run the whole transaction again.
 * Lock wait timeouts (errno 1205) behave the same way.
 */

const RETRYABLE_ERRNOS = new Set([1213, 1205]);
const RETRYABLE_CODES = new Set(['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT']);

/**
 * True when the error is a transient lock conflict and the transaction can be
 * replayed as-is.
 */
export function isTransientLockError(error: any): boolean {
  const candidates = [error, error?.driverError, error?.originalError];
  return candidates.some(
    (e) =>
      !!e &&
      (RETRYABLE_ERRNOS.has(Number(e.errno)) ||
        RETRYABLE_CODES.has(String(e.code))),
  );
}

/**
 * Run `work` and replay it when it fails with a transient lock error.
 * `work` must be a self-contained transaction: it is executed from scratch on
 * every attempt.
 */
export async function runWithDeadlockRetry<T>(
  work: () => Promise<T>,
  options: {
    maxAttempts?: number;
    baseDelayMs?: number;
    onRetry?: (attempt: number, error: any) => void;
  } = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 50;

  let lastError: any;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await work();
    } catch (error) {
      lastError = error;
      if (!isTransientLockError(error) || attempt === maxAttempts) throw error;

      options.onRetry?.(attempt, error);

      // Exponential backoff with jitter so retried transactions do not line up
      // again and deadlock on the same rows.
      const delay = baseDelayMs * 2 ** (attempt - 1) + Math.random() * baseDelayMs;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
