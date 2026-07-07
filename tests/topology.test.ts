import { describe, expect, it } from 'vitest';
import { getFrame } from '../src/model/data';

describe('Topologie', () => {
  it('Basisspiel: 19 Hexes, 54 Vertices, 72 Kanten', () => {
    const f = getFrame('base');
    expect(f.coords.length).toBe(19);
    expect(f.topo.vertices.size).toBe(54);
    expect(f.topo.edges.size).toBe(72);
  });

  it('5-6-Erweiterung: 30 Hexes', () => {
    const f = getFrame('ext56');
    expect(f.coords.length).toBe(30);
  });

  it.each(['base', 'ext56'] as const)('Euler-Invariante V = E - H + 1 (%s)', (id) => {
    const f = getFrame(id);
    expect(f.topo.vertices.size).toBe(f.topo.edges.size - f.coords.length + 1);
  });

  it.each(['base', 'ext56'] as const)('Küstenring geschlossen und vollständig (%s)', (id) => {
    const f = getFrame(id);
    const coastalEdges = [...f.topo.edges.values()].filter((e) => e.hexes.length === 1);
    expect(f.coastRing.length).toBe(coastalEdges.length);
    for (let i = 0; i < f.coastRing.length; i++) {
      const cur = f.coastRing[i];
      const next = f.coastRing[(i + 1) % f.coastRing.length];
      const shared = [cur.v1, cur.v2].filter((v) => v === next.v1 || v === next.v2);
      expect(shared.length).toBe(1);
    }
  });

  it.each(['base', 'ext56'] as const)('Vertex-Grade plausibel (%s)', (id) => {
    const f = getFrame(id);
    for (const v of f.topo.vertices.values()) {
      expect(v.hexes.length).toBeGreaterThanOrEqual(1);
      expect(v.hexes.length).toBeLessThanOrEqual(3);
      expect(v.adj.length).toBeGreaterThanOrEqual(2);
      expect(v.adj.length).toBeLessThanOrEqual(3);
    }
  });

  it('Jedes Hex hat genau 6 Ecken', () => {
    const f = getFrame('base');
    for (const corners of f.topo.hexCornerKeys) expect(corners.length).toBe(6);
  });
});
