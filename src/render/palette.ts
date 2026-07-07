import { Resource } from '../model/types';

export type ThemeId = 'light' | 'dark' | 'cb';

/**
 * Board-Farben liegen bewusst als TS-Objekte vor (nicht als CSS-Variablen),
 * damit exportierte SVG/PNG-Dateien ohne Stylesheet korrekt aussehen.
 */
export interface BoardPalette {
  water: string;
  waterDeep: string;
  frame: string;
  hexStroke: string;
  chip: string;
  chipText: string;
  chipRed: string;
  pip: string;
  pier: string;
  portBadge: string;
  portText: string;
  robber: string;
  spotRing: string;
  spotText: string;
  heatLow: string;
  heatHigh: string;
  resources: Record<Resource, string>;
}

export const PALETTES: Record<ThemeId, BoardPalette> = {
  light: {
    water: '#89b3c2',
    waterDeep: '#6d9dae',
    frame: '#3c6272',
    hexStroke: '#f2ecd9',
    chip: '#f6efdc',
    chipText: '#33302a',
    chipRed: '#bb3524',
    pip: '#5b564c',
    pier: '#7a5b3a',
    portBadge: '#f6efdc',
    portText: '#33302a',
    robber: '#3a3632',
    spotRing: '#e0a92e',
    spotText: '#3a3200',
    heatLow: '#c8433a',
    heatHigh: '#2f8f4e',
    resources: {
      wood: '#3f7d46',
      sheep: '#a8c76a',
      wheat: '#e3b64f',
      gold: '#f2d268',
      brick: '#c26744',
      ore: '#8b8f9c',
      desert: '#e5d6a4',
    },
  },
  dark: {
    water: '#233746',
    waterDeep: '#1a2a36',
    frame: '#0f1c26',
    hexStroke: '#101820',
    chip: '#ede4cd',
    chipText: '#2b2822',
    chipRed: '#d6402c',
    pip: '#565046',
    pier: '#a9855c',
    portBadge: '#ede4cd',
    portText: '#2b2822',
    robber: '#0c0c0e',
    spotRing: '#f0b93a',
    spotText: '#3a3200',
    heatLow: '#e05a4e',
    heatHigh: '#4dbf74',
    resources: {
      wood: '#2f6b3d',
      sheep: '#8fb35a',
      wheat: '#d0a53f',
      gold: '#e8c552',
      brick: '#b05a3a',
      ore: '#767c8c',
      desert: '#cbb987',
    },
  },
  // Okabe-Ito-Palette; Unterscheidung zusätzlich über Icons, nicht nur Farbe.
  cb: {
    water: '#a9c6d9',
    waterDeep: '#8fb3c9',
    frame: '#42667e',
    hexStroke: '#ffffff',
    chip: '#ffffff',
    chipText: '#1c1c1c',
    chipRed: '#d55e00',
    pip: '#444444',
    pier: '#6b5138',
    portBadge: '#ffffff',
    portText: '#1c1c1c',
    robber: '#2b2b2b',
    spotRing: '#000000',
    spotText: '#000000',
    heatLow: '#0072b2',
    heatHigh: '#e69f00',
    resources: {
      wood: '#009e73',
      sheep: '#f0e442',
      wheat: '#e69f00',
      gold: '#ffd92f',
      brick: '#cc79a7',
      ore: '#56b4e9',
      desert: '#dddddd',
    },
  },
};

export function lerpColor(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const mix = pa.map((x, i) => Math.round(x + (pb[i] - x) * t));
  return `#${mix.map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}
