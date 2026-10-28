import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BattleMove } from '../../game/engine';
import { HapticsService } from '../haptics/haptics.service';
import { SaveService } from '../storage/save.service';
import type { PokemonType } from '../utils/type-chart';
import { BottomNavComponent, type BottomNavItem } from './bottom-nav/bottom-nav';
import { FieldBannerComponent } from './field-banner/field-banner';
import { InstallPromptComponent } from './install-prompt/install-prompt';
import { MoveButtonComponent } from './move-button/move-button';
import { ToastService } from './toast/toast.service';
import { ToastsComponent } from './toast/toasts';

beforeEach(() => {
  localStorage.clear();
  TestBed.resetTestingModule();
});

describe('ToastsComponent', () => {
  function setup() {
    vi.useFakeTimers();
    const svc = TestBed.inject(ToastService);
    const f = TestBed.createComponent(ToastsComponent);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    const refresh = () => f.detectChanges();
    return { svc, f, el, refresh };
  }
  afterEach(() => vi.useRealTimers());

  it('renders nothing while the queue is empty', () => {
    const { el } = setup();
    expect(el.querySelectorAll('button.toast')).toHaveLength(0);
    expect(el.querySelector('.sr-only[role="status"]')!.textContent!.trim()).toBe('');
  });

  it('mirrors every toast into a polite sr-only live region', () => {
    const { svc, el, refresh } = setup();
    svc.show({ title: 'Saved', text: 'All good', icon: 'check', kind: 'info' });
    refresh();
    const live = el.querySelector('.sr-only')!;
    expect(live.getAttribute('role')).toBe('status');
    expect(live.getAttribute('aria-live')).toBe('polite');
    expect(live.getAttribute('aria-atomic')).toBe('false');
    expect(live.textContent).toContain('Saved');
    expect(live.textContent).toContain('All good');
  });

  it('hides the visual copy from assistive tech and labels the dismiss button', () => {
    const { svc, el, refresh } = setup();
    svc.show({ title: 'Level up', icon: 'trophy', kind: 'achievement' });
    refresh();
    const btn = el.querySelector('button.toast') as HTMLButtonElement;
    expect(btn.getAttribute('aria-label')).toBe('Dismiss');
    expect(btn.getAttribute('title')).toBe('Dismiss');
    expect(btn.querySelector('.t-body')!.getAttribute('aria-hidden')).toBe('true');
    expect(btn.querySelector('.t-icon')!.getAttribute('aria-hidden')).toBe('true');
    expect(btn.classList.contains('achievement')).toBe(true);
    expect(btn.querySelector('.t-text')).toBeNull();
  });

  it('dismisses a toast when clicked', () => {
    const { svc, el, refresh } = setup();
    svc.show({ title: 'A', icon: 'check', kind: 'info' });
    svc.show({ title: 'B', text: 'details', icon: 'check', kind: 'info' });
    refresh();
    expect(el.querySelectorAll('button.toast')).toHaveLength(2);
    (el.querySelectorAll('button.toast')[0] as HTMLButtonElement).click();
    refresh();
    expect(svc.toasts().map((t) => t.title)).toEqual(['B']);
    expect(el.querySelectorAll('button.toast')).toHaveLength(1);
    expect(el.querySelector('.t-text')!.textContent).toBe('details');
  });

  it('holds a toast on hover/focus and releases it afterwards', () => {
    const { svc, el, refresh } = setup();
    svc.show({ title: 'Hold me', icon: 'check', kind: 'info' }, 2000);
    refresh();
    const btn = el.querySelector('button.toast') as HTMLButtonElement;
    btn.dispatchEvent(new Event('mouseenter'));
    vi.advanceTimersByTime(10_000);
    expect(svc.toasts()).toHaveLength(1);
    btn.dispatchEvent(new Event('mouseleave'));
    vi.advanceTimersByTime(1900);
    expect(svc.toasts()).toHaveLength(1);
    vi.advanceTimersByTime(200);
    expect(svc.toasts()).toHaveLength(0);
  });

  it('also pauses on keyboard focus', () => {
    const { svc, el, refresh } = setup();
    svc.show({ title: 'Focus', icon: 'check', kind: 'info' }, 2000);
    refresh();
    const btn = el.querySelector('button.toast') as HTMLButtonElement;
    btn.dispatchEvent(new Event('focus'));
    vi.advanceTimersByTime(10_000);
    expect(svc.toasts()).toHaveLength(1);
    btn.dispatchEvent(new Event('blur'));
    vi.advanceTimersByTime(2000);
    expect(svc.toasts()).toHaveLength(0);
  });
});

