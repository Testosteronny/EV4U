# EV4U — UI-Revamp: Konzept «Klartext»

Status: **umgesetzt** · Konzept 2026-07-28 · umgesetzt 2026-08

Dieses Dokument bleibt als Begründung stehen — warum die Oberfläche so
aussieht, wie sie aussieht. Die Diagnose in Abschnitt 1 beschreibt den
*alten* Stand; die Zahlen dort sind historisch, nicht aktuell.

Abweichungen von der Planung, bewusst getroffen:

- **Spline Sans Mono ist ersatzlos entfallen** (3.2 sah es noch für Readouts
  vor). Archivo bringt echte Tabellenziffern mit — dafür braucht es kein
  zweites Schriftgesicht und keinen zweiten Font-Download.
- **Regel 1 gilt auch für die Daten**, nicht nur fürs Chrom. Der Katalog stand
  vollständig in Versalien («RENAULT 5 E-TECH 52»), weil die Marken- und
  Modellnamen so in der Datenbank lagen. `src/utils/format.ts` setzt sie beim
  Anzeigen; das Erfassungsformular schreibt sie nicht mehr gross.
- **Der Vergleich übernimmt einen geteilten `?ids=`-Link**, statt daneben eine
  zweite, nur lesbare Auswahl zu führen (4.3 liess das offen).
- **Inserate sind bearbeitbar** (`ListingEditor`). Ohne das endete der
  Verkäufer-Pfad in einem Entwurf, den niemand je vervollständigen konnte.

---

## 1. Diagnose

Die aktuelle Oberfläche ist handwerklich sauber und konsistent — aber sie ist
ein **Kostüm**. Sie erzählt vier Metaphern gleichzeitig (Bahnhofs-Falttafel,
Mischpult, technische Zeichnung, analoges Instrumentenbrett), und keine davon
hilft beim Autokauf. Konkret, messbar:

| Befund | Zahl | Wirkung |
|---|---|---|
| `uppercase` im Quelltext | **126×** | Wortbilder zerstört, Lesegeschwindigkeit halbiert |
| Mono-Font-Einsätze | **~190×** | UI liest sich wie ein Terminal, nicht wie ein Marktplatz |
| `whileInView` / Entrance-Motion | **36×** | Jeder Scroll ist eine Choreografie |
| Kleinste eingesetzte Schriftgrösse | **8 px** | Substanz (Kostenmodell, Steuer-Offenlegung) ist unlesbar |
| Freitext-Suche | **0** | Man kann «Model 3» nicht eingeben |

### 1.1 Die fünf echten Probleme

**A — Die Typo-Hierarchie ist invertiert.**
Dekoration ist gross (`stretch-expand text-6xl font-black uppercase` für das
Wort «INSERATE»), Inhalt ist klein (`text-[9px] uppercase tracking-[0.2em]
text-muted/60` für die Erklärung, wie die Kosten berechnet werden). Das
Wichtigste ist am schwersten zu lesen. Ganze Absätze Fliesstext stehen in
gesperrtem Mono-Versal — z. B. der komplette Modell-Disclaimer in
`EngineCore.tsx:556-567`.

**B — Ein Akzent macht fünf Jobs.**
`signal` (Grün) markiert: Marke, aktive Navigation, primären Button, *alle*
Icons, die Strom-Spalte, den Fokusring, Trennlinien, Hover-Ränder,
Scrollbar-Hover. Wenn alles Akzent ist, ist nichts Akzent. Dazu `lume` (Teal)
und `warn` (Amber) — drei Signalfarben, die auf Dunkelgrün schwer zu trennen
sind.

**C — Personalisierung durch unsichtbaren Zustand.**
Jede Zahl auf der Seite («CHF 3.68 Strom/100 km») hängt an einem globalen,
persistierten Kontext (PLZ-Tarif, km/Jahr, aktuelles Auto, Lade-Mix, PV).
Dieser Kontext ist **nur innerhalb von `/rechenwerk` oder einer eingebetteten
Engine editierbar** und sonst nirgends sichtbar. Der Nutzer sieht überall
Zahlen, die auf Annahmen beruhen, die er weder sieht noch ändern kann.
Kompensiert wird das mit Fussnoten (`* berechnet mit Tarif …`) auf jeder
zweiten Komponente. **Das ist der grösste Overview-Schaden im Produkt.**

