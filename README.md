# EV4U — Der Schweizer E-Auto-Marktplatz

> **The Future is electric.**

EV4U is a **classifieds platform** for used EVs — private sellers and
garages — that knows what matters for an electric car: battery state of
health, battery warranty, charging power, and what the car costs per month
at *your* municipal electricity tariff, *your* mileage and *your* canton's
vehicle tax.

The interface follows concept v3 **«Ladestand»**
(`docs/concept-v3-marktplatz.md`): a tinted canvas with white cards, deep
«Waldgrün» brand surfaces, the 10-segment *Ladebalken* as the one recurring
EV motif, and the price as the loudest text on every card. The previous
concept («Klartext», `docs/ui-revamp-concept.md`) stays as the record of
the readability rules v3 builds on.

## Stack
- **Astro 7 (static) + React 19 islands + TypeScript** (Node ≥ 22.12) — every page is real
  prerendered HTML (SEO/GEO), interactivity hydrates as islands
- **MDX content collections** for the blog and the Ratgeber
- **nanostores** (`persistent`) — cross-island, cross-page state
- **Tailwind CSS 4** (Vite plugin, no JS config) — `@theme` token set in `src/index.css`
- **Archivo**, one family, four weights, self-hosted through Astro's Fonts
  API (downloaded at build time — no request to Google per visit). Archivo
  carries tabular figures itself (`.tabular`).
- **lucide-react** icons. No animation library — CSS transitions only.
- **Mediabunny** (WebCodecs) — converts walkthrough videos in the browser, loaded only when a seller picks one

## Getting started

```bash
npm install
npm run dev            # http://localhost:4321
npm run build          # astro check (type-check) + production bundle
npm run typecheck      # types only
npm run sitemap        # regenerate public/sitemap.xml from the live database
npm run fetch:tariffs  # refresh official tariff data (yearly, see below)
npm run fetch:fuel     # refresh BFS pump prices (CI does this monthly)
npm run alerts:plz     # PLZ coordinates for the alerts function (after fetch:tariffs)
npm run catalog:import -- <workbook.xlsx>   # vehicle catalog, see below
```

Without a `.env` (see `.env.example`) the app runs on the twelve bundled seed
listings — the front end, the cost model and every filter work offline.
The vehicle catalog, accounts, messaging and the model pages need Supabase:
copy `.env.example` to `.env` with the project URL and publishable key.
`PUBLIC_VIDEO_BASE_URL` is optional: without it the video walkthroughs stay
hidden (see Video-Rundgang below).

## Architecture

`src/pages/**/*.astro` are thin shells around React islands;
`src/layouts/Base.astro` carries head/meta, the Header (with the Fahrprofil
chip), the AccountSync, CompareTray and BottomTabBar islands and the static
Footer. `chrome="minimal"` (the sell wizard) drops all of it for a
wordmark and a close link. Content pages (Hilfe, Sicherheit, legal) use
`src/layouts/Info.astro`.

**Prerendered from the live database at build time:** every listing
(`/inserat/[slug]`), every catalog brand and model (`/modelle/…`) and every
garage page (`/garagen/[slug]`) — per-page `<title>`, OG tags and
schema.org JSON-LD in the initial HTML. Listings and garage pages created
after the last build are served by `404.astro`, which reads the slug from the
URL and renders the island client-side; a rebuild (push,
`workflow_dispatch`, or the Supabase webhook) promotes them to static pages.

Account pages are static shells too: the conversation and the listing being
edited come from query parameters (`/konto/nachrichten?c=…`,
`/verkaufen/neu?id=…`), so no server is needed.

### Where things live

