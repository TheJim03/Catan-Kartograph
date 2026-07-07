import { Axial, Point, edgeKey, hexCorners, vkey } from './coords';

export interface VertexInfo {
  key: string;
  x: number;
  y: number;
  /** Indizes der angrenzenden Land-Hexes (1–3). */
  hexes: number[];
  /** Keys der über eine Kante verbundenen Nachbar-Vertices (2–3). */
  adj: string[];
  /** Berührt Wasser (weniger als 3 Land-Hexes). */
  coastal: boolean;
}

export interface EdgeInfo {
  key: string;
  v1: string;
  v2: string;
  /** Indizes der angrenzenden Land-Hexes (1 = Küste, 2 = innen). */
  hexes: number[];
  coastal: boolean;
}

export interface Topology {
  vertices: Map<string, VertexInfo>;
  edges: Map<string, EdgeInfo>;
  /** Ecken-Keys je Hex (Index = Hex-Index, 6 Einträge, oben beginnend). */
  hexCornerKeys: string[][];
}

/**
 * Leitet Vertices und Edges deterministisch aus der Hexliste ab.
 * Grundlage der vertex-basierten Balance: Nachbarschaften sind eindeutig.
 */
export function buildTopology(coords: Axial[]): Topology {
  const vertices = new Map<string, VertexInfo>();
  const edges = new Map<string, EdgeInfo>();
  const hexCornerKeys: string[][] = [];

  coords.forEach((h, hi) => {
    const corners = hexCorners(h);
    const keys: string[] = [];
    corners.forEach((p: Point, k: number) => {
      const key = vkey(p);
      keys.push(key);
      let v = vertices.get(key);
      if (!v) {
        v = { key, x: p.x, y: p.y, hexes: [], adj: [], coastal: false };
        vertices.set(key, v);
      }
      if (!v.hexes.includes(hi)) v.hexes.push(hi);

      const p2 = corners[(k + 1) % 6];
      const key2 = vkey(p2);
      const ek = edgeKey(key, key2);
      let e = edges.get(ek);
      if (!e) {
        e = {
          key: ek,
          v1: key < key2 ? key : key2,
          v2: key < key2 ? key2 : key,
          hexes: [],
          coastal: false,
        };
        edges.set(ek, e);
      }
      if (!e.hexes.includes(hi)) e.hexes.push(hi);
    });
    hexCornerKeys.push(keys);
  });

  for (const e of edges.values()) {
    e.coastal = e.hexes.length === 1;
    vertices.get(e.v1)!.adj.push(e.v2);
    vertices.get(e.v2)!.adj.push(e.v1);
  }
  for (const v of vertices.values()) v.coastal = v.hexes.length < 3;

  return { vertices, edges, hexCornerKeys };
}

export function buildCoastRings(topo: Topology): EdgeInfo[][] {
  const coastal = [...topo.edges.values()].filter((e) => e.coastal);
  const byVertex = new Map<string, EdgeInfo[]>();
  for (const e of coastal) {
    for (const v of [e.v1, e.v2]) {
      const arr = byVertex.get(v) ?? [];
      arr.push(e);
      byVertex.set(v, arr);
    }
  }
  const used = new Set<string>();
  const rings: EdgeInfo[][] = [];
  // Deterministische Startreihenfolge: lexikographisch kleinster Kanten-Key zuerst.
  const sorted = [...coastal].sort((a, b) => (a.key < b.key ? -1 : 1));
  for (const start of sorted) {
    if (used.has(start.key)) continue;
    const ring: EdgeInfo[] = [start];
    used.add(start.key);
    let cur = start.v2;
    let guard = 0;
    while (guard++ < 10000) {
      const next = (byVertex.get(cur) ?? []).find((e) => !used.has(e.key));
      if (!next) break;
      ring.push(next);
      used.add(next.key);
      cur = next.v1 === cur ? next.v2 : next.v1;
    }
    rings.push(ring);
  }
  // Längster Ring (Hauptinsel) zuerst.
  return rings.sort((a, b) => b.length - a.length);
}

/** Küstenring der Hauptinsel (längster Ring) — Grundlage der Hafen-Spots. */
export function buildCoastRing(topo: Topology): EdgeInfo[] {
  return buildCoastRings(topo)[0] ?? [];
}

/** Vertex-Keys im Abstand <= dist (BFS über die Vertex-Adjazenz). */
export function verticesWithin(topo: Topology, startKeys: string[], dist: number): Set<string> {
  const seen = new Set<string>(startKeys);
  let frontier = [...startKeys];
  for (let d = 0; d < dist; d++) {
    const next: string[] = [];
    for (const k of frontier) {
      for (const n of topo.vertices.get(k)!.adj) {
        if (!seen.has(n)) {
          seen.add(n);
          next.push(n);
        }
      }
    }
    frontier = next;
  }
  return seen;
}
