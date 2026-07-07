# Catan-Kartograph

Generator für balancierte Catan-Spielbretter — bewertet auf **Vertex-Ebene**
(den 54 bzw. 72 Kreuzungen, auf denen Siedlungen stehen), nicht nur auf
Hex-Ebene wie die meisten bestehenden Tools.

## Schnellstart

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # Vitest (22 Tests)
npm run build        # Typecheck + Produktions-Build → dist/
npm run build:single # Alles-in-einer-Datei-Build → dist-single/index.html
```

Kein Backend, kein Storage — der komplette Board-State steckt als
base64url-JSON im URL-Hash. Share-Links bleiben deshalb auch gültig, wenn
sich der Generator-Algorithmus später ändert.

## Warum Vertex-Ebene?

Gebaut wird auf Kreuzungen, nicht auf Feldern. Zwei Bretter mit identischer
Hex-Statistik können sich drastisch unterscheiden, sobald man fragt: *Wie
stark ist die beste Siedlungsposition? Wie fair verteilt sich Produktion über
die Startgebiete?* Deshalb berechnet der Scorer für jeden Vertex Pips
(Wahrscheinlichkeitspunkte der angrenzenden Chips) und Ressourcen-Diversität
und leitet daraus mehrere Faktoren ab.

## Generate-and-Score

1. Aus dem Seed werden bis zu **K Kandidaten** deterministisch erzeugt
   (`seed#0`, `seed#1`, …; mulberry32 + xmur3-Hash).
2. Jeder Kandidat durchläuft Constraint-Platzierung mit Backtracking:
   Wüste → Ressourcen → Chips (schwere Chips 6/8/2/12 zuerst) → Häfen.
3. Alle gültigen Kandidaten werden bewertet; angezeigt wird der beste
   (bzw. der schlechteste im Chaos-Modus, der erste im Zufallsmodus).

Gleicher Seed + gleiche Einstellungen ⇒ exakt dasselbe Board (getestet).
Der Button „Neu generieren" würfelt deshalb bewusst einen neuen Seed —
mit unverändertem Seed käme deterministisch dasselbe Board heraus.

## Die 6 Balance-Faktoren

Alle Faktoren liegen in [0, 1] und werden gewichtet zu einem Score 0–100
verrechnet (Gewichte im Advanced-Panel einstellbar).

| Faktor | Idee | Kern der Formel |
| --- | --- | --- |
| **Zahlen-Adjazenz** | Heiße/kalte Zahlen nicht klumpen | Strafpunkte je Hex-Nachbarschaft: 6/8-Paar = 2, 2/12-Paar = 1, gleiche Zahl = 1; `f = max(0, 1 − Σ/6)` |
| **Ressourcen-Verteilung** | Gleiche Ressourcen räumlich streuen | Halbierung des Bretts entlang der 3 Hex-Achsen; quadrierte Pip-Differenz je Ressource + Cluster-Strafe; `f = exp(−(dev + clumps)/Skala)` |
| **Pip-Balance je Ressource** | Keine Ressource verhungern lassen | Pips je Ressource, normiert auf Kartenanzahl; `f = 1 − σ/1.5 − 0.15·#ausgehungert` (ausgehungert = beste Zahl ≤ 2 Pips) |
| **Produktions-Gleichverteilung** | Stärke gleichmäßig über die Karte | Vertex-Stärken in 6 Winkelsektoren um den Schwerpunkt summiert (Top-2 je Sektor); `f = 1 − 1.8·CV` |
| **Hafen-Synergie** | 2:1-Häfen brauchen erreichbare eigene Pips | Angebot = direkte Pips + 0.5·Pips bis Distanz 2; Zielband [3, 8]; 3:1-Häfen zusätzlich über Umfangs-Streuung |
| **Start-Fairness** | Snake-Draft darf niemanden benachteiligen | Greedy-Snake-Draft für n Spieler (2 Siedlungen, Abstandsregel); `f = 1 − ((max−min)/mean)/0.4`, gemittelt über 3+4 bzw. 5+6 Spieler |

Vertex-Wert für Draft/Top-Spots: `pips + 0.7·(Diversität − 1) + 0.7·Hafenbonus`.

**Kalibrierung:** Die Konstanten (6, 1.5, 1.8, 0.4, …) sind empirisch so
gewählt, dass typische Zufallsboards ~40–60 und stark optimierte Boards
~75–90 erreichen. Wer härter/weicher bestrafen will, dreht an genau diesen
Stellen in `src/scoring/score.ts` — jede Funktion ist einzeln getestet.

## Constraints (togglebar)

