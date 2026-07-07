export type Resource = 'wood' | 'sheep' | 'wheat' | 'brick' | 'ore' | 'gold' | 'desert';
/** Handelbare Ressourcen mit 2:1-Häfen — Gold ist Joker und hat keinen Hafen. */
export type TradeResource = Exclude<Resource, 'desert' | 'gold'>;
export type PortKind = 'generic' | TradeResource;

export type FrameId =
  | 'base' | 'ext56'
  | 'sf34' | 'sf56'
  | 'sfFour' | 'sfFour56'
  | 'sfDesert' | 'sfFog' | 'sfArchipel' | 'sfGold'
  | 'sfCross34' | 'sfCross56';
export type PlayerGroup = '34' | '56';
export type Expansion = 'base' | 'ck' | 'seafarers' | 'ck+seafarers';
export const hasCK = (e: Expansion): boolean => e === 'ck' || e === 'ck+seafarers';
export const hasSeafarers = (e: Expansion): boolean => e === 'seafarers' || e === 'ck+seafarers';

export type ScenarioId = 'inselwelt' | 'vierinseln' | 'wueste' | 'nebel' | 'archipel' | 'goldrausch' | 'ueberfahrt';
export type PortMode = 'classic' | 'random' | 'off';
export type Target = 'best' | 'first' | 'worst';

export interface Port {
  /** Index in den Küstenring (Kante, an der der Hafen liegt). */
  ringIndex: number;
  kind: PortKind;
}

export interface Board {
  frameId: FrameId;
  /** Ressource je Hex, Reihenfolge = Frame-Koordinatenliste. */
  resources: Resource[];
  /** Zahlenchip je Hex, null auf Wüste. */
  chips: (number | null)[];
  ports: Port[];
  seed: string;
  candidateIndex: number;
}

export type FactorKey =
  | 'numbers'
  | 'spread'
  | 'pipBalance'
  | 'evenness'
  | 'ports'
  | 'fairness';

export const FACTOR_KEYS: FactorKey[] = [
  'numbers',
  'spread',
  'pipBalance',
  'evenness',
  'ports',
  'fairness',
];

export interface ConstraintSettings {
  /** Offizielle ausgewogene Variante: 6/8 teilen keine Kante. */
  noAdjRed: boolean;
  no2and12Adjacent: boolean;
  noSameNumberAdjacent: boolean;
  noSameResourceAdjacent: boolean;
  desertCenter: boolean;
}

export interface GenSettings {
  playerGroup: PlayerGroup;
  expansion: Expansion;
  /** Aktives Seefahrer-Szenario (wirkt nur, wenn Seefahrer aktiviert ist). */
  scenario: ScenarioId;
  constraints: ConstraintSettings;
  ports: PortMode;
  weights: Record<FactorKey, number>;
  candidates: number;
  target: Target;
  seed: string;
}

export interface ScoreResult {
  /** 0–100. */
  total: number;
  /** Je Faktor 0–1. */
  factors: Record<FactorKey, number>;
  vertexPips: Record<string, number>;
  vertexDiversity: Record<string, number>;
  /** Beste Startplätze (greedy, Abstandsregel), absteigend. */
  topSpots: string[];
  /** Draft-Summen je Spieler und simulierter Spielerzahl. */
  draft: { players: number; totals: number[] }[];
}

export interface GenResult {
  board: Board;
  score: ScoreResult;
  tried: number;
  failed: number;
  ms: number;
}

export const DEFAULT_WEIGHTS: Record<FactorKey, number> = {
  numbers: 1.0,
  spread: 1.0,
  pipBalance: 1.4,
  evenness: 1.0,
  ports: 0.8,
  fairness: 1.4,
};

export const DEFAULT_SETTINGS: GenSettings = {
  playerGroup: '34',
  expansion: 'base',
  scenario: 'inselwelt',
  constraints: {
    noAdjRed: true,
    no2and12Adjacent: false,
    noSameNumberAdjacent: false,
    noSameResourceAdjacent: false,
    desertCenter: false,
  },
  ports: 'classic',
  weights: { ...DEFAULT_WEIGHTS },
  candidates: 400,
  target: 'best',
  seed: 'CATAN',
};
