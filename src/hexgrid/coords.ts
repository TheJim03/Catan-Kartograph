/**
 * Axiale Koordinaten für pointy-top-Hexes (Red-Blob-Games-Konvention).
 * Alle Geometrie wird in Einheitsgröße (size = 1) gerechnet; der Renderer skaliert.
 */
export interface Axial {
  q: number;
  r: number;
}

export interface Point {
  x: number;
  y: number;
}

/** Die 6 Nachbarrichtungen (axial). */
export const DIRS: readonly Axial[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export const axialKey = (h: Axial): string => `${h.q},${h.r}`;

export const neighbors = (h: Axial): Axial[] =>
  DIRS.map((d) => ({ q: h.q + d.q, r: h.r + d.r }));

/** Kubische s-Koordinate (q + r + s = 0). */
export const sCoord = (h: Axial): number => -h.q - h.r;

export const hexDistance = (a: Axial, b: Axial): number =>
  (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(sCoord(a) - sCoord(b))) / 2;

/** Mittelpunkt eines pointy-top-Hexes in Einheitsgröße. */
export const hexCenter = (h: Axial): Point => ({
  x: Math.sqrt(3) * (h.q + h.r / 2),
  y: 1.5 * h.r,
});

/**
 * Die 6 Ecken eines Hexes, beginnend mit der oberen Spitze, im Uhrzeigersinn
 * (Bildschirmkoordinaten, y nach unten).
 */
export const hexCorners = (h: Axial): Point[] => {
  const c = hexCenter(h);
  const out: Point[] = [];
  for (let k = 0; k < 6; k++) {
    const ang = (Math.PI / 180) * (60 * k - 90);
    out.push({ x: c.x + Math.cos(ang), y: c.y + Math.sin(ang) });
  }
  return out;
};

/**
 * Deterministischer Vertex-Key aus Pixelkoordinaten. Ecken benachbarter Hexes
 * unterscheiden sich nur um Float-Rauschen (~1e-13) und runden auf denselben Key.
 */
export const vkey = (p: Point): string =>
  `${Math.round(p.x * 1000)}|${Math.round(p.y * 1000)}`;

export const edgeKey = (a: string, b: string): string =>
  a < b ? `${a}~${b}` : `${b}~${a}`;
