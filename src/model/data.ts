import { Axial, axialKey, hexCenter, neighbors } from '../hexgrid/coords';
import { buildCoastRings, buildTopology, EdgeInfo, Topology } from '../hexgrid/topology';
import { FrameId, PortKind, Resource, TradeResource } from './types';

/** Pips (Augen auf dem Chip) = Anzahl Würfelkombinationen / relative Wahrscheinlichkeit. */
export const PIPS: Record<number, number> = {
  2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1,
};

export const isRed = (n: number): boolean => n === 6 || n === 8;

export const TRADE_RESOURCES: TradeResource[] = ['wood', 'sheep', 'wheat', 'brick', 'ore'];

export const RESOURCE_LABEL: Record<Resource, string> = {
  wood: 'Holz', sheep: 'Wolle', wheat: 'Getreide', brick: 'Lehm', ore: 'Erz', gold: 'Goldfluss', desert: 'Wüste',
};

export const RESOURCE_ICON: Record<Resource, string> = {
  wood: '🌲', sheep: '🐑', wheat: '🌾', brick: '🧱', ore: '⛰️', gold: '🪙', desert: '🌵',
};

/**
 * Ein Frame ist eine austauschbare Board-Definition (Basis, 5–6, künftig Seefahrer-
 * Szenarien): Koordinaten, Ressourcen-/Chip-Pools und Hafenanzahl.
 */
export interface FrameDef {
  id: FrameId;
  name: string;
  /** Reihenlängen von oben nach unten (pointy-top). */
  rows: number[];
  /**
   * Optionale Land/Meer-Maske je Reihe ('X' = Land, '.' = Meer). Ohne Maske ist
   * jede Zelle Land. Ermöglicht Seefahrer-Inselwelten im selben Koordinatensystem.
   */
  masks?: string[];
  resourceCounts: Record<Resource, number>;
  /** Multiset der Zahlenchips. */
  chipCounts: Record<number, number>;
  portCount: number;
  portKinds: PortKind[];
  /** Feste Wüsten-Positionen (Hex-Indizes), z. B. Wüstenriegel — überschreibt die Wüsten-Platzierung. */
  fixedDeserts?: number[];
  /** Häfen nur an der Hauptinsel ('main', Default) oder über alle Inseln verteilt ('all'). */
  portRing?: 'main' | 'all';
  /** Nebel-Szenario: alle Hexes außerhalb der Hauptinsel starten verdeckt. */
  fog?: boolean;
}

/**
 * Erzeugt die axialen Koordinaten aus Reihenlängen, horizontal zentriert
 * und deterministisch sortiert (r, dann q).
 */
export function rowsToCoords(rows: number[]): Axial[] {
  const out: Axial[] = [];
  const rTop = -Math.floor(rows.length / 2);
  rows.forEach((len, i) => {
    const r = rTop + i;
    const qStart = Math.round(-(len - 1) / 2 - r / 2);
    for (let q = qStart; q < qStart + len; q++) out.push({ q, r });
  });
  out.sort((a, b) => (a.r - b.r) || (a.q - b.q));
  return out;
}

/** Wie rowsToCoords, trennt aber per Maske in Land- und Meeres-Hexes. */
export function rowsToCoordsMasked(rows: number[], masks?: string[]): { land: Axial[]; sea: Axial[] } {
  if (!masks) return { land: rowsToCoords(rows), sea: [] };
  const land: Axial[] = [];
  const sea: Axial[] = [];
  const rTop = -Math.floor(rows.length / 2);
  rows.forEach((len, i) => {
    const r = rTop + i;
    const qStart = Math.round(-(len - 1) / 2 - r / 2);
    for (let k = 0; k < len; k++) {
      (masks[i][k] === 'X' ? land : sea).push({ q: qStart + k, r });
    }
  });
  land.sort((a, b) => (a.r - b.r) || (a.q - b.q));
  return { land, sea };
}