- 6 & 8 nie benachbart (offizielle „ausgewogene" Variante, Default an)
- 2 & 12 nie benachbart
- Gleiche Zahlen nie benachbart
- Gleiche Ressourcen nie benachbart
- Wüste in der Mitte fixieren

Platzierung per Backtracking mit Schrittlimit; unerfüllbare Kombinationen
werden als Fehler gemeldet statt endlos zu suchen.

## Architektur

```
src/
  hexgrid/     Axial-/Cube-Koordinaten (Red-Blob-Konvention), Topologie:
               Vertices, Kanten, Küstenring — rein geometrisch, spielunabhängig
  model/       Typen + Frame-Definitionen (Basis 3-4-5-4-3, 5-6er 3-4-5-6-5-4-3),
               Kartenmengen, Chips, Pips, Hafenarten
  constraints/ Platzierung mit Backtracking + validateBoard (für Tests)
  scoring/     Vertex-Statistiken, 6 Faktoren, Snake-Draft, Top-Spots
  generator/   Seeded RNG, Kandidaten-Loop, Web Worker
  codec/       Board+Settings ↔ base64url im URL-Hash
  render/      BoardSVG (reines SVG) + Theme-Paletten als TS-Objekte
               (bewusst keine CSS-Variablen, damit SVG/PNG-Exporte
               ohne Stylesheet korrekt aussehen)
  ui/          Controls, ScorePanel, useGenerator (Worker mit Sync-Fallback)
```

**Datenfluss:** Settings-Änderung → `useGenerator` schickt sie an den Web
Worker → Worker meldet Fortschritt + bestes Board → App rendert SVG, schreibt
den Hash und (optional) Overlays. Falls die Umgebung Worker blockiert
(Sandbox-iframes), rechnet ein Watchdog-Fallback synchron — deterministisch
identisches Ergebnis.

**Frames statt Hardcoding:** Ein Brett ist eine `FrameDef` (Zeilen,
optionale Land/Meer-Maske, Kartenmengen, Chipmengen, Hafenarten). Basis,
5-6-Spiel und die Seefahrer-Inselwelt sind drei Einträge in `FRAME_DEFS` —
Topologie, Scoring und Rendering arbeiten frame-agnostisch auf
Koordinatenlisten. Städte & Ritter nutzt dasselbe Layout wie das Basisspiel
und ist daher bereits abgedeckt.

## Seefahrer: 7 Szenarien (3–4, teils 5–6 Spieler)

Seefahrer ist mit Städte & Ritter kombinierbar (C&K ändert nur Regeln, nicht
das Layout). Vier Szenarien sind frei nachempfundene Varianten bekannter
Klassiker (eigene Layouts und eigene Regel-Zusammenfassungen, keine
offiziellen Nachbauten), drei sind Eigenkreationen. Jedes Szenario bringt
Sonderregeln mit, die direkt im UI unter „📜 Sonderregeln" nachlesbar sind.

**5–6 Spieler:** Inselwelt, Vier Inseln und Die große Überfahrt haben eigene,
größere 5-6-Frames (eine `ScenarioDef` trägt Frames je Spielergruppe);
3-4-only-Szenarien sind im 5-6-Modus ausgegraut, und beim Umschalten auf 5–6
wechselt ein inkompatibles Szenario automatisch zur Inselwelt.

| Szenario | Inseln | Besonderheit |
| --- | --- | --- |
| **Inselwelt** (nach „Auf neue Ufer") | 14+3+3+2 / 20+3+3+2+2 | 2 Goldflüsse, +1 SP je Erstbesiedlung einer kleinen Insel |
| **Vier Inseln** (nach „Die vier Inseln") | 4×5 / 4×7 | Start auf max. 2 Heimatinseln, +2 SP je fremde Insel; Häfen über alle Inseln verteilt |
| **Durch die Wüste** (nach „Durch die Wüste") | 21+3 | Fester Wüstenriegel (fixierte Hex-Positionen) trennt das Land dahinter ab |
| **Nebelinseln** (nach „Die Nebelinseln") | 12+3+3+3 | 9 Nebelfelder starten verdeckt und werden per Klick aufgedeckt; Overlays lassen verdeckte Felder aus |
| **Der Archipel** (Eigenkreation) | 3×6 | Sechs gleichwertige Mini-Inseln, keine Wüste/kein Räuber, Häfen überall |
| **Die große Überfahrt** (Eigenkreation) | 10+9+3 / 13+13+4 | Zwei Kontinente, Gold-Eiland auf halber Strecke; Start nur im Westen, +2 SP für die erste Ost-Siedlung |
| **Goldrausch** (Eigenkreation) | 10+2+2+2+2 | 4 Goldflüsse auf Doppelinseln als Wirtschaftsmotor |

Technische Bausteine dafür:
- `masks` in der FrameDef trennen Land und Binnenmeer im selben Reihenraster;
  ein Konsistenz-Test stellt sicher, dass jede Maske exakt auf ihre Reihe passt
- `buildCoastRings` liefert alle geschlossenen Küstenringe; `portRing:
  'main' | 'all'` steuert, ob Häfen nur an der Hauptinsel oder über alle
  Inseln verteilt liegen — Euler gilt pro Insel: `V = E − H + Inseln`
- `fixedDeserts` fixiert Wüsten-Positionen (Wüstenriegel), unabhängig von den
  übrigen Constraints
- `fog: true` markiert Nebel-Frames; verdeckt sind alle Hexes außerhalb der
  Hauptinsel, der Aufdeck-Zustand lebt nur in der Session (Share-Links
  starten wieder verdeckt), Häfen liegen bewusst nur an der Hauptinsel
- Gold zählt in Pip-Balance und Verteilungs-Faktor als eigene Ressource
  (kein 2:1-Hafen, da Joker)

Neue Szenarien sind damit reine Daten: Maske + Kartenmengen + Regeltexte in
`src/model/scenarios.ts`.

## Experten-Modus

Der Standard-Modus zeigt bewusst nur, was man zum Board-Generieren braucht:
Spieler, Erweiterungen/Szenario, Balance-Presets, Häfen, Seed, Theme, Export
und den Score. Der Schalter **🧪 Experten-Modus** (oben in den Einstellungen)
blendet die Werkzeuge für Tüftler ein: Editor (Felder/Chips tauschen),
Faktor-Gewichte + Kandidatenzahl, Vertex-Heatmap und die
Ressourcen-Statistik. Beim Ausschalten werden Editor und Experten-Overlays
automatisch deaktiviert.

## Editor & Statistik

Zwei Features, die in der Catan-Community bei Map-Generatoren am häufigsten
gewünscht werden:

**✏️ Editor** (Experten-Modus) — Unter dem Board lassen sich zwei Modi aktivieren: *Felder
tauschen* (Ressource + Chip wandern gemeinsam) und *Chips tauschen* (nur die
Zahlen). Zwei Klicks tauschen; der Score wird live neu berechnet und der
Share-Link enthält automatisch den bearbeiteten Stand (der Codec kodiert das
komplette Board, nicht nur den Seed). Die Tausch-Operationen sind pure
Funktionen (`src/model/edit.ts`) und erhalten die Multisets — ein editiertes
Board ist immer regelkonform bestückt. Verletzt ein Edit aktive Regeln
(z. B. 6 neben 8), erscheint eine Warnung statt eines Verbots.
Chip-Tausch mit einer Wüste ist blockiert (Wüsten tragen nie einen Chip).

**📊 Ressourcen-Statistik** (Experten-Modus) — Toggle unter „Ansicht": erwartete Produktion je
Ressource pro 36 Würfen (= Pips), mit den verbauten Zahlen und einer
Markierung des fairen Anteils gemessen an der Felderzahl. So sieht man sofort,
ob z. B. Erz auf diesem Board verhungert.

## Offizielle Regeln

Die Materialmengen sind gegen die offiziellen Regelhefte verifiziert und als
Tests festgeschrieben (`tests/official_rules.test.ts`):

- **Basis:** 19 Felder (4/4/4 Holz/Wolle/Getreide, 3/3 Lehm/Erz, 1 Wüste),
  18 Chips (1× 2/12, 2× 3–6/8–11, keine 7), 58 Gesamt-Pips, 9 Häfen
  (4× 3:1 + je 1× 2:1), Rahmen 3-4-5-4-3, Wüste ohne Chip (Räuber-Start).
- **5–6:** +11 Felder (je +2 pro Ressource, +1 Wüste) auf 30, 28 Chips
  (2× 2/12, 3× Rest), 11 Häfen (+1× 3:1, +1× Wolle), Rahmen 3-4-5-6-5-4-3.
- **Variabler Aufbau:** die offizielle „ausgewogene" Regel (6/8 nie
  benachbart) ist per Default aktiv.
- **Seefahrer:** Gold ist Joker-Ressource ohne eigenen 2:1-Hafen; Schiffe,
  Pirat und Goldfluss stehen in den Szenario-Sonderregeln.

## Bekannte Vereinfachungen

- Der Snake-Draft ist greedy (jeder nimmt den besten freien Spot). Echte
  Spieler draften strategischer; als Fairness-Proxy ist greedy aber stabil
  und deterministisch.
- Hafen-Synergie bewertet Erreichbarkeit über Graph-Distanz ≤ 2, nicht
  über tatsächliche Wegekosten im Spielverlauf.
- Der Räuber steht dekorativ auf der (ersten) Wüste.

## Tests

`npm test` — 86 Tests: Topologie-Invarianten (54/72, Euler `V = E − H + 1`,
geschlossener Küstenring), Constraint-Erkennung + Property-Tests, Scoring-
Monotonie (ausgehungertes Erz schlechter, 6/8-Klumpen schlechter),
Codec-Roundtrip + Härtung (manipulierte Hashes werden abgelehnt),
Determinismus, alle 6 Szenario-Geometrien (Inselstruktur, Küstenringe,
Mengen-Konsistenz, Wüstenriegel-Trennung, Fog-Felder, Hafen-Verteilung),
offizielle Materialmengen für Basis und 5-6, Editor-Operationen
(Multiset-Erhalt, Wüsten-Schutz, Verletzungs-Erkennung) und
Hafen-Platzierung (klassisch/zufällig mit Mindestabstand).
