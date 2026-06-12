# EV4U — Der Schweizer E-Auto-Marktplatz

> **The Future is electric.**

EV4U is a **classifieds platform** for EVs — private second-hand sellers and
garages — with an instrument-grade calculation engine attached to every
listing. The design draws on Swiss heritage instead of generic "futuristic
dashboard" tropes: the International Typographic Style (Müller-Brockmann
grids, massive grotesque type) and the SBB split-flap departure board,
wired with an electric polarity metaphor: dark mode is the **Pluspol**
(anthracite, signal red), light mode the **Minuspol** (paper white,
federal blue) — red and blue, like the battery terminals in the car.

## Stack
- **Astro 5 (static) + React 18 islands + TypeScript** — every page is real
  prerendered HTML (SEO/GEO), interactivity hydrates as islands
- **nanostores** (`persistent`) — cross-island, cross-page state with the
  same localStorage key as before (ZIP, simulation inputs, Merkliste, tray)
- **Tailwind CSS 3** — custom token set (`nacht`, `panel`, `ink`, `signal`, `lume`, `warn`)
- **Framer Motion** — spring-loaded needles, flap boards, stamps
- **Archivo (variable width axis)** display + **Spline Sans Mono** data type

### Astro architecture
- `src/pages/*.astro` are thin shells around React page islands
  (`src/components/pages/*`); `src/layouts/Base.astro` carries head/meta,
  the TopBar + CompareTray islands and the static Footer.
- **`/inserat/[slug]` is prerendered at build time from the live database**
  — per-listing `<title>`, OG tags and schema.org JSON-LD in the initial
  HTML (the reason for this migration). Listings created after the last
  build are served by `404.astro`, which renders the detail island
  client-side; a rebuild (push or `workflow_dispatch`) promotes them to
  static pages.
- Filters on /inserate still live in the URL (`history.replaceState`).

## Getting started

```bash
npm install
npm run dev            # http://localhost:5173
npm run build          # type-check + production bundle
npm run fetch:tariffs  # refresh official tariff data (yearly, see below)
```

## Site structure (React Router)

| Route | Job |
|-------|-----|
| `/` | **Storefront** — hero + Standort-Fixierung, three intent doors (Finden / Verkaufen / Rechnen), the freshest Inserate as a teaser board, Sprechstunde booking (`/#beratung`) |
| `/inserate` | **Markt-Tafel** — the full catalogue as a split-flap board. Filters (Karosserie, Marke, Anbieter, Sitze, Preis) and sort live **in the URL** (`?seg=SUV&sitze=5`): shareable, bookmarkable, reload-safe |
| `/inserat/:id` | **One listing, one URL** — full dossier (specs, measured SOH, seller) plus the **embedded Rechenwerk** computing exactly this car against your persisted context. Dynamic `document.title` for sharing/SEO. RESERVIERT ads show the dossier but no simulation |
| `/rechenwerk` | **Standalone engine** — pick any open listing, tune km / ICE comparison / Lade-Mix / PV; always funnels back to the actual ad |
| `/vergleich` | **Listing-level compare** (max 3, only open ads) — specs *and* computed energy cost/savings per year at your tariff; best value per row marked. Shareable via `?ids=a,b,c` |
| `/verkaufen` | **Supply side** — three steps (Erfassen, SOH messen, live), honest pricing for Privat & Garage, mock capture form |

### Shared, persisted state (`src/context/CockpitContext.tsx`)
ZIP/tariff, the simulated listing, km/year, ICE comparison, Lade-Mix, PV and
the compare tray are global and persisted to `localStorage`
(`ev4u.cockpit.v1`) — a returning visitor lands pre-personalised, and the
standalone engine and every embedded detail-page engine always agree.

> Production hosting note: deep links like `/inserat/tesla-m3` need an SPA
> fallback rewrite to `index.html` (Netlify `_redirects`, Vercel `rewrites`,
> nginx `try_files`). `vite dev`/`preview` handle this automatically.

### The cost model (Rechenwerk)
```
kWh/year   = km / 100 × consumption(listing)
Lade-Mix   = one fader, 5 % steps: left = 100 % home, right = 100 % public
home kWh   × local ElCom tariff
public kWh = per charging-card combo: 12 × monthly fee
             + (public kWh − included kWh) × CHF/kWh;
             cheapest combo auto-selected (EMPFOHLEN), manual override possible
savings    = Benzin (L/100km × CHF 1.78) − Strom total
PV = JA    → ADDITIONAL savings shown as a range, not a point value:
             solar realistically covers 20–70 % of home charging (depending
             on PV capacity & surplus charging); each solar kWh saves
             (local tariff − 8 Rp. forgone feed-in remuneration)
```

