import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { IconComponent } from '../icon/icon';
import { SaveService } from '../../storage/save.service';
import { HapticsService } from '../../haptics/haptics.service';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Add-to-home-screen banner. On Chromium it defers the native
 * `beforeinstallprompt` and offers a one-tap install; on iOS Safari (which has
 * no such event) it shows the manual "Share → Add to Home Screen" hint. Either
 * way it appears at most once until the user installs or dismisses it, and never
 * when already running as an installed PWA.
 */
@Component({
  selector: 'pv-install-prompt',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  host: {
    '(window:beforeinstallprompt)': 'onBeforeInstall($event)',
    '(window:appinstalled)': 'onInstalled()',
  },
  template: `
    @if (visible()) {
      <div class="install glass" role="dialog" aria-label="Install app">
        <span class="ic"><pv-icon name="download" /></span>
        <span class="msg">
          <strong>Install PokéVerse Arena</strong>
          @if (ios()) {
            <span>Tap Share, then “Add to Home Screen”.</span>
          } @else {
            <span>Play fullscreen, offline-ready, one tap away.</span>
          }
        </span>
        @if (!ios()) {
          <button class="btn btn-primary go" type="button" (click)="install()">Install</button>
        }
        <button class="x" type="button" aria-label="Dismiss" (click)="dismiss()"><pv-icon name="x" /></button>
      </div>
    }
  `,
  styleUrl: './install-prompt.scss',
})
export class InstallPromptComponent {
  private readonly save = inject(SaveService);
  private readonly haptics = inject(HapticsService);
  private deferred: BeforeInstallPromptEvent | null = null;

  protected readonly visible = signal(false);
  protected readonly ios = signal(false);

  constructor() {
    if (this.dismissed() || this.isStandalone()) return;
    // iOS never fires beforeinstallprompt, so surface the manual hint there.
    if (this.isIos()) {
      this.ios.set(true);
      setTimeout(() => this.visible.set(true), 2600);
    }
  }

  protected onBeforeInstall(e: Event): void {
    e.preventDefault();
    if (this.dismissed() || this.isStandalone()) return;
    this.deferred = e as BeforeInstallPromptEvent;
    this.ios.set(false);
    this.visible.set(true);
  }

  protected onInstalled(): void {
    this.visible.set(false);
    this.remember();
  }

  protected async install(): Promise<void> {
    this.haptics.fire('select');
    const ev = this.deferred;
    if (!ev) return;
    this.visible.set(false);
    await ev.prompt();
    await ev.userChoice.catch(() => undefined);
    this.deferred = null;
    this.remember();
  }

  protected dismiss(): void {
    this.haptics.fire('tap');
    this.visible.set(false);
    this.remember();
  }

  private remember(): void {
    this.save.write('install-dismissed', true);
  }
  private dismissed(): boolean {
    return this.save.read('install-dismissed', false);
  }
  private isStandalone(): boolean {
    return (
      (typeof matchMedia !== 'undefined' && matchMedia('(display-mode: standalone)').matches) ||
      (typeof navigator !== 'undefined' && (navigator as { standalone?: boolean }).standalone === true)
    );
  }
  private isIos(): boolean {
    if (typeof navigator === 'undefined') return false;
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
  }
}
