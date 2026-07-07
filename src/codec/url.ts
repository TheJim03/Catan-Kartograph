import { getFrame } from '../model/data';
import {
  Board, DEFAULT_SETTINGS, FactorKey, FrameId, GenSettings, Port, PortKind, Resource,
} from '../model/types';

/**
 * Kompletter Board-State + Settings in der URL (base64url-kodiertes, kompaktes
 * JSON). Share-Links funktionieren dadurch offline/statisch und bleiben auch
 * gültig, wenn sich der Generator-Algorithmus später ändert.
 */

const RES_CHAR: Record<Resource, string> = {
  wood: 'w', sheep: 's', wheat: 'g', brick: 'b', ore: 'o', gold: 'u', desert: 'd',
};
const CHAR_RES = Object.fromEntries(
  Object.entries(RES_CHAR).map(([k, v]) => [v, k as Resource]),
) as Record<string, Resource>;

const PORT_CHAR: Record<PortKind, string> = {
  generic: 'x', wood: 'w', sheep: 's', wheat: 'g', brick: 'b', ore: 'o',
};
const CHAR_PORT = Object.fromEntries(
  Object.entries(PORT_CHAR).map(([k, v]) => [v, k as PortKind]),
) as Record<string, PortKind>;

interface Payload {
  v: 1;
  f: FrameId;
  r: string;               // Ressourcen, 1 Zeichen je Hex
  c: number[];             // Chips, 0 = Wüste
  p: [number, string][];   // Häfen: [ringIndex, kindChar]
  s: string;               // Seed
  k: number;               // Kandidatenindex
  set: {
    pg: GenSettings['playerGroup'];
    ex: GenSettings['expansion'];
    sc?: GenSettings['scenario'];
    con: number;           // Bitflags der 5 Constraints
    po: GenSettings['ports'];
    w: number[];           // Gewichte ×10
    ca: number;
    t: GenSettings['target'];
  };
}

const FACTOR_ORDER: FactorKey[] = ['numbers', 'spread', 'pipBalance', 'evenness', 'ports', 'fairness'];

const b64url = {
  encode(s: string): string {
    const bytes = new TextEncoder().encode(s);
    let bin = '';
    bytes.forEach((b) => (bin += String.fromCharCode(b)));
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  decode(s: string): string {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  },
};

export function encodeState(board: Board, settings: GenSettings): string {
  const con =
    (settings.constraints.noAdjRed ? 1 : 0) |
    (settings.constraints.no2and12Adjacent ? 2 : 0) |
    (settings.constraints.noSameNumberAdjacent ? 4 : 0) |
    (settings.constraints.noSameResourceAdjacent ? 8 : 0) |
    (settings.constraints.desertCenter ? 16 : 0);
  const payload: Payload = {
    v: 1,
    f: board.frameId,
    r: board.resources.map((r) => RES_CHAR[r]).join(''),
    c: board.chips.map((c) => c ?? 0),
    p: board.ports.map((p) => [p.ringIndex, PORT_CHAR[p.kind]]),
    s: board.seed,
    k: board.candidateIndex,
    set: {
      pg: settings.playerGroup,
      ex: settings.expansion,
      sc: settings.scenario,
      con,
      po: settings.ports,
      w: FACTOR_ORDER.map((k) => Math.round(settings.weights[k] * 10)),
      ca: settings.candidates,
      t: settings.target,
    },
  };
  return b64url.encode(JSON.stringify(payload));
}

export function decodeState(hash: string): { board: Board; settings: GenSettings } | null {
  try {
    const raw = hash.replace(/^#/, '').trim();
    if (!raw) return null;
    const payload = JSON.parse(b64url.decode(raw)) as Payload;
    if (payload.v !== 1) return null;
    const frame = getFrame(payload.f);
    if (payload.r.length !== frame.coords.length) return null;
    if (payload.c.length !== frame.coords.length) return null;
    if (payload.p.some(([ri]) => ri < 0 || ri >= frame.portCoast.length)) return null;
    if ([...payload.r].some((ch) => !(ch in CHAR_RES))) return null;
    const board: Board = {
      frameId: payload.f,
      resources: [...payload.r].map((ch) => CHAR_RES[ch]),
      chips: payload.c.map((c) => (c === 0 ? null : c)),
      ports: payload.p.map(([ringIndex, ch]): Port => ({ ringIndex, kind: CHAR_PORT[ch] })),
      seed: payload.s,
      candidateIndex: payload.k,
    };
    const weights = { ...DEFAULT_SETTINGS.weights };
    FACTOR_ORDER.forEach((k, i) => {
      if (payload.set.w[i] != null) weights[k] = payload.set.w[i] / 10;
    });
    const settings: GenSettings = {
      playerGroup: payload.set.pg,
      expansion: payload.set.ex,
      scenario: payload.set.sc ?? 'inselwelt',
      constraints: {
        noAdjRed: !!(payload.set.con & 1),
        no2and12Adjacent: !!(payload.set.con & 2),
        noSameNumberAdjacent: !!(payload.set.con & 4),
        noSameResourceAdjacent: !!(payload.set.con & 8),
        desertCenter: !!(payload.set.con & 16),
      },
      ports: payload.set.po,
      weights,
      candidates: payload.set.ca,
      target: payload.set.t,
      seed: payload.s,
    };
    return { board, settings };
  } catch {
    return null;
  }
}
