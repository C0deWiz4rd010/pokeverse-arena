import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { ACCENT_THEMES, ThemeService } from './theme.service';

const prop = (name: string): string => document.documentElement.style.getPropertyValue(name);

describe('ThemeService', () => {
  const create = (): ThemeService => {
    TestBed.resetTestingModule();
    return TestBed.inject(ThemeService);
  };

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('style');
  });

  it('starts on Aurora with no inline overrides', () => {
    const t = create();
    expect(t.themeId()).toBe('aurora');
    expect(t.current().id).toBe('aurora');
    expect(prop('--accent')).toBe('');
    expect(t.themes).toBe(ACCENT_THEMES);
  });

  it('applies and persists another palette to the root tokens', () => {
    const t = create();
    t.setTheme('ember');
    expect(t.themeId()).toBe('ember');
    expect(prop('--accent')).toBe('#ff9d55');
    expect(prop('--accent-2')).toBe('#ff5d73');
    expect(prop('--accent-3')).toBe('#ffd166');
    expect(JSON.parse(localStorage.getItem('pv:theme:accent')!).data).toBe('ember');
  });

  it('drops the overrides again when going back to Aurora', () => {
    const t = create();
    t.setTheme('verdant');
    t.setTheme('aurora');
    expect(prop('--accent')).toBe('');
    expect(prop('--accent-2')).toBe('');
    expect(prop('--accent-3')).toBe('');
  });

  it('ignores unknown palette ids', () => {
    const t = create();
    t.setTheme('nope');
    expect(t.themeId()).toBe('aurora');
    expect(localStorage.getItem('pv:theme:accent')).toBeNull();
  });

  it('restores the saved palette on startup', () => {
    create().setTheme('sakura');
    const again = create();
    expect(again.current().name).toBe('Sakura');
    expect(prop('--accent')).toBe('#ec8fe6');
  });

  it('falls back to Aurora when the saved id is no longer known', () => {
    localStorage.setItem('pv:theme:accent', JSON.stringify({ v: 1, data: 'retired' }));
    const t = create();
    expect(t.current().id).toBe('aurora');
    expect(prop('--accent')).toBe('');
  });
});