**D — Die Navigation zeigt Werkzeuge statt Ziele.**
`INSERATE · VERKAUFEN · RECHENWERK · VERGLEICH · KONTO` — flach, gleichrangig.
Zwei davon (Rechenwerk, Vergleich) sind Werkzeuge, die **ohne vorher gewähltes
Auto in einen leeren Zustand führen**. Gleichzeitig fehlt die Merkliste in der
Navigation komplett; sie ist ein Filter-Toggle auf `/inserate`. Und es gibt
keine Suche.

**E — Der Marktplatz führt nicht zum Verkäufer.**
Auf der Detailseite konkurrieren fünf Controls in der rechten Spalte (Stamp,
Preis, Rabatt-Kachel, Sprung-Link zum Rechenwerk, Merken, Vergleichen) — die
eigentliche Konversion, *Verkäufer kontaktieren*, liegt als `<ContactSeller>`
weit unten und nur für eigene Inserate. Das Foto, die wichtigste
Kaufentscheidungs-Information, steht an vierter Position.

---

## 2. Die Richtung: «Klartext»

> Sag es einfach. In Gemischtschreibung. In lesbarer Grösse.

Das Markenversprechen ist *«ehrlich durchgerechnet»*. Die richtige visuelle
Übersetzung davon ist nicht ein Cockpit-Skin, sondern das Gegenteil: **die Zahl
ist der Held, das Chrom verschwindet.** Ruhig, redaktionell, schweizerisch im
eigentlichen Sinn (Raster, Weissraum, ein Akzent) — nicht «Instrument».

Fünf Regeln, aus denen sich alles Übrige ableitet:

1. **Gemischtschreibung.** Versalien nur für das Eyebrow über einem Abschnitt,
   max. 3 Wörter. 126 → ~8 Vorkommen.
2. **Ein Akzent, vier Rollen.** Primärbutton, aktiver Zustand, Fokusring, Link.
   Sonst nichts. Icons sind neutral.
3. **Kein Text unter 13 px**, ausser Rechtlichem (11 px, gemischt gesetzt).
4. **Ein Kontext, sichtbar.** Alle personalisierten Zahlen kommen aus einer
   einzigen, immer sichtbaren, immer editierbaren Leiste.
5. **Motion nur, wenn sie Zustand erklärt.** Kein Entrance-Theater.

---

## 3. Token-System

### 3.1 Farbe — Hell als Default

Dunkel bleibt als gleichwertiger Modus, aber ein Marktplatz, auf dem man Fotos
vergleicht und Datenblätter liest, gehört hell als Standard.

```
                    LIGHT        DARK
bg (Seite)          #FBFBFA      #0E0F0E
surface (Karte)     #FFFFFF      #161816
surface-2 (raised)  #F4F4F2      #1E201E
border-hairline     #E6E6E3      #282A27
border-strong       #D6D6D2      #383B37
text                #141513      #EDEEEB
text-2 (sekundär)   #5C5E59      #9EA19B
text-3 (tertiär)    #8B8D87      #6D706A

accent              #0F7A43      #3BD683    ← Button, aktiv, Fokus, Link
caution             #9A6400      #E0A63C    ← reserviert, geschätzt
```

**Gestrichen:** `lume`. Ersparnis wird in `accent` gesetzt — Ersparnis *ist*
das Markenversprechen, dafür darf die Markenfarbe stehen. Zwei Farbtöne
insgesamt statt vier.

### 3.2 Typografie

Ein Textgesicht: **Archivo** (bereits geladen, variabel), Achsen `wdth`
konstant 100 — die Breiten-Spielereien (`stretch-expand/wide/cond`) entfallen
komplett. **Spline Sans Mono** bleibt, aber ausschliesslich für numerische
Readouts in Tabellen und Spec-Grids — nie für Labels, nie Versal, nie gesperrt.

| Rolle | Grösse/Zeilenhöhe | Gewicht | Verwendung |
|---|---|---|---|
| `display` | 32/38 → 40/44 | 600 | Seitentitel, gemischt gesetzt |
| `h2` | 22/28 | 600 | Abschnitte |
| `h3` | 17/24 | 600 | Karten, Panels |
| `body` | 15/24 | 400 | **Arbeitspferd — fehlt heute komplett** |
| `small` | 13/20 | 400/500 | Labels, Meta, Tabellenzellen |
| `micro` | 11/16 | 400 | nur Rechtliches, gemischt gesetzt |
| `eyebrow` | 11/16, `0.08em` | 600 | Versal, max. 3 Wörter, **einzige Versalie** |

