import { AfterViewInit, Directive, ElementRef, OnDestroy, inject, output } from '@angular/core';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal behaviour for any overlay panel: moves focus inside on open,
 * keeps Tab/Shift+Tab cycling within the panel, closes on Escape (`pvModalClose`)
 * and hands focus back to whatever opened it. Put it on the element that carries
 * `role="dialog"`; mark the preferred first control with `data-autofocus`.
 */
@Directive({
  selector: '[pvModal]',
  host: {
    '[attr.aria-modal]': '"true"',
    '(keydown)': 'onKeydown($event)',
  },
})
export class ModalDirective implements AfterViewInit, OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private opener: HTMLElement | null = null;

  /** Fired when the user presses Escape inside the panel. */
  readonly pvModalClose = output<void>();

  ngAfterViewInit(): void {
    this.opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const el = this.host.nativeElement;
    // Don't steal focus from a control that already grabbed it (e.g. a search input).
    if (el.contains(document.activeElement) && document.activeElement !== el) return;
    const target = el.querySelector<HTMLElement>('[data-autofocus]') ?? this.focusable()[0];
    if (target) target.focus();
    else {
      el.setAttribute('tabindex', '-1');
      el.focus();
    }
  }

  ngOnDestroy(): void {
    const opener = this.opener;
    // Wait a tick so the closing click/key finishes before focus moves back.
    if (opener && opener.isConnected) setTimeout(() => opener.focus({ preventScroll: true }));
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.pvModalClose.emit();
      return;
    }
    if (event.key !== 'Tab') return;
    const items = this.focusable();
    if (!items.length) {
      event.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !this.host.nativeElement.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !this.host.nativeElement.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  }

  private focusable(): HTMLElement[] {
    return Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      // skip anything display:none / visibility:hidden (older engines lack checkVisibility → keep)
      (el) => el.checkVisibility?.({ visibilityProperty: true }) ?? true,
    );
  }
}