describe('MoveButtonComponent', () => {
  const move = (over: Partial<BattleMove> = {}): BattleMove => ({
    name: 'flamethrower',
    type: 'fire',
    power: 90,
    accuracy: 100,
    damageClass: 'special',
    ...over,
  });

  function render(m: BattleMove, extra: Record<string, unknown> = {}) {
    const f = TestBed.createComponent(MoveButtonComponent);
    f.componentRef.setInput('move', m);
    for (const [k, v] of Object.entries(extra)) f.componentRef.setInput(k, v);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    return {
      f,
      el,
      btn: el.querySelector('button.mv') as HTMLButtonElement,
      eff: el.querySelector('.mv-eff') as HTMLElement | null,
    };
  }

  it('links the button to its tooltip through aria-describedby', () => {
    const { btn, el } = render(move());
    const tip = el.querySelector('[role="tooltip"]')!;
    expect(tip.id).toMatch(/^pv-move-tip-\d+$/);
    expect(btn.getAttribute('aria-describedby')).toBe(tip.id);
  });

  it('gives every instance its own tooltip id', () => {
    const a = render(move()).el.querySelector('[role="tooltip"]')!.id;
    const b = render(move()).el.querySelector('[role="tooltip"]')!.id;
    expect(a).not.toBe(b);
  });

  it('shows name, type, power and accuracy', () => {
    const { el, btn } = render(move({ pp: 15, priority: 1 }));
    expect(el.querySelector('.mv-name')!.textContent!.trim()).toBe('Flamethrower');
    expect(el.querySelector('pv-type-badge')!.textContent!.trim()).toBe('Fire');
    const stats = el.querySelector('.mv-stats')!.textContent!;
    expect(stats).toContain('90');
    expect(stats).toContain('100%');
    expect(el.querySelector('.mv-cat')!.getAttribute('data-cat')).toBe('special');
    expect(btn.style.getPropertyValue('--c')).toBe('var(--type-fire)');
    const tip = el.querySelector('.tip-grid')!.textContent!;
    expect(tip).toContain('15');
    expect(tip).toContain('+1');
  });

  it('uses a dash for no-power and never-miss moves', () => {
    const { el } = render(move({ power: 0, accuracy: 0, damageClass: 'status', name: 'growl' }));
    const stats = el.querySelector('.mv-stats')!.textContent!;
    expect(stats.match(/—/g)).toHaveLength(2);
    expect(el.querySelector('.tip-desc')!.textContent).toContain('status move');
  });

  it('describes the move for screen readers, including notable effectiveness', () => {
    const plain = render(move());
    expect(plain.btn.getAttribute('aria-label')).toBe('Flamethrower, Special Fire move, power 90');
    TestBed.resetTestingModule();
    const sup = render(move(), { defenderTypes: ['grass'] as PokemonType[] });
    expect(sup.btn.getAttribute('aria-label')).toBe(
      'Flamethrower, Special Fire move, power 90, Super effective',
    );
    TestBed.resetTestingModule();
    const neutral = render(move(), { defenderTypes: ['normal'] as PokemonType[] });
    expect(neutral.btn.getAttribute('aria-label')).not.toContain('effective');
  });

  it('shows no effectiveness badge without defender types or power', () => {
    expect(render(move()).eff).toBeNull();
    TestBed.resetTestingModule();
    expect(
      render(move({ power: 0, damageClass: 'status' }), {
        defenderTypes: ['grass'] as PokemonType[],
      }).eff,
    ).toBeNull();
  });

  const cases: [PokemonType[], string, string, string][] = [
    [['grass'], '×2', 'super', 'Super effective'],
    [['grass', 'bug'], '×4', 'super', 'Super effective'],
    [['water'], '×½', 'resist', 'Not very effective'],
    [['water', 'rock'], '×¼', 'resist', 'Not very effective'],
    [['normal'], '×1', 'neutral', 'Neutral'],
  ];
  it.each(cases)('badges %j against the defender as %s (%s)', (defenders, short, tier, label) => {
    const { eff, el } = render(move(), { defenderTypes: defenders });
    expect(eff!.textContent!.trim()).toBe(short);
    expect(eff!.getAttribute('data-tier')).toBe(tier);
    expect(el.querySelector('.tip-eff')!.textContent).toContain(label);
  });

  it('flags immunity with ×0', () => {
    const { eff } = render(move({ type: 'ground', name: 'earthquake' }), {
      defenderTypes: ['flying'] as PokemonType[],
    });
    expect(eff!.textContent!.trim()).toBe('×0');
    expect(eff!.getAttribute('data-tier')).toBe('immune');
  });

  it('renders a hotkey keycap only when given one', () => {
    expect(render(move()).el.querySelector('kbd')).toBeNull();
    TestBed.resetTestingModule();
    const k = render(move(), { hotkey: 3 }).el.querySelector('kbd')!;
    expect(k.textContent).toBe('3');
    expect(k.getAttribute('aria-hidden')).toBe('true');
  });

  it('emits picked on click and not when disabled', () => {
    const { f, btn } = render(move());
    const picked = vi.fn();
    f.componentInstance.picked.subscribe(picked);
    btn.click();
    expect(picked).toHaveBeenCalledTimes(1);
    f.componentRef.setInput('disabled', true);
    f.detectChanges();
    expect(btn.disabled).toBe(true);
    btn.click();
    expect(picked).toHaveBeenCalledTimes(1);
  });

  it('describes accuracy risk and priority in the blurb', () => {
    const risky = render(move({ accuracy: 70, priority: 1 }));
    const text = risky.el.querySelector('.tip-desc')!.textContent!;
    expect(text).toContain('risky to land');
    expect(text).toContain('strikes first');
    TestBed.resetTestingModule();
    const sure = render(move({ accuracy: 0, power: 130 }));
    const t2 = sure.el.querySelector('.tip-desc')!.textContent!;
    expect(t2).toContain('devastating');
    expect(t2).toContain('never misses');
  });
});

