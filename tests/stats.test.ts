import { describe, expect, it } from 'vitest';
import { generateCandidate } from '../src/generator/generate';
import { rngFrom } from '../src/generator/rng';
import { getFrame } from '../src/model/data';
import { computeResourceStats } from '../src/scoring/stats';
import { DEFAULT_SETTINGS, GenSettings } from '../src/model/types';

describe('Ressourcen-Statistik', () => {
  it('Pips und Felder summieren sich zum Gesamt-Board', () => {
    const frame = getFrame('base');
    const b = generateCandidate(DEFAULT_SETTINGS, rngFrom('stats'), 0)!;
    const stats = computeResourceStats(frame, b);
    expect(stats.map((s) => s.resource).sort()).toEqual(['brick', 'ore', 'sheep', 'wheat', 'wood']);
    expect(stats.reduce((a, s) => a + s.pips, 0)).toBe(frame.totalPips);
    expect(stats.reduce((a, s) => a + s.hexes, 0)).toBe(frame.landCount);
    expect(stats.reduce((a, s) => a + s.share, 0)).toBeCloseTo(1, 10);
    for (const s of stats) {
      expect(s.numbers.length).toBe(s.hexes);
      expect(s.numbers.reduce((a, n) => a + ({1:0,2:1,3:2,4:3,5:4,6:5,8:5,9:4,10:3,11:2,12:1} as Record<number, number>)[n], 0)).toBe(s.pips);
    }
  });

  it('Gold erscheint in Seefahrer-Statistiken als eigene Ressource', () => {
    const s: GenSettings = {
      ...DEFAULT_SETTINGS, expansion: 'seafarers', scenario: 'goldrausch',
      constraints: { ...DEFAULT_SETTINGS.constraints, desertCenter: false },
    };
    const frame = getFrame('sfGold');
    const b = generateCandidate(s, rngFrom('gold-stats'), 0)!;
    const stats = computeResourceStats(frame, b);
    const gold = stats.find((x) => x.resource === 'gold')!;
    expect(gold.hexes).toBe(4);
    expect(gold.pips).toBeGreaterThan(0);
    expect(gold.fairShare).toBeCloseTo(4 / 18, 10);
  });
});
