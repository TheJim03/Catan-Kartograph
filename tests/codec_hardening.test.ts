import { describe, expect, it } from 'vitest';
import { decodeState, encodeState } from '../src/codec/url';
import { generateCandidate } from '../src/generator/generate';
import { randomSeed, rngFrom } from '../src/generator/rng';
import { DEFAULT_SETTINGS } from '../src/model/types';

const tamper = (hash: string, fn: (json: any) => void): string => {
  const json = JSON.parse(Buffer.from(hash.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
  fn(json);
  return Buffer.from(JSON.stringify(json)).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

describe('Codec-Härtung', () => {
  const board = generateCandidate(DEFAULT_SETTINGS, rngFrom('hard'), 0)!;
  const hash = encodeState(board, DEFAULT_SETTINGS);

  it('encode → decode → encode ist stabil', () => {
    const decoded = decodeState(`#${hash}`)!;
    expect(encodeState(decoded.board, decoded.settings)).toBe(hash);
  });

  it('manipulierte Chip-Länge wird abgelehnt', () => {
    expect(decodeState(`#${tamper(hash, (j) => j.c.push(9))}`)).toBeNull();
    expect(decodeState(`#${tamper(hash, (j) => j.c.pop())}`)).toBeNull();
  });

  it('unbekannte Ressourcen-Zeichen werden abgelehnt', () => {
    expect(decodeState(`#${tamper(hash, (j) => { j.r = 'z' + j.r.slice(1); })}`)).toBeNull();
  });

  it('Hafen-Index außerhalb des Küstenrings wird abgelehnt', () => {
    expect(decodeState(`#${tamper(hash, (j) => { j.p[0][0] = 9999; })}`)).toBeNull();
  });

  it('randomSeed liefert praktisch nie Duplikate (Basis von „Neu generieren")', () => {
    const seeds = new Set(Array.from({ length: 200 }, () => randomSeed()));
    expect(seeds.size).toBe(200);
  });
});
