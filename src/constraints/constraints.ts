import { FrameRuntime, expandCounts, isRed } from '../model/data';
import { Board, ConstraintSettings, Resource } from '../model/types';
import { Rng, shuffle } from '../generator/rng';

const STEP_CAP = 8000;

/** Verletzt `chip` an Position `idx` (bei partieller Belegung) eine aktive Regel? */
export function chipViolates(
  adjIdx: number[][],
  chips: (number | null)[],
  idx: number,
  chip: number,
  s: ConstraintSettings,
): boolean {
  for (const j of adjIdx[idx]) {
    const c = chips[j];
    if (c == null) continue;
    if (s.noAdjRed && isRed(chip) && isRed(c)) return true;
    if (s.no2and12Adjacent && ((chip === 2 && c === 12) || (chip === 12 && c === 2))) return true;
    if (s.noSameNumberAdjacent && c === chip) return true;
  }
  return false;
}

/** Gleiche-Ressource-Regel (Wüste ist ausgenommen). */
export function resourceViolates(
  adjIdx: number[][],
  resources: (Resource | null)[],
  idx: number,
  res: Resource,
  s: ConstraintSettings,
): boolean {
  if (!s.noSameResourceAdjacent || res === 'desert') return false;
  return adjIdx[idx].some((j) => resources[j] === res);
}

/**
 * Ressourcen platzieren. Wüste zuerst (mittig oder zufällig), dann Backtracking
 * über die restlichen Felder, falls die Adjazenzregel aktiv ist.
 */
export function placeResources(
  frame: FrameRuntime,
  s: ConstraintSettings,
  rnd: Rng,
): Resource[] | null {
  const n = frame.coords.length;
  const res: (Resource | null)[] = Array(n).fill(null);
  const desertCount = frame.def.resourceCounts.desert;

  let desertSpots: number[];
  if (frame.def.fixedDeserts?.length) {
    // Szenario mit festem Wüstenriegel (z. B. „Durch die Wüste").
    desertSpots = frame.def.fixedDeserts;
  } else if (s.desertCenter) {
    desertSpots = frame.centralIdx.slice(0, desertCount);
  } else {
    desertSpots = shuffle(frame.coords.map((_, i) => i), rnd).slice(0, desertCount);
  }
  for (const i of desertSpots) res[i] = 'desert';

  const counts: Partial<Record<Resource, number>> = { ...frame.def.resourceCounts };
  delete counts.desert;
  const free = shuffle(
    res.map((r, i) => (r === null ? i : -1)).filter((i) => i >= 0),
    rnd,
  );

  if (!s.noSameResourceAdjacent) {
    const pool = shuffle(expandCounts(counts as Record<Resource, number>), rnd);
    free.forEach((idx, i) => (res[idx] = pool[i]));
    return res as Resource[];
  }

  let steps = 0;
  const kinds = Object.keys(counts) as Resource[];
  const assign = (i: number): boolean => {
    if (i === free.length) return true;
    if (++steps > STEP_CAP) return false;
    const idx = free[i];
    for (const r of shuffle(kinds.filter((k) => (counts[k] ?? 0) > 0), rnd)) {
      if (resourceViolates(frame.adjIdx, res, idx, r, s)) continue;
      res[idx] = r;
      counts[r] = (counts[r] ?? 0) - 1;
      if (assign(i + 1)) return true;
      res[idx] = null;
      counts[r] = (counts[r] ?? 0) + 1;
    }
    return false;
  };
  return assign(0) ? (res as Resource[]) : null;
}

/**
 * Zahlenchips platzieren: schwierige Chips zuerst (6/8, dann 2/12), Backtracking
 * mit Schrittlimit. Reihenfolge der Positionen ist rng-gesteuert → Kandidatenvielfalt.
 */
export function placeChips(
  frame: FrameRuntime,
  resources: Resource[],
  s: ConstraintSettings,
  rnd: Rng,
): (number | null)[] | null {
  const n = frame.coords.length;
  const chips: (number | null)[] = Array(n).fill(null);
  const targets = resources
    .map((r, i) => (r === 'desert' ? -1 : i))
    .filter((i) => i >= 0);

  const pool = expandCounts(frame.def.chipCounts) as number[];
  const difficulty = (c: number) => (isRed(c) ? 0 : c === 2 || c === 12 ? 1 : 2);
  const shuffled = shuffle(pool, rnd);
  shuffled.sort((a, b) => difficulty(a) - difficulty(b));

  let steps = 0;
  const assign = (ci: number): boolean => {
    if (ci === shuffled.length) return true;
    if (++steps > STEP_CAP) return false;
    const chip = shuffled[ci];
    for (const idx of shuffle(targets.filter((t) => chips[t] === null), rnd)) {
      if (chipViolates(frame.adjIdx, chips, idx, chip, s)) continue;
      chips[idx] = chip;
      if (assign(ci + 1)) return true;
      chips[idx] = null;
    }
    return false;
  };
  return assign(0) ? chips : null;
}

/** Liste aller Regelverletzungen eines fertigen Boards (für Tests + Zufallsmodus). */
export function validateBoard(
  frame: FrameRuntime,
  board: Pick<Board, 'resources' | 'chips'>,
  s: ConstraintSettings,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  frame.adjIdx.forEach((nbrs, i) => {
    for (const j of nbrs) {
      const pair = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (seen.has(pair)) continue;
      seen.add(pair);
      const ci = board.chips[i];
      const cj = board.chips[j];
      if (ci != null && cj != null) {
        if (s.noAdjRed && isRed(ci) && isRed(cj)) out.push(`rot-rot ${pair} (${ci}/${cj})`);
        if (s.no2and12Adjacent && ((ci === 2 && cj === 12) || (ci === 12 && cj === 2)))
          out.push(`2-12 ${pair}`);
        if (s.noSameNumberAdjacent && ci === cj) out.push(`gleiche Zahl ${pair} (${ci})`);
      }
      const ri = board.resources[i];
      const rj = board.resources[j];
      if (s.noSameResourceAdjacent && ri === rj && ri !== 'desert')
        out.push(`gleiche Ressource ${pair} (${ri})`);
    }
  });
  return out;
}
