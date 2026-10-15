# EV4U — Concept v3 «Ladestand»

Status: **Draft, reviewed 2026-10-15** (review log in section 11)
Replaces as a target state: `docs/ui-revamp-concept.md` («Klartext», implemented 2026-08).
«Klartext» stays as the record of *why* the current UI looks the way it does.

> From a calculator with listings to a **classifieds platform that knows EVs.**

---

## 0. Summary

«Klartext» fixed readability: mixed case, one accent, a visible context bar.
What it did not do is make EV4U *feel* like a marketplace. Today the site reads
like a well-typeset report about cars: a white page, hairline boxes, a sentence
as the hero, filters hidden in popovers, and the strongest asset (every listing
calculated for *your* municipality) reduced to «≈ 4.07 CHF Strom/100 km» on a
card.

v3 keeps the green and every existing function, and changes three things:

1. **Structure of a marketplace.** Search-first start page with structured
   quick search, a results page with a permanent filter sidebar, a detail page
   with a sticky price/contact box, a mobile tab bar, a real account area with
   sub-pages, and a rich footer. These are the patterns people already know
   from AutoScout24, tutti and Ricardo, so the site needs no explaining.
2. **EV knowledge as the product.** The catalog already holds ~30 fields per
   variant (warranty, 800 V, cell chemistry, towing load, trunk, AC/DC
   charging), and almost none of them reach the buyer. v3 turns that data into
   the answers used-EV buyers actually worry about: *How long is the battery
   still under warranty? How long does it charge at my place? What does it cost
   me per month? What is this model like to live with?*
3. **A design language built on the charge level.** Tinted canvas with white
   cards, bolder prices, icon-led spec rows, and one recurring EV motif: the
   **Ladebalken** (charge bar) for SOH, range and efficiency. Green stays the
   main color, now as a full scale from a deep «Waldgrün» brand surface to an
   electric «Volt» highlight.

---

## 1. What's wrong today (for a marketplace)

