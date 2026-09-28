export enum ErrorCodes {
  RETRY_EXHAUSTED = 'RETRY_EXHAUSTED',
  TIMEOUT = 'TIMEOUT',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  EXECUTION_FAILED = 'EXECUTION_FAILED',
}

export class ReviewError extends Error {
  constructor(message: string, public code: ErrorCodes, public details?: unknown) {
    super(message);
    this.name = 'ReviewError';
  }
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (error) {
      attempt++;
      if (attempt > maxRetries) {
        throw new ReviewError('Max retries exhausted', ErrorCodes.RETRY_EXHAUSTED, error);
      }
      const backoff = delayMs * Math.pow(2, attempt - 1);
      const jitter = Math.random() * 100;
      await new Promise((res) => setTimeout(res, backoff + jitter));
    }
  }
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new ReviewError(`Operation timed out after ${timeoutMs}ms`, ErrorCodes.TIMEOUT));
    }, timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]);
}