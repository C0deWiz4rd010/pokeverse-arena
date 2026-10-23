/**
 * Side conditions and field-wide speed effects: Reflect / Light Screen / Aurora Veil,
 * Tailwind and Trick Room. Pure descriptors and maths — the engine core owns the turn counters.
 */
import type { Weather } from './weather';

export type ScreenKind = 'reflect' | 'light-screen' | 'aurora-veil';

/** Remaining turns per screen on one side (0 = inactive). */
export type Screens = Record<ScreenKind, number>;

export const SCREEN_TURNS = 5;
export const TAILWIND_TURNS = 4;
export const TRICK_ROOM_TURNS = 5;

export const SCREEN_INFO: Record<ScreenKind, { label: string; blurb: string }> = {
  reflect: { label: 'Reflect', blurb: 'Halves physical damage.' },
  'light-screen': { label: 'Light Screen', blurb: 'Halves special damage.' },
  'aurora-veil': { label: 'Aurora Veil', blurb: 'Halves all damage (needs snow).' },
};

export function freshScreens(): Screens {
  return { reflect: 0, 'light-screen': 0, 'aurora-veil': 0 };
}

/** Aurora Veil can only be raised while it snows. */
export function screenAllowed(kind: ScreenKind, weather: Weather): boolean {
  return kind !== 'aurora-veil' || weather === 'snow';
}

/** ×0.5 when a matching screen guards the defender; critical hits bypass screens. */
export function screenDamageFactor(screens: Screens, special: boolean, crit: boolean): number {
  if (crit) return 1;
  const guarded =
    screens['aurora-veil'] > 0 || (special ? screens['light-screen'] > 0 : screens.reflect > 0);
  return guarded ? 0.5 : 1;
}

/** Whether any screen is up (for UI chips). */
export function activeScreens(screens: Screens): ScreenKind[] {
  return (Object.keys(screens) as ScreenKind[]).filter((k) => screens[k] > 0);
}

export function screenSetMessage(kind: ScreenKind, sideLabel: string): string {
  return `${SCREEN_INFO[kind].label} raised on ${sideLabel}!`;
}

export function screenEndMessage(kind: ScreenKind, sideLabel: string): string {
  return `${SCREEN_INFO[kind].label} wore off on ${sideLabel}.`;
}
