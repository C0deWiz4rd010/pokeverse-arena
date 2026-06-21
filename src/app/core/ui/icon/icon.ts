import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { ICONS, type IconName } from './icons.data';

/**
 * Crisp, themeable inline-SVG icon. Geometry comes from the Lucide icon set
 * (ISC) baked into {@link ICONS}, so there is no runtime dependency and icons
 * inherit the current text color. Size follows the surrounding font-size by
 * default (`1em`) or an explicit `size` in pixels.
 *
 * Usage: `<pv-icon name="sword" />` · `<pv-icon name="trophy" [size]="20" />`
 */
@Component({
  selector: 'pv-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      [attr.stroke-width]="strokeWidth()"
      stroke-linecap="round"
      stroke-linejoin="round"
      [style.width]="dim()"
      [style.height]="dim()"
      [attr.aria-hidden]="label() ? null : true"
      [attr.role]="label() ? 'img' : null"
      [attr.aria-label]="label() || null"
      [innerHTML]="body()"
    ></svg>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        line-height: 0;
        flex: none;
      }
      svg {
        display: block;
      }
    `,
  ],
})
export class IconComponent {
  private readonly sanitizer = inject(DomSanitizer);

  readonly name = input.required<IconName>();
  /** Optional explicit pixel size; defaults to `1em` (follows font-size). */
  readonly size = input<number>();
  readonly strokeWidth = input(2);
  /** Accessible label. When omitted the icon is decorative (aria-hidden). */
  readonly label = input<string>();

  protected readonly dim = computed(() => {
    const s = this.size();
    return s ? `${s}px` : '1em';
  });

  protected readonly body = computed<SafeHtml>(() =>
    this.sanitizer.bypassSecurityTrustHtml(ICONS[this.name()]),
  );
}
