# EV4U — Der Schweizer E-Auto-Marktplatz

> **The Future is electric.**

EV4U is a **classifieds platform** for EVs — private second-hand sellers and
garages — with a cost calculation attached to every listing. Not a generic
"from CHF 0.04/km" figure: *your* municipal electricity tariff, *your*
annual mileage, *your* charging mix, *your* canton's vehicle tax.

The interface follows the **«Klartext»** concept (`docs/ui-revamp-concept.md`):
mixed case, one accent colour, nothing below 13 px, one visible context bar
that owns every personalised number, and motion only where it explains state.

## Stack
- **Astro 7 (static) + React 19 islands + TypeScript** (Node ≥ 22.12) — every page is real
  prerendered HTML (SEO/GEO), interactivity hydrates as islands
- **nanostores** (`persistent`) — cross-island, cross-page state
- **Tailwind CSS 4** (Vite plugin, no JS config) — `@theme` token set in `src/index.css` (`canvas`, `surface`,
  `line`, `fg`, `accent`, `caution`)
- **Archivo**, one family, four weights. No second face, no width axis —
  Archivo carries tabular figures itself (`.tabular`).
- No animation library. CSS transitions only.

## Getting started

```bash
npm install
npm run dev            # http://localhost:4321
npm run build          # astro check (type-check) + production bundle
npm run typecheck      # types only
npm run fetch:tariffs  # refresh official tariff data (yearly, see below)
```

Without a `.env` (see `.env.example`) the app runs on the twelve bundled seed
listings — the whole front end, the cost model and every filter work offline.
The vehicle catalog lives only in Supabase, though: offline, the sell form
asks for brand and model as text and the buyer filter offers the brands in
stock. Copy `.env.example` to `.env` with the project URL and publishable key
to work against the real catalog.

## Architecture

`src/pages/*.astro` are thin shells around React page islands in
`src/components/pages/*`; `src/layouts/Base.astro` carries head/meta, the
sticky Header + ContextBar, the AccountSync and CompareTray islands and the
static Footer.

**`/inserat/[slug]` is prerendered at build time from the live database** —
per-listing `<title>`, OG tags and schema.org JSON-LD in the initial HTML.
Listings created after the last build are served by `404.astro`, which reads
the slug from the URL and renders the detail island client-side; a rebuild
(push, `workflow_dispatch`, or the Supabase webhook) promotes them to static
pages.

### Where things live

```
src/
  pages/*.astro              ← shells: meta, JSON-LD, build-time snapshot
  layouts/Base.astro         ← head, sticky header block, footer
  components/
    Header.tsx               ← wordmark · search · Merkliste/Vergleich/Konto
    ContextBar.tsx           ← «Deine Werte» + the sheet that sets them
    pages/*.tsx              ← one island per route
    EngineCore.tsx           ← the cost breakdown, embeddable
    ListingCard/Board.tsx    ← grid and list view of the catalogue
    ListingActions.tsx       ← the Merken/Vergleichen pair, used by both
    ListingEditor.tsx        ← edit an own listing (sheet on /konto)
    VehiclePicker.tsx        ← Marke → Modell → Variante (/verkaufen)
    VehicleFilter.tsx        ← same catalog as the buyer filter (/inserate)
    ui.tsx                   ← Button · Badge · Sheet · Popover · Slider …
  hooks/
    useCockpit.ts            ← the persisted visitor context
    useCosts.ts              ← context + listing → the numbers
    useListings/Session/…    ← store-backed reads
    useVehicleCatalog.ts     ← catalog reads + the resolved picker choice
  stores/                    ← nanostores: cockpit · listings · favorites ·
                               session · ui · vehicleCatalog
  lib/
    filters.ts               ← what a catalogue URL parameter means
    vehicleCatalog.ts        ← catalog types, labels, catalog → listing specs
    costModel.ts → utils/    ← see below
  utils/
    costModel.ts             ← THE calculation (computeCosts)
    format.ts                ← display names, segment/seller/status labels
    search.ts                ← the local instant search
    swiss.ts                 ← ZIP→Gemeinde resolver, fmtCH
  data/
    evData.ts                ← 12 seed listings, charging cards, Gabriel
    tariffs.json             ← baked ElCom × swisstopo lookup (generated,
                               loaded lazily via utils/plzResolver.ts)
    tariffMeta.json          ← its metadata, bundled on every page
    fuelPrices.json          ← baked BFS pump prices (generated)
```

