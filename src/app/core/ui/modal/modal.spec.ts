import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModalDirective } from './modal';

@Component({
  imports: [ModalDirective],
  template: `
    <button id="opener" type="button">open</button>
    @if (open()) {
      <div id="panel" role="dialog" pvModal (pvModalClose)="closed.set(true)">
        <button id="first" type="button">first</button>
        <button id="last" type="button">last</button>
      </div>
    }
  `,
})
class HostComponent {
  readonly open = signal(false);
  readonly closed = signal(false);
}

describe('ModalDirective', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  function setup() {
    const fixture = TestBed.createComponent(HostComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    el.querySelector<HTMLElement>('#opener')?.focus();
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    return { fixture, el };
  }

  const key = (target: Element, k: string, shiftKey = false) =>
    target.dispatchEvent(new KeyboardEvent('keydown', { key: k, shiftKey, bubbles: true, cancelable: true }));

  it('moves focus into the dialog and marks it modal', () => {
    const { el } = setup();
    expect(document.activeElement?.id).toBe('first');
    expect(el.querySelector('#panel')?.getAttribute('aria-modal')).toBe('true');
  });

  it('keeps Tab and Shift+Tab inside the dialog', () => {
    const { el } = setup();
    const first = el.querySelector<HTMLElement>('#first') as HTMLElement;
    const last = el.querySelector<HTMLElement>('#last') as HTMLElement;
    last.focus();
    key(last, 'Tab');
    expect(document.activeElement).toBe(first);
    key(first, 'Tab', true);
    expect(document.activeElement).toBe(last);
  });

  it('emits close on Escape and returns focus to the opener afterwards', () => {
    vi.useFakeTimers();
    const { fixture, el } = setup();
    key(el.querySelector('#panel') as Element, 'Escape');
    expect(fixture.componentInstance.closed()).toBe(true);
    fixture.componentInstance.open.set(false);
    fixture.detectChanges();
    vi.runAllTimers();
    expect(document.activeElement?.id).toBe('opener');
  });
});