describe('BottomNavComponent', () => {
  const items: BottomNavItem[] = [
    { path: '/pokedex', label: 'Pokédex', icon: 'book' },
    { path: '/spire', label: 'Spire', icon: 'mountain' },
    { path: '/world', label: 'World', icon: 'map' },
  ];

  function setup() {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: '**', children: [] }])],
    });
    const f = TestBed.createComponent(BottomNavComponent);
    f.componentRef.setInput('items', items);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    const fire = vi.spyOn(TestBed.inject(HapticsService), 'fire');
    const more = () => el.querySelector('button.bslot') as HTMLButtonElement;
    return { f, el, fire, more };
  }

  it('labels the primary nav and renders the five slots', () => {
    const { el } = setup();
    expect(el.querySelector('nav')!.getAttribute('aria-label')).toBe('Primary');
    const hrefs = Array.from(el.querySelectorAll('nav a.bslot')).map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/', '/pokedex', '/battle', '/adventure']);
    expect(el.querySelector('a.center')!.getAttribute('aria-label')).toBe('Battle');
  });

  it('starts with the sheet closed and no aria-controls', () => {
    const { el, more } = setup();
    expect(el.querySelector('#pv-more-sheet')).toBeNull();
    expect(more().getAttribute('aria-expanded')).toBe('false');
    expect(more().hasAttribute('aria-controls')).toBe(false);
    expect(more().getAttribute('aria-haspopup')).toBe('dialog');
    expect(more().getAttribute('aria-label')).toBe('More');
  });

  it('opens the sheet as a modal dialog that the button controls', () => {
    const { f, el, more, fire } = setup();
    more().click();
    f.detectChanges();
    const sheet = el.querySelector('#pv-more-sheet')!;
    expect(sheet.getAttribute('role')).toBe('dialog');
    expect(sheet.getAttribute('aria-modal')).toBe('true');
    expect(sheet.getAttribute('aria-label')).toBe('All sections');
    expect(more().getAttribute('aria-expanded')).toBe('true');
    expect(more().getAttribute('aria-controls')).toBe('pv-more-sheet');
    expect(fire).toHaveBeenCalledWith('tap');
    const links = Array.from(sheet.querySelectorAll('a.sheet-item'));
    expect(links.map((a) => a.getAttribute('href'))).toEqual(items.map((i) => i.path));
    expect(links[0]!.textContent).toContain('Pokédex');
  });

  it('closes via the scrim', () => {
    const { f, el, more } = setup();
    more().click();
    f.detectChanges();
    (el.querySelector('.sheet-scrim') as HTMLElement).click();
    f.detectChanges();
    expect(el.querySelector('#pv-more-sheet')).toBeNull();
    expect(more().getAttribute('aria-expanded')).toBe('false');
  });

  it('closes on Escape', () => {
    const { f, el, more } = setup();
    more().click();
    f.detectChanges();
    el.querySelector('#pv-more-sheet')!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    f.detectChanges();
    expect(el.querySelector('#pv-more-sheet')).toBeNull();
  });

  it('closes after picking a destination and gives haptic feedback', async () => {
    const { f, el, more, fire } = setup();
    more().click();
    f.detectChanges();
    fire.mockClear();
    (el.querySelector('a.sheet-item') as HTMLElement).click();
    f.detectChanges();
    await f.whenStable();
    expect(el.querySelector('#pv-more-sheet')).toBeNull();
    expect(fire).toHaveBeenCalledWith('select');
  });

  it('fires a select haptic when a tab is tapped', async () => {
    const { f, el, fire } = setup();
    (el.querySelector('a.bslot') as HTMLElement).click();
    await f.whenStable();
    expect(fire).toHaveBeenCalledWith('select');
  });
});

