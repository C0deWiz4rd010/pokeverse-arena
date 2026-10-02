import { describe, expect, it } from 'vitest';
import { Semaphore, backoffDelay, isRetryableStatus } from './request-pool';

describe('Semaphore', () => {
  it('never runs more than `limit` tasks at once and finishes them all', async () => {
    const sem = new Semaphore(3);
    let running = 0;
    let peak = 0;
    const task = async () => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 5));
      running--;
      return 1;
    };
    const results = await Promise.all(Array.from({ length: 12 }, () => sem.run(task)));
    expect(results.length).toBe(12);
    expect(peak).toBe(3);
  });

  it('releases the slot when a task throws', async () => {
    const sem = new Semaphore(1);
    await expect(sem.run(() => Promise.reject(new Error('x')))).rejects.toThrow('x');
    await expect(sem.run(async () => 'ok')).resolves.toBe('ok');
  });
});

describe('retry policy', () => {
  it('retries network, rate-limit and server errors only', () => {
    for (const s of [undefined, 0, 408, 429, 500, 503]) expect(isRetryableStatus(s)).toBe(true);
    for (const s of [400, 401, 404]) expect(isRetryableStatus(s)).toBe(false);
  });

  it('backs off exponentially, jittered and capped', () => {
    expect(backoffDelay(0, () => 1)).toBe(400);
    expect(backoffDelay(1, () => 1)).toBe(800);
    expect(backoffDelay(10, () => 1)).toBe(5000);
    expect(backoffDelay(2, () => 0)).toBe(0);
  });
});
