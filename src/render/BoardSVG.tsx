import { forwardRef, useMemo } from 'react';
import { Axial, axialKey, hexCenter, hexCorners, neighbors } from '../hexgrid/coords';
import { FrameRuntime, PIPS, RESOURCE_ICON, RESOURCE_LABEL, isRed } from '../model/data';
import { Board, ScoreResult } from '../model/types';
import { BoardPalette, lerpColor } from './palette';

const S = 52; // Pixel je Hex-Einheitsradius

export interface Overlays {
  topSpots: boolean;
  heatmap: boolean;
}

interface Props {
  frame: FrameRuntime;
  board: Board;
  score: ScoreResult | null;
  palette: BoardPalette;
  overlays: Overlays;
  /** Nebel-Szenario: Hex-Indizes, die aktuell verdeckt sind. */
  hiddenHexes?: Set<number>;
  onRevealHex?: (hexIndex: number) => void;
  /** Editor: Klick-Handler + aktuell ausgewähltes Hex. */
  onHexClick?: (hexIndex: number) => void;
  selectedHex?: number | null;
}

const px = (v: number) => v * S;

function polygonPoints(h: Axial): string {
  return hexCorners(h)
    .map((p) => `${px(p.x).toFixed(1)},${px(p.y).toFixed(1)}`)
    .join(' ');
}

/** Wasserring: alle Nachbarn von Land- und Binnenmeer-Hexes außerhalb des Rahmens. */
function waterRing(frame: FrameRuntime): Axial[] {
  const inside = new Set([...frame.coords, ...frame.seaCoords].map(axialKey));
  const seen = new Map<string, Axial>();
  for (const c of [...frame.coords, ...frame.seaCoords]) {
    for (const n of neighbors(c)) {
      const k = axialKey(n);
      if (!inside.has(k) && !seen.has(k)) seen.set(k, n);
    }
  }
  return [...seen.values()];
}

