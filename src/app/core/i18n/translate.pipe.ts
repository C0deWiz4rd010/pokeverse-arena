import { Pipe, PipeTransform, inject } from '@angular/core';
import { I18nService } from './i18n.service';

/**
 * `{{ 'Battle Log' | t }}` · `{{ 'Lv{0}' | t: [level] }}`. Impure on purpose: it reads
 * the locale signal, so views update the moment the language is switched.
 */
@Pipe({ name: 't', pure: false })
export class TranslatePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(text: string | number | null | undefined, params?: readonly unknown[] | Readonly<Record<string, unknown>>): string {
    if (text === null || text === undefined || text === '') return '';
    return typeof text === 'number' ? String(text) : this.i18n.t(text, params);
  }
}
