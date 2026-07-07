import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { decodeState, encodeState } from './codec/url';
import { randomSeed } from './generator/rng';
import { swapChips, swapTiles } from './model/edit';
import { validateBoard } from './constraints/constraints';
import { StatsPanel } from './ui/StatsPanel';
import { frameFor, rescore } from './generator/generate';
import { getFrame } from './model/data';
import { Board, DEFAULT_SETTINGS, GenResult, GenSettings } from './model/types';
import { BoardSVG, Overlays } from './render/BoardSVG';
import { PALETTES, ThemeId } from './render/palette';
import { Controls } from './ui/Controls';
import { ScorePanel } from './ui/ScorePanel';
import { useGenerator } from './ui/useGenerator';

type OverlayState = Overlays & { scorePanel: boolean; stats: boolean };

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export default function App() {
  // Share-Link beim Start wiederherstellen (einmalig, synchron ermittelt).
  const restored = useMemo(() => {
    try {
      return decodeState(window.location.hash);
    } catch {
      return null;
    }
  }, []);

  const [settings, setSettings] = useState<GenSettings>(restored?.settings ?? DEFAULT_SETTINGS);
  const [overlays, setOverlays] = useState<OverlayState>({ topSpots: true, heatmap: false, scorePanel: true, stats: false });
  const [theme, setTheme] = useState<ThemeId>(() =>
    window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const [toast, setToast] = useState<string | null>(null);
  const [expert, setExpert] = useState(false);

  const { state, generate } = useGenerator();
  const svgRef = useRef<SVGSVGElement>(null);

  // Wiederhergestelltes Board direkt anzeigen, ohne neu zu generieren.
  const [overrideResult, setOverrideResult] = useState<GenResult | null>(() => {
    if (!restored) return null;
    const score = rescore(restored.board, restored.settings);
    return { board: restored.board, score, tried: 1, failed: 0, ms: 0 };
  });

  const result: GenResult | null = overrideResult ?? state.result;
  const board: Board | null = result?.board ?? null;
  const frame = getFrame(board?.frameId ?? frameFor(settings));
  const palette = PALETTES[theme];

  // Nebel-Szenario: alle Hexes außerhalb der Hauptinsel starten verdeckt.
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const boardKey = board ? `${board.frameId}|${board.seed}|${board.candidateIndex}` : '';
  const prevBoardKey = useRef(boardKey);
  useEffect(() => {
    if (prevBoardKey.current !== boardKey) {
      prevBoardKey.current = boardKey;
      setRevealed(new Set());
    }
  }, [boardKey]);
  const fogAll = useMemo(
    () => (frame.def.fog ? new Set(frame.components.slice(1).flat()) : null),
    [frame],
  );
  const hiddenHexes = useMemo(() => {
    if (!fogAll) return undefined;
    return new Set([...fogAll].filter((i) => !revealed.has(i)));
  }, [fogAll, revealed]);
  const revealHex = useCallback((i: number) => {
    setRevealed((r) => new Set(r).add(i));
  }, []);

  // Editor: zwei Klicks tauschen Felder oder Chips, Score wird live neu berechnet.
  const [editMode, setEditMode] = useState<'off' | 'tiles' | 'chips'>('off');
  const [selectedHex, setSelectedHex] = useState<number | null>(null);
  useEffect(() => setSelectedHex(null), [editMode, boardKey]);
  useEffect(() => {
    if (!expert) {
      setEditMode('off');
      setOverlays((o) => ({ ...o, heatmap: false, stats: false }));
    }
  }, [expert]);

  const handleHexClick = useCallback((i: number) => {
    if (editMode === 'off' || !board) return;
    if (selectedHex === null) {
      setSelectedHex(i);
      return;
    }
    if (selectedHex === i) {
      setSelectedHex(null);
      return;
    }
    const swapped = editMode === 'tiles' ? swapTiles(board, selectedHex, i) : swapChips(board, selectedHex, i);
    setSelectedHex(null);
    if (!swapped) return; // z. B. Chip-Tausch mit Wüste
    setOverrideResult({
      board: swapped,
      score: rescore(swapped, settings),
      tried: result?.tried ?? 1,
      failed: result?.failed ?? 0,
      ms: 0,
    });
  }, [editMode, board, selectedHex, settings, result]);

  // Editierte Boards können Constraints verletzen — anzeigen statt verbieten.
  const violations = useMemo(() => {
    if (!board || !overrideResult) return [];
    return validateBoard(frame, board, settings.constraints);
  }, [board, overrideResult, frame, settings.constraints]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // Auto-Generate bei jeder Settings-Änderung (außer direkt nach Restore).
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current && overrideResult) {
      firstRun.current = false;
      return;
    }
    firstRun.current = false;
    setOverrideResult(null);
    generate(settings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  // URL-Hash aktuell halten, damit Reload/Copy immer das sichtbare Board trägt.
  useEffect(() => {
    if (!board) return;
    try {
      window.history.replaceState(null, '', `#${encodeState(board, settings)}`);
    } catch {
      /* file://-Kontexte o. Ä. — Share-Button nutzt dann den Fallback */
    }
  }, [board, settings]);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  };

  const svgMarkup = useCallback((): string | null => {
    const el = svgRef.current;
    if (!el) return null;
    return new XMLSerializer().serializeToString(el);
  }, []);

  const exportSVG = useCallback(() => {
    const markup = svgMarkup();
    if (!markup) return;
    downloadBlob(new Blob([markup], { type: 'image/svg+xml' }), `catan-${settings.seed}.svg`);
  }, [svgMarkup, settings.seed]);

  const exportPNG = useCallback(() => {
    const el = svgRef.current;
    const markup = svgMarkup();
    if (!el || !markup) return;
    const vb = el.viewBox.baseVal;
    const scale = 2;
    const img = new Image();
    const svgUrl = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }));
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(vb.width * scale);
      canvas.height = Math.round(vb.height * scale);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) downloadBlob(blob, `catan-${settings.seed}.png`);
        }, 'image/png');
      }
      URL.revokeObjectURL(svgUrl);
    };
    img.onerror = () => {
      URL.revokeObjectURL(svgUrl);
      showToast('PNG-Export fehlgeschlagen — SVG-Export nutzen.');
    };
    img.src = svgUrl;
  }, [svgMarkup, settings.seed]);

  const share = useCallback(async () => {
    if (!board) return;
    const url = `${window.location.origin}${window.location.pathname}#${encodeState(board, settings)}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast('Link kopiert!');
    } catch {
      window.prompt('Link zum Kopieren:', url);
    }
  }, [board, settings]);

  // „Neu generieren" würfelt einen neuen Seed — gleicher Seed hieße wegen des
  // Determinismus exakt dasselbe Board (so wirkte der Button zuvor kaputt).
  const regenerate = useCallback(() => {
    setOverrideResult(null);
    setSettings((s) => ({ ...s, seed: randomSeed() }));
  }, []);

  const busy = state.status === 'working';

  return (
    <div className="app">
      <header>
        <h1>Catan-Kartograph</h1>
        <p>Balancierte Spielbretter, bewertet auf Siedlungs-Ebene</p>
      </header>

      <main>
        <div className="board-col">
          <div className={`board-wrap${busy ? ' busy' : ''}`}>
            {board && (
              <BoardSVG
                ref={svgRef}
                frame={frame}
                board={board}
                score={result?.score ?? null}
                palette={palette}
                overlays={overlays}
                hiddenHexes={hiddenHexes}
                onRevealHex={revealHex}
                onHexClick={editMode !== 'off' ? handleHexClick : undefined}
                selectedHex={selectedHex}
              />
            )}
            {busy && (
              <div className="progress" role="status">
                <div className="progress-bar" style={{ width: `${Math.round(state.progress * 100)}%` }} />
                <span>Suche bestes Board … {Math.round(state.progress * 100)}%</span>
              </div>
            )}
            {state.status === 'error' && <div className="error">{state.error}</div>}
          </div>
          {expert && (
          <div className="editbar">
            <span>✏️ Bearbeiten:</span>
            <div className="seg">
              <button className={editMode === 'off' ? 'on' : ''} onClick={() => setEditMode('off')}>Aus</button>
              <button className={editMode === 'tiles' ? 'on' : ''} onClick={() => setEditMode('tiles')} title="Zwei Felder anklicken: Ressource + Chip tauschen die Plätze">Felder tauschen</button>
              <button className={editMode === 'chips' ? 'on' : ''} onClick={() => setEditMode('chips')} title="Zwei Felder anklicken: nur die Zahlenchips tauschen">Chips tauschen</button>
            </div>
            {editMode !== 'off' && (
              <span className="hint">
                {selectedHex === null ? 'Erstes Feld anklicken …' : 'Zweites Feld anklicken zum Tauschen'}
              </span>
            )}
          </div>
          )}
          {violations.length > 0 && (
            <div className="warnings">
              ⚠️ Das bearbeitete Board verletzt aktive Regeln: {violations.join(' · ')}
            </div>
          )}
          <div className="board-actions">
            <button className="primary" onClick={regenerate} disabled={busy}>
              {busy ? 'Generiert …' : 'Neu generieren'}
            </button>
            <code className="seed-chip" title="Aktueller Seed">
              {settings.seed}
              {board ? ` · #${board.candidateIndex}` : ''}
            </code>
            {hiddenHexes && hiddenHexes.size > 0 && (
              <button onClick={() => fogAll && setRevealed(new Set(fogAll))}>
                🌫️ Alles aufdecken ({hiddenHexes.size})
              </button>
            )}
          </div>
          {overlays.scorePanel && result && <ScorePanel result={result} weights={settings.weights} />}
          {expert && overlays.stats && board && <StatsPanel board={board} palette={palette} />}
        </div>

        <Controls
          settings={settings}
          onSettings={setSettings}
          overlays={overlays}
          onOverlays={setOverlays}
          theme={theme}
          onTheme={setTheme}
          onExportPNG={exportPNG}
          onExportSVG={exportSVG}
          onShare={share}
          busy={busy}
          expert={expert}
          onExpert={setExpert}
        />
      </main>

      {toast && <div className="toast">{toast}</div>}

      <footer>
        Vertex-basierte Balance: bewertet werden die 54/72 Kreuzungen, auf denen
        Siedlungen stehen — nicht nur die Hexfelder.
      </footer>
    </div>
  );
}