```
src/
  pages/**/*.astro           ← shells: meta, JSON-LD, build-time snapshots
  layouts/                   ← Base (site chrome) · Info (content pages)
  content/                   ← blog/*.mdx · ratgeber/*.mdx (content.config.ts)
  components/
    layout/                  ← Header · Fahrprofil (chip + sheet) · BottomTabBar ·
                               CompareTray · AccountSync · ThemeToggle · Footer
    search/                  ← QuickSearch · SearchBox · FilterSidebar ·
                               VehicleFilter · ResultsMap · SaveSearch
    listing/                 ← ListingCard/Row · Gallery · CostBreakdown ·
                               Financing · ContactSheet · ReportSheet · CarGraphic
    models/                  ← model guide: index, costs, offers
    sell/                    ← SellWizard · PhotoStep · VideoStep · VehiclePicker ·
                               PreisCheckPage · draft.ts (draft ↔ row)
    konto/                   ← KontoLayout + one page per /konto/* route, AdminPage
    garage/                  ← public garage profile
    content/                 ← MDX building blocks (ModelBox, SearchTeaser, …),
                               Monatsbrief box, charging-card comparison
    pages/*.tsx              ← the remaining one-island routes
    ui.tsx                   ← Button · Chip · Sheet · Stepper · ChargeBar · …
  hooks/                     ← useCockpit (Fahrprofil) · useCosts · useListings ·
                               useMerkliste · useMarket · useSession · useProfile ·
                               useUnread · useAccountSettings · useVehicleCatalog …
  stores/                    ← nanostores: cockpit · listings · merkliste ·
                               session · ui · vehicleCatalog
  lib/
    filters.ts               ← what a search URL parameter means; sorting
    priceCheck.ts            ← Preis-Check: comparables → range
    quality.ts               ← Inserat-Qualität 0–100 % and next steps
    vehicleCatalog.ts        ← catalog types, labels, catalog → listing specs
    build*.ts                ← build-time snapshots (listings, catalog, garages)
    supabase.ts · mappers.ts ← client, row types, row → Listing
    video.ts                 ← video URLs, limits, signed upload to R2
  utils/
    costModel.ts             ← THE calculation (computeCosts)
    format.ts                ← display names, segment/seller/status labels
    search.ts                ← the local instant search
    image.ts · videoPrepare.ts ← photo resize; video check + conversion (Mediabunny)
    swiss.ts · plzResolver.ts← PLZ → Gemeinde → tariff, fmtCH
  data/
    evData.ts                ← types, 12 offline seed listings, charging cards
    tariffs.json             ← baked ElCom × swisstopo lookup (generated,
                               loaded lazily via utils/plzResolver.ts)
    tariffMeta.json          ← its metadata, bundled on every page
    fuelPrices.json          ← baked BFS pump prices (generated)
supabase/
  migrations/                ← schema, RLS, triggers, cron
  functions/                 ← Edge Functions (see Backend); _shared/r2.ts signs R2 requests
  seed/                      ← vehicle catalog, demo listings
```

### Two rules that keep it honest

1. **One calculation.** `computeCosts()` in `src/utils/costModel.ts` is the
   only implementation of the cost model. The «Betrieb» figure on a card,
   the cost breakdown on a listing, `/kosten`, the model pages and the
   compare table all call it through `useCosts`.
2. **One display name.** `vehicleTitle()` in `src/utils/format.ts` renders
   every brand/model. Legacy all-caps rows are normalised on the way out, so
   an imported `VW ID.7 TOURER PRO S` still reads `VW ID.7 Tourer Pro S`.

### Shared, persisted state
- **Fahrprofil** (`ev4u.cockpit.v1`): PLZ → municipality and tariff, km per
  year, the car driven today, home charger, share charged on the road,
  solar, plus the compare tray (up to 4). Set in one sheet, opened from the
  header chip, from every «für dich →» link and inline on
  `/konto/einstellungen`; logged-in users get it synced to their private
  `account_settings` row.
- **Merkliste** (`ev4u.merkliste.v1`): local-first, no login needed. Each
  entry keeps the price at saving time and a note; on login it merges into
  `favorites`, which is what the alert e-mails watch.

## Site structure

The header carries the menus **Kaufen · Verkaufen · Modelle · Wissen**,
the search box, the Fahrprofil chip, Merkliste, Nachrichten, the account
menu and «Inserieren». Below `md` a bottom tab bar takes over.