describe('FieldBannerComponent', () => {
  function render(inputs: Record<string, unknown>) {
    const f = TestBed.createComponent(FieldBannerComponent);
    for (const [k, v] of Object.entries(inputs)) f.componentRef.setInput(k, v);
    f.detectChanges();
    return f;
  }

  it('renders nothing on a clear field', () => {
    const f = render({ weather: 'none', terrain: 'none' });
    expect((f.nativeElement as HTMLElement).querySelector('.field-banner')).toBeNull();
  });

  it('shows weather and terrain chips with their remaining turns', () => {
    const f = render({ weather: 'rain', terrain: 'grassy', weatherTurns: 4, terrainTurns: 2 });
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('.field-banner')!.getAttribute('aria-live')).toBe('polite');
    const chips = el.querySelectorAll('.chip');
    expect(chips).toHaveLength(2);
    expect(chips[0]!.classList.contains('weather')).toBe(true);
    expect(chips[0]!.textContent).toContain('Rain');
    expect(chips[0]!.querySelector('small')!.textContent).toBe('4');
    expect(chips[1]!.classList.contains('terrain')).toBe(true);
    expect(chips[1]!.textContent).toContain('Grassy Terrain');
    expect(chips[1]!.querySelector('small')!.textContent).toBe('2');
  });

  it('hides the turn counter for an effect without a duration', () => {
    const f = render({ weather: 'sand', terrain: 'none' });
    const chips = (f.nativeElement as HTMLElement).querySelectorAll('.chip');
    expect(chips).toHaveLength(1);
    expect(chips[0]!.textContent).toContain('Sandstorm');
    expect(chips[0]!.querySelector('small')).toBeNull();
  });

  it('updates when the field changes', () => {
    const f = render({ weather: 'none', terrain: 'none' });
    f.componentRef.setInput('terrain', 'electric');
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).querySelectorAll('.chip')).toHaveLength(1);
  });
});