Charging-card combos use real published provider offers (Stand 06/2026):
TCS eCharge (no base fee, ~0.57 typ. DC) + Swisscharge · MOVE flex
(CHF 19.90/mt incl. 45 kWh, 0.59 at GOFAST/Fastned partner HPC) · IONITY
Passport (CHF 11.99/mt, 0.46 CHF/kWh at CH IONITY) + Supercharger app.

## Backend (Supabase)

The only backend is a Supabase project (Postgres, region **Zürich /
eu-central-2**). No server code — all authorization is **Row Level
Security** in the database:

| Table | Policies |
|-------|----------|
| `listings` | published rows public; ENTWURF visible to owner only; insert/update/delete restricted to `owner = auth.uid()` |
| `profiles` | public read; users manage their own row; auto-created on signup by trigger |
| `bookings` | **write-only**: validated anonymous insert, no select policy — requests can't be read from the client |
| `canton_taxes` | **operator config**, weight-based: `rate_per_100kg` (linearized regular tariff per canton, mid-size calibrated) + `ev_discount_pct` (the researched EV privilege: 100/50/…/0) + `tax_year`. Tax = listing weight × rate; saving = tax × discount — never negative by construction. Public read, NO client write — edit via dashboard/SQL; bundled fallback when offline |
| `conversations` / `messages` | buyer ↔ seller messaging: visible **only** to the two participants; buyers can only open conversations on published, user-owned listings; senders can't be spoofed |
| storage `listing-photos` | public object URLs; uploads/deletes only into the user's own `uid/` folder |

- **Messaging**: "Nachricht an Verkäufer" on every user-owned listing detail
  page (hidden on platform-seeded ads); the shared inbox with threads lives
  on `/konto`. **Read receipts** via a column-level grant (recipients can
  update `read_at` and nothing else) drive the unread badge in the TopBar.
- **E-mail notifications**: a pg_net trigger on every message insert calls
  the `notify-message` Edge Function, which re-validates the message
  server-side, resolves the other participant and mails them via Resend.
  Set `RESEND_API_KEY` + `SITE_URL` as Edge Function secrets to activate —
  without the key it logs and exits cleanly.
- **Merkliste**: heart on rows + detail pages (persisted locally, no login
  needed), filterable on /inserate via `?fav=1`.
- **Saved searches**: the filter URL is stored as-is in `saved_searches`
  (owner-only RLS); managed on /konto. E-mail alerts on new matches: backlog.
- **Neupreis-Vergleich**: `price_new` per listing → "DU SPARST 29 %" badge
  on detail pages and a VS.-NEUPREIS row in the compare table. Positive
  framing only — listings are vetted; we show the saving, not a verdict.
- **Image processing**: photos are downscaled **client-side** before upload
  (max 1600 px, JPEG ~82 % — `src/utils/image.ts`), so storage and bandwidth
  stay small on the free tier; the `PhotoManager` on `/konto` handles
  upload/delete (max 6 per Inserat), the detail page shows the gallery.
  Server-side transforms (`getPublicUrl(..., { transform })`) can be added
  on the Pro plan without code changes elsewhere.

- **Auth**: passwordless magic links (`signInWithOtp`) — first login creates
  the seller profile. `/konto` is the seller dashboard (status control,
  delete); `/verkaufen` inserts drafts.
- **Client**: `src/lib/supabase.ts` with `VITE_SUPABASE_URL` +
  `VITE_SUPABASE_PUBLISHABLE_KEY` from `.env` (see `.env.example`). The
  publishable key is safe in the client; RLS does the guarding. Without env
  vars the app falls back to the bundled seed listings.
- **Data flow**: `ListingsContext` paints the bundled seed instantly, then
  swaps in live rows (`status in (AKTIV, RESERVIERT)`), refreshed after
  mutations.
- Migrations live in the Supabase project (`marketplace_schema`,
  `listing_photos_storage`, `security_hardening`); the security advisor is
  clean.
- **Production checklist**: set the Auth *Site URL* + redirect allow-list to
  your domain (magic-link emails), configure custom SMTP (the built-in
  mailer is rate-limited), and enable Point-in-Time Recovery when revenue
  depends on the data.

## SEO & GEO

- `public/robots.txt` + `public/sitemap.xml` (regenerate with
  `npm run sitemap` — pulls live listing slugs from Supabase).
- `public/llms.txt` for generative engines (GEO): what EV4U is, what makes
  it distinct, key URLs, data sources.
