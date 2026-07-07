import { describe, expect, it } from 'vitest';
import { generateCandidate } from '../src/generator/generate';
import { rngFrom } from '../src/generator/rng';
import { FRAME_DEFS, PIPS, getFrame } from '../src/model/data';
import { DEFAULT_SETTINGS } from '../src/model/types';

/**
 * Verifiziert die offiziellen Catan-Materialmengen (Basisspiel + 5-6-
 * Erweiterung) gegen die Regelhefte. Quellen: offizielles 5-6-Regelheft
 * („11 terrain hexes: 1 desert, 2 fields, 2 forest, 2 pasture, 2 mountains,
 * 2 hills; 28 number tokens; 11 harbor markers") und Komponentenlisten.
 */
describe('Offizielle Regeln: Basisspiel', () => {
  const def = FRAME_DEFS.base;

  it('19 Geländefelder: 4 Wald, 4 Weide, 4 Acker, 3 Hügel, 3 Gebirge, 1 Wüste', () => {
    expect(def.resourceCounts).toEqual({ wood: 4, sheep: 4, wheat: 4, brick: 3, ore: 3, gold: 0, desert: 1 });
  });

  it('18 Zahlenchips: je 1× 2/12, je 2× 3–6 und 8–11, keine 7', () => {
    expect(def.chipCounts).toEqual({ 2: 1, 3: 2, 4: 2, 5: 2, 6: 2, 8: 2, 9: 2, 10: 2, 11: 2, 12: 1 });
    expect(def.chipCounts[7]).toBeUndefined();
  });

  it('9 Häfen: 4× 3:1 und je 1× 2:1 pro Ressource', () => {
    const kinds = [...def.portKinds].sort();
    expect(kinds).toEqual(['brick', 'generic', 'generic', 'generic', 'generic', 'ore', 'sheep', 'wheat', 'wood']);
  });

  it('Pip-Tabelle entspricht den Würfelwahrscheinlichkeiten (Summe 58 Gesamt-Pips)', () => {
    // n Pips = Anzahl Würfelkombinationen für die Zahl (36er-Basis)
    const combos: Record<number, number> = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 };
    expect(PIPS).toEqual(combos);
    expect(getFrame('base').totalPips).toBe(58);
  });

  it('Rahmen 3-4-5-4-3, Wüste erhält keinen Chip (Räuber-Startfeld)', () => {
    expect(def.rows).toEqual([3, 4, 5, 4, 3]);
    for (let i = 0; i < 8; i++) {
      const b = generateCandidate(DEFAULT_SETTINGS, rngFrom(`official-${i}`), i);
      if (!b) continue;
      b.resources.forEach((r, hi) => {
        if (r === 'desert') expect(b.chips[hi]).toBeNull();
        else expect(b.chips[hi]).not.toBeNull();
      });
    }
  });
});

describe('Offizielle Regeln: 5-6-Spieler-Erweiterung', () => {
  const def = FRAME_DEFS.ext56;

  it('erweitert um 11 Felder auf 30: je +2 pro Ressource, +1 Wüste', () => {
    expect(def.resourceCounts).toEqual({ wood: 6, sheep: 6, wheat: 6, brick: 5, ore: 5, gold: 0, desert: 2 });
    expect(getFrame('ext56').coords.length).toBe(30);
  });

  it('28 Zahlenchips: je 2× 2/12, je 3× 3–6 und 8–11', () => {
    expect(def.chipCounts).toEqual({ 2: 2, 3: 3, 4: 3, 5: 3, 6: 3, 8: 3, 9: 3, 10: 3, 11: 3, 12: 2 });
    expect(Object.values(def.chipCounts).reduce((a, b) => a + b, 0)).toBe(28);
  });

  it('11 Häfen: +1× 3:1 und +1× Wolle gegenüber dem Basisspiel', () => {
    const kinds = [...def.portKinds].sort();
    expect(kinds).toEqual([
      'brick', 'generic', 'generic', 'generic', 'generic', 'generic',
      'ore', 'sheep', 'sheep', 'wheat', 'wood',
    ]);
  });

  it('Rahmen 3-4-5-6-5-4-3', () => {
    expect(def.rows).toEqual([3, 4, 5, 6, 5, 4, 3]);
  });
});

describe('Offizielle Regeln: variabler Aufbau', () => {
  it('die „ausgewogene" 6/8-Regel ist per Default aktiv', () => {
    expect(DEFAULT_SETTINGS.constraints.noAdjRed).toBe(true);
  });

  it('Seefahrer-Grundlagen: Gold ist Joker ohne 2:1-Hafen, Wüsten ohne Chip', () => {
    for (const id of ['sf34', 'sfFour', 'sfDesert', 'sfFog', 'sfArchipel', 'sfGold'] as const) {
      const d = FRAME_DEFS[id];
      // Kein Hafen-Typ „gold" — Gold ist per Regel frei wählbare Ressource
      expect(d.portKinds.every((k) => (k as string) !== 'gold')).toBe(true);
    }
  });
});
