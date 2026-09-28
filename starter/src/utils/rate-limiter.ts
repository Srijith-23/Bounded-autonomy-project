export interface RateLimiterConfig {
  tokensPerWindow: number;
  windowMs: number;
}

export class RateLimiter {
  private timestamps: number[] = [];
  private readonly tokensPerWindow: number;
  private readonly windowMs: number;

  constructor(config: Partial<RateLimiterConfig> = {}) {
    this.tokensPerWindow = config.tokensPerWindow ?? 30000;
    this.windowMs = config.windowMs ?? 60000;
  }

  /**
   * Filters out timestamps older than the sliding window.
   */
  private filterWindow(): void {
    const now = Date.now();
    this.timestamps = this.timestamps.filter((ts) => now - ts < this.windowMs);
  }

  /**
   * Attempts to acquire tokens without blocking.
   * Returns true if successful, false if limit reached.
   */
  async tryAcquire(cost = 1): Promise<boolean> {
    this.filterWindow();
    if (this.timestamps.length + cost <= this.tokensPerWindow) {
      const now = Date.now();
      for (let i = 0; i < cost; i++) {
        this.timestamps.push(now);
      }
      return true;
    }
    return false;
  }

  /**
   * Blocks until tokens are available and acquired.
   */
  async acquire(cost = 1): Promise<void> {
    while (!(await this.tryAcquire(cost))) {
      await new Promise((res) => setTimeout(res, 100));
    }
  }

  /**
   * Returns remaining available tokens in current sliding window.
   */
  getRemainingTokens(): number {
    this.filterWindow();
    return Math.max(0, this.tokensPerWindow - this.timestamps.length);
  }

  /**
   * Returns milliseconds until the window resets or frees up token slots.
   */
  getResetTime(): number {
    this.filterWindow();
    if (this.timestamps.length === 0) return 0;
    const oldestTimestamp = this.timestamps[0];
    if (oldestTimestamp === undefined) return 0;
    return Math.max(0, oldestTimestamp + this.windowMs - Date.now());
  }

  /**
   * Resets active timestamps.
   */
  reset(): void {
    this.timestamps = [];
  }

  /**
   * Release method stub for orchestrator compatibility
   */
  release(): void {
    // No-op for sliding window timestamp tracker
  }
}

export const globalRateLimiter = new RateLimiter();