import { getFrame, RESOURCE_ICON, RESOURCE_LABEL } from '../model/data';
import { Board } from '../model/types';
import { BoardPalette } from '../render/palette';
import { computeResourceStats } from '../scoring/stats';

interface Props {
  board: Board;
  palette: BoardPalette;
}

/**
 * Erwartete Produktion je Ressource pro 36 Würfen. Der Strich markiert den
 * „fairen" Anteil gemessen an der Felderzahl der Ressource — Balken deutlich
 * darunter heißt: diese Ressource ist auf diesem Board knapp.
 */
export function StatsPanel({ board, palette }: Props) {
  const frame = getFrame(board.frameId);
  const stats = computeResourceStats(frame, board);
  const maxPips = Math.max(1, ...stats.map((s) => s.pips));

  return (
    <div className="statspanel">
      <h3>Erwartete Produktion <span>je 36 Würfe</span></h3>
      {stats.map((s) => (
        <div key={s.resource} className="stat-row" title={`${RESOURCE_LABEL[s.resource]}: ${s.hexes} Felder, ${s.pips} Pips (${Math.round(s.share * 100)} % der Produktion, faire ${Math.round(s.fairShare * 100)} %)`}>
          <span className="stat-label">
            {RESOURCE_ICON[s.resource]} {RESOURCE_LABEL[s.resource]}
          </span>
          <div className="stat-bar">
            <div
              className="stat-fill"
              style={{ width: `${(s.pips / maxPips) * 100}%`, background: palette.resources[s.resource] }}
            />
            <div
              className="stat-fair"
              style={{ left: `${Math.min(100, (s.fairShare * frame.totalPips / maxPips) * 100)}%` }}
              title="Fairer Anteil gemessen an der Felderzahl"
            />
          </div>
          <span className="stat-val">
            {s.pips} <em>{s.numbers.join(' ')}</em>
          </span>
        </div>
      ))}
      <p className="hint">Strich = fairer Anteil nach Felderzahl. Balken weit darunter → Ressource ist knapp, weit darüber → im Überfluss.</p>
    </div>
  );
}