Tracking: `-0.02em` auf display/h2, `0` überall sonst. Die heutigen
`tracking-[0.25em]`-Werte entfallen.

### 3.3 Form & Fläche

```
radius:   10px (Karte, Input, Button) · 6px (Chip) · 999px (Avatar, Zähler)
border:   1px hairline — Standard-Abgrenzung
shadow:   keiner auf Flächen. Nur Overlays: 0 8px 32px -12px rgb(0 0 0 / .18)
spacing:  4er-Raster; Section-Rhythmus 64px statt 80px
```

**Ersatzlos gestrichen:** `bg-blueprint` (Raster-Hintergrund), `current-line`
(grüne Trennlinien), `stamp` (rotierte Stempel-Chips), `ruler` (Lineal-Ticks),
Custom-Scrollbar, `::selection`-Override, `shadow-signal`, `animation.blink`.

### 3.4 Motion

```
Seitenwechsel   :  keine
Entrance        :  eine Container-Fade, 160 ms — nicht pro Abschnitt
Hover           :  120 ms background/border
Overlay         :  160 ms fade + 4px translate
Zahlen          :  sofort. Ausnahmslos.
```

`AnimatedNumber` steckt heute ~20× allein in `EngineCore` — beim Ziehen eines
Reglers zappelt das ganze Ergebnispanel.