describe('InstallPromptComponent', () => {
  type Evt = Event & { prompt: ReturnType<typeof vi.fn>; userChoice: Promise<unknown> };
  const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)';

  const setUa = (ua: string): void => {
    Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
  };
  function create() {
    const f = TestBed.createComponent(InstallPromptComponent);
    f.detectChanges();
    return { f, el: f.nativeElement as HTMLElement };
  }
  function installEvent(): Evt {
    const e = new Event('beforeinstallprompt', { cancelable: true }) as Evt;
    e.prompt = vi.fn(() => Promise.resolve());
    e.userChoice = Promise.resolve({ outcome: 'accepted' });
    return e;
  }
  const saved = (): unknown =>
    TestBed.inject(SaveService).read<boolean | null>('install-dismissed', null);

  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'userAgent');
  });

  it('stays hidden until the browser offers an install', () => {
    const { el } = create();
    expect(el.querySelector('.install')).toBeNull();
  });

  it('offers a one-tap install after beforeinstallprompt and defers the native prompt', async () => {
    const { f, el } = create();
    const ev = installEvent();
    window.dispatchEvent(ev);
    f.detectChanges();
    expect(ev.defaultPrevented).toBe(true);
    const banner = el.querySelector('.install')!;
    expect(banner.getAttribute('role')).toBe('region');
    expect(banner.getAttribute('aria-label')).toBe('Install app');
    expect(banner.textContent).toContain('Install PokéVerse Arena');
    expect(banner.textContent).toContain('Play fullscreen');

    (el.querySelector('button.go') as HTMLButtonElement).click();
    await vi.advanceTimersByTimeAsync(0);
    f.detectChanges();
    expect(ev.prompt).toHaveBeenCalledTimes(1);
    expect(el.querySelector('.install')).toBeNull();
    expect(saved()).toBe(true);
  });

  it('can be dismissed with the labelled close button and stays dismissed', () => {
    const { f, el } = create();
    window.dispatchEvent(installEvent());
    f.detectChanges();
    const x = el.querySelector('button.x') as HTMLButtonElement;
    expect(x.getAttribute('aria-label')).toBe('Dismiss');
    x.click();
    f.detectChanges();
    expect(el.querySelector('.install')).toBeNull();
    expect(saved()).toBe(true);

    const again = create();
    window.dispatchEvent(installEvent());
    again.f.detectChanges();
    expect(again.el.querySelector('.install')).toBeNull();
  });

  it('hides after the appinstalled event and remembers it', () => {
    const { f, el } = create();
    window.dispatchEvent(installEvent());
    f.detectChanges();
    window.dispatchEvent(new Event('appinstalled'));
    f.detectChanges();
    expect(el.querySelector('.install')).toBeNull();
    expect(saved()).toBe(true);
  });

  it('shows the manual Share hint on iOS after a short delay, without an install button', () => {
    setUa(IOS_UA);
    const { f, el } = create();
    vi.advanceTimersByTime(2500);
    f.detectChanges();
    expect(el.querySelector('.install')).toBeNull();
    vi.advanceTimersByTime(200);
    f.detectChanges();
    const banner = el.querySelector('.install')!;
    expect(banner.textContent).toContain('Add to Home Screen');
    expect(banner.querySelector('button.go')).toBeNull();
    expect(banner.querySelector('button.x')).not.toBeNull();
  });

  it('never shows when already installed (standalone display mode)', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('standalone') }));
    setUa(IOS_UA);
    const { f, el } = create();
    vi.advanceTimersByTime(5000);
    window.dispatchEvent(installEvent());
    f.detectChanges();
    expect(el.querySelector('.install')).toBeNull();
  });

  it('install() without a deferred event is a harmless no-op', () => {
    const { f } = create();
    const inst = f.componentInstance as unknown as { install: () => Promise<void> };
    return expect(inst.install()).resolves.toBeUndefined();
  });
});
