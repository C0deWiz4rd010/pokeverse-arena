import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import type { PokemonStats } from '../models/pokemon.model';
import { ICONS } from './icon/icons.data';
import { IconComponent } from './icon/icon';
import { PageHeaderComponent } from './page-header/page-header';
import { SpinnerComponent } from './spinner/spinner';
import { StatBarComponent } from './stat-bar/stat-bar';
import { RADAR_MAX, radarPoint, shapePoints } from './stat-radar/radar-geometry';
import { StatRadarComponent } from './stat-radar/stat-radar';
import { StateComponent } from './state/state';
import { TypeBadgeComponent } from './type-badge/type-badge';

beforeEach(() => {
  localStorage.clear();
  TestBed.resetTestingModule();
});

describe('IconComponent', () => {
  function render(inputs: Record<string, unknown>) {
    const f = TestBed.createComponent(IconComponent);
    for (const [k, v] of Object.entries(inputs)) f.componentRef.setInput(k, v);
    f.detectChanges();
    return (f.nativeElement as HTMLElement).querySelector('svg') as SVGElement;
  }

  it('is decorative by default and follows the font size', () => {
    const svg = render({ name: 'sword' });
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.hasAttribute('role')).toBe(false);
    expect(svg.hasAttribute('aria-label')).toBe(false);
    expect(svg.style.width).toBe('1em');
    expect(svg.style.height).toBe('1em');
    expect(svg.getAttribute('stroke-width')).toBe('2');
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
  });

  it('applies an explicit pixel size and stroke width', () => {
    const svg = render({ name: 'sword', size: 28, strokeWidth: 1.5 });
    expect(svg.style.width).toBe('28px');
    expect(svg.style.height).toBe('28px');
    expect(svg.getAttribute('stroke-width')).toBe('1.5');
  });

  it('becomes a labelled image when given a label', () => {
    const svg = render({ name: 'trophy', label: 'Champion' });
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('Champion');
    expect(svg.hasAttribute('aria-hidden')).toBe(false);
  });

  it('draws the geometry of the requested icon', () => {
    const a = render({ name: 'sword' });
    const aShapes = a.querySelectorAll('path, circle, line, rect, polyline, polygon').length;
    expect(aShapes).toBeGreaterThan(0);
    TestBed.resetTestingModule();
    const b = render({ name: 'trophy' });
    expect(b.innerHTML).not.toBe(a.innerHTML);
    expect(ICONS['trophy']).toBeTruthy();
  });
});

describe('SpinnerComponent', () => {
  function render(label?: string) {
    const f = TestBed.createComponent(SpinnerComponent);
    if (label !== undefined) f.componentRef.setInput('label', label);
    f.detectChanges();
    return f.nativeElement as HTMLElement;
  }

  it('announces a default loading message as a status', () => {
    const el = render();
    const wrap = el.querySelector('[role="status"]')!;
    expect(wrap.getAttribute('aria-label')).toBe('Loading…');
    expect(el.querySelector('.text')!.textContent!.trim()).toBe('Loading…');
  });

  it('shows a custom label', () => {
    const el = render('Fetching moves');
    expect(el.querySelector('[role="status"]')!.getAttribute('aria-label')).toBe('Fetching moves');
    expect(el.querySelector('.text')!.textContent!.trim()).toBe('Fetching moves');
  });

  it('omits the visible text for an empty label', () => {
    const el = render('');
    expect(el.querySelector('.text')).toBeNull();
  });
});

describe('PageHeaderComponent', () => {
  function render(inputs: Record<string, unknown>) {
    const f = TestBed.createComponent(PageHeaderComponent);
    for (const [k, v] of Object.entries(inputs)) f.componentRef.setInput(k, v);
    f.detectChanges();
    return f.nativeElement as HTMLElement;
  }

  it('renders the title as the page heading', () => {
    const el = render({ title: 'Pokédex' });
    expect(el.querySelector('h1')!.textContent!.trim()).toBe('Pokédex');
    expect(el.querySelector('.chip')).toBeNull();
    expect(el.querySelector('.sub')).toBeNull();
  });

  it('adds the icon chip (decorative) and subtitle when given', () => {
    const el = render({ title: 'Arena', subtitle: 'Fight on', icon: 'swords' });
    const chip = el.querySelector('.chip')!;
    expect(chip.getAttribute('aria-hidden')).toBe('true');
    expect(chip.querySelector('pv-icon svg')).not.toBeNull();
    expect(el.querySelector('.sub')!.textContent!.trim()).toBe('Fight on');
  });
});

