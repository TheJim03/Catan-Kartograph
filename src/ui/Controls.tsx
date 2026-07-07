import { FACTOR_LABEL } from '../scoring/score';
import { SCENARIOS, SCENARIO_LIST } from '../model/scenarios';
import {
  ConstraintSettings, DEFAULT_WEIGHTS, Expansion, FACTOR_KEYS, GenSettings, hasCK, hasSeafarers,
} from '../model/types';

const combineExpansion = (ck: boolean, seafarers: boolean): Expansion =>
  ck && seafarers ? 'ck+seafarers' : ck ? 'ck' : seafarers ? 'seafarers' : 'base';
import { randomSeed } from '../generator/rng';
import { Overlays } from '../render/BoardSVG';
import { ThemeId } from '../render/palette';

export type ModeId = 'strict' | 'balanced' | 'loose' | 'random' | 'chaos';

export const MODES: { id: ModeId; label: string; hint: string }[] = [
  { id: 'strict', label: 'Streng', hint: 'Alle Adjazenzregeln, 1200 Kandidaten' },
  { id: 'balanced', label: 'Ausgewogen', hint: 'Offizielle 6/8-Regel, 400 Kandidaten' },
  { id: 'loose', label: 'Locker', hint: '6/8-Regel, 120 Kandidaten' },
  { id: 'random', label: 'Zufällig', hint: 'Offizielle Zufallsregel, 1 Kandidat' },
  { id: 'chaos', label: 'Chaos', hint: 'Bewusst maximal unausgewogen' },
];

export function applyMode(s: GenSettings, mode: ModeId): GenSettings {
  const base: Partial<ConstraintSettings> = {
    noAdjRed: false, no2and12Adjacent: false, noSameNumberAdjacent: false, noSameResourceAdjacent: false,
  };
  switch (mode) {
    case 'strict':
      return {
        ...s,
        constraints: { ...s.constraints, noAdjRed: true, no2and12Adjacent: true, noSameNumberAdjacent: true, noSameResourceAdjacent: true },
        candidates: 1200,
        target: 'best',
      };
    case 'balanced':
      return { ...s, constraints: { ...s.constraints, ...base, noAdjRed: true }, candidates: 400, target: 'best' };
    case 'loose':
      return { ...s, constraints: { ...s.constraints, ...base, noAdjRed: true }, candidates: 120, target: 'best' };
    case 'random':
      return { ...s, constraints: { ...s.constraints, ...base }, candidates: 1, target: 'first' };
    case 'chaos':
      return { ...s, constraints: { ...s.constraints, ...base }, candidates: 400, target: 'worst' };
  }
}

interface Props {
  settings: GenSettings;
  onSettings: (s: GenSettings) => void;
  overlays: Overlays & { scorePanel: boolean; stats: boolean };
  onOverlays: (o: Overlays & { scorePanel: boolean; stats: boolean }) => void;
  theme: ThemeId;
  onTheme: (t: ThemeId) => void;
  onExportPNG: () => void;
  onExportSVG: () => void;
  onShare: () => void;
  busy: boolean;
  expert: boolean;
  onExpert: (v: boolean) => void;
}