export const FRAME_DEFS: Record<FrameId, FrameDef> = {
  base: {
    id: 'base',
    name: 'Basisspiel (3–4)',
    rows: [3, 4, 5, 4, 3],
    resourceCounts: { wood: 4, sheep: 4, wheat: 4, brick: 3, ore: 3, gold: 0, desert: 1 },
    chipCounts: { 2: 1, 3: 2, 4: 2, 5: 2, 6: 2, 8: 2, 9: 2, 10: 2, 11: 2, 12: 1 },
    portCount: 9,
    portKinds: ['generic', 'generic', 'generic', 'generic', 'wood', 'brick', 'sheep', 'wheat', 'ore'],
  },
  ext56: {
    id: 'ext56',
    name: '5–6-Spieler-Erweiterung',
    rows: [3, 4, 5, 6, 5, 4, 3],
    resourceCounts: { wood: 6, sheep: 6, wheat: 6, brick: 5, ore: 5, gold: 0, desert: 2 },
    chipCounts: { 2: 2, 3: 3, 4: 3, 5: 3, 6: 3, 8: 3, 9: 3, 10: 3, 11: 3, 12: 2 },
    portCount: 11,
    portKinds: ['generic', 'generic', 'generic', 'generic', 'generic', 'wood', 'brick', 'sheep', 'sheep', 'wheat', 'ore'],
  },
  sf34: {
    id: 'sf34',
    name: 'Seefahrer: Inselwelt (3–4)',
    rows: [5, 6, 7, 7, 6, 5, 4],
    masks: [
      'XXXXX',
      'XXXXX.',
      '.XXXX..',
      '.......',
      'XX..XX',
      'X...X',
      '.XX.',
    ],
    resourceCounts: { wood: 4, sheep: 4, wheat: 4, brick: 3, ore: 3, gold: 2, desert: 2 },
    chipCounts: { 2: 1, 3: 2, 4: 3, 5: 2, 6: 2, 8: 2, 9: 2, 10: 3, 11: 2, 12: 1 },
    portCount: 9,
    portKinds: ['generic', 'generic', 'generic', 'generic', 'wood', 'brick', 'sheep', 'wheat', 'ore'],
  },
  sfFour: {
    id: 'sfFour',
    name: 'Seefahrer: Vier Inseln (3–4)',
    rows: [6, 7, 7, 7, 6],
    masks: ['XX..XX', 'XXX.XXX', '.......', 'XXX.XXX', 'XX..XX'],
    resourceCounts: { wood: 4, sheep: 4, wheat: 4, brick: 4, ore: 3, gold: 0, desert: 1 },
    chipCounts: { 2: 1, 3: 2, 4: 3, 5: 2, 6: 2, 8: 2, 9: 2, 10: 2, 11: 2, 12: 1 },
    portCount: 8,
    portKinds: ['generic', 'generic', 'generic', 'wood', 'brick', 'sheep', 'wheat', 'ore'],
    portRing: 'all',
  },
  sfDesert: {
    id: 'sfDesert',
    name: 'Seefahrer: Durch die Wüste (3–4)',
    rows: [6, 7, 8, 7, 4],
    masks: ['XXXXXX', 'XXXXXXX', 'XXXXXXXX', '.......', '.XXX'],
    resourceCounts: { wood: 4, sheep: 4, wheat: 4, brick: 4, ore: 3, gold: 2, desert: 3 },
    chipCounts: { 2: 1, 3: 2, 4: 3, 5: 3, 6: 2, 8: 2, 9: 2, 10: 3, 11: 2, 12: 1 },
    portCount: 8,
    portKinds: ['generic', 'generic', 'generic', 'wood', 'brick', 'sheep', 'wheat', 'ore'],
    // Fester Wüstenriegel (q = 2 durch den Kontinent) trennt das Land dahinter ab.
    fixedDeserts: [3, 10, 18],
  },
  sfFog: {
    id: 'sfFog',
    name: 'Seefahrer: Nebelinseln (3–4)',
    rows: [4, 5, 5, 6, 8, 8],
    masks: ['XXXX', 'XXXX.', 'XXXX.', '......', 'XX.XX.XX', 'X..X...X'],
    resourceCounts: { wood: 4, sheep: 4, wheat: 4, brick: 3, ore: 3, gold: 2, desert: 1 },
    chipCounts: { 2: 1, 3: 2, 4: 3, 5: 2, 6: 2, 8: 2, 9: 2, 10: 3, 11: 2, 12: 1 },
    portCount: 7,
    portKinds: ['generic', 'generic', 'generic', 'wood', 'brick', 'sheep', 'wheat'],
    fog: true,
  },
  sfArchipel: {
    id: 'sfArchipel',
    name: 'Seefahrer: Der Archipel (3–4)',
    rows: [6, 6, 6, 6, 6, 6, 6, 6],
    masks: ['XX..XX', 'X....X', '......', 'XX..XX', 'X....X', '......', 'XX..XX', 'X....X'],
    resourceCounts: { wood: 4, sheep: 3, wheat: 4, brick: 3, ore: 3, gold: 1, desert: 0 },
    chipCounts: { 2: 1, 3: 2, 4: 2, 5: 2, 6: 2, 8: 2, 9: 2, 10: 2, 11: 2, 12: 1 },
    portCount: 8,
    portKinds: ['generic', 'generic', 'generic', 'wood', 'brick', 'sheep', 'wheat', 'ore'],
    portRing: 'all',
  },
  sfGold: {
    id: 'sfGold',
    name: 'Seefahrer: Goldrausch (3–4)',
    rows: [6, 5, 4, 4, 4, 5, 6],
    masks: ['XX..XX', '.....', 'XXXX', 'XXX.', 'XXX.', '.....', 'XX..XX'],
    resourceCounts: { wood: 3, sheep: 3, wheat: 3, brick: 3, ore: 2, gold: 4, desert: 0 },
    chipCounts: { 2: 1, 3: 2, 4: 2, 5: 2, 6: 2, 8: 2, 9: 2, 10: 2, 11: 2, 12: 1 },
    portCount: 6,
    portKinds: ['generic', 'generic', 'wood', 'brick', 'sheep', 'ore'],
    portRing: 'all',
  },
  sf56: {
    id: 'sf56',
    name: 'Seefahrer: Inselwelt (5–6)',
    rows: [6, 7, 7, 7, 11, 11],
    masks: ['XXXXXX', 'XXXXXXX', 'XXXXXXX', '.......', 'XX.XX.XX.XX', 'X.....X....'],
    resourceCounts: { wood: 6, sheep: 5, wheat: 6, brick: 5, ore: 4, gold: 3, desert: 1 },
    chipCounts: { 2: 2, 3: 3, 4: 3, 5: 4, 6: 3, 8: 3, 9: 3, 10: 3, 11: 3, 12: 2 },
    portCount: 11,
    portKinds: ['generic', 'generic', 'generic', 'generic', 'generic', 'wood', 'brick', 'sheep', 'sheep', 'wheat', 'ore'],
  },
  sfFour56: {
    id: 'sfFour56',
    name: 'Seefahrer: Vier Inseln (5–6)',
    rows: [9, 9, 9, 9, 9],
    masks: ['XXXX.XXXX', 'XXX...XXX', '.........', 'XXXX.XXXX', 'XXX...XXX'],
    resourceCounts: { wood: 6, sheep: 6, wheat: 5, brick: 5, ore: 5, gold: 0, desert: 1 },
    chipCounts: { 2: 2, 3: 3, 4: 3, 5: 3, 6: 3, 8: 3, 9: 3, 10: 3, 11: 2, 12: 2 },
    portCount: 10,
    portKinds: ['generic', 'generic', 'generic', 'generic', 'generic', 'wood', 'brick', 'sheep', 'wheat', 'ore'],
    portRing: 'all',
  },
  sfCross34: {
    id: 'sfCross34',
    name: 'Seefahrer: Die große Überfahrt (3–4)',
    rows: [9, 9, 9, 8],
    masks: ['XXX.X.XXX', 'XXX.X.XXX', 'XXX.X.XXX', 'X.......'],
    resourceCounts: { wood: 4, sheep: 4, wheat: 4, brick: 3, ore: 3, gold: 3, desert: 1 },
    chipCounts: { 2: 1, 3: 2, 4: 3, 5: 3, 6: 2, 8: 2, 9: 2, 10: 3, 11: 2, 12: 1 },
    portCount: 8,
    portKinds: ['generic', 'generic', 'generic', 'wood', 'brick', 'sheep', 'wheat', 'ore'],
    portRing: 'all',
  },
  sfCross56: {
    id: 'sfCross56',
    name: 'Seefahrer: Die große Überfahrt (5–6)',
    rows: [9, 9, 9, 9, 8],
    masks: ['XXX.X.XXX', 'XXX.X.XXX', 'XXX.X.XXX', 'XXX.X.XXX', 'X......X'],
    resourceCounts: { wood: 6, sheep: 5, wheat: 6, brick: 5, ore: 4, gold: 3, desert: 1 },
    chipCounts: { 2: 2, 3: 3, 4: 3, 5: 4, 6: 3, 8: 3, 9: 3, 10: 3, 11: 3, 12: 2 },
    portCount: 10,
    portKinds: ['generic', 'generic', 'generic', 'generic', 'generic', 'wood', 'brick', 'sheep', 'wheat', 'ore'],
    portRing: 'all',
  },
};