### Two rules that keep it honest

1. **One calculation.** `computeCosts()` in `src/utils/costModel.ts` is the
   only implementation of the cost model. The engine, the price box on a
   listing page and the compare table all call it through `useCosts`. When
   this lived in three places they had already drifted: the sidebar forced
   the cheapest charging card while the engine used the one the visitor had
   picked, so the headline could contradict the breakdown right below it.
2. **One display name.** `vehicleTitle()` in `src/utils/format.ts` renders
   every brand/model. Legacy all-caps rows are normalised on the way out, so
   an imported `VW ID.7 TOURER PRO S` still reads `VW ID.7 Tourer Pro S`.

### Shared, persisted state
ZIP/tariff, annual km, the visitor's current car, charging mix, PV and the
compare tray are global and persisted to `localStorage` (`ev4u.cockpit.v1`).
A returning visitor lands pre-personalised; every number on the site is
computed from the values shown in the context bar, and that bar is the only
place they are set.

## Site structure

Navigation carries **two destinations** — Inserate (buy) and Verkaufen (sell)
— plus personal state on the right: Merkliste, Vergleich (appears only when
it holds something), Konto. Rechenwerk and Vergleich are states, not
destinations; both keep their URLs and are reachable from the footer.

| Route | Job |
|-------|-----|
| `/` | Hero + search, the freshest listings as photo cards, how EV4U calculates, brands in stock, consultation strip |
| `/inserate` | The catalogue. Full-text search, filter popovers **with a hit count per option**, grid or list view. Filters and sort live in the URL (`?seg=SUV&preis=40000`): shareable, bookmarkable, reload-safe |
| `/inserat/:slug` | One listing: gallery and price/contact first, then description, specs, the embedded cost breakdown, the seller, similar listings |
| `/rechenwerk` | «Was kostet mich ein E-Auto?» — the engine against any open listing, funnelling back into the catalogue |
| `/vergleich` | Up to 3 open listings side by side, specs *and* computed annual cost. Shareable via `?ids=a,b,c`, which is **adopted** into your own compare tray |
| `/verkaufen` | Sell side: three steps, honest pricing, a 3-step capture wizard with a live preview of the listing card |
| `/konto` | Seller dashboard in tabs: Inserate (status, edit, photos) · Suchen · Nachrichten · Profil |

## The cost model

The comparison is always against the visitor's ACTUAL car. Five drive types,
each priced honestly rather than uniformly:

| Antrieb | Energie | Wartung CHF/km | Verkehrssteuer |
|---|---|---|---|
| Benziner | BFS pump price | 0.060 | full (no EV discount) |
| Diesel | BFS pump price | 0.060 | full |
| Vollhybrid | petrol, lower consumption | 0.055 | full |
| Plug-in-Hybrid | petrol **and** electricity, split by the electric share | 0.055 | full |
| E-Auto | home tariff | 0.038 | already discounted → no saving to win |

One national pump price for all of Switzerland: the fuel-tax component is
federal, canton averages differ by a few Rappen, and station-level
competition dominates.

Two deliberate refusals to flatter the EV:

- **Hybrids are not billed as full combustion cars.** Regen braking really
  does spare the brakes, so their maintenance sits between petrol and
  electric. Treating them as petrol would have inflated the EV's advantage by
  ~CHF 75/year out of thin air.
