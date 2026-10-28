import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastService } from '../../core/ui/toast/toast.service';
import { dailyKey, dailyMatchup } from '../../game/daily/daily';
import { DailyService } from './daily.service';

describe('DailyService', () => {
  const show = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    show.mockClear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: ToastService, useValue: { show } }] });
  });

  const create = () => TestBed.inject(DailyService);

  it('exposes today and its deterministic matchup', () => {
    const svc = create();
    expect(svc.today).toBe(dailyKey());
    expect(svc.matchup).toEqual(dailyMatchup(svc.today));
  });

  it('starts with an empty record', () => {
    const svc = create();
    expect(svc.streak()).toBe(0);
    expect(svc.best()).toBe(0);
    expect(svc.wins()).toBe(0);
    expect(svc.wonToday()).toBe(false);
    expect(svc.playedToday()).toBe(false);
  });

  it('a first counted win starts a streak, persists and celebrates', () => {
    const svc = create();
    svc.report(true);
    expect(svc.streak()).toBe(1);
    expect(svc.best()).toBe(1);
    expect(svc.wins()).toBe(1);
    expect(svc.wonToday()).toBe(true);
    expect(svc.playedToday()).toBe(true);
    expect(show).toHaveBeenCalledTimes(1);
    const toast = show.mock.calls[0]![0] as { title: string; text: string; kind: string };
    expect(toast.title).toContain('1-day streak');
    expect(toast.text).toContain('start a streak');
    expect(toast.kind).toBe('achievement');

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: ToastService, useValue: { show } }] });
    expect(create().wonToday()).toBe(true);
  });

  it('retries on the same day are ignored', () => {
    const svc = create();
    svc.report(true);
    show.mockClear();
    svc.report(true);
    svc.report(false);
    expect(svc.wins()).toBe(1);
    expect(show).not.toHaveBeenCalled();
  });

  it('a loss counts as played without a toast or streak', () => {
    const svc = create();
    svc.report(false);
    expect(svc.playedToday()).toBe(true);
    expect(svc.wonToday()).toBe(false);
    expect(svc.streak()).toBe(0);
    expect(show).not.toHaveBeenCalled();
  });

  it('mentions the best run when a longer streak is continued', () => {
    const svc = create();
    const yesterday = new Date(Date.now() - 86_400_000);
    const key = dailyKey(yesterday);
    localStorage.setItem(
      'pv:daily:record',
      JSON.stringify({
        v: 1,
        data: { lastKey: key, lastWonKey: key, streak: 2, best: 2, wins: 2, plays: 2 },
      }),
    );
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: ToastService, useValue: { show } }] });
    const again = create();
    expect(again.streak()).toBe(2);
    again.report(true);
    expect(again.streak()).toBe(3);
    const toast = show.mock.calls[0]![0] as { title: string; text: string };
    expect(toast.title).toContain('3-day streak');
    expect(toast.text).toContain('Best run: 3');
    expect(svc).toBeDefined();
  });
});