/** Klassische, gleichmäßig verteilte Hafenpositionen im Küstenring. */
export function classicPortOffsets(ringLength: number, portCount: number): number[] {
  return Array.from({ length: portCount }, (_, i) => Math.round((i * ringLength) / portCount) % ringLength);
}

export interface FrameRuntime {
  def: FrameDef;
  coords: Axial[];
  /** Hex-Nachbar-Indizes innerhalb des Frames. */
  adjIdx: number[][];
  topo: Topology;
  /** Meeres-Hexes innerhalb des Rahmens (Seefahrer); leer bei Basis-Frames. */
  seaCoords: Axial[];
  /** Küstenring der Hauptinsel (Hafen-Spots). */
  coastRing: EdgeInfo[];
  /** Alle Küstenringe, längster zuerst (Hauptinsel + kleine Inseln). */
  coastRings: EdgeInfo[][];
  /** Hafen-Kanten: Hauptinsel-Ring oder (portRing 'all') alle Ringe konkateniert. */
  portCoast: EdgeInfo[];
  /** Hex-Indizes je Insel (Zusammenhangskomponenten), größte zuerst. */
  components: number[][];
  /** Hex-Indizes, sortiert nach Distanz zum Flächenschwerpunkt (für „Wüste mittig"). */
  centralIdx: number[];
  centroid: { x: number; y: number };
  landCount: number;
  totalPips: number;
}

