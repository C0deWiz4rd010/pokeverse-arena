import { AfterViewInit, Directive, ElementRef, OnDestroy, inject, output } from '@angular/core';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** How many open modals currently hold each element inert (nested dialogs share the background). */
const inertHolds = new Map<Element, number>();
let scrollLocks = 0;
let savedOverflow = '';

/**
 * Make everything outside `panel` inert — unreachable by keyboard, pointer and screen readers —
 * by marking every sibling along the path up to `<body>`. Returns the undo function.
 */
function inertBackground(panel: HTMLElement): () => void {
  const held: Element[] = [];
  for (let node: HTMLElement = panel; node.parentElement; node = node.parentElement) {
    for (const sibling of Array.from(node.parentElement.children)) {
      if (
        sibling === node ||
        sibling.tagName === 'SCRIPT' ||
        sibling.hasAttribute('data-keep-live')
      ) {
        continue;
      }
      inertHolds.set(sibling, (inertHolds.get(sibling) ?? 0) + 1);
      sibling.setAttribute('inert', '');
      held.push(sibling);
    }
    if (node.parentElement === document.body) break;
  }
  return () => {
    for (const el of held) {
      const left = (inertHolds.get(el) ?? 1) - 1;
      if (left <= 0) {
        inertHolds.delete(el);
        el.removeAttribute('inert');
      } else {
        inertHolds.set(el, left);
      }
    }
  };
}

function lockScroll(): () => void {
  if (scrollLocks++ === 0) {
    savedOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  return () => {
    if (--scrollLocks === 0) document.body.style.overflow = savedOverflow;
  };
}

/**
 * Accessible modal behaviour for any overlay panel: moves focus inside on open,
 * keeps Tab/Shift+Tab cycling within the panel, closes on Escape (`pvModalClose`),
 * makes the page behind inert (no focus, no screen-reader access) and locks body scroll,
 * then hands focus back to whatever opened it. Put it on the element that carries
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
  /** Captured at creation — before anything inside the panel can steal focus from the trigger. */
  private readonly opener: HTMLElement | null =
    document.activeElement instanceof HTMLElement && document.activeElement !== document.body
      ? document.activeElement
      : null;
  private releaseInert: (() => void) | null = null;
  private releaseScroll: (() => void) | null = null;

  /** Fired when the user presses Escape inside the panel. */
  readonly pvModalClose = output<void>();

  ngAfterViewInit(): void {
    const el = this.host.nativeElement;
    this.releaseInert = inertBackground(el);
    this.releaseScroll = lockScroll();
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
    this.releaseInert?.();
    this.releaseScroll?.();
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
    const first = items[0]!;
    const last = items[items.length - 1]!;
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
