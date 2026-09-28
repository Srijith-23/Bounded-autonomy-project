import { describe, it, expect } from 'vitest';
import { withRetry, withTimeout, ReviewError } from '../src/utils/error-handler.js';
import { RateLimiter } from '../src/utils/rate-limiter.js';

describe('Utility Functions', () => {
  it('withRetry retries failed functions and succeeds if attempt passes', async () => {
    let attempts = 0;
    const fn = async () => {
      attempts++;
      if (attempts < 2) throw new Error('Temporary failure');
      return 'success';
    };

    const result = await withRetry(fn, 3, 10);
    expect(result).toBe('success');
    expect(attempts).toBe(2);
  });

  it('withTimeout rejects if operation exceeds time limit', async () => {
    const slowTask = new Promise((resolve) => setTimeout(resolve, 500));

    await expect(withTimeout(slowTask, 50)).rejects.toThrow(ReviewError);
  });

  it('RateLimiter enforces sliding window limits correctly', async () => {
    const limiter = new RateLimiter({ tokensPerWindow: 2, windowMs: 1000 });

    expect(await limiter.tryAcquire(1)).toBe(true);
    expect(await limiter.tryAcquire(1)).toBe(true);
    expect(await limiter.tryAcquire(1)).toBe(false); // Exceeded 2 tokens limit
    expect(limiter.getRemainingTokens()).toBe(0);

    limiter.reset();
    expect(limiter.getRemainingTokens()).toBe(2);
  });
});