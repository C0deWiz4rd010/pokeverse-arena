import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CryService } from '../../core/audio/cry.service';
import type { PokedexEntry } from '../../core/models/pokemon.model';
import { WhosThatComponent } from './whos-that';

const pool: PokedexEntry[] = [
  { id: 1, name: 'bulbasaur', artwork: '', types: [], gen: 1 },
  { id: 4, name: 'charmander', artwork: '', types: [], gen: 1 },
  { id: 7, name: 'squirtle', artwork: '', types: [], gen: 1 },
  { id: 25, name: 'pikachu', artwork: '', types: [], gen: 1 },
];

@Component({
  imports: [WhosThatComponent],
  template: `<pv-whos-that [pool]="pool" (close)="closed = closed + 1" />`,
})
class HostComponent {
  pool: readonly PokedexEntry[] = pool;
  closed = 0;
}

/**
 * The component's constructor calls newRound(), which reads the required `pool` input
 * before Angular has bound it (NG0950). To exercise the real round logic we skip that
 * first constructor call and trigger newRound() once the input is bound.
 */
function setup(entries: readonly PokedexEntry[] = pool) {
  const proto = WhosThatComponent.prototype as unknown as { newRound: (this: unknown) => void };
  const original = proto.newRound;
  const spy = vi.spyOn(proto, 'newRound').mockImplementationOnce(() => undefined);
  const cry = { play: vi.fn(), muted: signal(false), playing: signal<number | null>(null) };
  TestBed.configureTestingModule({ providers: [{ provide: CryService, useValue: cry }] });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.componentInstance.pool = entries;
  fixture.detectChanges();
  spy.mockRestore();
  const game = fixture.debugElement.query(By.directive(WhosThatComponent)).componentInstance;
  original.call(game);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return { fixture, el, cry };
}

/** Deterministic Math.random: 0, .3, .6, .9, 0, … so the answer is pool[0] with two distinct decoys. */
function seedRandom(): void {
  const seq = [0, 0.3, 0.6, 0.9];
  let i = 0;
  vi.spyOn(Math, 'random').mockImplementation(() => seq[i++ % seq.length]!);
}

const opts = (el: HTMLElement) => Array.from(el.querySelectorAll<HTMLButtonElement>('.opt'));

describe('WhosThatComponent', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows three distinct options with a hidden silhouette', () => {
    const { el } = setup();
    const labels = opts(el).map((b) => b.textContent!.trim());
    expect(labels).toHaveLength(3);
    expect(new Set(labels).size).toBe(3);
    expect(el.querySelector('.silhouette')?.classList.contains('revealed')).toBe(false);
    expect(el.querySelector('img')?.getAttribute('alt')).toBe('Mystery Pokémon');
  });

  it('shows the loading text when the pool is too small', () => {
    const { el } = setup(pool.slice(0, 2));
    expect(el.querySelector('.loading')).not.toBeNull();
    expect(opts(el)).toHaveLength(0);
  });

  it('reveals, plays the cry and counts the streak on a correct guess', () => {
    seedRandom(); // answer = first entry
    const { fixture, el, cry } = setup();
    const correct = opts(el).find((b) => b.textContent!.trim() === 'Bulbasaur')!;
    correct.click();
    fixture.detectChanges();
    expect(cry.play).toHaveBeenCalledWith(1);
    expect(el.querySelector('.silhouette')?.classList.contains('revealed')).toBe(true);
    expect(el.querySelector('.verdict')?.classList.contains('right')).toBe(true);
    expect(el.querySelector('.verdict')?.textContent).toContain('Bulbasaur');
    const scores = el.querySelectorAll('.score strong');
    expect(scores[0]?.textContent).toBe('1');
    expect(scores[1]?.textContent).toBe('1');
    expect(opts(el)).toHaveLength(0);
  });

  it('resets the streak on a wrong guess but keeps the best', () => {
    seedRandom();
    const { fixture, el, cry } = setup();
    const pick = (name: string) =>
      opts(el)
        .find((b) => b.textContent!.trim() === name)!
        .click();

    pick('Bulbasaur');
    fixture.detectChanges();
    seedRandom(); // next round: same answer again
    el.querySelector<HTMLButtonElement>('.next')!.click();
    fixture.detectChanges();
    expect(el.querySelector('.silhouette')?.classList.contains('revealed')).toBe(false);

    const wrong = opts(el).find((b) => b.textContent!.trim() !== 'Bulbasaur')!;
    wrong.click();
    fixture.detectChanges();
    expect(el.querySelector('.verdict')?.classList.contains('wrong')).toBe(true);
    expect(cry.play).toHaveBeenCalledTimes(1);
    const scores = el.querySelectorAll('.score strong');
    expect(scores[0]?.textContent).toBe('0');
    expect(scores[1]?.textContent).toBe('1');
  });

  it('emits close from the X button and the backdrop', () => {
    const { fixture, el } = setup();
    el.querySelector<HTMLButtonElement>('.x')!.click();
    el.querySelector<HTMLElement>('.backdrop')!.click();
    expect(fixture.componentInstance.closed).toBe(2);
  });
});
