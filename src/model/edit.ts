import { Board } from './types';

/**
 * Editor-Operationen: Community-Wunsch Nr. 1 bei Map-Generatoren ist das
 * Nachjustieren einzelner Felder. Alle Operationen sind pur und erhalten die
 * Multisets von Ressourcen und Chips — ein editiertes Board bleibt dadurch
 * immer ein regelkonform bestücktes Board (nur die *Anordnung* ändert sich;
 * ob Constraints wie „6/8 getrennt" noch gelten, meldet validateBoard).
 */

/** Tauscht zwei komplette Felder (Ressource + Chip wandern gemeinsam). */
export function swapTiles(board: Board, i: number, j: number): Board | null {
  if (i === j) return null;
  if (i < 0 || j < 0 || i >= board.resources.length || j >= board.resources.length) return null;
  const resources = [...board.resources];
  const chips = [...board.chips];
  [resources[i], resources[j]] = [resources[j], resources[i]];
  [chips[i], chips[j]] = [chips[j], chips[i]];
  return { ...board, resources, chips };
}

/** Tauscht nur die Zahlenchips zweier Felder. Wüsten (ohne Chip) sind tabu. */
export function swapChips(board: Board, i: number, j: number): Board | null {
  if (i === j) return null;
  if (i < 0 || j < 0 || i >= board.resources.length || j >= board.resources.length) return null;
  if (board.resources[i] === 'desert' || board.resources[j] === 'desert') return null;
  const chips = [...board.chips];
  [chips[i], chips[j]] = [chips[j], chips[i]];
  return { ...board, chips };
}
