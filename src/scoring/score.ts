import { verticesWithin } from '../hexgrid/topology';
import { FrameRuntime, PIPS, isRed } from '../model/data';
import { sCoord } from '../hexgrid/coords';
import {
  Board, FACTOR_KEYS, FactorKey, Resource, ScoreResult, TradeResource,
} from '../model/types';


/** Alle im Frame vorkommenden Ertrags-Ressourcen (inkl. Gold, ohne Wüste). */
function yieldKinds(frame: FrameRuntime): Resource[] {
  return (Object.keys(frame.def.resourceCounts) as Resource[])
    .filter((r) => r !== 'desert' && frame.def.resourceCounts[r] > 0);
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export interface VertexStats {
  pips: Record<string, number>;
  diversity: Record<string, number>;
  portAt: Record<string, true>;
}

/** Produktionsstärke (Pip-Summe) und Ressourcenvielfalt je Vertex. */
export function computeVertexStats(frame: FrameRuntime, board: Board): VertexStats {
  const pips: Record<string, number> = {};
  const diversity: Record<string, number> = {};
  const portAt: Record<string, true> = {};
  for (const v of frame.topo.vertices.values()) {
    let p = 0;
    const kinds = new Set<string>();
    for (const hi of v.hexes) {
      const chip = board.chips[hi];
      const res = board.resources[hi];
      if (chip != null && res !== 'desert') {
        p += PIPS[chip];
        kinds.add(res);
      }
    }
    pips[v.key] = p;
    diversity[v.key] = kinds.size;
  }
  for (const port of board.ports) {
    const edge = frame.portCoast[port.ringIndex];
    if (edge) {
      portAt[edge.v1] = true;
      portAt[edge.v2] = true;
    }
  }
  return { pips, diversity, portAt };
}

/** Wert eines Start-Vertex: Produktion + Vielfalt + kleiner Hafenbonus. */
export const spotValue = (key: string, st: VertexStats): number =>
  st.pips[key] + 0.7 * Math.max(0, st.diversity[key] - 1) + (st.portAt[key] ? 0.7 : 0);

/**
 * Faktor 1 — Zahlen-Nachbarschaft: zählt rote Paare (doppelt gewichtet),
 * 2/12-Paare und Zahlendubletten auf gemeinsamen Kanten. Mit aktiven harten
 * Constraints per Konstruktion 1; relevant für Zufalls-/Chaos-Modus.
 */
function fNumbers(frame: FrameRuntime, board: Board): number {
  let v = 0;
  const seen = new Set<string>();
  frame.adjIdx.forEach((nbrs, i) => {
    for (const j of nbrs) {
      const pair = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (seen.has(pair)) continue;
      seen.add(pair);
      const a = board.chips[i];
      const b = board.chips[j];
      if (a == null || b == null) continue;
      if (isRed(a) && isRed(b)) v += 2;
      if ((a === 2 && b === 12) || (a === 12 && b === 2)) v += 1;
      if (a === b) v += 1;
    }
  });
  return clamp01(1 - v / 6);
}

/**
 * Faktor 2 — Ressourcen-Verteilung: Halbierungen entlang der drei Hex-Achsen
 * durchs Zentrum, quadrierte Zähl-Differenz je Ressource, plus Klump-Strafe
 * für gleiche Ressourcen auf gemeinsamen Kanten. exp-Kalibrierung → 0–1.
 */
function fSpread(frame: FrameRuntime, board: Board): number {
  const qs = frame.coords.map((c) => c.q);
  const rs = frame.coords.map((c) => c.r);
  const ss = frame.coords.map((c) => sCoord(c));
  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  const axes = [
    { vals: qs, m: mean(qs) },
    { vals: rs, m: mean(rs) },
    { vals: ss, m: mean(ss) },
  ];
  let dev = 0;
  for (const res of yieldKinds(frame)) {
    for (const ax of axes) {
      let a = 0;
      let b = 0;
      board.resources.forEach((r, i) => {
        if (r !== res) return;
        const c = ax.vals[i] - ax.m;
        if (c > 0.01) a++;
        else if (c < -0.01) b++;
      });
      dev += (a - b) ** 2;
    }
  }
  let clumps = 0;
  const seen = new Set<string>();
  frame.adjIdx.forEach((nbrs, i) => {
    for (const j of nbrs) {
      const pair = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (seen.has(pair)) continue;
      seen.add(pair);
      const a = board.resources[i];
      if (a !== 'desert' && a === board.resources[j]) clumps++;
    }
  });
  const scale = frame.coords.length / 19; // Kalibrierung wächst mit Boardgröße
  return clamp01(Math.exp(-(dev / (40 * scale) + clumps / (5 * scale))));
}

/**
 * Faktor 3 — Pip-Balance pro Ressource (der bei anderen Tools fehlende Faktor):
 * mittlere Pips je Hex und Ressourcentyp sollen nahe am globalen Schnitt liegen;
 * „verhungernde" Ressourcen (bester Chip ≤ 2 Pips) werden zusätzlich bestraft.
 */
function fPipBalance(frame: FrameRuntime, board: Board): number {
  const ideal = frame.totalPips / frame.landCount;
  let dev = 0;
  let starved = 0;
  for (const res of yieldKinds(frame)) {
    let pips = 0;
    let n = 0;
    let best = 0;
    board.resources.forEach((r, i) => {
      if (r !== res) return;
      n++;
      const chip = board.chips[i];
      if (chip != null) {
        pips += PIPS[chip];
        best = Math.max(best, PIPS[chip]);
      }
    });
    if (n === 0) continue;
    dev += n * (pips / n - ideal) ** 2;
    if (best <= 2) starved++;
  }
  const sigma = Math.sqrt(dev / frame.landCount);
  return clamp01(1 - sigma / 1.5 - 0.15 * starved);
}

/**
 * Faktor 4 — Produktions-Gleichverteilung: Vertices in 6 Winkelsektoren ums
 * Zentrum; verglichen wird die Summe der zwei stärksten Spots je Sektor
 * (Variationskoeffizient). Starke Spots dürfen sich nicht in einer Ecke ballen.
 */
function fEvenness(frame: FrameRuntime, st: VertexStats): number {
  const sums: number[][] = Array.from({ length: 6 }, () => []);
  for (const v of frame.topo.vertices.values()) {
    const ang = Math.atan2(v.y - frame.centroid.y, v.x - frame.centroid.x);
    const deg = ((ang * 180) / Math.PI + 360 + 15) % 360;
    sums[Math.floor(deg / 60) % 6].push(st.pips[v.key]);
  }
  const top2 = sums.map((arr) => {
    arr.sort((a, b) => b - a);
    return (arr[0] ?? 0) + (arr[1] ?? 0);
  });
  const m = top2.reduce((a, b) => a + b, 0) / 6;
  if (m <= 0) return 0;
  const sd = Math.sqrt(top2.reduce((s, x) => s + (x - m) ** 2, 0) / 6);
  return clamp01(1 - (sd / m) * 1.8);
}

/**
 * Faktor 5 — Hafen-Synergie: 2:1-Häfen brauchen erreichbare Pips der eigenen
 * Ressource (direkt angrenzend voll, bis Distanz 2 halb gewichtet). Tote Häfen
 * (Versorgung ~0) fallen hart durch, überversorgte werden leicht gedämpft.
 * 3:1-Häfen: gleichmäßige Streuung entlang des Küstenrings.
 */
function fPorts(frame: FrameRuntime, board: Board): number {
  if (board.ports.length === 0) return 1;
  const scores: number[] = [];
  for (const port of board.ports) {
    if (port.kind === 'generic') continue;
    const edge = frame.portCoast[port.ringIndex];
    const direct = new Set(
      [...frame.topo.vertices.get(edge.v1)!.hexes, ...frame.topo.vertices.get(edge.v2)!.hexes],
    );
    const near = verticesWithin(frame.topo, [edge.v1, edge.v2], 2);
    const nearHexes = new Set<number>();
    for (const vk of near) for (const hi of frame.topo.vertices.get(vk)!.hexes) nearHexes.add(hi);
    let supply = 0;
    for (const hi of nearHexes) {
      if (board.resources[hi] !== port.kind) continue;
      const chip = board.chips[hi];
      if (chip == null) continue;
      supply += direct.has(hi) ? PIPS[chip] : 0.5 * PIPS[chip];
    }
    scores.push(
      supply <= 0.01 ? 0.1
        : supply < 3 ? 0.3 + 0.5 * (supply / 3)
        : supply <= 8 ? 1
        : Math.max(0.4, 1 - (supply - 8) / 10),
    );
  }
  const generics = board.ports
    .filter((p) => p.kind === 'generic')
    .map((p) => p.ringIndex)
    .sort((a, b) => a - b);
  if (generics.length >= 2) {
    const L = frame.portCoast.length;
    const gaps = generics.map((g, i) => {
      const next = generics[(i + 1) % generics.length];
      return ((next - g) % L + L) % L;
    });
    const m = L / generics.length;
    const sd = Math.sqrt(gaps.reduce((s, g) => s + (g - m) ** 2, 0) / gaps.length);
    scores.push(clamp01(1 - sd / m));
  }
  if (scores.length === 0) return 1;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

/** Greedy-Snake-Draft für n Spieler unter der Abstandsregel. */
export function snakeDraft(
  frame: FrameRuntime,
  st: VertexStats,
  players: number,
): number[] {
  const available = new Set(frame.topo.vertices.keys());
  const order = [
    ...Array.from({ length: players }, (_, i) => i),
    ...Array.from({ length: players }, (_, i) => players - 1 - i),
  ];
  const totals = Array(players).fill(0);
  const sorted = [...frame.topo.vertices.keys()].sort(
    (a, b) => spotValue(b, st) - spotValue(a, st) || (a < b ? -1 : 1),
  );
  for (const p of order) {
    const key = sorted.find((k) => available.has(k));
    if (!key) break;
    totals[p] += spotValue(key, st);
    available.delete(key);
    for (const n of frame.topo.vertices.get(key)!.adj) available.delete(n);
  }
  return totals;
}

/**
 * Faktor 6 — Start-Fairness: relative Spanne der Draft-Summen; simuliert
 * werden beide Spielerzahlen der gewählten Gruppe (3&4 bzw. 5&6). Mehr Spieler
 * heißt automatisch: weniger Puffer, strengere Bewertung.
 */
function fFairness(
  frame: FrameRuntime,
  st: VertexStats,
  playerCounts: number[],
): { score: number; draft: { players: number; totals: number[] }[] } {
  const draft = playerCounts.map((players) => ({ players, totals: snakeDraft(frame, st, players) }));
  const scores = draft.map(({ totals }) => {
    const max = Math.max(...totals);
    const min = Math.min(...totals);
    const mean = totals.reduce((a, b) => a + b, 0) / totals.length;
    if (mean <= 0) return 0;
    return clamp01(1 - (max - min) / mean / 0.4);
  });
  return { score: scores.reduce((a, b) => a + b, 0) / scores.length, draft };
}

/** Top-Startplätze für das Overlay (greedy mit Abstandsregel). */
export function topStartSpots(frame: FrameRuntime, st: VertexStats, n: number): string[] {
  const available = new Set(frame.topo.vertices.keys());
  const sorted = [...frame.topo.vertices.keys()].sort(
    (a, b) => spotValue(b, st) - spotValue(a, st) || (a < b ? -1 : 1),
  );
  const out: string[] = [];
  for (const key of sorted) {
    if (out.length >= n) break;
    if (!available.has(key)) continue;
    out.push(key);
    available.delete(key);
    for (const a of frame.topo.vertices.get(key)!.adj) available.delete(a);
  }
  return out;
}

export function scoreBoard(
  frame: FrameRuntime,
  board: Board,
  weights: Record<FactorKey, number>,
  playerCounts: number[],
): ScoreResult {
  const st = computeVertexStats(frame, board);
  const fair = fFairness(frame, st, playerCounts);
  const factors: Record<FactorKey, number> = {
    numbers: fNumbers(frame, board),
    spread: fSpread(frame, board),
    pipBalance: fPipBalance(frame, board),
    evenness: fEvenness(frame, st),
    ports: fPorts(frame, board),
    fairness: fair.score,
  };
  let wsum = 0;
  let acc = 0;
  for (const k of FACTOR_KEYS) {
    const w = board.ports.length === 0 && k === 'ports' ? 0 : weights[k];
    wsum += w;
    acc += w * factors[k];
  }
  const total = wsum > 0 ? Math.round((acc / wsum) * 100) : 0;
  return {
    total,
    factors,
    vertexPips: st.pips,
    vertexDiversity: st.diversity,
    topSpots: topStartSpots(frame, st, 6),
    draft: fair.draft,
  };
}

export const FACTOR_LABEL: Record<FactorKey, string> = {
  numbers: 'Zahlen-Nachbarschaft',
  spread: 'Ressourcen-Verteilung',
  pipBalance: 'Pip-Balance je Ressource',
  evenness: 'Produktions-Gleichverteilung',
  ports: 'Hafen-Synergie',
  fairness: 'Start-Fairness',
};

export type { TradeResource };
