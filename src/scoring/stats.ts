import { FrameRuntime, PIPS } from '../model/data';
import { Board, Resource } from '../model/types';

/**
 * Ressourcen-Statistik: Community-Wunsch Nr. 2 — auf einen Blick sehen, wie
 * stark jede Ressource produziert. Grundlage ist die erwartete Produktion
 * pro 36 Würfen: Ein Feld mit n Pips wird in 36 Würfen erwartungsgemäß
 * n-mal ausgeschüttet.
 */
export interface ResourceStat {
  resource: Resource;
  hexes: number;
  pips: number;
  /** Anteil an den Gesamt-Pips des Boards (0–1). */
  share: number;
  /** Fairer Anteil gemessen an der Felderzahl (0–1). */
  fairShare: number;
  numbers: number[];
}

export function computeResourceStats(frame: FrameRuntime, board: Board): ResourceStat[] {
  const kinds = (Object.keys(frame.def.resourceCounts) as Resource[])
    .filter((r) => r !== 'desert' && frame.def.resourceCounts[r] > 0);
  const totalPips = frame.totalPips;
  const landHexes = frame.landCount;

  return kinds.map((resource) => {
    let pips = 0;
    let hexes = 0;
    const numbers: number[] = [];
    board.resources.forEach((r, i) => {
      if (r !== resource) return;
      hexes++;
      const chip = board.chips[i];
      if (chip != null) {
        pips += PIPS[chip];
        numbers.push(chip);
      }
    });
    numbers.sort((a, b) => a - b);
    return {
      resource,
      hexes,
      pips,
      share: totalPips > 0 ? pips / totalPips : 0,
      fairShare: landHexes > 0 ? hexes / landHexes : 0,
      numbers,
    };
  });
}
