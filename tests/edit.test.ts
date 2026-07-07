import { describe, expect, it } from 'vitest';
import { decodeState, encodeState } from '../src/codec/url';
import { generateCandidate, rescore } from '../src/generator/generate';
import { rngFrom } from '../src/generator/rng';
import { swapChips, swapTiles } from '../src/model/edit';
import { getFrame } from '../src/model/data';
import { validateBoard } from '../src/constraints/constraints';
import { DEFAULT_SETTINGS } from '../src/model/types';

const board = () => generateCandidate(DEFAULT_SETTINGS, rngFrom('edit'), 0)!;
const multiset = (a: unknown[]) => [...a].map(String).sort();

describe('Editor: Felder tauschen', () => {
  it('Ressource und Chip wandern gemeinsam, Multisets bleiben erhalten', () => {
    const b = board();
    const out = swapTiles(b, 0, 5)!;
    expect(out.resources[0]).toBe(b.resources[5]);
    expect(out.resources[5]).toBe(b.resources[0]);
    expect(out.chips[0]).toBe(b.chips[5]);
    expect(out.chips[5]).toBe(b.chips[0]);
    expect(multiset(out.resources)).toEqual(multiset(b.resources));
    expect(multiset(out.chips)).toEqual(multiset(b.chips));
    // Original unverändert (pure Funktion)
    expect(b.resources[0]).not.toBe(out.resources[0]);
  });

  it('Wüste darf als ganzes Feld verschoben werden — Chip (null) wandert mit', () => {
    const b = board();
    const d = b.resources.indexOf('desert');
    const other = d === 0 ? 1 : 0;
    const out = swapTiles(b, d, other)!;
    expect(out.resources[other]).toBe('desert');
    expect(out.chips[other]).toBeNull();
    expect(out.chips[d]).toBe(b.chips[other]);
  });

  it('ungültige Eingaben liefern null', () => {
    const b = board();
    expect(swapTiles(b, 3, 3)).toBeNull();
    expect(swapTiles(b, -1, 2)).toBeNull();
    expect(swapTiles(b, 0, 999)).toBeNull();
  });
});

describe('Editor: Chips tauschen', () => {
  it('nur Chips tauschen, Ressourcen bleiben liegen', () => {
    const b = board();
    const [i, j] = [0, 5].filter(() => true);
    const out = swapChips(b, i, j)!;
    expect(out.resources).toEqual(b.resources);
    expect(out.chips[i]).toBe(b.chips[j]);
    expect(out.chips[j]).toBe(b.chips[i]);
  });

  it('Chip-Tausch mit einer Wüste ist verboten (Wüste trägt nie einen Chip)', () => {
    const b = board();
    const d = b.resources.indexOf('desert');
    const other = d === 0 ? 1 : 0;
    expect(swapChips(b, d, other)).toBeNull();
    expect(swapChips(b, other, d)).toBeNull();
  });
});

describe('Editor: Integration', () => {
  it('bearbeitete Boards lassen sich neu bewerten und teilen (Codec-Roundtrip)', () => {
    const b = board();
    const edited = swapTiles(b, 2, 9)!;
    const score = rescore(edited, DEFAULT_SETTINGS);
    expect(score.total).toBeGreaterThanOrEqual(0);
    expect(score.total).toBeLessThanOrEqual(100);
    const decoded = decodeState(`#${encodeState(edited, DEFAULT_SETTINGS)}`);
    expect(decoded!.board).toEqual(edited);
  });

  it('validateBoard meldet Verletzungen, die durch Edits entstehen', () => {
    const b = board(); // Default: 6/8 getrennt
    const frame = getFrame('base');
    const i6 = b.chips.indexOf(6);
    // Chip 8 gezielt neben die 6 tauschen
    const nb = frame.adjIdx[i6].find((j) => b.chips[j] !== null && b.chips[j] !== 6)!;
    const i8 = b.chips.indexOf(8);
    const bad = swapChips(b, nb, i8)!;
    const violations = validateBoard(frame, bad, DEFAULT_SETTINGS.constraints);
    expect(violations.some((v) => v.includes('6/8'))).toBe(true);
    // Das Original bleibt sauber
    expect(validateBoard(frame, b, DEFAULT_SETTINGS.constraints)).toEqual([]);
  });
});
