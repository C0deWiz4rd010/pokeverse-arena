import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { WEATHER_INFO, type Weather } from './weather';
import { IconComponent } from '../icon/icon';

/**
 * Self-contained atmospheric backdrop for battle arenas. Drop it as the first
 * child of a `position: relative` arena; it fills the box, paints a per-weather
 * sky tint and animates particles (rain, snow, sand, leaves, …). An optional
 * floating badge names the current weather.
 *
 * Extracted from the Battle Arena so Tournaments (and any future battle surface)
 * share one implementation.
 */
@Component({
  selector: 'pv-weather-overlay',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  host: { '[attr.data-weather]': 'weather()' },
  template: `
    <div class="weather" aria-hidden="true">
      <div class="sky"></div>
      @switch (weather()) {
        @case ('sun') {
          <div class="sun-glow"></div>
          <div class="rays"></div>
        }
        @case ('rain') {
          <div class="rain">
            @for (d of drops; track d) { <span class="drop" [style.--i]="d"></span> }
          </div>
        }
        @case ('storm') {
          <div class="rain dense">
            @for (d of drops; track d) { <span class="drop" [style.--i]="d"></span> }
          </div>
          <div class="lightning"></div>
        }
        @case ('snow') {
          <div class="snow">
            @for (f of flakes; track f) { <span class="flake" [style.--i]="f"></span> }
          </div>
        }
        @case ('sand') {
          <div class="sand">
            @for (g of grains; track g) { <span class="grain" [style.--i]="g"></span> }
            <div class="haze"></div>
          </div>
        }
        @case ('fog') {
          <div class="fog">
            <span class="bank b1"></span>
            <span class="bank b2"></span>
            <span class="bank b3"></span>
          </div>
        }
        @case ('leaves') {
          <div class="leaves">
            @for (l of leaves; track l) { <span class="leaf" [style.--i]="l"><pv-icon name="leaf" /></span> }
          </div>
        }
      }
    </div>
    @if (showBadge() && weather() !== 'clear') {
      <span class="weather-badge" [title]="info().label"><pv-icon [name]="info().icon" /> {{ info().label }}</span>
    }
  `,
  styleUrl: './weather-overlay.scss',
})
export class WeatherOverlayComponent {
  readonly weather = input.required<Weather>();
  readonly showBadge = input(true);

  protected readonly info = computed(() => WEATHER_INFO[this.weather()]);

  protected readonly drops = Array.from({ length: 28 }, (_, i) => i);
  protected readonly flakes = Array.from({ length: 24 }, (_, i) => i);
  protected readonly grains = Array.from({ length: 30 }, (_, i) => i);
  protected readonly leaves = Array.from({ length: 12 }, (_, i) => i);
}