export function Controls({
  settings, onSettings, overlays, onOverlays, theme, onTheme,
  onExportPNG, onExportSVG, onShare, busy, expert, onExpert,
}: Props) {
  const set = (patch: Partial<GenSettings>) => onSettings({ ...settings, ...patch });
  const setCon = (patch: Partial<ConstraintSettings>) =>
    set({ constraints: { ...settings.constraints, ...patch } });

  const toggle = (
    label: string,
    checked: boolean,
    onChange: (v: boolean) => void,
  ) => (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );

  return (
    <div className="controls">
      <div className="controls-head">
        <span>Einstellungen</span>
        <label className="toggle expert-toggle" title="Blendet experimentelle Werkzeuge und Detail-Statistiken ein: Editor, Faktor-Gewichte, Heatmap, Ressourcen-Statistik">
          <input type="checkbox" checked={expert} onChange={(e) => onExpert(e.target.checked)} />
          <span>🧪 Experten-Modus</span>
        </label>
      </div>
      <section>
        <h2>Spiel</h2>
        <div className="seg">
          <button className={settings.playerGroup === '34' ? 'on' : ''} onClick={() => set({ playerGroup: '34' })}>
            3–4 Spieler
          </button>
          <button
            className={settings.playerGroup === '56' ? 'on' : ''}
            onClick={() => {
              const needsSwitch = hasSeafarers(settings.expansion) && !SCENARIOS[settings.scenario].frames['56'];
              set(needsSwitch ? { playerGroup: '56', scenario: 'inselwelt' } : { playerGroup: '56' });
            }}
          >
            5–6 Spieler
          </button>
        </div>
        <div className="expansions">
          {toggle('Städte & Ritter', hasCK(settings.expansion), (v) =>
            set({ expansion: combineExpansion(v, hasSeafarers(settings.expansion)) }))}
          {toggle('Seefahrer', hasSeafarers(settings.expansion), (v) => {
            const expansion = combineExpansion(hasCK(settings.expansion), v);
            const needsSwitch = v && settings.playerGroup === '56' && !SCENARIOS[settings.scenario].frames['56'];
            set(needsSwitch ? { expansion, scenario: 'inselwelt' } : { expansion });
          })}
        </div>
        {hasCK(settings.expansion) && (
          <p className="hint">Städte &amp; Ritter ändert nur die Spielregeln, nicht das Kartenlayout — die Generierung bleibt gleich{hasSeafarers(settings.expansion) ? ' und kombiniert sich mit dem gewählten Seefahrer-Szenario' : ''}.</p>
        )}
        {hasSeafarers(settings.expansion) && (
          <>
            <label className="field">
              <span>Szenario</span>
              <select
                value={settings.scenario}
                onChange={(e) => set({ scenario: e.target.value as GenSettings['scenario'] })}
              >
                <optgroup label="Klassiker (frei nachempfunden)">
                  {SCENARIO_LIST.filter((sc) => sc.origin === 'klassiker').map((sc) => (
                    <option key={sc.id} value={sc.id} disabled={settings.playerGroup === '56' && !sc.frames['56']}>
                      {sc.name}{sc.frames['56'] ? '' : ' (nur 3–4)'}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Eigenkreationen">
                  {SCENARIO_LIST.filter((sc) => sc.origin === 'eigen').map((sc) => (
                    <option key={sc.id} value={sc.id} disabled={settings.playerGroup === '56' && !sc.frames['56']}>
                      {sc.name}{sc.frames['56'] ? '' : ' (nur 3–4)'}
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>
            <p className="hint">{SCENARIOS[settings.scenario].tagline}</p>
            <details className="rules">
              <summary>📜 Sonderregeln: {SCENARIOS[settings.scenario].name}</summary>
              <ul>
                {SCENARIOS[settings.scenario].rules.map((rule, i) => (
                  <li key={i}>{rule}</li>
                ))}
                {hasCK(settings.expansion) && (
                  <li>
                    <strong>Mit Städte &amp; Ritter:</strong> Barbaren, Metropolen und
                    Stadtausbauten gelten zusätzlich; die Szenario-Siegpunktziele um
                    weitere +3 erhöhen.
                  </li>
                )}
              </ul>
              <p className="hint">Klassiker sind frei nachempfundene Varianten mit eigenen Layouts und eigenen Regel-Zusammenfassungen — keine offiziellen Nachbauten.</p>
            </details>
          </>
        )}
      </section>

      <section>
        <h2>Balance</h2>
        <div className="seg wrap" role="group" aria-label="Balance-Modus">
          {MODES.map((m) => (
            <button key={m.id} title={m.hint} onClick={() => onSettings(applyMode(settings, m.id))}>
              {m.label}
            </button>
          ))}
        </div>
        {toggle('6 & 8 nie benachbart (offiziell ausgewogen)', settings.constraints.noAdjRed, (v) => setCon({ noAdjRed: v }))}
        {toggle('2 & 12 nie benachbart', settings.constraints.no2and12Adjacent, (v) => setCon({ no2and12Adjacent: v }))}
        {toggle('Gleiche Zahlen nie benachbart', settings.constraints.noSameNumberAdjacent, (v) => setCon({ noSameNumberAdjacent: v }))}
        {toggle('Gleiche Ressourcen nie benachbart', settings.constraints.noSameResourceAdjacent, (v) => setCon({ noSameResourceAdjacent: v }))}
        {toggle('Wüste in der Mitte fixieren', settings.constraints.desertCenter, (v) => setCon({ desertCenter: v }))}
      </section>

      <section>
        <h2>Häfen</h2>
        <label className="field">
          <span>Positionierung</span>
          <select value={settings.ports} onChange={(e) => set({ ports: e.target.value as GenSettings['ports'] })}>
            <option value="classic">Klassische Positionen</option>
            <option value="random">Zufällige Positionen</option>
            <option value="off">Ohne Häfen</option>
          </select>
        </label>
      </section>

      {expert && (
      <details className="advanced">
        <summary>Erweitert: Faktor-Gewichte &amp; Kandidaten</summary>
        {FACTOR_KEYS.map((k) => (
          <label key={k} className="slider">
            <span>
              {FACTOR_LABEL[k]} <em>{settings.weights[k].toFixed(1)}</em>
            </span>
            <input
              type="range" min={0} max={2} step={0.1}
              value={settings.weights[k]}
              onChange={(e) => set({ weights: { ...settings.weights, [k]: Number(e.target.value) } })}
            />
          </label>
        ))}
        <label className="slider">
          <span>
            Kandidaten K <em>{settings.candidates}</em>
          </span>
          <input
            type="range" min={1} max={2000} step={1}
            value={settings.candidates}
            onChange={(e) => set({ candidates: Number(e.target.value) })}
          />
        </label>
        <button className="ghost" onClick={() => set({ weights: { ...DEFAULT_WEIGHTS } })}>
          Gewichte zurücksetzen
        </button>
      </details>
      )}

      <section>
        <h2>Seed</h2>
        <div className="seedrow">
          <input
            value={settings.seed}
            onChange={(e) => set({ seed: e.target.value })}
            aria-label="Seed"
            spellCheck={false}
          />
          <button onClick={() => set({ seed: randomSeed() })} disabled={busy} title="Neuen Seed würfeln">
            🎲 Würfeln
          </button>
        </div>
        <p className="hint">Gleicher Seed + gleiche Einstellungen = exakt dasselbe Board.</p>
      </section>

      <section>
        <h2>Ansicht</h2>
        {toggle('Top-Startplätze markieren', overlays.topSpots, (v) => onOverlays({ ...overlays, topSpots: v }))}
        {expert && toggle('Vertex-Heatmap (Pips)', overlays.heatmap, (v) => onOverlays({ ...overlays, heatmap: v }))}
        {toggle('Score-Details anzeigen', overlays.scorePanel, (v) => onOverlays({ ...overlays, scorePanel: v }))}
        {expert && toggle('Ressourcen-Statistik', overlays.stats, (v) => onOverlays({ ...overlays, stats: v }))}
        <label className="field">
          <span>Theme</span>
          <select value={theme} onChange={(e) => onTheme(e.target.value as ThemeId)}>
            <option value="light">Hell (Seekarte)</option>
            <option value="dark">Dunkel</option>
            <option value="cb">Farbenblind-sicher</option>
          </select>
        </label>
      </section>

      <section className="exports">
        <button onClick={onExportPNG}>PNG speichern</button>
        <button onClick={onExportSVG}>SVG speichern</button>
        <button onClick={onShare}>Link kopieren</button>
      </section>
    </div>
  );
}
