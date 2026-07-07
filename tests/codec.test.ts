import { describe, expect, it } from 'vitest';
import { decodeState, encodeState } from '../src/codec/url';
import { generateCandidate } from '../src/generator/generate';
import { rngFrom } from '../src/generator/rng';
import { DEFAULT_SETTINGS, GenSettings } from '../src/model/types';

describe('URL-Codec', () => {
  it('Roundtrip: Board + Settings überleben encode/decode', () => {
    const settings: GenSettings = {
      ...DEFAULT_SETTINGS,
      playerGroup: '56',
      ports: 'random',
      candidates: 777,
      target: 'worst',
      seed: 'RÖUND-trip_42',
      weights: { ...DEFAULT_SETTINGS.weights, ports: 0.3, fairness: 2 },
      constraints: { ...DEFAULT_SETTINGS.constraints, no2and12Adjacent: true, desertCenter: false },
    };
    const board = generateCandidate(settings, rngFrom('codec'), 3)!;
    const decoded = decodeState(`#${encodeState(board, settings)}`);
    expect(decoded).not.toBeNull();
    expect(decoded!.board).toEqual(board);
    expect(decoded!.settings).toEqual(settings);
  });

  it('Müll-Hashes werden abgelehnt statt zu crashen', () => {
    expect(decodeState('#not-base64!!')).toBeNull();
    expect(decodeState('')).toBeNull();
    expect(decodeState('#eyJ2IjoyfQ')).toBeNull(); // falsche Version
  });
});