- Open Graph / canonical metadata in `index.html`; per-listing
  **schema.org Car/Offer JSON-LD** injected on detail pages (Google renders
  JS and picks this up).
- Known limitation: the site is a client-rendered SPA, so WhatsApp/Slack
  link previews show only the site-wide OG card, not per-listing data —
  fixing that needs SSR/prerendering (see backlog).

## Vehicle-model API — DECISION PENDING

The schema is **prepared** for a vehicle spec database (`listings.weight_kg`
drives the cantonal tax model; range/consumption/battery/`price_new` would
come from the same source, and /verkaufen would gain a model picker that
prefills everything). **No API is connected yet** — options, ranked:

1. **Chargetrip Vehicle Database** *(recommended start)* — 1'800+ EV models
   via GraphQL incl. weights, batteries, efficiency, pricing; **free
   developer tier**, no contract. Bake into a `models` table (same pattern
   as the ElCom tariffs), monthly refresh.
2. **EV Database (ev-database.org) licensing** — the quality benchmark:
   real-world range and charge curves, EU-market focused. Paid,
   contact-based; the upgrade once data quality becomes a selling point.
3. **Open EV Data JSON (frozen)** — the old open dataset on GitHub; free
   bootstrap seed, but unmaintained (now part of the paid Chargeprice API).
   Good enough to launch the model picker at zero cost.
4. **Vehicle Databases / One Auto API** — per-request EV spec APIs, but
   US/Canada-centric trims; weak fit for the Swiss market.
5. **Eurotax (Autovista) / auto-i-dat** — the Swiss Typenschein-level
   industry data **plus market valuations**; expensive B2B. Relevant later
   for the Preis-Check backlog item rather than for specs alone.

Until the decision: new listings get `weight_kg = 1900` (mid-size EV
reference, `REF_WEIGHT_KG`), seeds carry real curb weights.

## Backlog (deliberately not built yet)

1. **Search-alert e-mails** — daily pg_cron + Edge Function over
   `saved_searches`; needs an e-mail provider key anyway (same Resend setup
   as message notifications).
2. **SSR / prerendering** — per-listing link previews + crawler-independence;
   the clean path is a meta-framework migration when traffic justifies it.
3. **Trust & safety** — "Inserat melden" (write-only `reports` table),
   auto-hide at N reports, garage verification via Zefix (UID register),
   phone verification for sellers.
4. **Payments** — Stripe Checkout via Edge Function + webhook for the
   CHF 29 boost and the Garage-Abo; build when there are real sellers.
5. **Market price intelligence** — comparable-listings statistics once
   inventory is large enough; framed positively, never as an ad rating.
6. **FR/IT localization** — Romandie/Ticino; structure new copy with
   translation in mind.
7. **Analytics** — privacy-friendly (Plausible), one script tag.
8. **OG image** — designed share card (currently text-only OG tags).

## Real tariff data

The ZIP → electricity-tariff lookup uses **official open data**, baked into
[`src/data/tariffs.json`](src/data/tariffs.json) by
[`scripts/fetch-tariffs.mjs`](scripts/fetch-tariffs.mjs) (Node 18+, zero deps):

