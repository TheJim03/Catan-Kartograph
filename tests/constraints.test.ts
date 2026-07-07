import { describe, expect, it } from 'vitest';
import { validateBoard } from '../src/constraints/constraints';
import { generateCandidate } from '../src/generator/generate';
import { rngFrom } from '../src/generator/rng';
import { getFrame } from '../src/model/data';
import { Board, DEFAULT_SETTINGS, GenSettings } from '../src/model/types';

const ALL_ON: GenSettings = {
  ...DEFAULT_SETTINGS,
  constraints: {
    noAdjRed: true,
    no2and12Adjacent: true,
    noSameNumberAdjacent: true,
    noSameResourceAdjacent: true,
    desertCenter: true,
  },
};

describe('Constraints', () => {
  it('erkennt eine geplante 6/8-Verletzung', () => {
    const frame = getFrame('base');
    // Manuelles Board: 6 und 8 auf die ersten beiden (benachbarten) Hexes legen.
    const n = frame.coords.length;
    const neighborOfZero = frame.adjIdx[0][0];
    const resources = Array(n).fill('wood');
    resources[n - 1] = 'desert';
    const chips: (number | null)[] = Array(n).fill(9);
    chips[0] = 6;
    chips[neighborOfZero] = 8;
    chips[n - 1] = null;
    const board = { frameId: 'base', resources, chips, ports: [], seed: 't', candidateIndex: 0 } as Board;
    const violations = validateBoard(frame, board, ALL_ON.constraints);
    expect(violations.some((v) => v.includes('6/8'))).toBe(true);
  });

  it('generierte Boards validieren sauber (Property-Test, alle Regeln an)', () => {
    const frame = getFrame('base');
    let produced = 0;
    for (let i = 0; i < 20; i++) {
      const rnd = rngFrom(`prop-${i}`);
      const board = generateCandidate(ALL_ON, rnd, i);
      if (!board) continue; // Backtracking darf scheitern, aber nie falsch liefern
      produced++;
      expect(validateBoard(frame, board, ALL_ON.constraints)).toEqual([]);
    }
    expect(produced).toBeGreaterThan(10);
  });

  it('Wüste liegt bei desertCenter in der Mitte', () => {
    const frame = getFrame('base');
    const board = generateCandidate(ALL_ON, rngFrom('desert'), 0)!;
    expect(board.resources[frame.centralIdx[0]]).toBe('desert');
    expect(board.chips[frame.centralIdx[0]]).toBeNull();
  });

  it('5-6-Erweiterung: korrekte Mengen', () => {
    const s: GenSettings = { ...ALL_ON, playerGroup: '56', constraints: { ...ALL_ON.constraints, desertCenter: false } };
    const board = generateCandidate(s, rngFrom('ext'), 0)!;
    const count = (r: string) => board.resources.filter((x) => x === r).length;
    expect(count('desert')).toBe(2);
    expect(count('wood')).toBe(6);
    expect(count('ore')).toBe(5);
    expect(board.chips.filter((c) => c !== null).length).toBe(28);
    expect(board.ports.length).toBe(11);
  });
});
