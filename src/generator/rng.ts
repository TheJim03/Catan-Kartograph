/** xmur3-Stringhash → 32-bit-Seed. Rein ganzzahlig, plattformdeterministisch. */
export function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

/** mulberry32-PRNG: schnell, deterministisch, gut genug für Layout-Sampling. */
export function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = () => number;

export const rngFrom = (seed: string): Rng => mulberry32(xmur3(seed)());

/** Fisher-Yates auf einer Kopie. */
export function shuffle<T>(arr: readonly T[], rnd: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pick<T>(arr: readonly T[], rnd: Rng): T {
  return arr[Math.floor(rnd() * arr.length)];
}

/** Neuer Zufallsseed für die UI (bewusst nicht deterministisch). */
export const randomSeed = (): string =>
  Math.random().toString(36).slice(2, 8).toUpperCase();