- **The plug-in hybrid takes the hybrid-mode consumption, not the WLTP mixed
  figure.** A PHEV declared at 1.6 l/100 km really drinks 6–7 l once the
  battery is empty; the WLTP number assumes an electric share almost nobody
  achieves. The visitor sets that share themselves and the annual kilometres
  are split accordingly — move the slider toward electricity and the PHEV
  gets *cheaper*, which is the whole point of owning one.

```
kWh/year   = km / 100 × consumption(listing)
Lade-Mix   = one slider, 5 % steps: left = 100 % home, right = 100 % public
home kWh   × local ElCom tariff
public kWh = per charging-card combo: 12 × monthly fee
             + (public kWh − included kWh) × CHF/kWh;
             cheapest combo auto-selected, manual override possible
Wartung    = km × rate(Antrieb), per TCS/ADAC — see the table above
PHEV       = petrol on km × (1 − share) at the hybrid-mode consumption
             + electricity on km × share at 20 kWh/100 km, home tariff
Steuer     = weight/100 × canton rate, minus the canton's EV discount
Ersparnis  = current car total − listing total
PV = ja    → ADDITIONAL savings as a RANGE, not a point value: solar
             realistically covers 20–70 % of home charging; each solar kWh
             saves (local tariff − 8 Rp. forgone feed-in remuneration)
```

Charging-card combos use real published provider offers (Stand 06/2026):
TCS eCharge (no base fee, ~0.57 typ. DC) + Swisscharge · MOVE flex
(CHF 19.90/mt incl. 45 kWh, 0.59 at GOFAST/Fastned partner HPC) · IONITY
Passport (CHF 11.99/mt, 0.46 CHF/kWh at CH IONITY) + Supercharger app.

Insurance and depreciation are **not** in the model, and the engine says so.

## Backend (Supabase)

The only backend is a Supabase project (Postgres, region **Zürich /
eu-central-2**). No server code — all authorization is **Row Level
Security** in the database:

| Table | Policies |
|-------|----------|
| `listings` | published rows public; ENTWURF visible to owner only; insert/update/delete restricted to `owner = auth.uid()` |
| `profiles` | public read; users manage their own row; auto-created on signup by trigger |
| `bookings` | **write-only**: validated anonymous insert, no select policy |
| `canton_taxes` | **operator config**, weight-based: `rate_per_100kg` + `ev_discount_pct` + `tax_year`. Public read, no client write; bundled fallback when offline |
| `favorites` | the Merkliste — owner-only, which is why a heart click needs a login |
| `saved_searches` | the filter URL stored as-is, owner-only |
| `conversations` / `messages` | buyer ↔ seller messaging: visible **only** to the two participants; senders can't be spoofed |
| `vehicle_brands` / `vehicle_models` / `vehicle_variants` | **reference data**, the EV catalog (see below): public read, no client write. Drives the /verkaufen picker & prefill |
| `user_roles` | **admin flag**; `private.is_admin()` (security definer, in a schema the API doesn't expose) backs the admin branch of the listings RLS policies. The UI only decides what to *show* |
| storage `listing-photos` | public object URLs; uploads/deletes only into the user's own `uid/` folder |

- **Auth**: passwordless magic links (`signInWithOtp`). One session fetch and
  one `onAuthStateChange` subscription per page (`src/stores/session.ts`) —
  not one per component that happens to need it.
- **Messaging**: contact form on every listing; the shared inbox lives on
  `/konto`. Read receipts via a column-level grant drive the unread badge.
- **E-mail notifications**: a pg_net trigger on message insert calls the
  `notify-message` Edge Function (Resend). Without `RESEND_API_KEY` it logs
  and exits cleanly.
- **AI search**: the `suche` Edge Function turns a description
  («familientauglicher Kombi bis 40'000») into the same URL filters the
  filter row writes — the result is a normal, shareable, adjustable search,
  and what the model set appears as removable chips. Times out after 8 s and
  falls back to plain text search; the site is fully functional without it.
- **Image processing**: photos are downscaled client-side before upload
  (max 1600 px, JPEG ~82 % — `src/utils/image.ts`), max 6 per listing.
- **Client**: `src/lib/supabase.ts` with `PUBLIC_SUPABASE_URL` +
  `PUBLIC_SUPABASE_PUBLISHABLE_KEY`. The publishable key is safe in the
  client; RLS does the guarding.
- **Production checklist**: set the Auth *Site URL* + redirect allow-list to
  your domain, configure custom SMTP, enable Point-in-Time Recovery,
  **remove the demo listings** (below).

### Demo listings

Until real sellers arrive, the live database holds 28 demo cars so every
page can be checked with realistic data. They live in the production table
but are fenced off by a flag, not a naming convention:

- `listings.is_demo` (migration `*_listings_demo_flag.sql`). A check
  constraint allows it only on platform rows (`owner is null`) — sellers
  always insert with their own `owner` (RLS), so a real listing can never be
  marked demo, nor swept away by the cleanup.
- Each car is a catalog variant: brand, model, variant and all specs come
  from `vehicle_variants`, exactly as if a seller had picked it in the sell
  form, so the Marke → Modell → Variante filter works on them. Only year,
  km, price, SOH, seller and place are made up.
- Shown with a «Demo» badge and a note on the detail page; no contact form
  (there is no seller). `noindex`, no Car/Offer JSON-LD, left out of the
  `/inserate` ItemList and the sitemap.

```
supabase db query --linked -f supabase/seed/demo_listings.sql   # load / reset (idempotent)
```

Before launch, in the SQL editor (photos: none, the demo cars use the car
graphic):

```sql
delete from public.listings where is_demo;
```

The `is_demo` column can stay; once no row carries it, it changes nothing.

## SEO & GEO

- `public/robots.txt` + `public/sitemap.xml` (regenerate with
  `npm run sitemap` — pulls live listing slugs from Supabase).
- `public/llms.txt` for generative engines.
- Per-listing **schema.org Car/Offer + BreadcrumbList JSON-LD**, an
  **ItemList** on `/inserate`, canonical + OG on every page — all in the
  prerendered HTML, not injected by JS.
- `404.astro` is `noindex,follow`: it doubles as the client fallback for
  listings newer than the last build, so it can answer under arbitrary URLs.

## Real tariff data

The ZIP → electricity-tariff lookup uses **official open data**, baked into
[`src/data/tariffs.json`](src/data/tariffs.json) by
[`scripts/fetch-tariffs.mjs`](scripts/fetch-tariffs.mjs) (Node 18+, zero deps).
The map (~60 KB gzipped) is **not** part of the page bundle: it loads on
demand when a postcode has to be resolved, and the resolved place is
persisted in the cockpit — a returning visitor never downloads it again
until the next ElCom period. Sources:

- **ElCom** tariff cube on [LINDAS](https://lindas.admin.ch) — every grid
  operator in every Swiss municipality. Latest period, category **H4**
  (typical household, 4'500 kWh/a), standard product, total in Rp./kWh
  (**excl. VAT**), median across operators per municipality.
- **swisstopo AMTOVZ** locality directory — PLZ → municipality (BFS no.)
  and canton.

Swiss household tariffs are set **once per year** per grid operator, so a
yearly `npm run fetch:tariffs` after the ElCom autumn publication *is* the
accurate refresh cadence.

### Real fuel prices (BFS, automated)

Pump prices come from the **BFS Landesindex der Konsumentenpreise,
"Durchschnittspreise für Energie und Treibstoffe"** (order number
`su-d-05.02.91`). [`scripts/fetch-fuel-prices.mjs`](scripts/fetch-fuel-prices.mjs)
resolves the newest edition, parses the XLSX and bakes
`src/data/fuelPrices.json`; a sanity gate rejects implausible parses so a
format drift can never poison the cost model. The deploy workflow runs
`npm run fetch:fuel` before every build (non-fatal) and a monthly `schedule`
trigger redeploys right after the BFS publication.

### PLZ resolution (three tiers)
1. **Exact** — all 3'172 Swiss address PLZ. PLZ spanning several
   municipalities resolve to the one holding most addresses.
2. **Inferred** — Postfach-/Firmen-PLZ (3000 Bern, 2001 Neuchâtel, 8021
   Zürich, …) exist only in the Post's directory, which is no longer open
   data. They are numbered inside their municipality's PLZ range, so the
   resolver applies Post numbering convention: near a hundred base
   (`xx00–xx15`) → the base municipality; otherwise a distance-weighted vote
   of the address PLZ within ±40. The context sheet shows which delivery PLZ
   the tariff came from.
3. **CH median**, flagged **geschätzt** — only for PLZ nothing is near.

Input is PLZ-level, so residents of a small municipality sharing its PLZ with
a larger neighbour get the neighbour's tariff — the trade-off every PLZ-based
lookup makes (ElCom's own site asks for the municipality).

## Vehicle catalog — Marke → Modell → Variante

Sellers pick their car instead of typing it. The catalog is normalised in
three levels — **87 brands · 357 models · 743 variants** (Stand 23.09.2026) —
from the EV4U workbook *Elektroauto-Varianten Europa*: sheet «Modelle &
Varianten» (on sale) plus «Auslauf & Occasion» (run-out and used-only cars).

| Table | Holds |
|-------|-------|
| `vehicle_brands` | name |
| `vehicle_models` | segment, body type, availability (`LIEFERBAR` · `IMPORT` · `ANGEKUENDIGT` · `AUSLAUF` · `OCCASION`), market launch → `launch_year` / `end_year`, remark |
| `vehicle_variants` | ~30 fields per drivetrain/battery: power, gross/net battery, WLTP range and consumption, DC peak and 10–80 % time, AC, V2L, dimensions, curb weight, battery warranty, Swiss list price |

Every row carries a stable `slug` derived from the workbook ID
(`brand_model_variant`). Re-imports upsert on it, so uuids — and the listings
linking to them — survive an update.

**Listings snapshot, then link.** A listing keeps brand, model, `variant` and
all specs in its own columns (the seller can still correct them) and links
`model_id` / `variant_id` to the catalog with `on delete set null`; a
composite FK guarantees the variant belongs to the model. Dropping a car from
the catalog never changes a published listing.

**Picker** (`VehiclePicker.tsx`, state shared via `stores/vehicleCatalog.ts`):
native selects for brand and model — models grouped into current, no longer
sold new and announced — and the variant as radio cards with battery, power,
drive, range and list price. A model with one variant preselects it. Every
level can be typed in when the car is missing; «Weiss ich nicht genau» keeps
the model link without guessing specs. Brands + models arrive in one embedded
select, variants per model on demand.

**Buyer filter** (`VehicleFilter.tsx` on `/inserate`, «Marke & Modell»): the
same catalog as cascading selects — what's in stock first, with hit counts,
then every other brand/model, so a buyer can save a search for a car nobody
offers yet. The URL keeps the brand as a name (`marke=Tesla`; old links and
the AI search's `TESLA` still match, case and accents ignored) and model and
variant as catalog slugs (`modell=tesla_model-y`, `variante=…`). Listings
load with those slugs embedded (`LISTING_SELECT`), so model and variant match
on the catalog link only — a typed-in car is found by brand and free text,
never guessed into a model. The search box suggests catalog brands and models
with their listing count and jumps straight into this filter.

**Nothing is invented.** Values the catalog lacks stay empty (no DC on a
microcar, unknown curb weight — the tax then uses `REF_WEIGHT_KG`). Only the
four NOT NULL specs start at neutral `SPEC_PLACEHOLDERS` when no variant is
known; the listing is a private draft until the seller corrects them.

### Updating the catalog

```
npm run catalog:import -- path/to/EV4U_Elektroauto_Varianten_Europa_<edition>.xlsx
```

[`scripts/import-vehicle-catalog.mjs`](scripts/import-vehicle-catalog.mjs)
(Node 18+, zero deps) reads both sheets and validates every cell — types,
ranges, enums, net ≤ gross battery, unique IDs, model-level fields identical
across a model's variants — and cross-checks the totals on the «Übersicht»
sheet. Any error aborts with *Nothing written*. Otherwise it writes:

- `supabase/seed/vehicle_catalog.sql` — one transaction: upsert brands →
  models → variants, delete what the workbook no longer lists, then a count
  gate that rolls everything back if the totals don't match.
- `src/data/vehicleCatalogMeta.json` — counts and edition for the picker's
  footnote.

Apply the seed with `psql "$DATABASE_URL" -f supabase/seed/vehicle_catalog.sql`,
with the logged-in Supabase CLI (`supabase db query --linked -f
supabase/seed/vehicle_catalog.sql`, no database password needed) or paste it
into the Supabase SQL editor. The schema is
`supabase/migrations/*vehicle_catalog_v2.sql`.

## Backlog (deliberately not built yet)

1. **Search-alert e-mails** — daily pg_cron + Edge Function over
   `saved_searches`; needs the same Resend setup as message notifications.
2. **Trust & safety** — "Inserat melden" (write-only `reports` table),
   auto-hide at N reports, garage verification via Zefix, phone verification.
3. **Certified SOH** — today the SOH is the seller's statement and is labelled
   as such. A `soh_verified_at` column plus the partner check turns it into a
   claim EV4U can stand behind.
4. **Payments** — Stripe Checkout via Edge Function + webhook for the CHF 29
   boost and the Garage-Abo.
5. **Market price intelligence** — comparable-listings statistics once
   inventory is large enough; framed positively, never as an ad rating.
6. **FR/IT localization** — Romandie/Ticino.
7. **Analytics** — privacy-friendly (Plausible), one script tag.
8. **OG image** — a designed share card (currently text-only OG tags).

## Design tokens

All colours are CSS variables (`--c-*` RGB triplets in `src/index.css`).
Light is the default; an explicit choice wins, otherwise the system
preference decides, applied pre-paint by an inline script (no flash).

| Token | Light | Dark |
|-------|-------|------|
| `canvas` page | `#FBFBFA` | `#0E0F0E` |
| `surface` card | `#FFFFFF` | `#161816` |
| `fg` / `fg2` / `fg3` | `#141513` / `#5C5E59` / `#70726C` | `#EDEEEB` / `#9EA19B` / `#82857F` |
| `accent` | `#0F7A43` | `#3BD683` |
| `caution` | `#9A6400` | `#E0A63C` |

`fg3` is deliberately darker than the obvious choice: `micro`/`small` text in
`fg3` has to reach WCAG AA against the card.

The accent carries exactly four jobs — primary button, active state, focus
ring, link — plus the one editorial exception: a saving is the brand promise,
so a saving may be green. Icons are neutral. Uppercase appears only in
`.eyebrow`.

## Mobile
Grids stack to one column, the list view collapses to Inserat · Preis, touch
targets stay ≥ 44 px, filter popovers become bottom sheets. Below `sm` the
nav collapses to a full-screen menu, rendered outside the sticky header so
its backdrop-filter cannot clip the overlay.

## Placeholders & Bilder
Every listing shows a visual: the seller's first photo when uploaded,
otherwise a technical side-elevation line drawing of the segment
(`CarGraphic.tsx`, Kompakt/Limousine/Kombi/SUV). Detail pages without photos
get a full "Fotos folgen" drawing panel instead of nothing.
