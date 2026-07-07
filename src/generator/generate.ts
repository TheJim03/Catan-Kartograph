import { placeChips, placeResources } from '../constraints/constraints';
import { classicPortOffsets, getFrame } from '../model/data';
import { SCENARIOS } from '../model/scenarios';
import {
  Board, FrameId, GenResult, GenSettings, Port, PortMode, ScoreResult, hasSeafarers,
} from '../model/types';
import { scoreBoard } from '../scoring/score';
import { Rng, rngFrom, shuffle } from './rng';

export const frameForGroup = (g: GenSettings['playerGroup']): FrameId =>
  g === '56' ? 'ext56' : 'base';

/**
 * Frame aus Settings: Seefahrer nutzt das Szenario-Frame der Spielergruppe.
 * Szenarien ohne 5-6-Variante fallen defensiv auf ihr 3-4-Frame zurück
 * (die UI verhindert diese Kombination, manipulierte Links nicht).
 */
export const frameFor = (s: Pick<GenSettings, 'playerGroup' | 'expansion' | 'scenario'>): FrameId => {
  if (!hasSeafarers(s.expansion)) return frameForGroup(s.playerGroup);
  const frames = SCENARIOS[s.scenario].frames;
  return frames[s.playerGroup] ?? frames['34'];
};

export const playerCountsForGroup = (g: GenSettings['playerGroup']): number[] =>
  g === '56' ? [5, 6] : [3, 4];

function placePorts(frameId: FrameId, mode: PortMode, rnd: Rng): Port[] {
  if (mode === 'off') return [];
  const frame = getFrame(frameId);
  const L = frame.portCoast.length;
  const P = frame.def.portCount;
  let offsets: number[];
  if (mode === 'classic') {
    offsets = classicPortOffsets(L, P);
  } else {
    // Zufällige Positionen mit Mindestabstand 2 (kein geteilter Vertex).
    const chosen: number[] = [];
    const circDist = (a: number, b: number) => {
      const d = Math.abs(a - b) % L;
      return Math.min(d, L - d);
    };
    for (const idx of shuffle(Array.from({ length: L }, (_, i) => i), rnd)) {
      if (chosen.every((c) => circDist(c, idx) >= 2)) chosen.push(idx);
      if (chosen.length === P) break;
    }
    offsets = chosen.length === P
      ? chosen.sort((a, b) => a - b)
      : classicPortOffsets(L, P).map((o) => (o + Math.floor(rnd() * L)) % L).sort((a, b) => a - b);
  }
  const kinds = shuffle(frame.def.portKinds, rnd);
  return offsets.map((ringIndex, i) => ({ ringIndex, kind: kinds[i] }));
}

/** Ein Kandidat: Ressourcen → Chips → Häfen. null, wenn Backtracking scheitert. */
export function generateCandidate(s: GenSettings, rnd: Rng, candidateIndex: number): Board | null {
  const frameId = frameFor(s);
  const frame = getFrame(frameId);
  const resources = placeResources(frame, s.constraints, rnd);
  if (!resources) return null;
  const chips = placeChips(frame, resources, s.constraints, rnd);
  if (!chips) return null;
  const ports = placePorts(frameId, s.ports, rnd);
  return { frameId, resources, chips, ports, seed: s.seed, candidateIndex };
}

/**
 * Generate-and-score: erzeugt K Kandidaten deterministisch aus
 * `seed#kandidatenindex`, bewertet alle und liefert den besten (bzw. den
 * schlechtesten im Chaos-Modus oder den ersten im Zufallsmodus).
 */
export function generateBest(
  s: GenSettings,
  onProgress?: (done: number, total: number) => void,
): GenResult | null {
  const t0 = Date.now();
  const frame = getFrame(frameFor(s));
  const playerCounts = playerCountsForGroup(s.playerGroup);
  const K = s.target === 'first' ? 1 : Math.max(1, s.candidates);

  let best: { board: Board; score: ScoreResult } | null = null;
  let tried = 0;
  let failed = 0;

  for (let k = 0; k < K; k++) {
    const rnd = rngFrom(`${s.seed}#${k}`);
    const board = generateCandidate(s, rnd, k);
    tried++;
    if (!board) {
      failed++;
      continue;
    }
    const score = scoreBoard(frame, board, s.weights, playerCounts);
    const better =
      best === null ||
      (s.target === 'worst' ? score.total < best.score.total : score.total > best.score.total);
    if (s.target === 'first' ? best === null : better) best = { board, score };
    if (onProgress && (k % 25 === 24 || k === K - 1)) onProgress(k + 1, K);
  }

  if (!best) return null;
  return { ...best, tried, failed, ms: Date.now() - t0 };
}

/** Bewertet ein bereits existierendes Board (z. B. aus einem Share-Link) neu. */
export function rescore(board: Board, s: GenSettings): ScoreResult {
  const frame = getFrame(board.frameId);
  return scoreBoard(frame, board, s.weights, playerCountsForGroup(s.playerGroup));
}