describe('StateComponent', () => {
  function render(inputs: Record<string, unknown>) {
    const f = TestBed.createComponent(StateComponent);
    for (const [k, v] of Object.entries(inputs)) f.componentRef.setInput(k, v);
    f.detectChanges();
    return { f, el: f.nativeElement as HTMLElement };
  }

  it('shows a spinner labelled with the title while loading', () => {
    const { el } = render({ kind: 'loading', title: 'Loading Pokédex' });
    expect(el.querySelector('pv-spinner')).not.toBeNull();
    expect(el.querySelector('[role="status"]')!.getAttribute('aria-label')).toBe('Loading Pokédex');
    expect(el.querySelector('button')).toBeNull();
    expect(el.querySelector('.state')!.hasAttribute('role')).toBe(false);
  });

  it('shows an empty state with title and text but no alert role', () => {
    const { el } = render({ kind: 'empty', title: 'Nothing here', text: 'Try another filter' });
    expect(el.querySelector('.title')!.textContent).toBe('Nothing here');
    expect(el.querySelector('.text')!.textContent).toBe('Try another filter');
    expect(el.querySelector('.state')!.hasAttribute('role')).toBe(false);
    expect(el.querySelector('pv-spinner')).toBeNull();
    expect(el.querySelector('.icon')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('announces errors as an alert and emits the retry action', () => {
    const { f, el } = render({
      kind: 'error',
      title: 'Failed',
      actionLabel: 'Retry',
    });
    expect(el.querySelector('.state')!.getAttribute('role')).toBe('alert');
    let clicks = 0;
    f.componentInstance.action.subscribe(() => clicks++);
    const btn = el.querySelector('button')!;
    expect(btn.textContent!.trim()).toBe('Retry');
    btn.click();
    expect(clicks).toBe(1);
  });

  it('uses a different default icon for errors and empty states', () => {
    const empty = render({ kind: 'empty' }).el.querySelector('.icon svg')!.innerHTML;
    TestBed.resetTestingModule();
    const error = render({ kind: 'error' }).el.querySelector('.icon svg')!.innerHTML;
    expect(empty).not.toBe(error);
  });

  it('honours an explicit icon and can drop the glass card', () => {
    const { el } = render({ kind: 'empty', icon: 'trophy', card: false });
    expect(el.querySelector('.state')!.classList.contains('glass')).toBe(false);
    TestBed.resetTestingModule();
    const withCard = render({ kind: 'empty' }).el;
    expect(withCard.querySelector('.state')!.classList.contains('glass')).toBe(true);
  });

  it('omits optional parts when not provided', () => {
    const { el } = render({ kind: 'empty' });
    expect(el.querySelector('.title')).toBeNull();
    expect(el.querySelector('.text')).toBeNull();
    expect(el.querySelector('button')).toBeNull();
  });
});

describe('StatBarComponent', () => {
  function render(inputs: Record<string, unknown>) {
    const f = TestBed.createComponent(StatBarComponent);
    for (const [k, v] of Object.entries(inputs)) f.componentRef.setInput(k, v);
    f.detectChanges();
    return f.nativeElement as HTMLElement;
  }

  it('exposes the value as an accessible meter', () => {
    const el = render({ label: 'attack', value: 90 });
    const meter = el.querySelector('[role="meter"]')!;
    expect(meter.getAttribute('aria-valuemin')).toBe('0');
    expect(meter.getAttribute('aria-valuemax')).toBe('180');
    expect(meter.getAttribute('aria-valuenow')).toBe('90');
    expect(meter.getAttribute('aria-label')).toBe('attack');
    expect(el.querySelector('.label')!.textContent).toBe('attack');
    expect(el.querySelector('.value')!.textContent).toBe('90');
  });

  it('scales the fill to the max and caps it at 100%', () => {
    expect(
      (render({ label: 'hp', value: 90 }).querySelector('.fill') as HTMLElement).style.width,
    ).toBe('50%');
    TestBed.resetTestingModule();
    const over = render({ label: 'hp', value: 300 });
    expect((over.querySelector('.fill') as HTMLElement).style.width).toBe('100%');
    expect(over.querySelector('[role="meter"]')!.getAttribute('aria-valuenow')).toBe('300');
  });

  it('honours a custom max', () => {
    const el = render({ label: 'hp', value: 100, max: 255 });
    expect(el.querySelector('[role="meter"]')!.getAttribute('aria-valuemax')).toBe('255');
    const w = parseFloat((el.querySelector('.fill') as HTMLElement).style.width);
    expect(w).toBeCloseTo((100 / 255) * 100, 3);
  });

  it('colours the bar by value tier', () => {
    const colors = [20, 40, 60, 90, 120].map((value) => {
      TestBed.resetTestingModule();
      const f = TestBed.createComponent(StatBarComponent);
      f.componentRef.setInput('label', 'x');
      f.componentRef.setInput('value', value);
      f.detectChanges();
      return (f.componentInstance as unknown as { color: () => string }).color();
    });
    expect(new Set(colors).size).toBe(5);
    expect(colors[0]).toContain('#ff5d73');
    expect(colors[4]).toContain('#6ce0ff');
  });
});

describe('TypeBadgeComponent', () => {
  function render(type: string) {
    const f = TestBed.createComponent(TypeBadgeComponent);
    f.componentRef.setInput('type', type);
    f.detectChanges();
    return (f.nativeElement as HTMLElement).querySelector('.badge') as HTMLElement;
  }

  it('labels the type in title case and wires the colour variable', () => {
    const b = render('fire');
    expect(b.textContent!.trim()).toBe('Fire');
    expect(b.style.getPropertyValue('--c')).toBe('var(--type-fire)');
    expect(b.classList.contains('light')).toBe(false);
    expect(b.querySelector('.dot')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('switches to light text on the dark type colours', () => {
    for (const t of ['fighting', 'ghost', 'dragon', 'dark']) {
      TestBed.resetTestingModule();
      expect(render(t).classList.contains('light')).toBe(true);
    }
    TestBed.resetTestingModule();
    expect(render('Ghost').classList.contains('light')).toBe(true);
    TestBed.resetTestingModule();
    expect(render('electric').classList.contains('light')).toBe(false);
  });

  it('uses a deeper gradient for the light-text types', () => {
    const f = TestBed.createComponent(TypeBadgeComponent);
    f.componentRef.setInput('type', 'dark');
    const inst = f.componentInstance;
    expect(inst.bg()).toContain('78%');
    f.componentRef.setInput('type', 'fire');
    expect(inst.bg()).toContain('94%');
  });
});

describe('StatRadarComponent', () => {
  const stats: PokemonStats = {
    hp: 90,
    attack: 180,
    defense: 45,
    'special-attack': 300,
    'special-defense': 0,
    speed: 135,
  };

  function render(max?: number) {
    const f = TestBed.createComponent(StatRadarComponent);
    f.componentRef.setInput('stats', stats);
    if (max !== undefined) f.componentRef.setInput('max', max);
    f.detectChanges();
    return f.nativeElement as HTMLElement;
  }

  it('is an accessible image with rings, spokes and six axes', () => {
    const el = render();
    const svg = el.querySelector('svg')!;
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('Base stat radar');
    expect(el.querySelectorAll('polygon.grid')).toHaveLength(4);
    expect(el.querySelectorAll('line.spoke')).toHaveLength(6);
    expect(el.querySelectorAll('circle.dot')).toHaveLength(6);
  });

  it('prints each stat label and value', () => {
    const el = render();
    const labels = Array.from(el.querySelectorAll('text.lbl')).map((t) => t.textContent);
    const values = Array.from(el.querySelectorAll('text.val')).map((t) => t.textContent);
    expect(labels).toEqual(['HP', 'Atk', 'Def', 'SpA', 'SpD', 'Spe']);
    expect(values).toEqual(['90', '180', '45', '300', '0', '135']);
  });

  it('draws the stat polygon from the shared geometry', () => {
    const el = render();
    expect(el.querySelector('polygon.area')!.getAttribute('points')).toBe(shapePoints(stats));
  });

  it('places dots by the max and caps overshooting stats at the outer ring', () => {
    const el = render(RADAR_MAX);
    const dots = Array.from(el.querySelectorAll('circle.dot'));
    const tip = radarPoint(3, 1);
    expect(Number(dots[3]!.getAttribute('cx'))).toBeCloseTo(tip.x, 5);
    expect(Number(dots[3]!.getAttribute('cy'))).toBeCloseTo(tip.y, 5);
    const half = radarPoint(0, 0.5);
    expect(Number(dots[0]!.getAttribute('cy'))).toBeCloseTo(half.y, 5);
  });

  it('rescales the dots when the max changes', () => {
    const el = render(360);
    const dot = el.querySelectorAll('circle.dot')[0]!;
    expect(Number(dot.getAttribute('cy'))).toBeCloseTo(radarPoint(0, 0.25).y, 5);
  });
});
