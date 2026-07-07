import { describe, expect, it } from 'vitest';
import { generateCandidate } from '../src/generator/generate';
import { rngFrom } from '../src/generator/rng';
import { getFrame, PIPS } from '../src/model/data';
import { Board, DEFAULT_SETTINGS, DEFAULT_WEIGHTS } from '../src/model/types';
import { scoreBoard } from '../src/scoring/score';

const frame = getFrame('base');

function makeBoard(resources: string[], chips: (number | null)[]): Board {
  return { frameId: 'base', resources: resources as Board['resources'], chips, ports: [], seed: 't', candidateIndex: 0 };
}

describe('Scoring', () => {
  it('Pip-Tabelle stimmt', () => {
    expect(PIPS[2]).toBe(1);
    expect(PIPS[12]).toBe(1);
    expect(PIPS[3]).toBe(2);
    expect(PIPS[6]).toBe(5);
    expect(PIPS[8]).toBe(5);
    expect(PIPS[7]).toBeUndefined();
  });

  it('Pip-Balance bestraft ausgehungerte Ressourcen', () => {
    // Board A: Erz bekommt nur 2, 3, 12 (4 Pips) — Board B: Erz bekommt 6, 8, 5 (14 Pips).
    const base = generateCandidate(DEFAULT_SETTINGS, rngFrom('pip'), 0)!;
    const oreIdx = base.resources.map((r, i) => (r === 'ore' ? i : -1)).filter((i) => i >= 0);
    const otherIdx = base.resources.map((r, i) => (r !== 'ore' && r !== 'desert' ? i : -1)).filter((i) => i >= 0);

    const starve = [...base.chips];
    const rich = [...base.chips];
    const give = (chips: (number | null)[], targets: number[], values: number[]) => {
      // Werte mit den aktuellen Positionen tauschen, Chip-Multiset bleibt gültig.
      values.forEach((val, i) => {
        const from = chips.indexOf(val);
        const to = targets[i];
        [chips[from], chips[to]] = [chips[to], chips[from]];
      });
    };
    give(starve, oreIdx, [2, 3, 12]);
    give(rich, oreIdx, [6, 8, 5]);

    const sA = scoreBoard(frame, makeBoard(base.resources, starve), DEFAULT_WEIGHTS, [3, 4]);
    const sB = scoreBoard(frame, makeBoard(base.resources, rich), DEFAULT_WEIGHTS, [3, 4]);
    expect(sB.factors.pipBalance).toBeGreaterThan(sA.factors.pipBalance);
  });

  it('Zahlen-Faktor bestraft benachbarte 6/8', () => {
    const good = generateCandidate(
      { ...DEFAULT_SETTINGS, constraints: { ...DEFAULT_SETTINGS.constraints, noAdjRed: true } },
      rngFrom('good'),
      0,
    )!;
    // Schlechtes Board: 6 und 8 nebeneinander zwingen.
    const bad: (number | null)[] = [...good.chips];
    const i6 = bad.indexOf(6);
    const nb = frame.adjIdx[i6].find((j) => bad[j] !== null)!;
    const i8 = bad.indexOf(8);
    [bad[nb], bad[i8]] = [bad[i8], bad[nb]];

    const sGood = scoreBoard(frame, good, DEFAULT_WEIGHTS, [3, 4]);
    const sBad = scoreBoard(frame, makeBoard(good.resources, bad), DEFAULT_WEIGHTS, [3, 4]);
    expect(sGood.factors.numbers).toBeGreaterThan(sBad.factors.numbers);
  });

  it('Score liegt in [0, 100], Faktoren in [0, 1]', () => {
    for (let i = 0; i < 10; i++) {
      const b = generateCandidate(DEFAULT_SETTINGS, rngFrom(`range-${i}`), i);
      if (!b) continue;
      const s = scoreBoard(frame, b, DEFAULT_WEIGHTS, [3, 4]);
      expect(s.total).toBeGreaterThanOrEqual(0);
      expect(s.total).toBeLessThanOrEqual(100);
      for (const v of Object.values(s.factors)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('liefert 6 Top-Startplätze mit Abstand', () => {
    const b = generateCandidate(DEFAULT_SETTINGS, rngFrom('spots'), 0)!;
    const s = scoreBoard(frame, b, DEFAULT_WEIGHTS, [3, 4]);
    expect(s.topSpots.length).toBe(6);
    // Abstandsregel: kein Top-Spot direkt neben einem anderen.
    for (const a of s.topSpots) {
      const v = frame.topo.vertices.get(a)!;
      for (const other of s.topSpots) {
        if (other !== a) expect(v.adj.includes(other)).toBe(false);
      }
    }
  });
});