export const BoardSVG = forwardRef<SVGSVGElement, Props>(function BoardSVG(
  { frame, board, score, palette, overlays, hiddenHexes, onRevealHex, onHexClick, selectedHex },
  ref,
) {
  const water = useMemo(() => waterRing(frame), [frame]);

  const bounds = useMemo(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const h of [...frame.coords, ...frame.seaCoords, ...water]) {
      for (const p of hexCorners(h)) {
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
      }
    }
    const pad = 0.35;
    return {
      x: px(minX - pad), y: px(minY - pad),
      w: px(maxX - minX + 2 * pad), h: px(maxY - minY + 2 * pad),
    };
  }, [frame, water]);

  const ports = useMemo(() => {
    return board.ports.map((port) => {
      const edge = frame.portCoast[port.ringIndex];
      const v1 = frame.topo.vertices.get(edge.v1)!;
      const v2 = frame.topo.vertices.get(edge.v2)!;
      const mid = { x: (v1.x + v2.x) / 2, y: (v1.y + v2.y) / 2 };
      const hc = hexCenter(frame.coords[edge.hexes[0]]);
      const len = Math.hypot(mid.x - hc.x, mid.y - hc.y) || 1;
      const out = { x: (mid.x - hc.x) / len, y: (mid.y - hc.y) / len };
      const badge = { x: mid.x + out.x * 0.82, y: mid.y + out.y * 0.82 };
      return { port, v1, v2, badge };
    });
  }, [board.ports, frame]);

  const maxPips = 12;
  let desertsSeen = 0;

  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`}
      role="img"
      aria-label="Generiertes Catan-Spielbrett"
      style={{ width: '100%', height: 'auto', display: 'block' }}
    >
      <rect x={bounds.x} y={bounds.y} width={bounds.w} height={bounds.h} rx={14} fill={palette.waterDeep} />

      {/* Wasserrahmen + Binnenmeer (Seefahrer) */}
      {[...water, ...frame.seaCoords].map((h) => (
        <polygon key={axialKey(h)} points={polygonPoints(h)} fill={palette.water} stroke={palette.waterDeep} strokeWidth={2} />
      ))}

      {/* Hafen-Stege unter den Landhexes */}
      {ports.map(({ port, v1, v2, badge }) => (
        <g key={`pier-${port.ringIndex}`} stroke={palette.pier} strokeWidth={5} strokeLinecap="round">
          <line x1={px(badge.x)} y1={px(badge.y)} x2={px(v1.x)} y2={px(v1.y)} />
          <line x1={px(badge.x)} y1={px(badge.y)} x2={px(v2.x)} y2={px(v2.y)} />
        </g>
      ))}

      {/* Landhexes */}
      {frame.coords.map((h, i) => {
        const res = board.resources[i];
        const chip = board.chips[i];
        const c = hexCenter(h);
        const isDesert = res === 'desert';
        const showRobber = isDesert && desertsSeen++ === 0;
        if (hiddenHexes?.has(i)) {
          return (
            <g
              key={axialKey(h)}
              onClick={() => onRevealHex?.(i)}
              style={{ cursor: onRevealHex ? 'pointer' : 'default' }}
            >
              <polygon
                points={polygonPoints(h)}
                fill={palette.water}
                stroke={palette.hexStroke}
                strokeWidth={3}
                strokeDasharray="7 5"
                strokeLinejoin="round"
              >
                <title>Nebelfeld — klicken zum Aufdecken</title>
              </polygon>
              <text
                x={px(c.x)} y={px(c.y)}
                textAnchor="middle" dominantBaseline="central"
                fontSize={S * 0.5} fontWeight={800}
                fill={palette.hexStroke} opacity={0.9}
                style={{ pointerEvents: 'none' }}
              >
                ?
              </text>
            </g>
          );
        }
        const isSelected = selectedHex === i;
        return (
          <g
            key={axialKey(h)}
            onClick={onHexClick ? () => onHexClick(i) : undefined}
            style={{ cursor: onHexClick ? 'pointer' : 'default' }}
          >
            <polygon
              points={polygonPoints(h)}
              fill={palette.resources[res]}
              stroke={isSelected ? palette.spotRing : palette.hexStroke}
              strokeWidth={isSelected ? 5 : 3}
              strokeLinejoin="round"
            >
              <title>{`${RESOURCE_LABEL[res]}${chip != null ? ` · ${chip} (${PIPS[chip]} Pips)` : ''}`}</title>
            </polygon>
            <text x={px(c.x)} y={px(c.y) - S * 0.5} textAnchor="middle" fontSize={S * 0.42} style={{ pointerEvents: 'none' }}>
              {RESOURCE_ICON[res]}
            </text>
            {chip != null && (
              <g style={{ pointerEvents: 'none' }}>
                <circle cx={px(c.x)} cy={px(c.y) + S * 0.14} r={S * 0.34} fill={palette.chip} stroke="rgba(0,0,0,0.25)" strokeWidth={1.5} />
                <text
                  x={px(c.x)} y={px(c.y) + S * 0.14}
                  textAnchor="middle" dominantBaseline="central"
                  fontSize={S * (isRed(chip) ? 0.36 : 0.3)}
                  fontWeight={700}
                  fontFamily="Iowan Old Style, Palatino, Georgia, serif"
                  fill={isRed(chip) ? palette.chipRed : palette.chipText}
                >
                  {chip}
                </text>
                <g fill={isRed(chip) ? palette.chipRed : palette.pip}>
                  {Array.from({ length: PIPS[chip] }, (_, d) => (
                    <circle
                      key={d}
                      cx={px(c.x) + (d - (PIPS[chip] - 1) / 2) * S * 0.085}
                      cy={px(c.y) + S * 0.36}
                      r={S * 0.028}
                    />
                  ))}
                </g>
              </g>
            )}
            {showRobber && (
              <g style={{ pointerEvents: 'none' }} fill={palette.robber} opacity={0.9}>
                <ellipse cx={px(c.x)} cy={px(c.y) + S * 0.28} rx={S * 0.16} ry={S * 0.07} />
                <path
                  d={`M ${px(c.x) - S * 0.11} ${px(c.y) + S * 0.28}
                      C ${px(c.x) - S * 0.11} ${px(c.y)} ${px(c.x) + S * 0.11} ${px(c.y)} ${px(c.x) + S * 0.11} ${px(c.y) + S * 0.28} Z`}
                />
                <circle cx={px(c.x)} cy={px(c.y) - S * 0.03} r={S * 0.09} />
              </g>
            )}
          </g>
        );
      })}

      {/* Hafen-Badges */}
      {ports.map(({ port, badge }) => (
        <g key={`badge-${port.ringIndex}`}>
          <circle cx={px(badge.x)} cy={px(badge.y)} r={S * 0.3} fill={palette.portBadge} stroke={palette.pier} strokeWidth={2}>
            <title>
              {port.kind === 'generic' ? 'Hafen 3:1 (beliebige Ressource)' : `Hafen 2:1 ${RESOURCE_LABEL[port.kind]}`}
            </title>
          </circle>
          {port.kind === 'generic' ? (
            <text x={px(badge.x)} y={px(badge.y)} textAnchor="middle" dominantBaseline="central" fontSize={S * 0.2} fontWeight={700} fill={palette.portText} style={{ pointerEvents: 'none' }}>
              3:1
            </text>
          ) : (
            <g style={{ pointerEvents: 'none' }}>
              <text x={px(badge.x)} y={px(badge.y) - S * 0.07} textAnchor="middle" dominantBaseline="central" fontSize={S * 0.2}>
                {RESOURCE_ICON[port.kind]}
              </text>
              <text x={px(badge.x)} y={px(badge.y) + S * 0.13} textAnchor="middle" dominantBaseline="central" fontSize={S * 0.15} fontWeight={700} fill={palette.portText}>
                2:1
              </text>
            </g>
          )}
        </g>
      ))}

      {/* Overlay: Pip-Heatmap über alle Vertices */}
      {overlays.heatmap && score && (
        <g>
          {[...frame.topo.vertices.values()].map((v) => {
            if (hiddenHexes && v.hexes.some((hi) => hiddenHexes.has(hi))) return null;
            const t = Math.min(1, score.vertexPips[v.key] / maxPips);
            return (
              <circle
                key={v.key}
                cx={px(v.x)} cy={px(v.y)} r={S * 0.13}
                fill={lerpColor(palette.heatLow, palette.heatHigh, t)}
                stroke="rgba(0,0,0,0.35)" strokeWidth={1}
              >
                <title>{`${score.vertexPips[v.key]} Pips · ${score.vertexDiversity[v.key]} Ressourcen`}</title>
              </circle>
            );
          })}
        </g>
      )}

      {/* Overlay: Top-Startplätze */}
      {overlays.topSpots && score && (
        <g>
          {score.topSpots.map((key, rank) => {
            const v = frame.topo.vertices.get(key)!;
            if (hiddenHexes && v.hexes.some((hi) => hiddenHexes.has(hi))) return null;
            return (
              <g key={key}>
                <circle cx={px(v.x)} cy={px(v.y)} r={S * 0.21} fill={palette.spotRing} stroke="rgba(0,0,0,0.45)" strokeWidth={2}>
                  <title>{`Top-Startplatz #${rank + 1}: ${score.vertexPips[key]} Pips, ${score.vertexDiversity[key]} Ressourcen`}</title>
                </circle>
                <text x={px(v.x)} y={px(v.y)} textAnchor="middle" dominantBaseline="central" fontSize={S * 0.22} fontWeight={800} fill={palette.spotText} style={{ pointerEvents: 'none' }}>
                  {rank + 1}
                </text>
              </g>
            );
          })}
        </g>
      )}
    </svg>
  );
});
