import { TestBed } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nService } from '../../core/i18n/i18n.service';
import { SaveService } from '../../core/storage/save.service';
import { ToastService } from '../../core/ui/toast/toast.service';
import { AchievementWatcherService } from './achievement-watcher.service';

describe('AchievementWatcherService', () => {
  let events: Subject<unknown>;
  let toast: { show: ReturnType<typeof vi.fn> };
  let save: SaveService;
  let visibility: DocumentVisibilityState;

  const create = (): AchievementWatcherService => {
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { events } },
        { provide: ToastService, useValue: toast },
      ],
    });
    save = TestBed.inject(SaveService);
    return TestBed.inject(AchievementWatcherService);
  };

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    events = new Subject();
    toast = { show: vi.fn() };
    visibility = 'visible';
    vi.useFakeTimers();
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibility,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (document as unknown as Record<string, unknown>)['visibilityState'];
  });

  it('baselines silently on the first run and persists the seen set', () => {
    const svc = create();
    save.write('arena:badges', ['a']); // first-badge already unlocked before the feature existed
    svc.start();
    expect(toast.show).not.toHaveBeenCalled();
    expect(save.read<string[] | null>('achievements:seen', null)).toContain('first-badge');
  });

  it('toasts newly unlocked achievements after navigation, once', () => {
    const svc = create();
    svc.start(); // baseline: nothing unlocked
    expect(save.read<string[] | null>('achievements:seen', null)).toEqual([]);

    save.write('arena:badges', ['a']);
    events.next(new NavigationEnd(1, '/', '/'));
    expect(toast.show).toHaveBeenCalledTimes(1);
    const arg = toast.show.mock.calls[0]![0];
    expect(arg.kind).toBe('achievement');
    expect(arg.title).toContain(TestBed.inject(I18nService).t('First Steps'));
    expect(arg.icon).toBe('shield-check');

    events.next(new NavigationEnd(2, '/x', '/x')); // nothing new
    expect(toast.show).toHaveBeenCalledTimes(1);
  });

  it('ignores non-NavigationEnd router events', () => {
    const svc = create();
    svc.start();
    save.write('arena:badges', ['a']);
    events.next({ type: 'other' });
    expect(toast.show).not.toHaveBeenCalled();
  });

  it('polls every 30s only while the tab is visible', () => {
    const svc = create();
    svc.start();
    save.write('arena:badges', ['a']);

    visibility = 'hidden';
    vi.advanceTimersByTime(30_000);
    expect(toast.show).not.toHaveBeenCalled();

    visibility = 'visible';
    vi.advanceTimersByTime(30_000);
    expect(toast.show).toHaveBeenCalledTimes(1);
  });

  it('catches up as soon as the tab becomes visible again', () => {
    const svc = create();
    svc.start();
    save.write('arena:badges', ['a']);
    visibility = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    expect(toast.show).not.toHaveBeenCalled();
    visibility = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    expect(toast.show).toHaveBeenCalledTimes(1);
  });

  it('start() is idempotent', () => {
    const svc = create();
    svc.start();
    svc.start();
    save.write('arena:badges', ['a']);
    events.next(new NavigationEnd(1, '/', '/'));
    expect(toast.show).toHaveBeenCalledTimes(1);
  });

  it('re-arms toasts after a progress reset', () => {
    const svc = create();
    save.write('arena:badges', ['a']);
    svc.start();
    save.write('arena:badges', []);
    events.next(new NavigationEnd(1, '/', '/'));
    expect(save.read<string[] | null>('achievements:seen', null)).toEqual([]);
    save.write('arena:badges', ['a']);
    events.next(new NavigationEnd(2, '/', '/'));
    expect(toast.show).toHaveBeenCalledTimes(1);
  });

  it('stops listening once destroyed', () => {
    const svc = create();
    svc.start();
    expect(events.observed).toBe(true);
    TestBed.resetTestingModule(); // destroys the injector -> DestroyRef callbacks
    expect(events.observed).toBe(false);
  });
});
