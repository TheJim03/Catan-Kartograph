import { describe, expect, it } from 'vitest';
import { generateBest } from '../src/generator/generate';
import { DEFAULT_SETTINGS, GenSettings } from '../src/model/types';

describe('Determinismus', () => {
  it('gleicher Seed + Einstellungen → identisches Board und Score', () => {
    const s: GenSettings = { ...DEFAULT_SETTINGS, candidates: 60, seed: 'DETERMINISM' };
    const a = generateBest(s)!;
    const b = generateBest(s)!;
    expect(a.board).toEqual(b.board);
    expect(a.score.total).toBe(b.score.total);
  });

  it('anderer Seed → (praktisch immer) anderes Board', () => {
    const a = generateBest({ ...DEFAULT_SETTINGS, candidates: 30, seed: 'alpha' })!;
    const b = generateBest({ ...DEFAULT_SETTINGS, candidates: 30, seed: 'beta' })!;
    expect(a.board.resources.join('') + a.board.chips.join(','))
      .not.toBe(b.board.resources.join('') + b.board.chips.join(','));
  });
});