| Route | Job |
|-------|-----|
| `/` | Hero search, entry rows (Karosserie, Budget, Themen) with counts, «Neu eingetroffen», cost teaser, popular models, sell teaser, blog, Beratung |
| `/inserate` | Search: filter sidebar (sheet on mobile) **with hit counts**, grid · list · map, sort incl. «Tiefste Betriebskosten» and «Nächste zuerst», Suchabo. Filters live in the URL (`?seg=SUV&preis=40000&garantie=1`) |
| `/inserat/:slug` | Gallery (with the Video-Rundgang, if any), price and contact first; battery & warranty, Alltag, Laden, cost per year with financing example, equipment & condition, specs, price history, the model, seller (garage badge, response time), similar listings, «Inserat melden» |
| `/merkliste` | Saved cars without login: price changes since saving, sold/reserved, notes |
| `/vergleich` | Up to 4 listings side by side, specs and computed cost, best value highlighted; `?ids=a,b,c` is adopted into the tray |
| `/finder` | Six questions → matching listings |
| `/modelle` · `/modelle/[marke]` · `/modelle/[marke]/[modell]` | The catalog as a model guide: variants, range, charging, warranty, list price, running costs, used offers |
| `/kosten` | Cost calculator against your current car, «Umsteigen» mode, financing example (`/rechenwerk` redirects here) |
| `/verkaufen` · `/verkaufen/neu` · `/verkaufen/preis-check` | Sell landing; 7-step wizard with autosave, up to 12 photos plus an optional video, quality meter (`?id=` edits); free valuation |
| `/garagen` · `/garagen/[slug]` | Offer for garages; public garage page with inventory |
| `/blog` · `/blog/[slug]` · `/blog/kategorie/[kategorie]` · `/rss.xml` | Dated posts (MDX) |
| `/ratgeber` · `/ratgeber/[slug]` · `/ratgeber/ladekarten` | Evergreen guides; interactive charging-card comparison |
| `/beratung` · `/monatsbrief` | Call-back booking with Gabriel; the monthly newsletter (double opt-in) |
| `/konto` · `/konto/{inserate,nachrichten,suchabos,einstellungen,garage}` | Dashboard, my listings with stats, inbox (`?c=`), search alerts, settings (Fahrprofil, notifications, delete account), garage profile and leads |
| `/login` · `/admin` | Magic link (`?next=`); moderation: reports, garage verification, listings |
| `/hilfe` · `/sicherheit` · `/ueber-uns` · `/kontakt` · `/impressum` · `/datenschutz` · `/agb` | Help (FAQ JSON-LD), safety, about, legal |


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

Insurance and depreciation are **not** in the model, and every cost view says so;
financing is shown separately as an example (with the KKG notice).

## Backend (Supabase)

The only backend is a Supabase project (Postgres, region **Zürich /
eu-central-2**). All authorization is **Row Level Security** in the
database; the few things a browser must not do run as Edge Functions.

