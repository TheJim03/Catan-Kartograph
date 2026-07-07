import { describe, expect, it } from 'vitest';
import { validateBoard } from '../src/constraints/constraints';
import { decodeState, encodeState } from '../src/codec/url';
import { generateBest, generateCandidate } from '../src/generator/generate';
import { rngFrom } from '../src/generator/rng';
import { FRAME_DEFS, getFrame } from '../src/model/data';
import { SCENARIOS, SCENARIO_LIST } from '../src/model/scenarios';
import { DEFAULT_SETTINGS, FrameId, GenSettings, ScenarioId } from '../src/model/types';

const EXPECTED_ISLANDS: Partial<Record<FrameId, number[]>> = {
  sf34: [14, 3, 3, 2],
  sf56: [20, 3, 3, 2, 2],
  sfFour: [5, 5, 5, 5],
  sfFour56: [7, 7, 7, 7],
  sfDesert: [21, 3],
  sfFog: [12, 3, 3, 3],
  sfArchipel: [3, 3, 3, 3, 3, 3],
  sfGold: [10, 2, 2, 2, 2],
  sfCross34: [10, 9, 3],
  sfCross56: [13, 13, 4],
};

/** Alle Szenario-Frames als [ScenarioId, FrameId]-Paare. */
const SCENARIO_FRAMES = SCENARIO_LIST.flatMap((sc) =>
  Object.values(sc.frames).map((f) => [sc.id, f] as const),
);

const sfSettings = (scenario: ScenarioId): GenSettings => ({
  ...DEFAULT_SETTINGS,
  expansion: 'seafarers',
  playerGroup: '34',
  scenario,
  constraints: { ...DEFAULT_SETTINGS.constraints, desertCenter: false },
  candidates: 25,
});

describe('Szenario-Registry', () => {
  it('jedes Szenario hat Namen, Tagline und mindestens 3 Sonderregeln', () => {
    for (const sc of SCENARIO_LIST) {
      expect(sc.name.length).toBeGreaterThan(2);
      expect(sc.tagline.length).toBeGreaterThan(10);
      expect(sc.rules.length).toBeGreaterThanOrEqual(3);
      expect(FRAME_DEFS[sc.frames['34']]).toBeDefined();
      if (sc.frames['56']) expect(FRAME_DEFS[sc.frames['56']]).toBeDefined();
    }
  });

  it.each(SCENARIO_FRAMES)('%s / %s: Frame-Daten sind konsistent', (_id, frameId) => {
    const def = FRAME_DEFS[frameId];
    const frame = getFrame(def.id);
    // Masken passen exakt auf die Reihenlängen (kein stilles Abschneiden)
    def.masks!.forEach((m, i) => expect(m.length).toBe(def.rows[i]));
    // Ressourcen decken alle Hexes, Chips decken alle Nicht-Wüsten
    const resSum = Object.values(def.resourceCounts).reduce((a, b) => a + b, 0);
    expect(resSum).toBe(frame.coords.length);
    const chipSum = Object.values(def.chipCounts).reduce((a, b) => a + b, 0);
    expect(chipSum).toBe(frame.coords.length - def.resourceCounts.desert);
    // Häfen passen in den Hafen-Küstenring
    expect(def.portKinds.length).toBe(def.portCount);
    expect(def.portCount).toBeLessThanOrEqual(frame.portCoast.length);
    // Inselstruktur wie designt
    expect(frame.components.map((c) => c.length)).toEqual(EXPECTED_ISLANDS[frameId]);
    // Feste Wüsten liegen im gültigen Bereich
    for (const d of def.fixedDeserts ?? []) {
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThan(frame.coords.length);
    }
  });

  it.each(SCENARIO_FRAMES)('%s / %s: Generierung läuft und validiert', (id, frameId) => {
    const s: GenSettings = {
      ...sfSettings(id),
      playerGroup: frameId === SCENARIOS[id].frames['56'] ? '56' : '34',
    };
    const frame = getFrame(frameId);
    const res = generateBest(s)!;
    expect(res.board.frameId).toBe(frameId);
    expect(validateBoard(frame, res.board, s.constraints)).toEqual([]);
    expect(res.score.total).toBeGreaterThan(0);
    expect(res.board.ports.length).toBe(frame.def.portCount);
    for (const p of res.board.ports) expect(p.ringIndex).toBeLessThan(frame.portCoast.length);
  });
});