- **ElCom** (federal electricity regulator) tariff cube on
  [LINDAS](https://lindas.admin.ch) — every grid operator in every Swiss
  municipality. Latest period, category **H4** (typical household,
  4'500 kWh/a), standard product, total in Rp./kWh (**excl. VAT**), median
  across operators per municipality.
- **swisstopo AMTOVZ** locality directory — PLZ → municipality (BFS no.),
  canton and real LV95 coordinates (shown on the hero survey stamp).

Swiss household tariffs are set **once per year** per grid operator, so a
yearly `npm run fetch:tariffs` after the ElCom autumn publication *is* the
accurate refresh cadence.

### PLZ resolution (three tiers)
1. **Exact** — all 3'172 Swiss address PLZ. PLZ spanning several
   municipalities resolve to the one holding most addresses, falling back
   through the candidates if the dominant one lacks an ElCom entry.
2. **Inferred** — Postfach-/Firmen-PLZ (3000 Bern, 2001 Neuchâtel, 8021
   Zürich, 6000 Luzern, …) exist only in the Post's directory, which is no
   longer published as open data. They are always numbered inside their
   municipality's PLZ range, so the resolver applies Post numbering
   convention: near a hundred base (`xx00–xx15`) → the base municipality
   (2001–2010 → 2000 Neuchâtel); otherwise a distance-weighted vote of the
   address PLZ within ±40 (3030 → Bern, 6341 → Baar). The stamp openly
   shows which Zustell-PLZ the tariff was taken from.
3. **CH median**, stamped **GESCHÄTZT** — only for PLZ nothing is near
   (typos like 9999).

Note: input is PLZ-level, so residents of a small municipality sharing its
PLZ with a larger neighbour get the neighbour's tariff — the same trade-off
every PLZ-based lookup makes (ElCom's own site asks for the municipality).

## Component map
```
src/
  App.tsx                      ← router shell + <CockpitProvider> + ScrollToTop
  pages/
    Home.tsx                   ← storefront: hero, treadmill, bento, teaser
    Inserate.tsx               ← catalogue + URL-synced filter console
    InseratDetail.tsx          ← dossier + embedded engine
    RechenwerkPage.tsx         ← standalone engine + listing funnel
    Vergleich.tsx              ← side-by-side compare table
    Verkaufen.tsx              ← sell page (steps, pricing, mock form)
  components/
    TopBar.tsx                 ← polarity switch + NavLinks + tariff chip
    Hero.tsx                   ← headline + Standort-Fixierung + contour field
    ListingBoard.tsx           ← split-flap board (full + compact teaser)
    BrandTreadmill.tsx         ← infinite brand marquee (live from listings)
    BentoHub.tsx               ← Schaltzentrale: doors + Sprechstunde bento,
                                 animated SVGs (route, gauge, bolt, pulse)
    EngineCore.tsx             ← the simulation engine, embeddable
    CompareTray.tsx            ← fixed bottom tray (max 3)
    Footer.tsx                 ← hollow wordmark + data credits
    ui.tsx                     ← FlapText · AnimatedNumber · Fader ·
                                 SectionHeader · Stamp · Segmented
  context/CockpitContext.tsx   ← persisted shared state (see above)
  data/evData.ts               ← 12 listings, card combos, consultants
  data/tariffs.json            ← baked ElCom×swisstopo lookup (generated)
  utils/swiss.ts               ← ZIP→Gemeinde resolver (real data), fmtCH
  index.css                    ← tokens, faders, flap cells, grain, blueprint grid
scripts/
  fetch-tariffs.mjs            ← yearly open-data refresh (LINDAS + AMTOVZ)
```

### Try these flows
1. Type `4617` (Gunzgen) in the hero → the stamp drops with the real ElCom
   tariff; the Tafel's STROM/100KM column re-flaps with local prices.
2. Open the **Renault 5** row → "Im Rechenwerk simulieren" → the page scrolls
   to the engine and the gauges swing to that car.
3. Toggle **PV-Anlage: JA** → a solar row appears in the breakdown, the Strom
   needle drops, and the delta panel shows "DAVON DANK SOLAR: CHF …".
4. Switch to **LANGSTRECKE** with a thirsty car (Taycan) at high km → the
   EMPFOHLEN stamp jumps to the IONITY flat-rate combo.
5. Try opening a **RESERVIERT** listing (NIO, Audi) — the dossier shows, but
   the simulate button is locked; reserved cars never enter the engine.

## Design tokens & polarity themes
All colors are CSS variables (`--c-*` RGB triplets in `index.css`), themed by
a `light` class on `<html>` — toggled by the **polarity switch** in the
TopBar (a battery-terminal `+`/`−` pair), persisted as `ev4u.theme`, applied
pre-paint by an inline script (no flash). Pluspol (dark) is the default.

| Token | Pluspol `+` (default) | Minuspol `−` |
|-------|----------------------|--------------|
| `nacht` page | `#0A0B0D` anthracite | `#F4F6FA` cool paper white |
| `panel` | `#121316` | `#FFFFFF` |
| `ink` text | `#EDEBE6` warm lume | `#0E1828` near-black blue |
| `signal` accent | `#FF3B30` **Swiss signal red** | `#0050D8` **Swiss federal blue** |
| `lume` / `warn` | green / amber | darkened for white-bg contrast |

Electric flourishes: section headers carry a `.current-line` divider whose
dashes drift like DC current; the hero corners read like a circuit sheet
("STROMKREIS 01", "800 V DC · 50 HZ AC").
- `.stretch-expand` — Archivo width axis at 125 % for display type
- `.fader` + `.ruler` — mixing-console range inputs
- `.stamp` — rubber-stamp tags (FIXIERT / EMPFOHLEN / GEBUCHT)
- `.grain` / `.bg-blueprint` — film grain + engineering grid atmospherics

## Mobile
Grids stack to one column, the board collapses to Inserat · Preis · Status,
touch targets stay ≥ 44 px, nav collapses to clock + wordmark.
