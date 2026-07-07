import { describe, expect, it } from 'vitest';
import { validateBoard } from '../src/constraints/constraints';
import { frameFor, generateBest, generateCandidate } from '../src/generator/generate';
import { rngFrom } from '../src/generator/rng';
import { getFrame } from '../src/model/data';
import { decodeState, encodeState } from '../src/codec/url';
import { DEFAULT_SETTINGS, GenSettings } from '../src/model/types';

const SF: GenSettings = {
  ...DEFAULT_SETTINGS,
  expansion: 'seafarers',
  playerGroup: '34',
  constraints: { ...DEFAULT_SETTINGS.constraints, desertCenter: false },
  candidates: 40,
};

describe('Seefahrer: Inselwelt', () => {
  it('Frame-Auswahl: Seefahrer nutzt das Szenario-Frame der Spielergruppe', () => {
    expect(frameFor({ expansion: 'seafarers', playerGroup: '34', scenario: 'inselwelt' })).toBe('sf34');
    expect(frameFor({ expansion: 'seafarers', playerGroup: '56', scenario: 'inselwelt' })).toBe('sf56');
    expect(frameFor({ expansion: 'ck+seafarers', playerGroup: '34', scenario: 'vierinseln' })).toBe('sfFour');
    expect(frameFor({ expansion: 'ck+seafarers', playerGroup: '56', scenario: 'vierinseln' })).toBe('sfFour56');
    expect(frameFor({ expansion: 'seafarers', playerGroup: '34', scenario: 'ueberfahrt' })).toBe('sfCross34');
    expect(frameFor({ expansion: 'seafarers', playerGroup: '56', scenario: 'ueberfahrt' })).toBe('sfCross56');
    // Szenario ohne 5-6-Variante: defensiver Fallback aufs 3-4-Frame
    expect(frameFor({ expansion: 'seafarers', playerGroup: '56', scenario: 'nebel' })).toBe('sfFog');
    expect(frameFor({ expansion: 'ck', playerGroup: '34', scenario: 'inselwelt' })).toBe('base');
    expect(frameFor({ expansion: 'base', playerGroup: '34', scenario: 'nebel' })).toBe('base');
  });

  it('Geometrie: 22 Land, 18 Binnenmeer, Inseln 14+3+3+2', () => {
    const f = getFrame('sf34');
    expect(f.coords.length).toBe(22);
    expect(f.seaCoords.length).toBe(18);

    // Zusammenhangskomponenten über die Hex-Adjazenz
    const seen = new Set<number>();
    const sizes: number[] = [];
    for (let i = 0; i < f.coords.length; i++) {
      if (seen.has(i)) continue;
      let size = 0;
      const stack = [i];
      seen.add(i);
      while (stack.length) {
        const cur = stack.pop()!;
        size++;
        for (const j of f.adjIdx[cur]) {
          if (!seen.has(j)) { seen.add(j); stack.push(j); }
        }
      }
      sizes.push(size);
    }
    expect(sizes.sort((a, b) => b - a)).toEqual([14, 3, 3, 2]);
  });

  it('Küstenringe: 4 geschlossene Ringe, Häfen nur am längsten', () => {
    const f = getFrame('sf34');
    expect(f.coastRings.length).toBe(4);
    const coastalEdges = [...f.topo.edges.values()].filter((e) => e.hexes.length === 1);
    expect(f.coastRings.reduce((s, r) => s + r.length, 0)).toBe(coastalEdges.length);
    expect(f.coastRing.length).toBe(Math.max(...f.coastRings.map((r) => r.length)));
    for (const ring of f.coastRings) {
      for (let i = 0; i < ring.length; i++) {
        const cur = ring[i];
        const next = ring[(i + 1) % ring.length];
        const shared = [cur.v1, cur.v2].filter((v) => v === next.v1 || v === next.v2);
        expect(shared.length).toBe(1);
      }
    }
  });

  it('Euler-Invariante gilt je Insel: V = E − H + Inseln', () => {
    const f = getFrame('sf34');
    expect(f.topo.vertices.size).toBe(f.topo.edges.size - f.coords.length + 4);
  });

  it('Mengen: 2 Gold, 2 Wüsten, 20 Chips, 9 Häfen', () => {
    const board = generateCandidate(SF, rngFrom('sf'), 0)!;
    const count = (r: string) => board.resources.filter((x) => x === r).length;
    expect(count('gold')).toBe(2);
    expect(count('desert')).toBe(2);
    expect(board.chips.filter((c) => c !== null).length).toBe(20);
    expect(board.ports.length).toBe(9);
    // Häfen liegen ausschließlich im Hauptinsel-Ring
    const f = getFrame('sf34');
    for (const p of board.ports) expect(p.ringIndex).toBeLessThan(f.coastRing.length);
  });

  it('Constraints funktionieren auch auf der Inselwelt (Property-Test)', () => {
    const strict: GenSettings = {
      ...SF,
      constraints: { ...SF.constraints, noAdjRed: true, no2and12Adjacent: true, noSameNumberAdjacent: true },
    };
    const f = getFrame('sf34');
    let produced = 0;
    for (let i = 0; i < 15; i++) {
      const board = generateCandidate(strict, rngFrom(`sfp-${i}`), i);
      if (!board) continue;
      produced++;
      expect(validateBoard(f, board, strict.constraints)).toEqual([]);
    }
    expect(produced).toBeGreaterThan(5);
  });

  it('Generate-and-score läuft, Gold zählt in die Pip-Balance', () => {
    const res = generateBest(SF)!;
    expect(res.board.frameId).toBe('sf34');
    expect(res.score.total).toBeGreaterThan(0);
    // Goldfelder tragen Chips (kein null außer auf Wüsten)
    res.board.resources.forEach((r, i) => {
      if (r === 'gold') expect(res.board.chips[i]).not.toBeNull();
      if (r === 'desert') expect(res.board.chips[i]).toBeNull();
    });
  });

  it('Codec-Roundtrip inkl. Gold und sf34', () => {
    const board = generateCandidate(SF, rngFrom('sfc'), 1)!;
    const decoded = decodeState(`#${encodeState(board, SF)}`);
    expect(decoded).not.toBeNull();
    expect(decoded!.board).toEqual(board);
    expect(decoded!.settings.expansion).toBe('seafarers');
  });
});
