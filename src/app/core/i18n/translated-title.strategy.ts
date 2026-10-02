import { Injectable, effect, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { I18nService } from './i18n.service';

/** Sets the document title from the route's `title`, translated — and re-translates on a language switch. */
@Injectable({ providedIn: 'root' })
export class TranslatedTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly i18n = inject(I18nService);
  private current: string | undefined;

  constructor() {
    super();
    effect(() => {
      this.i18n.locale();
      if (this.current) this.title.setTitle(this.i18n.t(this.current));
    });
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.current = this.buildTitle(snapshot);
    if (this.current) this.title.setTitle(this.i18n.t(this.current));
  }
}