const cache = new Map<FrameId, FrameRuntime>();

export function getFrame(id: FrameId): FrameRuntime {
  const hit = cache.get(id);
  if (hit) return hit;
  const def = FRAME_DEFS[id];
  const { land: coords, sea: seaCoords } = rowsToCoordsMasked(def.rows, def.masks);
  const keyToIdx = new Map(coords.map((c, i) => [axialKey(c), i]));
  const adjIdx = coords.map((c) =>
    neighbors(c)
      .map((n) => keyToIdx.get(axialKey(n)))
      .filter((i): i is number => i !== undefined),
  );
  const topo = buildTopology(coords);
  const coastRings = buildCoastRings(topo);
  const coastRing = coastRings[0] ?? [];
  const portCoast = def.portRing === 'all' ? coastRings.flat() : coastRing;

  // Zusammenhangskomponenten (Inseln) über die Hex-Adjazenz, größte zuerst.
  const seenComp = new Set<number>();
  const components: number[][] = [];
  for (let i = 0; i < coords.length; i++) {
    if (seenComp.has(i)) continue;
    const comp: number[] = [];
    const stack = [i];
    seenComp.add(i);
    while (stack.length) {
      const cur = stack.pop()!;
      comp.push(cur);
      for (const j of adjIdx[cur]) {
        if (!seenComp.has(j)) { seenComp.add(j); stack.push(j); }
      }
    }
    components.push(comp.sort((a, b) => a - b));
  }
  components.sort((a, b) => b.length - a.length);
  const centers = coords.map(hexCenter);
  const centroid = {
    x: centers.reduce((s, p) => s + p.x, 0) / centers.length,
    y: centers.reduce((s, p) => s + p.y, 0) / centers.length,
  };
  const centralIdx = coords
    .map((_, i) => i)
    .sort((a, b) => {
      const da = (centers[a].x - centroid.x) ** 2 + (centers[a].y - centroid.y) ** 2;
      const db = (centers[b].x - centroid.x) ** 2 + (centers[b].y - centroid.y) ** 2;
      return da - db || a - b;
    });
  const landCount = coords.length - def.resourceCounts.desert;
  const totalPips = Object.entries(def.chipCounts).reduce(
    (s, [n, c]) => s + PIPS[Number(n)] * c,
    0,
  );
  const rt: FrameRuntime = {
    def, coords, adjIdx, topo, seaCoords, coastRing, coastRings, portCoast, components, centralIdx, centroid, landCount, totalPips,
  };
  cache.set(id, rt);
  return rt;
}

/** Multiset → flache Liste. */
export function expandCounts<K extends string | number>(counts: Record<K, number>): K[] {
  const out: K[] = [];
  for (const [k, c] of Object.entries(counts) as [string, number][]) {
    for (let i = 0; i < c; i++) out.push((isNaN(Number(k)) ? k : Number(k)) as K);
  }
  return out;
}