Ursprünglich war geplant, die eine Ersparnis-Headline als 200-ms-Count-up zu
behalten. **Verworfen nach dem Test:** die Kostenwerte ändern sich beim Laden
mehrfach kurz hintereinander (Tarif-Hydration, dann die Kantonssteuern), eine
unterbrochene Zählung bleibt auf einem Zwischenbild stehen — und die Headline
widersprach dann ihrer eigenen Aufschlüsselung (CHF 1'940 über
«Energie 1'348 · Wartung 330 · Steuer 353»). Eine Zahl, die falsch sein kann,
ist die Bewegung nicht wert. Zahlen werden jetzt ausschliesslich formatiert,
nie animiert.

Framer Motion verschwindet damit vollständig aus dem Projekt — Overlays und
Hover laufen über CSS-Transitions.

### 3.5 Controls

| heute | neu |
|---|---|
| `Fader` mit Lineal-Ticks, eckigem Mischpult-Thumb | Standard-Slider, runder 16-px-Thumb, Wert inline, keine Ticks |
| Analoge Zeiger-Gauges (2 Stück, ~340 px hoch) | **Ein Balkenpaar**: dein Auto vs. dieses Auto, gleiche Aussage, ¼ Platz, exakt ablesbar |
| `Segmented` Versal-Mono-Pills | Segmented gemischt gesetzt, gerundet, nur ≤ 4 Optionen — ab 5 wird es ein Select/Chip-Row |
| `Stamp` (Rahmen + Sperrung) | Status-Badge: 6-px-Radius, gefüllt-dezent, gemischt |

---

## 4. Informationsarchitektur

### 4.1 Die Kontextleiste — der zentrale Umbau

Ein Element ersetzt vier heutige Oberflächen (PlzGate-Modal, Hero-Widget,
TopBar-Chip, `/rechenwerk`-Eingabespalte) und löst Problem **C**:

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Deine Werte   4617 Gänsbrunnen · 27.9 Rp./kWh   15'000 km/Jahr           │
│               Heute: Benzin 7.0 l   80 % zuhause          [ Anpassen ]   │
└──────────────────────────────────────────────────────────────────────────┘
```

- **Immer sichtbar**, direkt unter dem Header, auf jeder Seite. Mobil einzeilig:
  `4617 · 15'000 km · Benzin 7.0 l  [Anpassen]`.
- **«Anpassen»** öffnet ein Sheet mit genau den fünf Eingaben, die heute in der
  Engine-Eingabespalte stecken. Das ist die einzige Stelle, an der der Kontext
  gesetzt wird.
- **Erstbesuch:** die Leiste zeigt inline `Standort wählen für deine Preise →`.
  **Kein Modal.** `PlzGate` als Interruption entfällt — heute unterbricht es,
  bevor man irgendetwas gesehen hat.
- **Alle `* berechnet mit Tarif …`-Fussnoten entfallen.** Ein Sternchen an der
  Zahl verlinkt auf die Leiste; sie erklärt alle Zahlen der Seite auf einmal.

### 4.2 Navigation

```
┌ EV4U ─ [ 🔍 Marke, Modell oder Stichwort ] ── Verkaufen ─ ♡ 3 ─ ⇄ 2 ─ Konto ▾ ┐
└ Deine Werte  4617 · 27.9 Rp./kWh · 15'000 km/Jahr · Benzin 7.0 l  [Anpassen] ┘
```

- **Suche wird primäres Element** — der offensichtlichste Mangel heute.
- **Zwei Ziele** statt fünf: Kaufen (die Suche/das Logo führt dorthin) und
  Verkaufen. Der Rest ist persönlicher Zustand rechts: Merkliste, Vergleich,
  Konto (mit Nachrichten-Badge).
- **Merkliste kommt in die Navigation** (heute nur Filter-Toggle).
- **Rechenwerk und Vergleich verlassen die Hauptnavigation** — beides sind
  Zustände, keine Ziele.

### 4.3 Routen

| Route | Änderung |
|---|---|
| `/` | Storefront, gestrafft (siehe 5.1) |
| `/inserate` | Suche + Filter-Popover + Raster/Liste-Umschalter |
| `/inserat/[slug]` | Neu geordnet, Kontaktaufnahme als Primäraktion |
| `/verkaufen` | Landing + Erfassung als 3-Schritt-Wizard |
| `/konto` | Tabs: Inserate · Merkliste · Suchen · Nachrichten · Profil |
| `/vergleich` | Bleibt als teilbare URL (`?ids=`), raus aus der Navigation |
| `/rechenwerk` | **Bleibt als URL** (SEO), wird zur Landingpage «Was kostet mich ein E-Auto?» mit Trichter in den Katalog. Raus aus der Hauptnavigation, rein in den Footer. |

---

## 5. Seiten-Blueprints

### 5.1 Home

```
Ein Satz, was EV4U ist.
[ 🔍 Suchfeld                                    ]  oder alle 13 Inserate →
2 Kennzahlen (offene Inserate · Gemeindetarife)     ← «0 Verkaufsdruck» streichen
──────────────────────────────────────────────────
Neu auf EV4U            6 Karten                   → Alle Inserate
──────────────────────────────────────────────────
Wie EV4U rechnet        3 knappe Punkte            ← ersetzt das 4-Karten-Bento
──────────────────────────────────────────────────
Marken-Zeile (bleibt, funktioniert)
Unsicher? Gespräch mit Gabriel   — schmaler Streifen, nicht als vierte Karte
```

### 5.2 `/inserate`

```
Inserate                                            [ ⊞ Raster │ ☰ Liste ]
[ 🔍 Suche                                                                ]
[Karosserie ▾][Marke ▾][Preis ▾][Reichweite ▾][Laden ▾][Anbieter ▾][Mehr ▾]
                                                    Sortieren: [ Preis ▾ ]
7 von 13 · SUV ×  bis 40'000 ×  ≥ 400 km ×  Alle zurücksetzen  [♡ Suche merken]
───────────────────────────────────────────────────────────────────────────
Karten-Raster (Default)
```

- **Filter werden Popover mit Trefferzahl pro Option**, statt der immer offenen
  Konsole, die heute ~200 px über dem Falz kostet.
- **Reichweite und DC-Ladeleistung bekommen echte Filter** — heute kann sie nur
  das Finder-Quiz setzen, was in `InseratePage.tsx:250-278` eine Sonderbehandlung
  («Finder-Chips») erzwingt. Mit echten Filtern verschwindet die Sonderlogik:
  **ein** Chip-Row für alle aktiven Filter.
- **Raster ist Default** (Fotos verkaufen Autos), Liste ist der dichte Modus.
  Heute erzwingt `/inserate` eine 9-Spalten-Tabelle, in der das Foto auf 56×36 px
  schrumpft — während die Startseite dieselben Autos als Fotokarten zeigt.
- **Der E-Auto-Finder bleibt**, aber als sekundärer Einstieg
  («Unsicher? 6 Fragen»), nicht als grüner Primärbutton neben dem Katalog.
- **Leerzustand** wird hilfreich statt witzig: der restriktivste Filter wird
  benannt und einzeln entfernbar angeboten. («Keine Inserate auf diesem Gleis.»
  hilft niemandem.)

### 5.3 `/inserat/[slug]`

```
‹ Inserate
┌───────────────────────────────┬──────────────────────────┐
│                               │ CHF 31'900               │
│      Galerie (2/3)            │ Neupreis 42'990 · −26 %  │
│                               │ ● Verfügbar              │
│                               │                          │
│                               │ [ Verkäufer kontaktieren ]│ ← primär
│                               │ [ ♡ Merken ] [ ⇄ Vgl. ]  │
│                               │ ───────────────────────  │
│                               │ Deine Kosten             │
│                               │ CHF 1'240/Jahr günstiger │
│                               │ als dein Benziner  ↓     │
└───────────────────────────────┴──────────────────────────┘   ← Rail sticky
Tesla Model 3 RWD  + Beschreibung
Technische Daten
Deine Kostenrechnung          ← Engine an Ort und Stelle, ohne «02»-Nummerierung
Verkäufer
Ähnliche Inserate             ← fehlt heute
```

- **Foto zuerst.** Heute steht es an vierter Position.
- **Verkäufer kontaktieren wird Primäraktion** und für *alle* Inserate sichtbar.
- **Die Engine schrumpft**: Gauges → Balkenpaar, der Modell-Disclaimer wird
  aus dem gesperrten Versal-Mono in einen `micro`-Absatz überführt und hinter
  «Wie wir rechnen ▾» geklappt.
- **«Ähnliche Inserate»** hält den Nutzer im Katalog, wenn dieses Auto nicht passt.

### 5.4 `/konto` und `/verkaufen`

- `/konto`: Tabs statt einer 300-Zeilen-Scrollstrecke. Der Foto-Manager wandert
  in die Inserat-Bearbeitung, nicht in die Liste.
- `/verkaufen`: Die Erfassung wird ein 3-Schritt-Wizard (Fahrzeug → Eckdaten →
  Fotos & Preis) mit Live-Vorschau der Inseratskarte. Heute ist es ein flaches
  Formular, dessen Feldbeschriftungen (`JAHRGANG`, `KM-STAND`) in Versal-Mono
  stehen.

---

## 6. Umsetzung in Phasen

| Phase | Inhalt | Wirkung |
|---|---|---|
| **P0** | Tokens in `index.css` + `tailwind.config.js`, `ui.tsx`-Primitive neu, Typo-Regeln | Trägt sich durch alles Weitere durch |
| **P1** | Header + Kontextleiste + Footer; `PlzGate`-Modal entfernen | Löst Problem **C** und **D** |
| **P2** | `/inserate`: Suche, Filter-Popover, Raster/Liste, Kartendesign | Löst den Katalog-Overview |
| **P3** | `/inserat/[slug]`: Reihenfolge, Kontakt-CTA, Engine-Vereinfachung | Löst Problem **E** |
| **P4** | `/konto` Tabs, `/verkaufen` Wizard, Vergleich als Modus | Räumt die Nebenflächen |
| **P5** | Aufräumen: Framer Motion aus statischen Komponenten, Mono aus Labels, `blueprint`/`stamp`/`current-line`/`ruler` löschen | Bundle + Konsistenz |

P0 und P1 zusammen ändern den Gesamteindruck bereits vollständig — der Rest
ist Fläche.

---

## 7. Was bleibt

Nicht alles muss weg. Bewusst behalten:

- **Die Marke Grün.** Nur disziplinierter eingesetzt.
- **Die Tarif-Personalisierung als Kern-Differenzierer.** Sie wird sichtbarer,
  nicht kleiner.
- **Der E-Auto-Finder.** Guter Einstieg für Unentschlossene — nur nicht als
  Konkurrenz zum Katalog.
- **URL-als-Zustand** auf `/inserate` und `/vergleich`. Sauber gelöst, bleibt.
- **Die dichte Tabellenansicht.** Als Liste-Modus, nicht als einzige Ansicht.
- **Der Kostenmodell-Text.** Inhaltlich richtig und ehrlich — er wird nur
  endlich lesbar gesetzt.
