/**
 * Small, framework-free helpers for polite API access: a concurrency limiter and
 * retry/backoff policy. Pure so they can be unit-tested without HttpClient.
 */

/** Runs at most `limit` async tasks at once; the rest wait in FIFO order. */
export class Semaphore {
  private active = 0;
  private readonly waiting: (() => void)[] = [];

  constructor(private readonly limit: number) {}

  async run<T>(task: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await task();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.active < this.limit) {
      this.active++;
      return Promise.resolve();
    }
    // The slot is handed over directly by release(), so `active` stays constant.
    return new Promise<void>((resolve) => this.waiting.push(resolve));
  }

  private release(): void {
    const next = this.waiting.shift();
    if (next) next();
    else this.active--;
  }
}

/** Network failure (status 0), rate limit, or server error — worth another try. */
export function isRetryableStatus(status: number | undefined): boolean {
  return status === undefined || status === 0 || status === 408 || status === 429 || status >= 500;
}

/** Exponential backoff with full jitter: attempt 0 → ≤ base, 1 → ≤ 2·base, … capped. */
export function backoffDelay(attempt: number, rand: () => number = Math.random, baseMs = 400, capMs = 5000): number {
  return Math.floor(rand() * Math.min(capMs, baseMs * 2 ** attempt));
}
