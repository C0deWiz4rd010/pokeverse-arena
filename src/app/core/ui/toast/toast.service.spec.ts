import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastService } from './toast.service';

const t = (title: string) => ({ title, icon: 'trophy' as const, kind: 'info' as const });

describe('ToastService', () => {
  let toasts: ToastService;
  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.resetTestingModule();
    toasts = TestBed.inject(ToastService);
  });
  afterEach(() => vi.useRealTimers());

  it('shows a toast and removes it after its time', () => {
    toasts.show(t('hi'), 1000);
    expect(toasts.toasts().map((x) => x.title)).toEqual(['hi']);
    vi.advanceTimersByTime(1001);
    expect(toasts.toasts()).toEqual([]);
  });

  it('keeps only the newest four', () => {
    for (let i = 0; i < 6; i++) toasts.show(t(`t${i}`), 60_000);
    expect(toasts.toasts().map((x) => x.title)).toEqual(['t2', 't3', 't4', 't5']);
  });

  it('pauses on hover and resumes with the remaining time (at least 1.5 s)', () => {
    toasts.show(t('read me'), 3000);
    vi.advanceTimersByTime(2900);
    const id = toasts.toasts()[0].id;
    toasts.pause(id);
    vi.advanceTimersByTime(20_000);
    expect(toasts.toasts().length).toBe(1); // still there while paused
    toasts.resume(id);
    vi.advanceTimersByTime(1400);
    expect(toasts.toasts().length).toBe(1);
    vi.advanceTimersByTime(200);
    expect(toasts.toasts().length).toBe(0);
  });

  it('dismiss removes immediately and cancels the timer', () => {
    toasts.show(t('x'), 5000);
    const id = toasts.toasts()[0].id;
    toasts.dismiss(id);
    expect(toasts.toasts()).toEqual([]);
    expect(() => vi.advanceTimersByTime(6000)).not.toThrow();
  });

  it('ignores pause/resume for unknown ids', () => {
    expect(() => { toasts.pause(999); toasts.resume(999); }).not.toThrow();
  });
});