| Table | Policies |
|-------|----------|
| `listings` | AKTIV/RESERVIERT/VERKAUFT public unless `hidden_at` is set; ENTWURF and PAUSIERT owner-only; writes restricted to `owner = auth.uid()`. `hidden_at`, `created_at` and the `slug` (once set) are admin/platform-only (trigger); the slug must look like `tesla-model-y-k3f9` — it becomes a path at build time. Seller-entered battery warranty (`battery_warranty_until/_km/_soh_pct` — never computed), condition, `equipment` jsonb, `negotiable`, at most 12 `photos`, one video (`video_path / _seconds / _poster`, files in the owner's folder) |
| `listing_price_history` | every price, logged by trigger — «Preis gesenkt», Merkliste changes, the price chart |
| `listing_events` | views / contacts / saves per day; written only through `track_listing_event()`, read by owner and admins (account stats). `listing_save_count()` is the one public number |
| `reports` | «Inserat melden»: anyone may insert, only admins read. Three distinct logged-in reporters set `hidden_at` (trigger) until an admin looks |
| `profiles` | public read (seller name, garage page: slug, address, hours, logo, …); `verified` is admin-only (trigger); auto-created on signup |
| `account_settings` | private, owner-only: the Fahrprofil and the notification switches (`notify_messages`, `notify_alerts`) |
| `favorites` | the synced Merkliste: note, `saved_price`, and what the last alert reported |
| `saved_searches` | the filter URL as-is, plus alert `frequency` (SOFORT · TAEGLICH · WOECHENTLICH · AUS) and `last_notified_at` / `last_opened_at` |
| `conversations` / `messages` | buyer ↔ seller messaging: visible **only** to the two participants; senders can't be spoofed. `seller_response_minutes()` gives the «antwortet meist innert …» badge |
| `newsletter_subscribers` | the Monatsbrief, double opt-in; RLS without policies and no API grants — only the `newsletter` function touches it |
| `job_runs` | leases for scheduled functions (`alerts`: one run per 20 min); service role only |
| `bookings` | Beratung call-backs: **write-only**, validated anonymous insert |
| `canton_taxes` | **operator config**, weight-based: `rate_per_100kg` + `ev_discount_pct` + `tax_year`. Public read, no client write; bundled fallback when offline |
| `vehicle_brands` / `vehicle_models` / `vehicle_variants` | **reference data**, the EV catalog (see below): public read, no client write |
| `user_roles` | **admin flag**; `private.is_admin()` (security definer, in a schema the API doesn't expose) backs the admin branches of the RLS policies. The UI only decides what to *show* |
| storage `listing-photos` | public object URLs; uploads/deletes only into the user's own `uid/` folder (listing photos, garage logo); JPEG only, max 5 MB |

**Edge Functions** (`supabase/functions/`, all behind the JWT gateway):

| Function | Job |
|----------|-----|
| `notify-message` | called by a pg_net trigger on message insert; mails the other participant a link into the thread — not when they switched it off, and only once per unread burst (30 min). Each message is claimed once (`messages.notified_at`), so replayed calls mail nothing |
| `alerts` | **pg_cron every 30 min** (`ev4u-alerts`, lease in `job_runs`): new hits for due saved searches (frequency, max 5 per mail; the «Umkreis» filter uses `alerts/plz.json`) and Merkliste changes (price cut, reserved, sold, offline, available again) |
| `newsletter` | Monatsbrief subscribe → confirmation mail, confirm, unsubscribe; one answer for every case, rate-limited |
| `delete-account` | removes the caller's photos and videos, then the auth user; everything else cascades |
| `video-upload` | signs a PUT link to R2 for exactly one converted video (type and byte size are part of the signature, max 60 MB, at most one video per listing + 2 per account) and deletes videos — the owner's, or any for admins |
| `suche` | AI search: a description («familientauglicher Kombi bis 40'000») becomes the same URL filters the sidebar writes. 8 s timeout, falls back to text search; the site works without it |

Secrets: `RESEND_API_KEY`, `MAIL_FROM`, `SITE_URL` (mail functions — without
the key they log and exit cleanly), `GEMINI_API_KEY` (`suche`) and
`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`
(videos, see below — without them `video-upload` answers 503). Deploy with
`supabase functions deploy <name> --project-ref <ref> --use-api`.

- **Auth**: passwordless magic links (`signInWithOtp`) on `/login?next=…`.
  One session fetch and one `onAuthStateChange` subscription per page
  (`src/stores/session.ts`).
- **Sell wizard**: the draft autosaves to `localStorage` until every
  required field is valid (`canPersist` — the row has NOT NULL specs and
  price), then to an ENTWURF row on every step; publishing needs a photo. Photos are
  downscaled client-side (max 1600 px, JPEG ~82 % — `src/utils/image.ts`),
  max 12 (also a check constraint), reorderable; the first is the cover.
  Plus an optional Video-Rundgang (below).
- **Client**: `src/lib/supabase.ts` with `PUBLIC_SUPABASE_URL` +
  `PUBLIC_SUPABASE_PUBLISHABLE_KEY`. The publishable key is safe in the
  client; RLS does the guarding.
- **Production checklist**: set the Auth *Site URL* + redirect allow-list to
  your domain, configure custom SMTP, set the function secrets above,
  set up R2 for videos with a custom domain instead of r2.dev (below),
  enable Point-in-Time Recovery, fill in the operator details on
  `/impressum`, `/datenschutz` and `/agb` (marked as drafts) and have them
  reviewed, **remove the demo listings** (below).

### Video-Rundgang (Cloudflare R2)

One optional walkthrough video per listing, **at most 3 minutes**. The
browser does the heavy lifting (`src/utils/videoPrepare.ts`, Mediabunny over
WebCodecs): it checks the length, converts to MP4 (H.264 + AAC, longer
edge 1280 px, ~2 Mbit/s — about 45 MB for 3 minutes), drops all metadata
(phone videos carry the GPS position) and grabs a poster frame. The
`video-upload` function signs a PUT link and the file goes **straight to
R2** — no video passes through Supabase. The poster lands in
`listing-photos`; `listings.video_path / video_seconds / video_poster` hold
the rest, with checks that both paths sit in the owner's folder.

R2's free tier (10 GB per Cloudflare account, no egress fees) holds about
220 three-minute videos; beyond that $0.015 per GB-month. Replaced or
removed videos are deleted, so storage follows the live listings.

The whole feature stays hidden until `PUBLIC_VIDEO_BASE_URL` is set. Setup:

1. Cloudflare → R2 → create bucket `ev4u-videos`, location **Western
   Europe**. Settings → *Public Development URL* → enable (later: a custom
   domain such as `video.ev4u.ch` — the r2.dev URL is rate-limited).
2. Same page → *CORS policy*:
   ```json
   [{ "AllowedOrigins": ["http://localhost:4321", "https://testosteronny.github.io", "https://ev4u.ch"],
      "AllowedMethods": ["PUT", "GET", "HEAD"], "AllowedHeaders": ["content-type"], "MaxAgeSeconds": 3600 }]
   ```
3. R2 → *Manage API tokens* → *Object Read & Write*, only `ev4u-videos`.
   Then `supabase secrets set R2_ACCOUNT_ID=… R2_ACCESS_KEY_ID=…
   R2_SECRET_ACCESS_KEY=… R2_BUCKET=ev4u-videos --project-ref <ref>`.
4. The public URL from step 1 as GitHub repository variable
   `PUBLIC_VIDEO_BASE_URL` (Settings → Secrets and variables → Actions →
   Variables) and in your local `.env`.

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

- `public/sitemap.xml`, regenerated in CI before every build by
  `npm run sitemap`: the indexable pages, blog posts and categories, guides,
  every catalog brand and model, garage pages and live (non-demo) listings.
  IndexNow gets the list after each deploy (`scripts/submit-indexnow.mjs`).
- `public/robots.txt` keeps `/konto`, `/admin` and `/login` out;
  `noindex` on Merkliste, Vergleich, the sell wizard and demo listings.
- `public/llms.txt` for generative engines; `/rss.xml` for the blog.
- **JSON-LD in the prerendered HTML**: Car/Offer + BreadcrumbList per
  listing, ItemList on `/inserate`, ProductModel + AggregateOffer per model,
  BlogPosting / Article, AutoDealer per garage, FAQPage on `/hilfe`.
- `404.astro` is `noindex,follow`: it doubles as the client fallback for
  listings and garage pages newer than the last build.

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
   of the address PLZ within ±40. The Fahrprofil shows which delivery PLZ the
   tariff came from.
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

**Picker** (`sell/VehiclePicker.tsx`, state shared via `stores/vehicleCatalog.ts`):
native selects for brand and model — models grouped into current, no longer
sold new and announced — and the variant as radio cards with battery, power,
drive, range and list price. A model with one variant preselects it. Every
level can be typed in when the car is missing; «Weiss ich nicht genau» keeps
the model link without guessing specs. Brands + models arrive in one embedded
select, variants per model on demand.

**Buyer filter** (`search/VehicleFilter.tsx` on `/inserate`, «Marke & Modell»): the
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

1. **Payments** — Stripe Checkout via Edge Function + webhook for «Boost»
   and the Garage-Abo. `/garagen` and `/verkaufen` show the plans; nothing
   is charged yet.
2. **Verification** — phone (SMS) verification for private sellers and an
   automated Zefix lookup for garages. Today an admin checks the UID by hand
   on `/admin` (Zefix link) and sets «Verifizierte Garage».
3. **Certified SOH** — today the SOH is the seller's statement and is
   labelled as such. A `soh_verified_at` column plus a partner check turns
   it into a claim EV4U can stand behind.
4. **Partner offers** — insurance and financing are shown as labelled
   estimates (KKG notice), not as offers from a named partner.
5. **Orphaned photos** — an admin deleting someone else's listing leaves its
   photos in storage (storage policies are owner-only); a scheduled sweep
   with the service role would clean them up.
6. **FR/IT localization** — Romandie/Ticino.
7. **Analytics** — privacy-friendly (Plausible), one script tag.
8. **OG image** — a designed share card (currently text-only OG tags).

## Design tokens

All colours are CSS variables (`--c-*` RGB triplets in `src/index.css`).
Light is the default; an explicit choice (footer, account menu, settings)
wins, otherwise the system preference decides, applied pre-paint by an
inline script (no flash).

| Token | Light | Job |
|-------|-------|-----|
| `canvas` | `#F3F5F2` | tinted page; white `surface` cards sit on it without a frame |
| `forest` | `#062A19` | hero, footer, brand panels (`on-forest` text) |
| `accent` | `#0F7A43` | buttons, links, active state, focus ring |
| `volt` | `#3BD683` | highlights on dark surfaces, «Neu» — never text on light |
| `bar` | `#1A9E58` | Ladebalken fill (volt fails 3:1 on white) |
| `soft` / `faint` | `#DDF3E6` / `#EEF8F2` | positive badges, selected chips / tip boxes, the monthly-cost box |
| `caution` | `#A86200` | warnings, «geschätzt» |

Dark mode redefines every token under `html.dark`. Uppercase appears only in
`.eyebrow`.

## Mobile
Grids stack to one column, the filter sidebar becomes a sheet behind a
sticky «Filter · Sortieren · Suchabo» bar, touch targets stay ≥ 44 px, and a
bottom tab bar (Suchen · Merkliste · Inserieren · Nachrichten · Konto)
replaces the header menus below `md`.

## Placeholders & Bilder
Every listing shows a visual: the seller's first photo when uploaded,
otherwise a technical side-elevation line drawing of the segment
(`listing/CarGraphic.tsx`). The gallery shows the drawing instead of an
empty frame.