| # | Finding | Effect |
|---|---|---|
| A | Hero is a sentence + a free-text box. No Marke/Modell/Preis quick search, no body-type or budget entries. | Visitors with a concrete wish (90 % of car-marketplace traffic) have no fast lane. |
| B | Filters live in 7 popovers above the results. | You can't see what is filtered without opening each one; no room for EV filters. Weak overview. |
| C | The sticky «Deine Werte» bar sits on every page (≈ 40 px) and is abstract for first-time visitors. | Costs space everywhere and explains itself nowhere. |
| D | Cards show year · km · range · seller, price and «Strom/100 km». | Nothing that distinguishes a *used EV*: no SOH, no charging power, no location, no monthly cost. |
| E | The catalog data (warranty, 800 V, LFP, towing, trunk, AC kW, dimensions) is barely shown, and not filterable at all. | The biggest unused asset in the project. |
| F | Merkliste needs a login on the first heart click. | The most common first action of a buyer is blocked by a magic-link e-mail. |
| G | The account area is one page with four tabs. Messages, searches and listings share one URL. | No deep links (an e-mail can't open a conversation), no overview. |
| H | No pages for models, blog, guides, garages, help, or legal (Impressum, Datenschutz, AGB). | Little SEO/GEO surface beyond listings. The legal pages are mandatory before launch. |
| I | Design: white on near-white, hairlines only, no shadows, neutral icons, accent restricted to four jobs. | Calm, but every block weighs the same, so the eye has no landing points. Reads editorial, not "market". |

---

## 2. Principles

1. **Search first, everywhere.** Every page is at most one click from a
   filtered result list. The header search, the hero quick search, the model
   pages and the guides all lead into the same `/inserate` URL state.
2. **The answer on the card.** A buyer should be able to decide from the
   results list alone whether to open a listing. Price, monthly cost, SOH,
   range, charging and distance belong on the card.
3. **EV facts, not EV jargon.** «Lädt an deiner Wallbox in 4 h» instead of
   «AC 11 kW». The kW value is still there, under the plain sentence.
4. **Personal, but optional.** The site works with no input at all (Swiss
   averages, clearly marked). One PLZ makes every number personal. The
   *Fahrprofil* is offered where a number appears, not imposed as a bar.
5. **Honest numbers (kept from v1/v2).** One calculation (`computeCosts`).
   Estimates are labelled as estimates. No ad gets a negative rating.
6. **Every state has a URL.** Filters, compare, conversations, account
   sections, model pages. Shareable, bookmarkable, linkable from e-mails.

---

## 3. Sitemap

```
EV4U
├── /                                Start
├── /inserate                        Search & results (grid · list · map)
├── /inserat/[slug]                  Listing detail
├── /merkliste                       Saved cars, no login needed               NEW
├── /vergleich                       Compare, up to 4, ?ids=a,b,c
├── /finder                          E-Auto-Finder, 6 questions (was a sheet)  NEW ROUTE
│
├── /modelle                         Model guide: all brands                   NEW
│   ├── /modelle/[marke]             Brand: models, stock, price range         NEW
│   └── /modelle/[marke]/[modell]    Model: variants, data, used offers        NEW
│
├── /kosten                          Cost calculator & «Umsteigen» (was /rechenwerk → 301)
│
├── /verkaufen                       Sell: landing for private sellers
│   ├── /verkaufen/neu               Listing wizard (?id= edits an existing one)  NEW ROUTE
│   └── /verkaufen/preis-check       Free valuation                            NEW
│
├── /garagen                         For garages: offer, subscription          NEW
│   └── /garagen/[slug]              Public garage profile + inventory         NEW
│
├── /blog                            Blog: dated posts, featured + categories  NEW
│   ├── /blog/[slug]                 Post (MDX, model boxes, search teasers)   NEW
│   ├── /blog/kategorie/[kategorie]  Category archive                          NEW
│   └── /rss.xml                     Feed                                      NEW
├── /ratgeber                        Guides hub, evergreen                     NEW
│   ├── /ratgeber/[slug]             Guide (Astro content collection)          NEW
│   └── /ratgeber/ladekarten         Charging-card comparison (interactive)    NEW
├── /beratung                        Talk to Gabriel (was a home strip)        NEW ROUTE
│
├── /konto                           Account overview (dashboard)
│   ├── /konto/inserate              My listings + stats                       NEW ROUTE
│   ├── /konto/nachrichten           Inbox, ?c=<conversation>                  NEW ROUTE
│   ├── /konto/suchabos              Saved searches & alerts                   NEW ROUTE
│   ├── /konto/einstellungen         Profile · Fahrprofil · notifications      NEW ROUTE
│   └── /konto/garage                Garages only: profile, leads, plan        NEW
├── /login                           Magic link, ?next=                        NEW ROUTE
├── /admin                           Moderation (admins only)                  NEW ROUTE
│
└── /hilfe · /sicherheit · /ueber-uns · /kontakt · /impressum · /datenschutz · /agb   NEW
```

Notes:

- **Astro static stays.** All new routes are prerendered shells with React
  islands. Account sub-pages are separate static pages; the conversation and
  the listing being edited come from a query parameter (`?c=`, `?id=`), so no
  server is needed.
- **Model pages are prerendered from the catalog** at build time (87 brands,
  357 models). The catalog changes a few times a year; the existing rebuild
  webhook covers it.
- **Renames are cheap now.** The site is pre-launch (demo data), so
  `/rechenwerk → /kosten` costs nothing in SEO. Astro `redirects` keeps old
  links working.
- **Deliberately not built:** brand-filtered SEO listing pages
  (`/inserate/tesla`). The model pages carry that search intent and link into
  `/inserate?marke=…`. Two pages per brand would compete with each other.

### 3.1 Navigation

**Desktop header** (one row, 64 px, no second bar):

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ ⊞ EV4U   Kaufen ▾  Verkaufen ▾  Modelle  Wissen ▾    [🔍 Marke, Modell, Stichwort ] │
│                                         📍 4600 · 27.9 Rp  ♡ 3  ✉ 2  (R)  [+ Inserieren] │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

- **Kaufen ▾** (mega menu): Alle Inserate · Neu eingetroffen · by body type
  (with counts) · by budget · Themen (Grosse Reichweite, Schnelllader,
  Batteriegarantie aktiv, Anhängerkupplung, 7 Sitze) · E-Auto-Finder ·
  Vergleich · Merkliste.
- **Verkaufen ▾**: Inserat aufgeben · Gratis Preis-Check · Für Garagen ·
  Meine Inserate.
- **Modelle**: the model guide. **Wissen ▾**: Blog (latest posts) ·
  Ratgeber · Kostenrechner · Ladekarten · Beratung.
- **Fahrprofil chip** (`📍 4600 · 27.9 Rp`) replaces the sticky context bar.
  It opens the same sheet (`ContextSheet`) as today. First visit:
  `📍 PLZ für echte Kosten`.
- **+ Inserieren** is the one green button in the header. It is the classic
  classifieds CTA and the clearest signal that this is a marketplace.

**Mobile**: compact top bar (logo · search icon · Fahrprofil chip) plus a
**bottom tab bar**, the standard pattern of classifieds apps:

```
┌────────┬──────────┬────────────┬─────────────┬────────┐
│ 🔍     │ ♡ 3      │  ⊕         │ ✉ 2         │ (R)    │
│ Suchen │ Merkliste│ Inserieren │ Nachrichten │ Konto  │
└────────┴──────────┴────────────┴─────────────┴────────┘
```

**Footer**: dark «Waldgrün» surface, five link columns (Kaufen · Verkaufen ·
Top-Modelle · Wissen · EV4U), RSS link, data sources line (ElCom period, BFS fuel
price, catalog edition), legal links, theme toggle.

---

## 4. Pages

### 4.1 Start `/`

Job: get a buyer into a filtered list in one step; show the stock; explain the
USP by letting people *try* it; recruit sellers.

```
┌ HERO, deep green surface ────────────────────────────────────────────────────┐
│  Gebrauchte E-Autos in der Schweiz.                                          │
│  Durchgerechnet für deine Gemeinde.                                          │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ [Marke ▾] [Modell ▾] [Preis bis ▾] [Reichweite ab ▾] [PLZ · Umkreis]     │ │
│ │                                                 [ 26 Angebote anzeigen ] │ │
│ │ ✨ Oder beschreib es: «Familien-SUV bis 40'000 mit Anhängerkupplung»       │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│  26 Inserate · 87 Marken im Katalog · 2'124 Gemeindetarife                   │
└──────────────────────────────────────────────────────────────────────────────┘
Karosserie   [Kleinwagen 6] [Limousine 5] [Kombi 4] [SUV 11] [Van/7 Sitze 2]
Budget       [bis 15'000] [15–25'000] [25–40'000] [über 40'000]
Themen       [500+ km] [Schnelllader 150+ kW] [Garantie aktiv] [AHK] [V2L]
──────────────────────────────────────────────────────────────────────────────
Neu eingetroffen                                            Alle Inserate →
[card] [card] [card] [card]                       (horizontal scroll on mobile)
──────────────────────────────────────────────────────────────────────────────
┌ USP, interactive ────────────────────────────────────────────────────────────┐
│ Was kostet dich ein E-Auto wirklich?      PLZ [ 4600 ]  km/Jahr [ 15'000 ]   │
│ → Olten: 27.9 Rp./kWh · 1'420 CHF/Jahr weniger als dein Benziner*            │
│   (Sets the Fahrprofil. Every card on the site recalculates.)               │
└──────────────────────────────────────────────────────────────────────────────┘
Warum EV4U     4 tiles: Batteriegarantie · Echte Kosten · Geprüfte Garagen · Schweizer Daten
Beliebte Modelle   6 tiles from the model guide: «ab CHF 22'900 · 4 Angebote»
┌ SELL ───────────────────────────────────────────────────────────────────────┐
│ Dein E-Auto verkaufen: gratis, an Leute, die E-Autos suchen.                 │
│ Mini Preis-Check [Marke][Modell][Jahr][km] → «Schätzung anzeigen»            │
└──────────────────────────────────────────────────────────────────────────────┘
Aus dem Blog   3 latest posts                Beratung   Gabriel strip (kept)
```

- The quick search writes the same URL parameters as the results sidebar
  (`lib/filters.ts`). The button shows the live hit count.
- The AI search (`suche` Edge Function) moves *into* the quick-search card as
  a second line, with the same fallback behaviour as today.
- Brand index (`BrandIndex`) moves to `/modelle` and the Marke dropdown, where
  it is more useful than a row of names with counts.

### 4.2 Results `/inserate`

Job: overview and narrowing. This page gets the biggest structural change.

```
Start › Inserate › Tesla
Tesla Occasionen — 12 Angebote                 [🔔 Suchabo speichern]
┌ FILTER (sticky, 288 px) ─┐ ┌─────────────────────────────────────────────────┐
│ 🔍 Stichwort              │ │ Tesla × · bis 40'000 × · SOH ≥ 90 % × Zurücksetzen│
│ ▾ Fahrzeug               │ │ Sortieren [Neueste ▾]          [▦ Raster|☰ Liste|🗺]│
│   Marke / Modell / Var.  │ ├─────────────────────────────────────────────────┤
│   Karosserie   ☐ SUV (11)│ │ [card]  [card]  [card]                          │
│   Sitze                  │ │ [card]  [card]  [card]                          │
│ ▾ Preis & Kosten         │ │ ┌ Tip (only without Fahrprofil) ─────────────┐ │
│   Preis  [——●———]        │ │ │ PLZ eingeben → Monatskosten für deinen Ort │ │
│   Monatlich bis          │ │ └─────────────────────────────────────────────┘ │
│ ▾ Zustand                │ │ [card]  [card]  [card]                          │
│   Jahrgang · km · MFK    │ │ ┌ Suchabo CTA after row 3 ─────────────────────┐ │
│ ▾ Batterie & Reichweite  │ │ │ 🔔 Neue Tesla bis 40'000 per E-Mail erhalten │ │
│   Reichweite (WLTP)      │ │ └─────────────────────────────────────────────┘ │
│   SOH ab                 │ │ [ Weitere 24 laden ]                            │
│   Batteriegarantie aktiv │ └─────────────────────────────────────────────────┘
│ ▾ Laden                  │
│   DC ab · 800 V · AC 22  │   Nothing found? → name the narrowest filter,
│   V2L / V2G              │   offer to drop it, offer a Suchabo. (kept)
│ ▾ Alltag                 │
│   AHK · Kofferraum ab    │
│   Allrad · Wärmepumpe    │
│ ▾ Anbieter & Ort         │
│   Privat/Garage · Umkreis│
│ Unsicher? → Finder       │
└──────────────────────────┘
```

- **Sidebar, always visible on desktop**: you see the whole filter state at a
  glance, every option shows its hit count (the facet logic in
  `lib/filters.ts` already does this). On mobile the sidebar is a full-height
  sheet behind a sticky bottom bar: `[Filter (3)] [Sortieren] [🔔]`.
- **New filters from data we already have** (catalog-linked listings):
  SOH minimum, 800 V, AC 22 kW, towing load, trunk volume, AWD, cell
  chemistry (LFP), 0–100. «Batteriegarantie aktiv» comes with the seller's
  warranty fields (F1); MFK, heat pump, winter tyres… come with F11.
- **New sorts**: Neueste (default), Preis, Monatskosten, Reichweite, km,
  Entfernung.
- **Map view** (F9) as a third mode next to grid and list.
- **Dynamic H1 and breadcrumb** from the filter state («Tesla Model Y
  Occasionen»), for orientation and SEO.
- **Scale note:** filtering stays client-side up to ~1–2k listings (it is
  today). Beyond that, move to a Supabase RPC with pagination and facet
  counts. The URL contract doesn't change.

**Card anatomy** (grid):

```
┌────────────────────────────────────┐
│ [Neu] [🛡 Garantie bis 2031]  ♡  ⇄ │
│                                    │
│              photo 4:3        📷 8 │
├────────────────────────────────────┤
│ Tesla Model Y                      │
│ Long Range AWD · 2023 · 41'000 km  │
│ ⚡ 533 km   ▰▰▰▰▰▰▰▰▰▱ SOH 94 %     │
│ ⏱ DC 250 kW · 10–80 % in 27 min    │
│                                    │
│ CHF 36'900          ≈ CHF 144/Mt.  │
│ 📍 Olten · 12 km     Privat        │
└────────────────────────────────────┘
```

**List view row**: 200 px photo · title/variant · four icon facts in a
column · SOH bar · price + monthly · location. Same data, denser.

### 4.3 Listing `/inserat/[slug]`

Job: answer every pre-contact question on one page, then make contact easy.

```
‹ Zurück zu den Ergebnissen     Start › Inserate › Tesla › Model Y
┌──────────────────────────────────────────┐ ┌ STICKY BOX ─────────────────┐
│                                          │ │ Tesla Model Y               │
│        Gallery (lightbox, 1/8)           │ │ Long Range AWD              │
│                                          │ │ CHF 36'900                  │
│ [thumb][thumb][thumb][thumb][+4]         │ │ Neupreis 57'990 · −36 %     │
└──────────────────────────────────────────┘ │ ≈ CHF 144/Mt. für dich →    │
┌ KEY FACTS ────────────────────────────────┐│                             │
│ 📅 03/2023 │ 🛣 41'000 km │ ⚡ 533 km WLTP │ │ [ Nachricht senden ]        │
│ 🔋 75 kWh · SOH 94 % │ ⏱ 250 kW │ AWD 378 kW│ │ [ Probefahrt anfragen ]     │
└───────────────────────────────────────────┘│ ♡ Merken  ⇄ Vergleichen  ↗  │
Übersicht · Batterie · Alltag · Laden · Kosten · Ausstattung · Anbieter     │ ─────────────── │
                                             │ M. Odermatt · Privat        │
§ Beschreibung (seller text)                 │ ✓ Telefon bestätigt         │
§ Batterie & Garantie (F1)                   │ Antwortet meist < 2 h       │
  SOH bar (seller's figure) · usable kWh now │ 📍 4600 Olten · 12 km       │
  Battery warranty, entered by the seller:   └─────────────────────────────┘
  «bis 03/2031 oder 192'000 km, min. 70 %»
  Cell chemistry (catalog): «NMC — täglich bis 80 % laden»
§ Alltag (catalog)  trunk + frunk · towing · length × width · seats · V2L
§ Laden (F5)  «An deiner Wallbox (11 kW): 20→80 % in 4 h 05»
              «Schnelllader: 10→80 % in 27 min · 400 V»
              Typ-2/CCS · V2L ✓ · Ladestationen nahe deiner PLZ (F10)
§ Kosten — EngineCore as today (vs. your current car) + financing (F4)
§ Ausstattung & Zustand (F11): checklist with ✓/✗/—
§ Technische Daten: full catalog spec table, collapsible groups
§ Das Modell: link to /modelle/tesla/model-y, other variants, list price
§ Ähnliche Inserate (kept) + «Suchabo für Model Y»
Footer of page: Inserat-Nr. · online seit · 34× gemerkt · Inserat melden · Sicherheitstipps
```

- **Sticky box** carries price, monthly cost, both CTAs, save/compare/share
  and the seller trust summary. On mobile it becomes a sticky bottom bar:
  `CHF 36'900 · [Nachricht]`.
- **Anchor tabs** under the key facts make a long page navigable. The tabs
  sit sticky under the header.
- **Contact with intent** (F14): the message sheet opens with chips («Ist das
  Auto noch verfügbar?», «Probefahrt», «Frage zur Batterie»,
  «Preisvorschlag») that pre-fill the text. Same messaging backend.
- **Demo listings** keep the badge, the note and no contact form (as today).

### 4.4 Compare `/vergleich`

- Up to **4** cars (was 3); sticky header row with photo, price and remove.
- Grouped rows: Preis & Kosten · Batterie · Reichweite · Laden · Alltag
  (trunk, towing, seats) · Ausstattung.
- **Best value per row highlighted** in green (highest range, fastest
  charge, lowest monthly cost). Toggle «Nur Unterschiede».
- `?ids=` sharing and adoption into your own tray: kept.

### 4.5 Merkliste `/merkliste` (new route)

- **Works without login** (F15): stored locally, merged into the account on
  login. `AccountSync` already does this for the Fahrprofil (home PLZ,
  current car); the Merkliste gets the same treatment.
- Each saved car shows **what changed since you saved it**: «Preis −1'500»,
  «Reserviert», «Verkauft».
- Personal note per car. Select 2–4 → «Vergleichen».
- Logged-out banner: «Melde dich an, um die Merkliste auf allen Geräten zu
  haben und bei Preisänderungen eine E-Mail zu bekommen.»

### 4.6 Model guide `/modelle` (new)

- **`/modelle`**: brand grid with logo initials, number of models, used offers
  in stock. Search field. Filter: «nur mit Angeboten».
- **`/modelle/[marke]`**: models grouped by availability (current · no longer
  sold new · announced), each with segment, range span, list-price span,
  offers in stock.
- **`/modelle/[marke]/[modell]`**:
  - Header: name, segment, body type, years on sale, «12 Occasionen ab CHF
    28'900 →», `[🔔 Suchabo für dieses Modell]`.
  - Variants table: battery net, power, drive, WLTP range, DC peak +
    10–80, AC, 0–100, list price.
  - Everyday data: trunk/frunk, towing, dimensions («passt in eine Garage ab
    4.80 m»), seats, V2L.
  - Battery: chemistry, voltage, and the manufacturer's warranty terms as
    published. A used listing shows the seller's own warranty entry instead.
  - Running costs for this model with your Fahrprofil.
  - Used offers (cards), related models (same segment, similar price).
  - JSON-LD (`Car` / `ProductModel`), canonical, OG. **The largest SEO and
    GEO surface on the site**: 357 pages that answer «Tesla Model Y
    Reichweite», «Enyaq Anhängelast», «ID.4 Batteriegarantie».

### 4.7 Costs `/kosten` (was `/rechenwerk`)

- «Was kostet mich ein E-Auto?»: the existing engine with the Fahrprofil.
- New **Umsteigen mode** (F16): start from your current car (already in the
  Fahrprofil) → «Diese 9 Inserate kosten dich pro Monat weniger als dein
  Golf» → link into `/inserate?sort=monatlich&…`.
- Method section (kept text, collapsed): ElCom, BFS, cantonal tax, what is
  not included.

### 4.8 Sell `/verkaufen`, `/verkaufen/neu`, `/verkaufen/preis-check`

**Landing `/verkaufen`**: hero «Verkauf dein E-Auto an Leute, die E-Autos
suchen» + `[Inserat aufgeben]` + mini Preis-Check · 3 steps · what buyers see
(a real card + listing preview) · pricing (as today) · FAQ · link to
`/garagen`.

**Wizard `/verkaufen/neu`** (full-screen, minimal header, autosaves as
ENTWURF; `?id=` reuses it for editing, which replaces the separate
`ListingEditor` sheet):

| Step | Content | Data |
|---|---|---|
| 1 Fahrzeug | Catalog picker Marke → Modell → Variante (kept) | catalog |
| 2 Zustand | First registration, km, MFK date, accident-free, owners, service book, warranty | **new fields** |
| 3 Batterie | SOH (as today) + battery warranty: valid until (month/year), until km, guaranteed capacity. All optional, entered by the seller | **new fields** |
| 4 Ausstattung | Checklist: heat pump, tow hitch, winter tyres, charging cables (Typ 2 / Mode 2), panorama roof, assist, colour | **new fields** |
| 5 Fotos | Guided shot list (front, rear, side, interior, **cockpit with range/SOH**, charge port), drag to reorder, max raised to 20 | storage |
| 6 Preis | Preis-Check suggestion (F8) with method, «Verhandlungsbasis» toggle | model |
| 7 Vorschau | Card + detail preview, contact options, publish | — |

A side panel shows **Inserat-Qualität** (0–100 %) with the next best action:
«+12 %: Foto vom Ladeanschluss», «+15 %: Batteriegarantie angeben».
Listings with a higher score rank higher in «Neueste» ties.

**`/verkaufen/preis-check`**: Marke/Modell/Variante, year, km, SOH → price
range with method and comparable listings. Lead magnet: «Jetzt inserieren —
die Daten sind schon ausgefüllt».

### 4.9 Garages `/garagen`, `/garagen/[slug]`, `/konto/garage`

- **Landing**: subscription offer, what's included, contact form.
- **Public profile**: name, logo, address + map, opening hours, UID-verified
  badge (Zefix), response time, inventory as the results component pre-filtered
  to this garage.
- **Garage cockpit** (in the account): views/contacts/saves per listing,
  lead list with export (CSV), profile editor. Later: inventory feed import.

### 4.10 Wissen: Blog, Ratgeber, Beratung

Two kinds of content, each an Astro content collection (MDX in the repo,
published with a push like everything else):

| | Blog `/blog` | Ratgeber `/ratgeber` |
|---|---|---|
| Kind | Dated posts: market, models, energy, policy, stories | Evergreen how-tos, updated in place |
| Examples | Marktbericht Oktober 2026 · Stromtarife 2027: was Laden zuhause kostet · Verkehrssteuer 2027 nach Kanton · Kia EV3 als Occasion · Ein Jahr mit dem ID.3 | Occasion-E-Auto prüfen (checklist) · SOH erklärt · Laden im Mietshaus · Ladekarten · Verkaufen: die besten Fotos |
| Cadence | 2–4 posts per month | Launch set of 5–6, then as needed |
| Organised by | Date and category | Topic |

**`/blog`**: featured post on top, category chips (Marktbericht · Neue
Modelle · Laden & Energie · Politik & Förderung · Erfahrungen), post cards
with cover, category, date and reading time, a «Monatsbrief» sign-up box
and «Meistgelesen». Prerendered category archives under
`/blog/kategorie/[kategorie]`, plus `/rss.xml`.

**`/blog/[slug]`**: category, title, date · reading time · author, a table
of contents for longer posts, prose at ~68ch. Two MDX embeds make every post
lead into the marketplace:

- `<ModelBox model="kia_ev3" />`: the model with its key data and «4
  Angebote ab CHF 31'900 →» (live count, links into `/inserate`).
- `<SearchTeaser filter="seg=SUV&preis=40000" />`: a pre-filtered search with
  hit count and «Suchabo speichern».

Posts can be personal too: the tariff post reads the Fahrprofil and shows
the reader's own municipality. Every post ends with matching listings,
related posts and the Monatsbrief box.

Frontmatter: `title`, `description`, `date`, `updated`, `category`, `tags`,
`cover`, `models` (catalog slugs → related listings), `author`. JSON-LD
`BlogPosting`, OG image per post (F18). Needs `@astrojs/mdx`.

**What only EV4U can write:**

- a monthly **Marktbericht** from our own listings (asking prices by model,
  new listings, time to sale, most-saved cars), once stock allows it;
- the yearly **Stromtarife** post when ElCom publishes the new municipal
  tariffs (early September), with the change computed for each reader's PLZ.

**Monatsbrief** (newsletter, F21): one e-mail a month with the Marktbericht,
new posts and price drops on your Merkliste. Double opt-in (revDSG), same
Resend setup as the search alerts (F7).

Also in Wissen:

- **`/ratgeber/ladekarten`**: interactive comparison built on `CARD_COMBOS`,
  the same data the cost model uses.
- **`/beratung`**: Gabriel, slots, what the conversation covers (the
  `bookings` insert, kept).
- Every post and guide ends in a filtered search or a tool, never a dead end.
- A CMS (Keystatic, Decap) only pays off once someone who doesn't use git
  writes posts. The collections stay the same either way.

### 4.11 Account `/konto/*`

```
/konto  Übersicht
┌ Meine Inserate ────┐ ┌ Nachrichten ───────┐ ┌ Suchabos ──────────┐ ┌ Merkliste ─────────┐
│ 2 aktiv · 1 Entwurf│ │ 3 ungelesen        │ │ 2 Abos · 5 neu     │ │ 6 · 1 Preis gesenkt│
│ 412 Aufrufe / 7 T. │ │ «Ist der noch da?» │ │ Tesla bis 40k (3)  │ │                    │
└────────────────────┘ └────────────────────┘ └────────────────────┘ └────────────────────┘
Next step for you: «Dein Entwurf ID.3 ist zu 60 % fertig → weiter»
```

- **`/konto/inserate`**: table with photo, status (Aktiv · Reserviert ·
  Verkauft · Pausiert · Entwurf), days left, views/contacts/saves, Inserat-
  Qualität, actions (bearbeiten → wizard, Fotos, Status, Boost).
- **`/konto/nachrichten`**: two panes on desktop (conversation list | thread),
  listing context header in the thread (photo, price, status), quick replies,
  **safety banner** when a message contains typical scam patterns
  (Vorauszahlung, Kurier, Western Union). `?c=` deep link from the e-mail
  notification.
- **`/konto/suchabos`**: saved searches with new-hit count, frequency
  (sofort · täglich · wöchentlich · aus), rename, open, delete.
- **`/konto/einstellungen`**: Profil (name, phone + verification, seller
  type) · **Fahrprofil** (the same five inputs, plus «Laden zuhause» kW) ·
  notifications (Suchabos, Merkliste, Monatsbrief) · theme · delete account.
- **`/login`**: one magic-link page with `?next=` instead of inline prompts
  scattered over components.

### 4.12 Trust, help, legal

- `/sicherheit`: safe buying/selling (no advance payment, test drive with ID,
  MFK, payment at handover), linked from every message thread.
- `/hilfe`: FAQ grouped by Kaufen/Verkaufen/Konto/Kosten.
- `/impressum`, `/datenschutz` (revDSG), `/agb`: **required before launch.**
- `/ueber-uns`, `/kontakt`.
- `/admin`: moderation queue (reports, new listings of new sellers), listing
  search, user roles, catalog edition. Replaces the `AdminPanel` embedded in
  the account.

---

## 5. New functionality

Ranked by value for a used-EV buyer or seller. **Data** says what already
exists: ✓ = in the catalog/listings today, ◐ = partially, ✗ = needs new
data/backend.

### 5.1 Top five

After the review on 2026-10-15 (section 11).

| # | Feature | What it does | Why it's worth it | Data | Effort |
|---|---|---|---|---|---|
| **F1** | **Batteriegarantie im Inserat** | The seller enters the battery warranty next to the SOH: valid until (month/year), until km, guaranteed capacity if known. All optional. Shown as «Garantie bis 2031» on the card, in the Batterie block on the listing, and as the filter «Batteriegarantie aktiv». Cell-chemistry advice (LFP vs NMC) comes from the catalog. | How long the battery is still covered is one of the first questions about a used EV. Three optional fields in the sell form answer it. | ✗ 3 listing fields | S |
| **F4** | **Monatskosten alles inkl.** | One monthly number per card: energy (your tariff) + maintenance + cantonal tax (all exist) + optional financing (deposit, term, rate) + insurance estimate. Sort and filter by it. | Turns the USP from a detail-page module into **the browsing currency**. «CHF 144/Mt.» is how people actually budget. | ◐ model ✓, financing/insurance ✗ | M |
| **F7** | **Suchabo + Preisalarm** | E-mail alerts for saved searches (sofort/täglich/wöchentlich) and for Merkliste changes (price drop, reserved, sold). Price history per listing. | The retention engine of every classifieds site. Saved searches already exist; only the sending is missing. Same Resend setup as message notifications. | ◐ saved_searches ✓, cron/history ✗ | M |
| **F6** | **Modell-Lexikon** | 357 prerendered model pages from the catalog (see 4.6). | Biggest SEO/GEO lever; lets buyers research *and* subscribe to a model nobody offers yet. | ✓ | M |
| **F17** | **Blog + Ratgeber** | Dated posts (Marktbericht, neue Modelle, Laden & Energie, Politik & Förderung, Erfahrungen) next to evergreen guides. Posts embed model boxes and pre-filtered searches (see 4.10). | Timely posts are what search engines and AI answers pick up. A monthly Marktbericht from our own listings is something only EV4U can publish. | ✓ content collections | S–M |

### 5.2 Marketplace standards (expected, currently missing)

| # | Feature | Notes | Data | Effort |
|---|---|---|---|---|
| F5 | **Ladezeiten persönlich** | «Laden zuhause» in the Fahrprofil (Steckdose 2.3 · Wallbox 11 · 22 kW) → charge times per listing; 800 V badge. | ✓ ac/dc/voltage | S |
| F9 | **Umkreissuche + Karte** | Bake PLZ → coordinates (swisstopo AMTOVZ, the source the tariff script already reads). Distance on every card, radius filter, map view (MapLibre + swisstopo vector tiles, free). | ◐ | M |
| F11 | **Zustand & Ausstattung** | Structured fields: MFK date, accident-free, owners, service book, warranty, heat pump, tow hitch, winter tyres, cables, colour. Filters + checklist on the detail page. | ✗ schema | M |
| F14 | **Anfrage mit Absicht** | Intent chips + preferred test-drive slots in the contact sheet; sellers get structured leads. | ✓ messaging | S |
| F15 | **Merkliste ohne Login** | Local-first, merged on login, change indicators, notes. | ✓ | S |
| F13 | **Vertrauen & Sicherheit** | Report listing (write-only `reports`, auto-hide at N), phone verification (Supabase phone OTP), Zefix UID check for garages, scam-pattern banner in chat, response-time badge. | ✗ | M |
| — | **Legal pages** | Impressum, Datenschutz, AGB. | — | S |

### 5.3 Growth & revenue

| # | Feature | Notes | Effort |
|---|---|---|---|
| F8 | **Preis-Check** | Sellers: suggested range in the wizard + standalone page (lead magnet). Buyers: neutral market context on the detail page («im Rahmen von 9 vergleichbaren Angeboten»), never a red «too expensive». Starts model-based (list price × age/km/SOH curve), switches to comparables once stock allows. | M–L |
| F12 | **Garagen-Profile & Cockpit** | Public profiles, lead stats, export, later feed import (AutoScout-compatible CSV). The subscription product. | L |
| F10 | **Laden in deiner Nähe** | BFE open data on public charging points (data.geo.admin.ch, incl. live status): «18 Ladepunkte in 3 km, 4 davon ≥ 150 kW». Reassures tenants without a wallbox and calibrates the Lade-Mix default. | M |
| F16 | **Umsteigen-Modus** | `/kosten` starts from your current car and ends in a list of listings that are cheaper per month. | S |
| F20 | **Ladekarten-Vergleich** | Interactive card comparison on `CARD_COMBOS`, the cost model's own data. | S |
| F21 | **Monatsbrief** | Monthly newsletter: Marktbericht, new posts, Merkliste price drops. Double opt-in. | S |
| F18 | **Share cards** | Designed OG image per listing, model page and post (build-time, satori). Already in the backlog. | S–M |
| F19 | **Payments** | Stripe Checkout for Boost and the garage plan (backlog #4). | M |

---

## 6. Design language «Ladestand»

### 6.1 Direction

From «calm report» to **«clear market with an electric pulse»**:

- **Tinted canvas, white cards.** The page is a light grey-green; cards are
  white with a soft shadow on hover. Content groups stand out without
  hairlines everywhere. This is the classic classifieds look and the biggest
  single change in perceived structure.
- **Deep green brand surfaces** (hero, footer, sell CTA, garage banner) give
  the site a recognisable identity instead of «white page + green button».
- **The Ladebalken motif**: a 10-segment bar used consistently for SOH, range
  (relative to the best in the segment), and charge progress. One EV-native
  visual that makes cards scannable and is ours.
- **Icons carry facts.** Every spec on a card or key-facts strip has an icon
  (lucide, already installed): calendar, road, bolt, battery, timer, pin.
  Icons stay neutral grey; green is reserved for state and action.
- **Prices are the loudest text** on any card (700 weight, tabular).

### 6.2 Colour

Green stays the primary. It grows from one accent into a scale:

| Token | Light | Dark | Use |
|---|---|---|---|
| `green-950` «Waldgrün» | `#062A19` | `#0D2619` | Hero, footer, brand panels (lifted in dark so it still reads as a surface) |
| `green-700` | `#0B6236` | `#2FBF72` | Primary hover |
| `green-600` **primary** | `#0F7A43` | `#3BD683` | Buttons, links, active, focus (unchanged) |
| `volt` | `#3BD683` | `#5BE89A` | Highlights on dark surfaces, «Neu» badge |
| `bar` | `#1A9E58` | `#3BD683` | Ladebalken fill (volt fails 3:1 non-text contrast on white) |
| `green-100` | `#DDF3E6` | `#143826` | Positive badges, selected filter chips |
| `green-50` | `#EEF8F2` | `#0F2118` | Tip boxes, hover rows, monthly-cost box |
| `canvas` | `#F3F5F2` | `#0B0D0C` | Page background (was `#FBFBFA`) |
| `surface` | `#FFFFFF` | `#151816` | Cards, header, sidebar |
| `surface2` | `#F7F8F6` | `#1C1F1D` | Inputs, photo placeholders |
| `line` | `#E3E7E2` | `#272B28` | Dividers |
| `fg` / `fg2` / `fg3` | `#121613` / `#4E5650` / `#6B736D` | `#EEF1EE` / `#A3ABA5` / `#858D87` | Text |
| `caution` | `#A86200` on `#FFF3DC` | `#E8A93E` | Reserviert, Schätzung, Preis gesenkt |
| `danger` | `#B42318` | `#F0776C` | Errors, report, destructive |

Rules: one green button per view; `volt` never as text on light backgrounds
(contrast); savings and «best value» may be green (kept from v2); every pair
checked for WCAG AA.

### 6.3 Type

- **Archivo stays** (one family, already loaded), weights 400/500/600/**700**
  (700 added for prices and the hero).
- Scale gets one step bigger at the top: hero 48/52 (desktop), page title
  32/38, section 22/28, card title 17/24, body 15/24, small 13/20, micro
  11/16. Tabular figures for every number (kept).
- Uppercase stays limited to the eyebrow (kept).

### 6.4 Shape, depth, motion

- Radius: cards 12 px, inputs/buttons 10 px, chips **pill** (999 px), images
  inside cards inherit the top radius.
- Shadow: `e1` (cards at rest: none on canvas, border only in dark) ·
  `e2` hover `0 6px 20px -8px rgb(6 42 25 / .18)` · `e3` overlays (kept).
- Motion: as v2 (no entrance theatre, numbers never animate). New: card
  hover lifts 2 px. The Ladebalken is static: a bar that animates in starts
  from a wrong value, the same reason v2 dropped the count-up.

### 6.5 Components (new or reworked in `ui.tsx`)

`ChargeBar` (Ladebalken) · `SpecItem` (icon + value + label) · `KeyFacts`
strip · `FilterSidebar` + `FilterGroup` (accordion with counts) ·
`QuickSearch` (hero) · `ListingCard` v3 + `ListingRow` · `StickyBuyBox` ·
`SectionTabs` (anchor nav) · `BatteryBlock` · `ChargeTimes` · `PostCard` ·
`ModelBox` · `SearchTeaser` · `TrustBadge` (Telefon bestätigt, Garage geprüft) · `MegaMenu` ·
`BottomTabBar` · `FahrprofilChip` · `StatCard` (account dashboard) ·
`Stepper` (wizard) · `QualityMeter` · `EmptyState` (kept).

---

## 7. Every existing function, and where it lives in v3

| Today | v3 |
|---|---|
| Header search with catalog suggestions (`SearchBox`) | Header + hero quick search (kept logic) |
| AI search (`suche` Edge Function, chips) | Second line of the hero quick search + results header |
| Filter popovers with hit counts, URL state | Filter sidebar (desktop) / sheet (mobile), same `lib/filters.ts` |
| Grid / list view | Grid · list · **map** |
| Save search | «Suchabo speichern» + `/konto/suchabos` with alerts |
| E-Auto-Finder (sheet on `/inserate`) | `/finder` route, linked from home, Kaufen menu, sidebar |
| Merkliste (login, `?fav=1`) | `/merkliste`, local-first; `?fav=1` redirects |
| Vergleich (3, `?ids=`, tray) | `/vergleich` up to 4, tray kept |
| «Deine Werte» context bar + sheet | Fahrprofil chip + same sheet + `/konto/einstellungen` |
| `/rechenwerk` | `/kosten` (301) + Umsteigen mode |
| `EngineCore` on detail | Detail «Kosten» section (kept) + financing |
| Contact seller, inbox, unread badge, e-mail notify | Sticky box CTA + `/konto/nachrichten?c=` + header badge |
| `ListingEditor` sheet, `PhotoManager` | Wizard in edit mode `/verkaufen/neu?id=` |
| `VehiclePicker` | Wizard step 1 (kept) |
| `ProfilePanel` | `/konto/einstellungen` |
| `AdminPanel` | `/admin` |
| Gabriel consult strip, `bookings` | `/beratung` + teaser on home/detail |
| `BrandIndex` | `/modelle` + Marke dropdown |
| Dark mode toggle | Account menu + footer |
| Demo badge / no contact / noindex | Kept |
| 404 fallback for listings newer than the build | Kept |
| JSON-LD, sitemap, llms.txt | Kept + model pages + guides |

Nothing is removed. The sticky context bar is the one surface that goes away;
its function moves into the header chip.

---

## 8. Data model additions (for later phases)

| Change | For |
|---|---|
| `listings`: `battery_warranty_until` (date), `battery_warranty_km`, `battery_warranty_soh_pct`, all optional, entered by the seller | F1 |
| `listings`: `mfk_date`, `accident_free`, `owners`, `service_book`, `warranty_until`, `equipment jsonb` (heat pump, tow hitch, winter tyres, cables, colour…) | F11 |
| `listing_price_history` (listing, price, changed_at), trigger on price update | F7, Merkliste changes |
| `listing_stats` (views, contacts, saves per day) via an RPC | Account, garages |
| `saved_searches`: `frequency`, `last_notified_at` · pg_cron + Edge Function | F7 |
| `reports` (write-only, like `bookings`) + auto-hide | F13 |
| `profiles`: `phone_verified_at`, `response_time_min` (derived) | F13 |
| `garages` (slug, UID, verified_at, address, hours, logo) | F12 |
| Baked `plzCoords.json` (from swisstopo, like `tariffs.json`) | F9 |
| Cost model: financing + insurance estimate in `costModel.ts` (still one calculation) | F4 |
| `src/content/blog`, `src/content/ratgeber` (Astro content collections, MDX) | F17 |
| `newsletter_subscribers` (e-mail, confirmed_at, token), write-only like `bookings` | F21 |

---

## 9. Roadmap

| Phase | Scope | Result |
|---|---|---|
| **P1 Fundament** | Tokens v3 + `ui.tsx` components · header with mega menu, Fahrprofil chip, mobile tab bar · footer · start page · results with sidebar + card v3 · detail page restructure (sticky box, key facts, section tabs). No schema change. | The site *looks and navigates* like a marketplace. |
| **P2 EV-Mehrwert & Inhalte** | Battery warranty fields (seller-entered) on card, listing and filter; chemistry note; charge times; monthly cost on cards (energy/tax/maintenance); new catalog filters; `/modelle` pages; `/blog` + `/ratgeber` with the first posts; `/merkliste` local-first; compare up to 4. | The differentiators, and the content that needs time to rank. |
| **P3 Konto & Verkaufen** | `/konto/*` sub-pages + dashboard, `/login`, wizard v2 with new fields (F11) + photo guide + quality meter, `/admin`, legal pages. | Sellers produce better listings; buyers can filter on condition. |
| **P4 Bindung** | Suchabo e-mails, price history + Preisalarm, Umkreissuche + map, contact intents. | People come back. |
| **P5 Wachstum** | Preis-Check, Ladekarten, Laden in deiner Nähe, Monatsbrief, garages (profiles, cockpit), financing/insurance partners, payments, share cards. | Revenue and reach. |

P1 alone changes the overall impression. P2 is where EV4U becomes clearly
better than a generic car marketplace for EVs.

---

## 10. Open decisions

1. **Context bar → header chip.** Recommended. It frees ~40 px on every page,
   and the Fahrprofil gets offered where numbers appear. The trade-off: the
   assumptions are no longer *always* in view, so each personal number links
   to the chip.
2. **Merkliste without login.** Recommended. It reverses a deliberate v2
   decision («the list only exists on the account») in favour of conversion.
3. **Monthly cost on cards before financing/insurance exist.** Show «Betrieb
   ≈ CHF 140/Mt.» (energy + tax + maintenance) in P2, then switch to «alles
   inkl.» once financing is in. Or wait and launch both together.
4. **Route names.** `/kosten`, `/modelle`, `/ratgeber`, `/garagen` as
   proposed, or keep `/rechenwerk` as the brand name of the calculator?
5. **Partner choices** for financing and insurance: business decisions
   that the «alles inkl.» monthly cost depends on, not design ones.

---

## 11. Review log

**2026-10-15**, first review of the feature list:

- **F1**: no trust levels (seller's figure · report · partner check). The
  battery warranty matters, and the **seller enters it**. Nothing is
  computed from the catalog.
- **F4** monthly cost on cards: confirmed.
- **F2/F3** realistic range and the trip check: **dropped**.
- **F7** search alerts and price alerts: confirmed.
- **F6** model guide: confirmed. A **blog** joins the guides (F17,
  section 4.10).
