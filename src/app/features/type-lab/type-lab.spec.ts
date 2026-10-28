import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { POKEMON_TYPES } from '../../core/utils/type-chart';
import { TypeLabComponent } from './type-lab';

function setup() {
  const fixture = TestBed.createComponent(TypeLabComponent);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const q = (sel: string) => el.querySelector<HTMLElement>(sel);
  const qa = (sel: string) => Array.from(el.querySelectorAll<HTMLElement>(sel));
  const tab = (label: string) => {
    qa('nav.tabs button')
      .find((b) => b.textContent!.includes(label))!
      .click();
    fixture.detectChanges();
  };
  /** Click a `.t-btn` by its type name within the nth `.grid-types` block. */
  const pick = (type: string, group = 0) => {
    const grid = qa('.grid-types')[group]!;
    Array.from(grid.querySelectorAll<HTMLElement>('.t-btn'))
      .find((b) => b.textContent!.trim().toLowerCase() === type)!
      .click();
    fixture.detectChanges();
  };
  return { fixture, el, q, qa, tab, pick };
}

const badges = (root: Element | null) =>
  Array.from(root?.querySelectorAll('pv-type-badge') ?? []).map((b) =>
    b.textContent!.trim().toLowerCase(),
  );

describe('TypeLabComponent', () => {
  describe('chart tab', () => {
    it('renders the tabs with the chart selected', () => {
      const { qa } = setup();
      const tabs = qa('nav.tabs button');
      expect(tabs).toHaveLength(4);
      expect(tabs[0]!.getAttribute('aria-selected')).toBe('true');
      expect(tabs[1]!.getAttribute('aria-selected')).toBe('false');
    });

    it('explores one type: fire attacks and defends', () => {
      const { qa } = setup();
      const [atk, def] = qa('.explorer-col');
      const atkBuckets = Array.from(atk!.querySelectorAll('.bucket'));
      const superBucket = atkBuckets[0]!;
      expect(superBucket.querySelector('.b-mult')?.textContent).toBe('2×');
      expect(badges(superBucket).sort()).toEqual(['bug', 'grass', 'ice', 'steel']);
      expect(badges(def!.querySelector('.bucket.m2')).sort()).toEqual(['ground', 'rock', 'water']);
    });

    it('changes the explored type', () => {
      const { pick, qa } = setup();
      pick('normal');
      const [atk, def] = qa('.explorer-col');
      expect(badges(atk!.querySelector('.bucket.m0'))).toEqual(['ghost']);
      expect(badges(def!.querySelector('.bucket.m0'))).toEqual(['ghost']);
      expect(qa('.t-btn.on')[0]!.textContent!.trim()).toBe('Normal');
    });

    it('draws a full 18x18 matrix', () => {
      const { qa } = setup();
      expect(qa('table.matrix tbody tr')).toHaveLength(POKEMON_TYPES.length);
      expect(qa('table.matrix td.cell')).toHaveLength(POKEMON_TYPES.length ** 2);
    });

    it('shows a readout on hover and pins rows, columns and cells', () => {
      const { fixture, q, qa } = setup();
      const cell = (row: number, col: number) =>
        qa('table.matrix tbody tr')[row]!.querySelectorAll<HTMLElement>('td.cell')[col]!;
      const fire = POKEMON_TYPES.indexOf('fire');
      const grass = POKEMON_TYPES.indexOf('grass');

      cell(fire, grass).dispatchEvent(new Event('mouseenter'));
      fixture.detectChanges();
      expect(q('.readout')).not.toBeNull();
      expect(q('.readout .ro-mult')?.textContent).toBe('2×');
      expect(cell(fire, grass).classList.contains('both')).toBe(true);
      cell(fire, grass).dispatchEvent(new Event('mouseleave'));
      fixture.detectChanges();
      expect(q('.readout')).toBeNull();

      cell(fire, grass).click(); // pin the cell
      fixture.detectChanges();
      expect(q('.readout .ro-mult')?.textContent).toBe('2×');
      expect(q('.clear-pins')).not.toBeNull();
      cell(fire, grass).click(); // unpin
      fixture.detectChanges();
      expect(q('.readout')).toBeNull();
      expect(q('.clear-pins')).toBeNull();

      // pin a row + a column header separately
      qa('th.row-head')[fire]!.click();
      qa('th.col-head')[POKEMON_TYPES.indexOf('water')]!.click();
      fixture.detectChanges();
      expect(q('.readout .ro-mult')?.textContent).toBe('½×');
      expect(qa('th.row-head')[fire]!.classList.contains('pinned')).toBe(true);
      q('.clear-pins')!.click();
      fixture.detectChanges();
      expect(q('.readout')).toBeNull();
    });

    it('marks cells by effectiveness class', () => {
      const { qa } = setup();
      const ghostRow = qa('table.matrix tbody tr')[POKEMON_TYPES.indexOf('ghost')]!;
      const normalCol = ghostRow.querySelectorAll('td.cell')[POKEMON_TYPES.indexOf('normal')]!;
      expect(normalCol.classList.contains('m0')).toBe(true);
      expect(normalCol.textContent!.trim()).toBe('0×');
    });
  });

  describe('calculator tab', () => {
    it('defaults to fire vs grass', () => {
      const { tab, q } = setup();
      tab('Calculator');
      expect(q('.big')?.textContent).toBe('2×');
      expect(q('.verdict')?.textContent).toBe('Super effective');
      expect(q('.result')?.classList.contains('m2')).toBe(true);
    });

    it('combines two defending types and shows the breakdown', () => {
      const { tab, pick, q, qa } = setup();
      tab('Calculator');
      pick('rock', 1); // grass + rock
      expect(q('.big')?.textContent).toBe('1×'); // fire: 2x grass, 0.5x rock
      expect(qa('.breakdown span').map((s) => s.textContent!.trim())).toEqual([
        'Grass: 2×',
        'Rock: ½×',
      ]);
      pick('water', 1); // 3rd pick replaces the oldest: rock + water
      expect(qa('.breakdown span').map((s) => s.textContent!.trim())).toEqual([
        'Rock: ½×',
        'Water: ½×',
      ]);
      expect(q('.big')?.textContent).toBe('¼×');
    });

    it('allows deselecting all defenders', () => {
      const { tab, pick, q } = setup();
      tab('Calculator');
      pick('grass', 1);
      expect(q('.combo .muted')).not.toBeNull();
      expect(q('.big')?.textContent).toBe('1×');
      expect(q('.breakdown')).toBeNull();
    });

    it('changes the attacking type and lists its coverage', () => {
      const { tab, pick, q, qa } = setup();
      tab('Calculator');
      pick('electric', 0);
      pick('ground', 1); // grass -> ground (replace? grass + ground)
      pick('grass', 1); // remove grass: ground only
      expect(q('.big')?.textContent).toBe('0×');
      expect(q('.result')?.classList.contains('m0')).toBe(true);
      const bucket = qa('.calc-offense .bucket.m0')[0]!;
      expect(badges(bucket)).toEqual(['ground']);
    });
  });

  describe('defender tab', () => {
    it('shows buckets for the default fire/flying defender', () => {
      const { tab, q, qa } = setup();
      tab('Defender');
      expect(badges(q('.chosen')).sort()).toEqual(['fire', 'flying']);
      const first = qa('.bucket')[0]!;
      expect(first.querySelector('.b-mult')?.textContent).toBe('4×');
      expect(badges(first)).toEqual(['rock']);
    });

    it('lets types be toggled and replaced', () => {
      const { tab, pick, q } = setup();
      tab('Defender');
      pick('fire', 0);
      pick('flying', 0);
      expect(q('.chosen .muted')).not.toBeNull();
      expect(q('.buckets')).toBeNull();
      pick('water', 0);
      expect(badges(q('.chosen'))).toEqual(['water']);
      pick('ground', 0);
      pick('grass', 0); // replaces water
      expect(badges(q('.chosen')).sort()).toEqual(['grass', 'ground']);
    });
  });

  describe('team tab', () => {
    const open = () => {
      const ctx = setup();
      ctx.tab('Team');
      return ctx;
    };

    it('starts with a fire/water/grass trio and scores it', () => {
      const { qa, q } = open();
      expect(qa('.team-roster .member')).toHaveLength(3);
      expect(q('.team-summary .grade')?.textContent).toMatch(/^[SABCD]$/);
      expect(q('.team-summary strong')?.textContent).toMatch(/Coverage score \d+\/100/);
      expect(qa('.heatmap .hm-cell')).toHaveLength(POKEMON_TYPES.length);
    });

    it('builds a dual-type member, limiting the builder to two types', () => {
      const { pick, qa, q, fixture } = open();
      pick('ghost', 0);
      pick('dark', 0);
      pick('fairy', 0); // replaces the oldest
      expect(badges(q('.build-chosen')).sort()).toEqual(['dark', 'fairy']);
      pick('fairy', 0); // toggle off
      expect(badges(q('.build-chosen'))).toEqual(['dark']);
      q('.btn.add')!.click();
      fixture.detectChanges();
      expect(qa('.team-roster .member')).toHaveLength(4);
      expect(badges(qa('.team-roster .member')[3]!)).toEqual(['dark']);
      expect(q('.build-chosen .muted')).not.toBeNull();
    });

    it('disables add without a selection and at six members', () => {
      const { pick, q, fixture, el } = open();
      const add = q('.btn.add') as HTMLButtonElement;
      expect(add.disabled).toBe(true);
      for (const t of ['ghost', 'dark', 'steel']) {
        pick(t, 0);
        add.click();
        fixture.detectChanges();
      }
      pick('ice', 0);
      expect(add.disabled).toBe(true);
      add.click();
      fixture.detectChanges();
      expect(el.querySelectorAll('.team-roster .member')).toHaveLength(6);
    });

    it('removes a member and clears the team', () => {
      const { qa, q, fixture } = open();
      qa('.team-roster .member')[0]!.click();
      fixture.detectChanges();
      expect(qa('.team-roster .member')).toHaveLength(2);
      expect(badges(qa('.team-roster .member')[0]!)).toEqual(['water']);
      q('.chip.clear')!.click();
      fixture.detectChanges();
      expect(qa('.team-roster .member')).toHaveLength(0);
      expect(q('.team-roster .muted')).not.toBeNull();
      expect(q('.team-summary')).toBeNull();
      expect(q('.heatmap')).toBeNull();
    });

    it('flags uncovered weaknesses in the heatmap', () => {
      const { qa, q, fixture } = open();
      // A lone Normal member is weak to fighting and resists nothing relevant to it.
      q('.chip.clear')!.click();
      fixture.detectChanges();
      const grid = qa('.grid-types')[0]!;
      Array.from(grid.querySelectorAll<HTMLElement>('.t-btn'))
        .find((b) => b.textContent!.trim() === 'Normal')!
        .click();
      fixture.detectChanges();
      q('.btn.add')!.click();
      fixture.detectChanges();
      const danger = qa('.hm-cell.danger');
      expect(danger).toHaveLength(1);
      expect(badges(danger[0]!)).toEqual(['fighting']);
      expect(danger[0]!.querySelector('.w')?.classList.contains('hot')).toBe(true);
      expect(qa('.hm-cell.safe').map((c) => badges(c)[0])).toContain('ghost');
    });
  });
});
