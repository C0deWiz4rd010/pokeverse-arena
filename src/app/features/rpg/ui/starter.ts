import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RpgService } from '../rpg.service';
import { TypeBadgeComponent } from '../../../core/ui/type-badge/type-badge';
import { officialArtwork } from '../../../core/api/pokeapi-endpoints';
import type { PokemonType } from '../../../core/utils/type-chart';

interface Starter {
  readonly species: string;
  readonly name: string;
  readonly dex: number;
  readonly type: PokemonType;
  readonly blurb: string;
}

/** Professor's starter choice — three classic first partners. */
@Component({
  selector: 'pv-starter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TypeBadgeComponent],
  template: `
    <div class="starter">
      <h2 class="st-title">Choose your first partner!</h2>
      <p class="st-sub">Prof. Oak: "Go on — pick the one that speaks to you."</p>
      <div class="st-grid">
        @for (s of starters; track s.species) {
          <button class="st-card" type="button" [style.--type]="'var(--type-' + s.type + ')'" (click)="pick(s.species)">
            <img [src]="art(s.dex)" [alt]="s.name" loading="lazy" />
            <strong>{{ s.name }}</strong>
            <pv-type-badge [type]="s.type" />
            <span class="st-blurb">{{ s.blurb }}</span>
          </button>
        }
      </div>
    </div>
  `,
  styleUrl: './starter.scss',
})
export class StarterComponent {
  private readonly svc = inject(RpgService);
  protected readonly art = (dex: number) => officialArtwork(dex);

  protected readonly starters: Starter[] = [
    { species: 'bulbasaur', name: 'Bulbasaur', dex: 1, type: 'grass', blurb: 'A sturdy all-rounder with strong Grass moves.' },
    { species: 'charmander', name: 'Charmander', dex: 4, type: 'fire', blurb: 'A fierce attacker that grows into a powerhouse.' },
    { species: 'squirtle', name: 'Squirtle', dex: 7, type: 'water', blurb: 'A tough defender with reliable Water moves.' },
  ];

  protected pick(species: string): void {
    void this.svc.chooseStarter(species);
  }
}
