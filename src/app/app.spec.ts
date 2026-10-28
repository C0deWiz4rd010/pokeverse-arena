import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './app';
import { I18nService } from './core/i18n/i18n.service';
import { APP_VERSION } from './core/version';

interface AppInternals {
  paletteOpen: () => boolean;
  menuOpen: () => boolean;
  scrolled: () => boolean;
  showToTop: () => boolean;
}

describe('App shell', () => {
  let fixture: ComponentFixture<App>;
  let el: HTMLElement;
  const internals = (): AppInternals => fixture.componentInstance as unknown as AppInternals;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', children: [] }]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    el = fixture.nativeElement as HTMLElement;
  });
  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
  });

  it('offers a skip link to the main landmark', () => {
    const skip = el.querySelector('a.skip-link')!;
    expect(skip.getAttribute('href')).toBe('#main-content');
    const main = el.querySelector('main')!;
    expect(main.id).toBe('main-content');
    expect(main.getAttribute('tabindex')).toBe('-1');
  });

  it('renders every destination in the main nav with a title', () => {
    const links = Array.from(el.querySelectorAll('nav#site-nav a'));
    expect(links).toHaveLength(14);
    expect(links.map((a) => a.getAttribute('href'))).toContain('/pokedex');
    expect(links.map((a) => a.getAttribute('href'))).toContain('/profile');
    for (const a of links) {
      expect(a.getAttribute('title')).toBeTruthy();
      expect(a.querySelector('.nav-icon')!.getAttribute('aria-hidden')).toBe('true');
    }
    expect(el.querySelector('nav#site-nav')!.getAttribute('aria-label')).toBe('Main');
  });

  it('feeds the same destinations to the bottom nav and mounts toasts + install prompt', () => {
    expect(el.querySelector('pv-bottom-nav')).not.toBeNull();
    expect(el.querySelector('pv-toasts')).not.toBeNull();
    expect(el.querySelector('pv-install-prompt')).not.toBeNull();
  });

  it('toggles the mobile menu with correct ARIA state', () => {
    const burger = el.querySelector('button.burger') as HTMLButtonElement;
    expect(burger.getAttribute('aria-controls')).toBe('site-nav');
    expect(burger.getAttribute('aria-expanded')).toBe('false');
    burger.click();
    fixture.detectChanges();
    expect(burger.getAttribute('aria-expanded')).toBe('true');
    expect(el.querySelector('nav#site-nav')!.classList.contains('open')).toBe(true);
    burger.click();
    fixture.detectChanges();
    expect(el.querySelector('nav#site-nav')!.classList.contains('open')).toBe(false);
  });

  it('closes the menu when a nav link is chosen', async () => {
    (el.querySelector('button.burger') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(internals().menuOpen()).toBe(true);
    (el.querySelector('nav#site-nav a') as HTMLElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(internals().menuOpen()).toBe(false);
  });

  it('Ctrl+K toggles the command palette and closes the menu', () => {
    (el.querySelector('button.burger') as HTMLButtonElement).click();
    const press = (init: KeyboardEventInit): KeyboardEvent => {
      const e = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
      document.dispatchEvent(e);
      return e;
    };
    const first = press({ key: 'k', ctrlKey: true });
    expect(first.defaultPrevented).toBe(true);
    expect(internals().paletteOpen()).toBe(true);
    expect(internals().menuOpen()).toBe(false);
    press({ key: 'K', metaKey: true });
    expect(internals().paletteOpen()).toBe(false);
  });

  it('ignores a plain K or other shortcuts', () => {
    const plain = new KeyboardEvent('keydown', { key: 'k', cancelable: true });
    document.dispatchEvent(plain);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', ctrlKey: true }));
    expect(plain.defaultPrevented).toBe(false);
    expect(internals().paletteOpen()).toBe(false);
  });

  it('opens the palette from the search button', () => {
    const btn = el.querySelector('button.palette-btn') as HTMLButtonElement;
    expect(btn.getAttribute('aria-keyshortcuts')).toBe('Control+K Meta+K');
    btn.click();
    expect(internals().paletteOpen()).toBe(true);
  });

  it('switches the interface language from the header button', async () => {
    const i18n = TestBed.inject(I18nService);
    const btn = el.querySelector('button.lang-btn') as HTMLButtonElement;
    expect(btn.textContent!.trim()).toBe('EN');
    btn.click();
    await vi.waitFor(() => expect(i18n.locale()).toBe('de'));
    fixture.detectChanges();
    expect(btn.textContent!.trim()).toBe('DE');
    expect(document.documentElement.lang).toBe('de');
  });

  it('shows the app version in the footer', () => {
    expect(el.querySelector('footer .version')!.textContent!.trim()).toBe(`v${APP_VERSION}`);
  });

  it('tracks scroll position for the header shadow and back-to-top button', () => {
    const scrollTo = vi.fn();
    vi.stubGlobal('scrollTo', scrollTo);
    Object.defineProperty(window, 'scrollY', { value: 100, configurable: true });
    window.dispatchEvent(new Event('scroll'));
    fixture.detectChanges();
    expect(internals().scrolled()).toBe(true);
    expect(internals().showToTop()).toBe(false);
    expect(el.querySelector('header.topbar')!.classList.contains('scrolled')).toBe(true);
    expect(el.querySelector('button.to-top')).toBeNull();

    Object.defineProperty(window, 'scrollY', { value: 1200, configurable: true });
    window.dispatchEvent(new Event('scroll'));
    fixture.detectChanges();
    const top = el.querySelector('button.to-top') as HTMLButtonElement;
    expect(top.getAttribute('aria-label')).toBe('Back to top');

    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    top.click();
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    top.click();
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'auto' });
    vi.unstubAllGlobals();

    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
    window.dispatchEvent(new Event('scroll'));
    fixture.detectChanges();
    expect(internals().scrolled()).toBe(false);
    expect(el.querySelector('button.to-top')).toBeNull();
  });

  it('keeps the footer pending until the first route renders', () => {
    const footer = el.querySelector('footer')!;
    expect(footer.classList.contains('pending')).toBe(true);
  });
});