describe('Durch die Wüste: fester Wüstenriegel', () => {
  it('Wüsten liegen immer auf den Riegel-Positionen und trennen das Land dahinter', () => {
    const frame = getFrame('sfDesert');
    for (let i = 0; i < 5; i++) {
      const board = generateCandidate(sfSettings('wueste'), rngFrom(`riegel-${i}`), i)!;
      for (const d of frame.def.fixedDeserts!) {
        expect(board.resources[d]).toBe('desert');
        expect(board.chips[d]).toBeNull();
      }
    }
    // Riegel trennt: ohne die Wüsten-Hexes zerfällt der Kontinent in 2 Teile
    const banned = new Set(frame.def.fixedDeserts);
    const main = frame.components[0].filter((i) => !banned.has(i));
    const seen = new Set<number>([main[0]]);
    const stack = [main[0]];
    while (stack.length) {
      const cur = stack.pop()!;
      for (const j of frame.adjIdx[cur]) {
        if (!banned.has(j) && frame.components[0].includes(j) && !seen.has(j)) {
          seen.add(j);
          stack.push(j);
        }
      }
    }
    expect(seen.size).toBeLessThan(main.length); // es bleibt ein Gebiet jenseits der Wüste
  });
});

describe('Nebelinseln: Fog-Mechanik', () => {
  it('alle Hexes außerhalb der Hauptinsel sind Nebelfelder (9 Stück)', () => {
    const frame = getFrame('sfFog');
    expect(frame.def.fog).toBe(true);
    const fog = frame.components.slice(1).flat();
    expect(fog.length).toBe(9);
    expect(new Set(fog).size).toBe(9);
    // Hauptinsel bleibt sichtbar
    for (const i of frame.components[0]) expect(fog.includes(i)).toBe(false);
  });

  it('Häfen liegen nur an der Hauptinsel (kein Nebel-Leak)', () => {
    const frame = getFrame('sfFog');
    expect(frame.portCoast.length).toBe(frame.coastRing.length);
  });
});

describe('Kombinierte Erweiterungen', () => {
  it('Codec-Roundtrip mit ck+seafarers und Szenario', () => {
    const s: GenSettings = { ...sfSettings('archipel'), expansion: 'ck+seafarers' };
    const board = generateCandidate(s, rngFrom('combo'), 2)!;
    const decoded = decodeState(`#${encodeState(board, s)}`);
    expect(decoded).not.toBeNull();
    expect(decoded!.settings.expansion).toBe('ck+seafarers');
    expect(decoded!.settings.scenario).toBe('archipel');
    expect(decoded!.board).toEqual(board);
  });

  it('Codec-Roundtrip mit 5-6-Seefahrer-Frame', () => {
    const s: GenSettings = { ...sfSettings('ueberfahrt'), playerGroup: '56' };
    const board = generateCandidate(s, rngFrom('cross56'), 1)!;
    expect(board.frameId).toBe('sfCross56');
    const decoded = decodeState(`#${encodeState(board, s)}`);
    expect(decoded!.board).toEqual(board);
    expect(decoded!.settings.playerGroup).toBe('56');
  });

  it('alte Links ohne Szenario-Feld fallen auf inselwelt zurück', () => {
    const s = sfSettings('inselwelt');
    const board = generateCandidate(s, rngFrom('legacy'), 0)!;
    const hash = encodeState(board, s);
    // sc-Feld aus dem Payload entfernen (simuliert v1-Link vor dem Szenario-Feature)
    const json = JSON.parse(Buffer.from(hash.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
    delete json.set.sc;
    const legacy = Buffer.from(JSON.stringify(json)).toString('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const decoded = decodeState(`#${legacy}`);
    expect(decoded).not.toBeNull();
    expect(decoded!.settings.scenario).toBe('inselwelt');
  });
});
