/* eslint-disable @typescript-eslint/unbound-method */
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SfxService } from '../../core/audio/sfx.service';
import { HapticsService } from '../../core/haptics/haptics.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { SaveService } from '../../core/storage/save.service';
import { ThemeService } from '../../core/theme/theme.service';
import { ToastService } from '../../core/ui/toast/toast.service';
import { PokedexService } from '../pokedex/pokedex.service';
import { ProfileComponent } from './profile';
import { ProfileService } from './profile.service';

/** A canvas 2D context that accepts every call (jsdom has none). */
function fakeContext(): CanvasRenderingContext2D {
  const store: Record<string | symbol, unknown> = {};
  return new Proxy(store, {
    get: (t, p) => {
      if (p === 'measureText') return () => ({ width: 10 });
      if (p in t) return t[p];
      if (typeof p === 'string' && p.startsWith('create')) return () => ({ addColorStop() {} });
      return () => undefined;
    },
    set: (t, p, v) => {
      t[p] = v;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

describe('ProfileComponent', () => {
  let fixture: ComponentFixture<ProfileComponent>;
  let toast: { show: ReturnType<typeof vi.fn> };
  let sfx: {
    muted: ReturnType<typeof signal<boolean>>;
    volume: ReturnType<typeof signal<number>>;
    setMuted: ReturnType<typeof vi.fn>;
    setVolume: ReturnType<typeof vi.fn>;
  };
  let haptics: {
    supported: boolean;
    enabled: ReturnType<typeof signal<boolean>>;
    toggle: ReturnType<typeof vi.fn>;
  };
  let anchorClick: ReturnType<typeof vi.spyOn>;

  const root = () => fixture.nativeElement as HTMLElement;
  const text = () => root().textContent ?? '';
  const flush = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const byText = (label: string) =>
    [...root().querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent?.includes(label),
    );

  async function mount(): Promise<void> {
    fixture = TestBed.createComponent(ProfileComponent);
    await flush();
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    toast = { show: vi.fn() };
    sfx = {
      muted: signal(false),
      volume: signal(0.6),
      setMuted: vi.fn((on: boolean) => sfx.muted.set(on)),
      setVolume: vi.fn(),
    };
    haptics = { supported: true, enabled: signal(true), toggle: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: ToastService, useValue: toast },
        { provide: SfxService, useValue: sfx },
        { provide: HapticsService, useValue: haptics },
        { provide: PokedexService, useValue: { favorites: signal(new Set([25, 6, 1, 4])) } },
      ],
    });
    anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    Object.assign(URL, {
      createObjectURL: vi.fn(() => 'blob:fake'),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders identity, rank, records, mastery and achievements', async () => {
    const save = TestBed.inject(SaveService);
    save.write('arena:badges', ['a', 'b']);
    save.write('world:caught', [1, 2, 3]);
    await mount();

    expect(root().querySelector('.id-name strong')!.textContent).toBe('Trainer');
    expect(text()).toContain('Rising Challenger');
    expect(root().querySelector('.rank-badge')!.textContent).toContain('Rookie');
    expect(root().querySelector('.rank-next')!.textContent).toContain('to Adept');
    expect(root().querySelectorAll('.record')).toHaveLength(21);
    expect(text()).toContain(`2 / ${TestBed.inject(ProfileService).state().totalBadges}`);
    expect(root().querySelectorAll('.bar-row')).toHaveLength(6);
    expect(root().querySelectorAll('.ach')).toHaveLength(
      TestBed.inject(ProfileService).totalAchievements,
    );
    // unlocked achievements sort first
    expect(root().querySelector('.ach')!.classList.contains('on')).toBe(true);
    expect(root().querySelector('.ring-label strong')!.textContent).toContain('%');
  });

  it('shows the max rank message once the top tier is reached', async () => {
    const save = TestBed.inject(SaveService);
    save.write('spire:meta', {
      bestDepth: 12,
      clears: 10,
      bankedCoins: 0,
      ascension: 5,
      chimeraWins: 0,
    });
    await mount();
    expect(root().querySelector('.rank-next.maxed')!.textContent).toContain('Max rank reached');
  });

  it('edits and persists the trainer identity', async () => {
    await mount();
    root().querySelector<HTMLButtonElement>('.id-name .link')!.click();
    await flush();

    const [name, title] = [...root().querySelectorAll<HTMLInputElement>('.id-edit input')];
    expect(name!.value).toBe('Trainer');
    name!.value = 'Red';
    name!.dispatchEvent(new Event('input'));
    title!.value = 'Champion';
    title!.dispatchEvent(new Event('input'));
    byText('Save')!.click();
    await flush();

    expect(root().querySelector('.id-name strong')!.textContent).toBe('Red');
    expect(text()).toContain('Champion');
    expect(root().querySelector('.id-edit')).toBeNull();
    expect(TestBed.inject(SaveService).read('profile:identity', null)).toEqual({
      name: 'Red',
      title: 'Champion',
    });
  });

  it('switches the accent theme and the language', async () => {
    await mount();
    const chips = [
      ...root().querySelectorAll<HTMLButtonElement>('.themes')[0]!.querySelectorAll('button'),
    ];
    expect(chips[0]!.getAttribute('aria-pressed')).toBe('true');
    chips[1]!.click();
    await flush();
    expect(TestBed.inject(ThemeService).themeId()).toBe(TestBed.inject(ThemeService).themes[1]!.id);
    expect(chips[1]!.classList.contains('on')).toBe(true);

    const langs = [...root().querySelectorAll<HTMLButtonElement>('.lang-chip')];
    expect(langs.length).toBeGreaterThan(1);
    const other = langs.find((l) => l.getAttribute('aria-pressed') === 'false')!;
    other.click();
    await flush();
    expect(TestBed.inject(I18nService).locale()).toBe(other.getAttribute('lang'));
    void TestBed.inject(I18nService).set('en');
  });

  it('toggles sound and volume, and haptics when supported', async () => {
    await mount();
    const sound = root().querySelector<HTMLButtonElement>('.setting-row')!;
    expect(sound.getAttribute('aria-checked')).toBe('true');
    sound.click();
    expect(sfx.setMuted).toHaveBeenCalledWith(true);
    await flush();
    expect(root().querySelector('.vol-row')!.classList.contains('off')).toBe(true);
    expect(root().querySelector<HTMLInputElement>('.vol-row input')!.disabled).toBe(true);

    sfx.muted.set(false);
    await flush();
    const slider = root().querySelector<HTMLInputElement>('.vol-row input')!;
    slider.value = '35';
    slider.dispatchEvent(new Event('input'));
    expect(sfx.setVolume).toHaveBeenCalledWith(0.35);

    byText('Haptic feedback')!.click();
    expect(haptics.toggle).toHaveBeenCalled();
  });

  it('hides the haptics switch on devices without vibration', async () => {
    haptics.supported = false;
    await mount();
    expect(text()).not.toContain('Haptic feedback');
  });

  describe('trainer card', () => {
    beforeEach(() => {
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
        () => fakeContext() as never,
      );
      vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb) =>
        cb(new Blob(['png'], { type: 'image/png' })),
      );
      vi.stubGlobal(
        'Image',
        class {
          crossOrigin = '';
          onload: (() => void) | null = null;
          onerror: (() => void) | null = null;
          set src(_v: string) {
            queueMicrotask(() => this.onerror?.());
          }
        },
      );
    });

    it('shares the rendered PNG through the native share sheet when files are supported', async () => {
      const share = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });
      Object.defineProperty(navigator, 'share', { value: share, configurable: true });
      await mount();
      byText('Share Trainer Card')!.click();
      await vi.waitFor(() => expect(share).toHaveBeenCalled());
      const arg = share.mock.calls[0]![0] as { files: File[] };
      expect(arg.files[0]!.name).toBe('trainer-card.png');
      expect(toast.show).not.toHaveBeenCalled();
      await flush();
      expect(byText('Share Trainer Card')!.disabled).toBe(false);
      Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    });

    it('falls back to a download with a confirmation toast', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout'] });
      Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
      await mount();
      byText('Share Trainer Card')!.click();
      await vi.waitFor(() => expect(toast.show).toHaveBeenCalled());
      expect(anchorClick).toHaveBeenCalled();
      expect(toast.show.mock.calls[0]![0].title).toBe('Trainer Card saved');
      vi.advanceTimersByTime(4000);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake');
    });

    it('reports a failure but stays quiet when the share sheet is dismissed', async () => {
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
      await mount();
      byText('Share Trainer Card')!.click();
      await vi.waitFor(() => expect(toast.show).toHaveBeenCalled());
      expect(toast.show.mock.calls[0]![0].title).toBe('Could not create the card');

      toast.show.mockClear();
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
        () => fakeContext() as never,
      );
      Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });
      Object.defineProperty(navigator, 'share', {
        value: vi.fn().mockRejectedValue(new DOMException('x', 'AbortError')),
        configurable: true,
      });
      await flush();
      byText('Share Trainer Card')!.click();
      await vi.waitFor(() => expect(navigator.share).toHaveBeenCalled());
      await flush();
      expect(toast.show).not.toHaveBeenCalled();
      Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    });
  });

  describe('backup', () => {
    it('exports every owned save as a JSON download', async () => {
      localStorage.setItem('pv:arena:badges', '{"v":1,"data":["a"]}');
      localStorage.setItem('unrelated', 'x');
      let blob: Blob | undefined;
      (URL.createObjectURL as ReturnType<typeof vi.fn>).mockImplementation((b: Blob) => {
        blob = b;
        return 'blob:fake';
      });
      await mount();
      root().querySelector<HTMLButtonElement>('.data-actions .btn')!.click();

      expect(anchorClick).toHaveBeenCalled();
      const json = JSON.parse(await blob!.text()) as {
        app: string;
        entries: Record<string, string>;
      };
      expect(json.app).toBe('pokeverse-arena');
      expect(Object.keys(json.entries)).toContain('pv:arena:badges');
      expect(Object.keys(json.entries)).not.toContain('unrelated');
      expect(toast.show.mock.calls[0]![0].title).toBe('Save exported');
    });

    it('reports an export failure', async () => {
      (URL.createObjectURL as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('nope');
      });
      await mount();
      root().querySelector<HTMLButtonElement>('.data-actions .btn')!.click();
      expect(toast.show.mock.calls[0]![0].title).toBe('Export failed');
    });

    const importFile = async (content: string): Promise<void> => {
      const input = root().querySelector<HTMLInputElement>('input[type="file"]')!;
      Object.defineProperty(input, 'files', {
        value: [new File([content], 'save.json', { type: 'application/json' })],
        configurable: true,
      });
      input.dispatchEvent(new Event('change'));
      for (let i = 0; i < 50; i++) await Promise.resolve();
    };

    it('ignores an empty file selection', async () => {
      await mount();
      const input = root().querySelector<HTMLInputElement>('input[type="file"]')!;
      input.dispatchEvent(new Event('change'));
      for (let i = 0; i < 10; i++) await Promise.resolve();
      expect(toast.show).not.toHaveBeenCalled();
    });

    it('rejects a file that is not a backup', async () => {
      await mount();
      await importFile('not json');
      await vi.waitFor(() => expect(toast.show).toHaveBeenCalled());
      expect(toast.show.mock.calls[0]![0]).toMatchObject({
        title: 'Import failed',
        text: 'This file is not valid JSON.',
      });
    });

    it('does nothing when the restore is not confirmed', async () => {
      const confirmSpy = vi.fn().mockReturnValue(false);
      vi.stubGlobal('confirm', confirmSpy);
      await mount();
      await importFile(
        JSON.stringify({
          app: 'pokeverse-arena',
          format: 1,
          entries: { 'pv:arena:coins': '{"v":1,"data":5}' },
        }),
      );
      await vi.waitFor(() => expect(confirmSpy).toHaveBeenCalled());
      expect(confirmSpy.mock.calls[0]![0]).toContain('Restore 1 saved entries');
      expect(localStorage.getItem('pv:arena:coins')).toBeNull();
    });

    it('restores confirmed entries into localStorage', async () => {
      vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
      await mount();
      await importFile(
        JSON.stringify({
          app: 'pokeverse-arena',
          format: 1,
          entries: { 'pv:arena:coins': '{"v":1,"data":5}' },
        }),
      );
      await vi.waitFor(() =>
        expect(localStorage.getItem('pv:arena:coins')).toBe('{"v":1,"data":5}'),
      );
    });

    it('reports entries that could not be written', async () => {
      vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('quota');
      });
      await mount();
      await importFile(
        JSON.stringify({
          app: 'pokeverse-arena',
          format: 1,
          entries: { 'pv:arena:coins': '{"v":1,"data":5}' },
        }),
      );
      await vi.waitFor(() => expect(toast.show).toHaveBeenCalled());
      expect(toast.show.mock.calls[0]![0].title).toBe('Import incomplete');
    });
  });
});
