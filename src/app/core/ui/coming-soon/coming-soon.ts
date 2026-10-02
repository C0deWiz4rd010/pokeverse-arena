import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../icon/icon';
import type { IconName } from '../icon/icons.data';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

/** Friendly placeholder for modules that are still on the roadmap. */
@Component({
  selector: 'pv-coming-soon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, RouterLink, IconComponent],
  template: `
    <section class="container wrap">
      <div class="glass card">
        <div class="emoji" aria-hidden="true"><pv-icon [name]="icon()" [size]="64" /></div>
        <h1 class="gradient-text">{{ title() | t }}</h1>
        <p>{{ description() | t }}</p>
        <p class="tag"><pv-icon name="construction" /> {{ 'Under construction — coming in a future update.' | t }}</p>
        <a class="btn btn-primary" routerLink="/pokedex">{{ 'Explore the Pokédex' | t }}</a>
      </div>
    </section>
  `,
  styles: [
    `
      .wrap { display: grid; place-items: center; min-height: calc(var(--dvh) * 60); padding: 2rem 0; }
      .card { text-align: center; padding: 3rem 2rem; max-width: 560px; }
      .emoji { font-size: 4rem; margin-bottom: 0.5rem; }
      h1 { font-size: 2rem; }
      p { color: var(--text-dim); }
      .tag { color: var(--accent-3); font-weight: 600; margin: 1.2rem 0; }
    `,
  ],
})
export class ComingSoonComponent {
  readonly title = input('Coming soon');
  readonly description = input('This module is on the roadmap.');
  readonly icon = input<IconName>('sparkles');
}
