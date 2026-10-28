import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { WeatherOverlayComponent } from './weather-overlay';
import {
  AMBIENCE_FOR_ENGINE,
  AMBIENCE_INFO,
  pickWeather,
  weatherForType,
  type Ambience,
} from './weather';

describe('WeatherOverlayComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  function render(weather: Ambience, extra: Record<string, unknown> = {}) {
    const f = TestBed.createComponent(WeatherOverlayComponent);
    f.componentRef.setInput('weather', weather);
    for (const [k, v] of Object.entries(extra)) f.componentRef.setInput(k, v);
    f.detectChanges();
    return f;
  }
  const q = (f: { nativeElement: HTMLElement }, sel: string) =>
    f.nativeElement.querySelectorAll(sel);

  it('is purely decorative and exposes the weather on the host', () => {
    const f = render('rain');
    expect((f.nativeElement as HTMLElement).getAttribute('data-weather')).toBe('rain');
    expect(q(f, '.weather')[0]!.getAttribute('aria-hidden')).toBe('true');
    expect(q(f, '.sky')).toHaveLength(1);
  });

  const particles: [Ambience, string, number][] = [
    ['rain', '.drop', 28],
    ['storm', '.drop', 28],
    ['snow', '.flake', 24],
    ['sand', '.grain', 30],
    ['leaves', '.leaf', 12],
    ['fog', '.bank', 3],
  ];
  it.each(particles)('%s paints %s x%i', (weather, sel, count) => {
    expect(q(render(weather), sel)).toHaveLength(count);
  });

  it('adds weather-specific extras', () => {
    expect(q(render('storm'), '.lightning')).toHaveLength(1);
    expect(q(render('storm'), '.rain.dense')).toHaveLength(1);
    expect(q(render('sand'), '.haze')).toHaveLength(1);
    expect(q(render('sun'), '.sun-glow')).toHaveLength(1);
    expect(q(render('sun'), '.rays')).toHaveLength(1);
    expect(q(render('leaves'), '.leaf pv-icon')).toHaveLength(12);
  });

  it('draws no particles for clear skies', () => {
    const f = render('clear');
    expect(q(f, '.weather > *:not(.sky)')).toHaveLength(0);
    expect(q(f, '.weather-badge')).toHaveLength(0);
  });

  it('names the weather in a floating badge', () => {
    const f = render('storm');
    const badge = q(f, '.weather-badge')[0]!;
    expect(badge.textContent).toContain('Thunderstorm');
    expect(badge.getAttribute('title')).toBe('Thunderstorm');
    expect(badge.querySelector('svg')).not.toBeNull();
  });

  it('can hide the badge', () => {
    expect(q(render('rain', { showBadge: false }), '.weather-badge')).toHaveLength(0);
  });

  it('swaps the backdrop when the weather changes', () => {
    const f = render('rain');
    f.componentRef.setInput('weather', 'snow');
    f.detectChanges();
    expect(q(f, '.drop')).toHaveLength(0);
    expect(q(f, '.flake')).toHaveLength(24);
    expect((f.nativeElement as HTMLElement).getAttribute('data-weather')).toBe('snow');
  });
});

describe('weather helpers', () => {
  it('maps a type to the atmosphere it evokes, clear otherwise', () => {
    expect(weatherForType('fire')).toBe('sun');
    expect(weatherForType('water')).toBe('rain');
    expect(weatherForType('electric')).toBe('storm');
    expect(weatherForType('ghost')).toBe('fog');
    expect(weatherForType('normal')).toBe('clear');
  });

  it('weights the foe types first and de-duplicates', () => {
    expect(pickWeather(['fire'], ['water'])).toBe('rain');
    expect(pickWeather(['normal'], ['ice', 'ice'])).toBe('snow');
    expect(pickWeather(['normal'], ['normal'])).toBe('clear');
    expect(pickWeather([], [])).toBe('clear');
  });

  it('lets an injected picker choose among distinct candidates', () => {
    const seen: string[][] = [];
    const last = <T>(items: readonly T[]): T => {
      seen.push(items as unknown as string[]);
      return items[items.length - 1]!;
    };
    expect(pickWeather(['fire', 'water'], ['rock', 'ground'], last)).toBe('rain');
    expect(seen[0]).toEqual(['sand', 'sun', 'rain']);
  });

  it('covers every engine weather and describes every ambience', () => {
    expect(AMBIENCE_FOR_ENGINE).toEqual({
      none: 'clear',
      sun: 'sun',
      rain: 'rain',
      sand: 'sand',
      snow: 'snow',
    });
    for (const [id, info] of Object.entries(AMBIENCE_INFO)) {
      expect(info.id).toBe(id);
      expect(info.label).toBeTruthy();
    }
  });
});
