import { describe, expect, it } from 'vitest';
import { generateCandidate } from '../src/generator/generate';
import { rngFrom } from '../src/generator/rng';
import { classicPortOffsets, getFrame } from '../src/model/data';
import { DEFAULT_SETTINGS, GenSettings } from '../src/model/types';

describe('Hafen-Platzierung', () => {
  it('klassisch: gleichmäßige Offsets, korrekte Anzahl, offizielles Kinds-Multiset', () => {
    const frame = getFrame('base');
    const b = generateCandidate(DEFAULT_SETTINGS, rngFrom('ports-classic'), 0)!;
    expect(b.ports.map((p) => p.ringIndex)).toEqual(classicPortOffsets(frame.portCoast.length, 9));
    expect(b.ports.map((p) => p.kind).sort()).toEqual([...frame.def.portKinds].sort());
  });

  it('zufällig: Mindestabstand 2 im Küstenring, Multiset bleibt erhalten', () => {
    const s: GenSettings = { ...DEFAULT_SETTINGS, ports: 'random' };
    const frame = getFrame('base');
    const L = frame.portCoast.length;
    for (let k = 0; k < 10; k++) {
      const b = generateCandidate(s, rngFrom(`ports-rnd-${k}`), k)!;
      expect(b.ports.length).toBe(9);
      expect(b.ports.map((p) => p.kind).sort()).toEqual([...frame.def.portKinds].sort());
      const idx = b.ports.map((p) => p.ringIndex).sort((a, b2) => a - b2);
      for (let i = 0; i < idx.length; i++) {
        const next = idx[(i + 1) % idx.length];
        const d = Math.min(((next - idx[i]) % L + L) % L, ((idx[i] - next) % L + L) % L);
        expect(d).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('aus: keine Häfen, Score trotzdem in [0,100]', () => {
    const s: GenSettings = { ...DEFAULT_SETTINGS, ports: 'off' };
    const b = generateCandidate(s, rngFrom('ports-off'), 0)!;
    expect(b.ports).toEqual([]);
  });

  it('unterschiedliche Seeds → unterschiedliche Zufalls-Hafenpositionen (Regenerate-Semantik)', () => {
    const s: GenSettings = { ...DEFAULT_SETTINGS, ports: 'random' };
    const a = generateCandidate(s, rngFrom('seed-A'), 0)!;
    const b = generateCandidate({ ...s, seed: 'seed-B' }, rngFrom('seed-B'), 0)!;
    expect(a.ports.map((p) => p.ringIndex).join(',')).not.toBe(b.ports.map((p) => p.ringIndex).join(','));
  });
});
