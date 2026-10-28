/* eslint-disable @typescript-eslint/no-misused-promises, @typescript-eslint/no-unsafe-call */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PokeApiClient } from '../../core/api/pokeapi.client';
import type { PokemonDto } from '../../core/dto/pokeapi.dto';
import { HapticsService } from '../../core/haptics/haptics.service';
import { SaveService } from '../../core/storage/save.service';
import { ToastService } from '../../core/ui/toast/toast.service';
import { ShowdownComponent } from './showdown';

const STAT_NAMES = [
  'hp',
  'attack',
  'defense',
  'special-attack',
  'special-defense',
  'speed',
] as const;

/** Every base stat equals the id, so the higher id always wins any stat. */
function dto(id: number): PokemonDto {
  return {
    id,
    name: `mon-${id}`,
    types: [{ slot: 1, type: { name: 'fire', url: '' } }],
    stats: STAT_NAMES.map((s) => ({ base_stat: id, effort: 0, stat: { name: s, url: '' } })),
  } as unknown as PokemonDto;
}

/** Math.random() values that map to ids 2 (low) and 923 (high). */
const LOW = 0.001;
const HIGH = 0.9;

describe('ShowdownComponent', () => {
  let fixture: ComponentFixture<ShowdownComponent>;
  let get: ReturnType<typeof vi.fn>;
  let haptics: { fire: ReturnType<typeof vi.fn> };
  let toast: { show: ReturnType<typeof vi.fn> };
  let random: ReturnType<typeof vi.spyOn>;

  const root = () => fixture.nativeElement as HTMLElement;
  const text = () => root().textContent ?? '';
  const tick = async () => {
    for (let i = 0; i < 200; i++) await Promise.resolve();
    fixture.detectChanges();
  };
  const cards = () => [...root().querySelectorAll<HTMLButtonElement>('button.card')];
  const byText = (label: string) =>
    [...root().querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent?.includes(label),
    );

  /** Queue stat index + the ids of the next round's left/right Pokémon. */
  function queueRound(left: number, right: number): void {
    random.mockReturnValueOnce(0).mockReturnValueOnce(left).mockReturnValueOnce(right);
  }

  async function startRound(left: number, right: number): Promise<void> {
    queueRound(left, right);
    byText('Start Showdown')!.click();
    await tick();
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    random = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    get = vi.fn().mockImplementation((url: string) => {
      const id = Number(url.split('/').filter(Boolean).pop());
      return Promise.resolve(dto(id));
    });
    haptics = { fire: vi.fn() };
    toast = { show: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: PokeApiClient, useValue: { get } },
        { provide: HapticsService, useValue: haptics },
        { provide: ToastService, useValue: toast },
      ],
    });
    fixture = TestBed.createComponent(ShowdownComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('opens on the intro with the stored best streak', () => {
    expect(text()).toContain('Start Showdown');
    expect(text()).toContain('Best streak:');
    expect(root().querySelector('.arena')).toBeNull();
  });

  it('shows the persisted best streak on the intro', () => {
    TestBed.inject(SaveService).write('showdown-best', 7);
    const again = TestBed.createComponent(ShowdownComponent);
    again.detectChanges();
    expect(again.nativeElement.querySelector('.best strong').textContent).toBe('7');
  });

  it('shows skeleton cards while loading, then two Pokémon to choose from', async () => {
    queueRound(LOW, HIGH);
    byText('Start Showdown')!.click();
    fixture.detectChanges();
    expect(root().querySelectorAll('.skeleton')).toHaveLength(2);
    expect(haptics.fire).toHaveBeenCalledWith('select');

    await tick();
    expect(cards()).toHaveLength(2);
    expect(cards()[0]!.textContent).toContain('Mon 2');
    expect(cards()[1]!.textContent).toContain('Mon 923');
    expect(cards().every((c) => !c.disabled)).toBe(true);
    expect(text()).toContain('Highest HP');
    expect(text()).toContain('Tap to pick');
  });

  it('a correct pick reveals values, grows the streak and loads the next round', async () => {
    await startRound(LOW, HIGH);
    queueRound(HIGH, LOW);
    cards()[1]!.click(); // the higher id wins
    fixture.detectChanges();

    expect(haptics.fire).toHaveBeenCalledWith('success');
    expect(cards()[1]!.classList.contains('win')).toBe(true);
    expect(cards()[0]!.classList.contains('lose')).toBe(true);
    expect(cards()[1]!.querySelector('.value')!.textContent).toBe('923');
    expect(root().querySelector('.hud .chip strong')!.textContent).toBe('1');
    expect(cards().every((c) => c.disabled)).toBe(true);

    vi.advanceTimersByTime(1150);
    await tick();
    expect(cards()[0]!.textContent).toContain('Mon 923');
    expect(cards().every((c) => !c.disabled)).toBe(true);
  });

  it('a miss ends the run, saves a new personal best and offers a replay', async () => {
    await startRound(LOW, HIGH);
    queueRound(LOW, HIGH);
    cards()[1]!.click(); // correct
    vi.advanceTimersByTime(1150);
    await tick();

    cards()[0]!.click(); // wrong: left is the low one
    fixture.detectChanges();
    expect(haptics.fire).toHaveBeenCalledWith('error');
    vi.advanceTimersByTime(900);
    fixture.detectChanges();

    expect(root().querySelector('.over')).not.toBeNull();
    expect(text()).toContain('Run over!');
    expect(text()).toContain('New personal best!');
    expect(TestBed.inject(SaveService).read('showdown-best', 0)).toBe(1);

    queueRound(LOW, HIGH);
    byText('Play again')!.click();
    await tick();
    expect(root().querySelector('.over')).toBeNull();
    expect(root().querySelector('.hud .chip strong')!.textContent).toBe('0');
  });

  it('does not overwrite a higher stored best and says "So close!" on a zero streak', async () => {
    TestBed.inject(SaveService).write('showdown-best', 9);
    fixture = TestBed.createComponent(ShowdownComponent);
    fixture.detectChanges();
    await startRound(LOW, HIGH);
    cards()[0]!.click();
    vi.advanceTimersByTime(900);
    fixture.detectChanges();
    expect(text()).toContain('So close!');
    expect(text()).not.toContain('New personal best!');
    expect(TestBed.inject(SaveService).read('showdown-best', 0)).toBe(9);
  });

  it('ties make both cards glow and count as correct', async () => {
    get.mockImplementation((url: string) => {
      const flat = dto(Number(url.split('/').filter(Boolean).pop()));
      flat.stats.forEach((st) => (st.base_stat = 80));
      return Promise.resolve(flat);
    });
    await startRound(LOW, HIGH);
    cards()[0]!.click();
    fixture.detectChanges();
    expect(cards().every((c) => c.classList.contains('win'))).toBe(true);
    expect(root().querySelector('.hud .chip strong')!.textContent).toBe('1');
  });

  it('arrow keys pick a side while playing and are ignored otherwise', async () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' })); // intro: ignored
    expect(root().querySelector('.arena')).toBeNull();

    await startRound(LOW, HIGH);
    const ev = new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true });
    document.dispatchEvent(ev);
    fixture.detectChanges();
    expect(ev.defaultPrevented).toBe(true);
    expect(cards()[1]!.classList.contains('picked')).toBe(true);

    const second = new KeyboardEvent('keydown', { key: 'ArrowLeft', cancelable: true });
    document.dispatchEvent(second); // already revealing: ignored
    expect(second.defaultPrevented).toBe(false);
  });

  it('the left arrow picks the left card', async () => {
    await startRound(HIGH, LOW);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', cancelable: true }));
    fixture.detectChanges();
    expect(cards()[0]!.classList.contains('picked')).toBe(true);
    expect(cards()[0]!.classList.contains('win')).toBe(true);
  });

  it('shows an error state with a retry when nothing can be fetched', async () => {
    get.mockRejectedValue(new Error('offline'));
    byText('Start Showdown')!.click();
    await tick();
    await tick();
    expect(root().querySelector('pv-state')).not.toBeNull();
    expect(text()).toContain('Could not load the next round');
    expect(root().querySelector('.arena')).toBeNull();

    get.mockImplementation((url: string) =>
      Promise.resolve(dto(Number(url.split('/').filter(Boolean).pop()))),
    );
    queueRound(LOW, HIGH);
    byText('Try again')!.click();
    await tick();
    expect(cards()).toHaveLength(2);
  });

  it('keeps trying other ids after a miss', async () => {
    get.mockRejectedValueOnce(new Error('miss'));
    await startRound(LOW, HIGH);
    expect(cards()).toHaveLength(2);
    expect(get.mock.calls.length).toBeGreaterThan(2);
  });

  it('falls back to Pikachu when every random id fails', async () => {
    get.mockImplementation((url: string) =>
      url.endsWith('/25') ? Promise.resolve(dto(25)) : Promise.reject(new Error('x')),
    );
    byText('Start Showdown')!.click();
    await tick();
    await tick();
    expect(cards()).toHaveLength(2);
    expect(cards()[0]!.textContent).toContain('Mon 25');
    expect(cards()[1]!.textContent).toContain('Mon 25');
  });

  describe('share', () => {
    async function reachOver(): Promise<void> {
      await startRound(LOW, HIGH);
      cards()[0]!.click();
      vi.advanceTimersByTime(900);
      fixture.detectChanges();
    }

    it('uses the native share sheet when available', async () => {
      const share = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'share', { value: share, configurable: true });
      await reachOver();
      byText('Share')!.click();
      await tick();
      expect(share).toHaveBeenCalledTimes(1);
      expect(share.mock.calls[0]![0].text).toContain('Showdown');
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    });

    it('copies to the clipboard otherwise and confirms with a toast', async () => {
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
      await reachOver();
      byText('Share')!.click();
      await tick();
      expect(writeText).toHaveBeenCalledTimes(1);
      expect(toast.show).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Copied to clipboard' }),
      );
    });

    it('swallows a dismissed share sheet', async () => {
      const share = vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError'));
      Object.defineProperty(navigator, 'share', { value: share, configurable: true });
      await reachOver();
      byText('Share')!.click();
      await tick();
      expect(share).toHaveBeenCalled();
      expect(toast.show).not.toHaveBeenCalled();
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    });
  });

  it('drops a round that is still loading when the component is destroyed', async () => {
    queueRound(LOW, HIGH);
    byText('Start Showdown')!.click();
    fixture.destroy();
    await tick();
    expect(get).toHaveBeenCalled();
  });
});
