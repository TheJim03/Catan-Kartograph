import { FrameId, ScenarioId } from './types';

/**
 * Seefahrer-Szenarien. „Klassiker" sind frei nachempfundene Varianten bekannter
 * Szenarien (eigene Layouts und eigene Regel-Zusammenfassungen, keine
 * offiziellen Nachbauten); „Eigenkreationen" sind komplett neu.
 */
export interface ScenarioDef {
  id: ScenarioId;
  name: string;
  /** Frames je Spielergruppe — ohne '56'-Eintrag ist das Szenario nur für 3–4 spielbar. */
  frames: { '34': FrameId; '56'?: FrameId };
  origin: 'klassiker' | 'eigen';
  tagline: string;
  /** Sonderregeln für den Spieltisch, als kurze Stichpunkte. */
  rules: string[];
}

export const SCENARIOS: Record<ScenarioId, ScenarioDef> = {
  inselwelt: {
    id: 'inselwelt',
    name: 'Inselwelt',
    frames: { '34': 'sf34', '56': 'sf56' },
    origin: 'klassiker',
    tagline: 'Hauptinsel + 3 kleine Inseln — der Klassiker zum Aufbrechen (nach „Auf neue Ufer").',
    rules: [
      'Siegpunkte-Ziel um 2 erhöhen (z. B. 12 statt 10).',
      'Schiffe werden wie Straßen zu Wasser gebaut (1 Holz + 1 Wolle); Straße und Schiffslinie verbinden sich nur über eine Siedlung/Stadt an der Küste.',
      'Die erste eigene Siedlung auf jeder kleinen Insel bringt sofort +1 Siegpunkt (Marker unter die Siedlung legen).',
      'Goldfluss 🪙: Wird seine Zahl gewürfelt, erhält jede angrenzende Siedlung 1 beliebige Ressource (Stadt: 2).',
      'Der Pirat (Schiff statt Räuber) kann alternativ zum Räuber auf ein Meerfeld gesetzt werden und blockiert dort vorbeiführende Schiffslinien.',
      'Mit 5–6 Spielern: größere Karte (30 Felder, 4 Außeninseln, 3 Goldflüsse) und die Sonderbauphase aus der 5-6-Erweiterung gilt.',
    ],
  },
  vierinseln: {
    id: 'vierinseln',
    name: 'Vier Inseln',
    frames: { '34': 'sfFour', '56': 'sfFour56' },
    origin: 'klassiker',
    tagline: 'Vier gleichwertige Inseln — wer wagt die Überfahrt zuerst? (nach „Die vier Inseln").',
    rules: [
      'Bei der Startaufstellung dürfen die beiden Siedlungen auf höchstens 2 verschiedenen Inseln stehen — das sind eure Heimatinseln.',
      'Die erste eigene Siedlung auf jeder fremden Insel bringt sofort +2 Siegpunkte.',
      'Schiffe wie in der Inselwelt; eine Schiffslinie darf erst weitergebaut werden, wenn das offene Ende nicht vom Piraten blockiert ist.',
      'Siegpunkte-Ziel: 13.',
      'Mit 5–6 Spielern: vier größere Inseln (je 7 Felder) und die Sonderbauphase aus der 5-6-Erweiterung gilt.',
    ],
  },
  wueste: {
    id: 'wueste',
    name: 'Durch die Wüste',
    frames: { '34': 'sfDesert' },
    origin: 'klassiker',
    tagline: 'Ein fester Wüstenriegel trennt das fruchtbare Land vom Streifen dahinter (nach „Durch die Wüste").',
    rules: [
      'Der Wüstenriegel liegt immer an derselben Stelle (im Generator fest verdrahtet) — Straßen dürfen nicht durch die Wüste gebaut werden.',
      'Das Land jenseits des Riegels und die kleine Insel sind nur per Schiff erreichbar.',
      'Die erste eigene Siedlung jenseits der Wüste oder auf der kleinen Insel bringt sofort +2 Siegpunkte.',
      'Goldfluss 🪙 wie in der Inselwelt.',
      'Siegpunkte-Ziel: 12.',
    ],
  },
  nebel: {
    id: 'nebel',
    name: 'Nebelinseln',
    frames: { '34': 'sfFog' },
    origin: 'klassiker',
    tagline: 'Drei Inseln liegen im Nebel und werden erst beim Erkunden aufgedeckt (nach „Die Nebelinseln").',
    rules: [
      'Die Nebelfelder (❓) bleiben verdeckt. Am Spieltisch: Feld erst umdrehen, wenn ein Schiff oder eine Straße direkt daran angrenzend gebaut wird.',
      'Wer ein Landfeld aufdeckt, erhält sofort 1 Ressource dieses Typs (Gold: 1 beliebige) als Entdeckerbonus.',
      'In dieser App: Nebelfelder per Klick aufdecken — „Alles aufdecken" zeigt das komplette Board. Overlays lassen verdeckte Felder aus, damit nichts verraten wird.',
      'Schiffe und Goldfluss wie in der Inselwelt. Siegpunkte-Ziel: 12.',
    ],
  },
  archipel: {
    id: 'archipel',
    name: 'Der Archipel',
    frames: { '34': 'sfArchipel' },
    origin: 'eigen',
    tagline: 'Eigenkreation: sechs gleichwertige Mini-Inseln, jeder startet auf seiner eigenen.',
    rules: [
      'Jeder Spieler wählt reihum eine Startinsel und setzt beide Startsiedlungen dort — pro Spieler eine eigene Insel.',
      'Die erste eigene Siedlung auf jeder weiteren Insel bringt sofort +1 Siegpunkt.',
      'Es gibt keine Wüste und keinen Räuber: Bei einer 7 wird nur abgeworfen (Handkartenlimit), zusätzlich darf der Pirat auf ein Meerfeld versetzt werden.',
      'Schiffe wie in der Inselwelt; Goldfluss 🪙 gibt 1 beliebige Ressource.',
      'Siegpunkte-Ziel: 11.',
    ],
  },
  ueberfahrt: {
    id: 'ueberfahrt',
    name: 'Die große Überfahrt',
    frames: { '34': 'sfCross34', '56': 'sfCross56' },
    origin: 'eigen',
    tagline: 'Eigenkreation: Zwei Kontinente, dazwischen offenes Meer mit einem Gold-Eiland auf halber Strecke.',
    rules: [
      'Alle starten auf dem Westkontinent (beide Startsiedlungen).',
      'Die erste eigene Siedlung auf dem Ostkontinent bringt sofort +2 Siegpunkte, die erste auf dem Gold-Eiland +1 Siegpunkt.',
      'Das Gold-Eiland liegt auf halber Strecke: Wer dort siedelt, verkürzt die Überfahrt und finanziert sie per Goldfluss 🪙 (1 beliebige Ressource) gleich mit.',
      'Der Pirat ist auf der offenen See besonders wirksam — er darf statt des Räubers versetzt werden und blockiert Schiffslinien.',
      'Siegpunkte-Ziel: 12 (bei 5–6 Spielern: 13, Sonderbauphase gilt).',
    ],
  },
  goldrausch: {
    id: 'goldrausch',
    name: 'Goldrausch',
    frames: { '34': 'sfGold' },
    origin: 'eigen',
    tagline: 'Eigenkreation: vier Doppelinseln voller Gold locken hinaus aufs Meer.',
    rules: [
      'Auf der Hauptinsel wird gestartet (beide Startsiedlungen).',
      'Goldfluss 🪙: 1 beliebige Ressource je angrenzender Siedlung (Stadt: 2) — bei 4 Goldfeldern ist das der Motor des Szenarios.',
      'Wer zuerst auf 2 verschiedenen Außeninseln siedelt, erhält einmalig +2 Siegpunkte.',
      'Keine Wüste, kein Räuber: Bei einer 7 gilt nur das Handkartenlimit; der Pirat darf versetzt werden.',
      'Siegpunkte-Ziel: 12.',
    ],
  },
};

export const SCENARIO_LIST: ScenarioDef[] = Object.values(SCENARIOS);
