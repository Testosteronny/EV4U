import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUpDown, LayoutGrid, List, Map as MapIcon, MapPin, SlidersHorizontal, X } from "lucide-react";
import FilterSidebar, { type FacetCount } from "../search/FilterSidebar";
import ResultsMap from "../search/ResultsMap";
import SaveSearch, { useAboParam } from "../search/SaveSearch";
import { selectionLabels, useVehicleSelection } from "../search/VehicleFilter";
import ListingCard from "../listing/ListingCard";
import ListingRow from "../listing/ListingRow";
import { Breadcrumbs, Button, EmptyState, FilterChip, Segmented, Select, Sheet } from "../ui";
import { openFahrprofil } from "../../stores/ui";
import { useCockpit } from "../../hooks/useCockpit";
import { useListings } from "../../hooks/useListings";
import { useMarket } from "../../hooks/useMarket";
import {
  AI_KEYS,
  DEFAULT_FILTERS,
  FILTER_KEYS,
  PREDICATES,
  SORTS,
  activeKeys,
  filterChips,
  filterParams,
  passes,
  readFilters,
  readSort,
  resultsTitle,
  sorter,
  withDependents,
  type FilterKey,
  type Filters,
  type SortKey,
} from "../../lib/filters";
import { takeAiNote, type AiNote } from "../../lib/aiSearch";
import { href } from "../../lib/url";
import { fmtCH } from "../../utils/swiss";
import type { Listing } from "../../data/evData";

/* ============================================================================
   /inserate — search and results (Konzept v3 §4.2).

   The URL is the only source of truth: filters (lib/filters.ts), `sort`,
   `ansicht` (liste | karte) and `plz` (origin of the radius). The page
   hydrates with empty filters and adopts the URL right after mount — the
   prerendered HTML can't know the query.

   Layout: sticky filter sidebar left (a drawer on the phone), results right
   with a dynamic H1, active-filter chips, sort and view, a Fahrprofil tip
   when no PLZ is set, the Suchabo CTA after the first rows, and an empty
   state that names the narrowest filter.
   ============================================================================ */

type View = "raster" | "liste" | "karte";
const PAGE = 24;

export default function ResultsPage({ initial }: { initial?: Listing[] }) {
  const { listings } = useListings(initial);
  const { gemeinde, hydrated } = useCockpit();

  const [sp, setSpState] = useState(() => new URLSearchParams());
  const [aiNote, setAiNote] = useState<AiNote | null>(null);
  const [shown, setShown] = useState(PAGE);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [aboOpen, clearAbo] = useAboParam();

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search);
    // The Merkliste used to be a filter of this page.
    if (fromUrl.get("fav") === "1") {
      window.location.replace(href("/merkliste"));
      return;
    }
    if (fromUrl.get("ai") === "1") setAiNote(takeAiNote());
    AI_KEYS.forEach((k) => fromUrl.delete(k));
    fromUrl.delete("abo");
    setSpState(fromUrl);
  }, []);

  const setSp = useCallback((next: URLSearchParams) => {
    AI_KEYS.forEach((k) => next.delete(k));
    const query = next.toString();
    history.replaceState(null, "", query ? `${location.pathname}?${query}` : location.pathname);
    setSpState(next);
    setShown(PAGE);
  }, []);

  const f = useMemo(() => readFilters(sp), [sp]);
  const sort = readSort(sp);
  const view: View = sp.get("ansicht") === "liste" ? "liste" : sp.get("ansicht") === "karte" ? "karte" : "raster";
  const plzParam = /^\d{4}$/.test(sp.get("plz") ?? "") ? sp.get("plz") : null;

  /** Apply a filter patch, keeping sort, view and origin. */
  const set = useCallback(
    (patch: Partial<Filters>) => {
      const nextF = { ...f, ...patch };
      // Changing the brand drops model and variant.
      if ("marke" in patch && patch.marke !== f.marke) {
        nextF.modell = patch.modell ?? "";
        nextF.variante = patch.variante ?? "";
      }
      if ("modell" in patch && patch.modell !== f.modell) nextF.variante = patch.variante ?? "";
      const next = filterParams(nextF);
      for (const k of ["sort", "ansicht", "plz"]) {
        const v = sp.get(k);
        if (v) next.set(k, v);
      }
      setSp(next);
    },
    [f, sp, setSp],
  );

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(sp);
    if (value) next.set(key, value);
    else next.delete(key);
    setSp(next);
  };

  const clearKey = (key: FilterKey) => {
    const patch: Partial<Filters> = {};
    for (const k of withDependents(key)) (patch as Record<string, unknown>)[k] = DEFAULT_FILTERS[k];
    set(patch);
  };

  const clearAll = () => {
    const next = new URLSearchParams();
    for (const k of ["sort", "ansicht", "plz"]) {
      const v = sp.get(k);
      if (v) next.set(k, v);
    }
    setSp(next);
  };

  const forSale = useMemo(() => listings.filter((l) => l.status !== "VERKAUFT"), [listings]);
  const market = useMarket(forSale, plzParam);
  const ctx = market.ctx;

  const rows = useMemo(
    () => forSale.filter((l) => passes(l, f, ctx)).sort(sorter(sort, ctx)),
    [forSale, f, ctx, sort],
  );

  /* Facet counts — «how many hits would this value give, all OTHER filters
     kept?» One pass per filter key over the stock, not one per option. */
  const count = useMemo<FacetCount>(() => {
    const pools = {} as Record<FilterKey, Listing[]>;
    for (const key of FILTER_KEYS) pools[key] = forSale.filter((l) => passes(l, f, ctx, key));
    return (key, value) => {
      const probe = { ...f, [key]: value } as Filters;
      return pools[key].filter((l) => PREDICATES[key](l, probe, ctx)).length;
    };
  }, [forSale, f, ctx]);

  const vehicle = { marke: f.marke, modell: f.modell, variante: f.variante };
  const selection = useVehicleSelection(vehicle, f.modell !== "");
  const names = selectionLabels(vehicle, selection);
  const chipNames = { modell: names.model, variante: names.variant };
  const chips = filterChips(f, chipNames).map((c) => (c.key === "marke" ? { ...c, label: names.brand } : c));
  const title = resultsTitle({ ...f, marke: f.marke ? names.brand : "" }, chipNames);
  const stockBrands = useMemo(() => Array.from(new Set(forSale.map((l) => l.brand))).sort(), [forSale]);

  const crumbs = [
    { label: "Start", href: href("/") },
    { label: "Inserate", href: href("/inserate") },
    ...(f.marke ? [{ label: names.brand, href: `${href("/inserate")}?marke=${encodeURIComponent(f.marke)}` }] : []),
    ...(f.modell ? [{ label: names.model }] : []),
  ];

  /** The single filter that costs the most hits — named in the empty state. */
  let worst: { key: FilterKey; label: string; gain: number } | null = null;
  if (rows.length === 0) {
    for (const c of chips) {
      const gain = forSale.filter((l) => passes(l, f, ctx, c.key)).length;
      if (gain > 0 && (!worst || gain > worst.gain)) worst = { ...c, gain };
    }
  }

  const searchQuery = filterParams(f).toString();
  const aboLabel = [title.replace(/ Occasionen$/, ""), ...chips.filter((c) => !["marke", "modell", "seg"].includes(c.key)).map((c) => c.label)]
    .join(" · ")
    .slice(0, 120);
  const noProfile = hydrated && !gemeinde;
  const sortLabel = SORTS.find((s) => s.key === sort)?.label ?? "";

  const sidebar = (
    <FilterSidebar
      f={f}
      set={set}
      count={count}
      stockBrands={stockBrands}
      origin={market.origin}
      setOriginPlz={(plz) => setParam("plz", plz || null)}
    />
  );

  const visible = rows.slice(0, shown);
  const cardProps = (l: Listing) => ({
    listing: l,
    monthly: market.monthly.get(l.id),
    distance: market.distance.get(l.id),
  });

  return (
    <div className="mx-auto max-w-page animate-fade-in px-4 py-6 sm:px-6 sm:py-8">
      <Breadcrumbs items={crumbs} />
      <div className="mt-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <h1 className="text-display font-bold text-fg">
          {title}
          <span className="ml-2 align-middle text-h2 font-semibold text-fg3 tabular" aria-live="polite">
            {rows.length} {rows.length === 1 ? "Angebot" : "Angebote"}
          </span>
        </h1>
        <div className="hidden md:block">
          <SaveSearch params={searchQuery} label={aboLabel} autoOpen={aboOpen} onAutoOpenHandled={clearAbo} />
        </div>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="hidden lg:block" aria-label="Filter">
          <div className="card sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto p-4 no-scrollbar">{sidebar}</div>
        </aside>

        <section aria-label="Ergebnisse" className="min-w-0">
          {aiNote && (
            <div className="tip mb-4 flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                {aiNote.reply && <p className="text-body text-fg">{aiNote.reply}</p>}
                {aiNote.unsupported.length > 0 && (
                  <p className="mt-1 text-small text-fg2">
                    Dafür gibt es keinen Filter: <span className="text-fg">{aiNote.unsupported.join(", ")}</span>
                  </p>
                )}
                <p className="mt-1 text-small text-fg3">Die Filter darunter kannst du einzeln entfernen.</p>
              </div>
              <button
                type="button"
                onClick={() => setAiNote(null)}
                aria-label="Hinweis ausblenden"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-fg3 hover:bg-surface hover:text-fg"
              >
                <X size={14} aria-hidden />
              </button>
            </div>
          )}

          {chips.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {chips.map((c) => (
                <FilterChip key={c.key} onRemove={() => clearKey(c.key)}>
                  {c.label}
                </FilterChip>
              ))}
              <button
                type="button"
                onClick={clearAll}
                className="text-small font-semibold text-fg2 underline-offset-2 hover:text-fg hover:underline"
              >
                Zurücksetzen
              </button>
            </div>
          )}

          <div className="mb-4 hidden flex-wrap items-center justify-between gap-3 md:flex">
            <label className="flex items-center gap-2 text-small font-semibold text-fg2">
              Sortieren
              <Select
                value={sort}
                onChange={(e) => setParam("sort", e.target.value === "neu" ? null : e.target.value)}
                className="h-9 w-auto py-0 text-small"
              >
                {SORTS.map((s) => (
                  <option key={s.key} value={s.key} disabled={s.key === "distanz" && !market.origin}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </label>
            <Segmented<View>
              label="Ansicht"
              size="sm"
              value={view}
              onChange={(v) => setParam("ansicht", v === "raster" ? null : v)}
              options={[
                { key: "raster", label: <><LayoutGrid size={15} aria-hidden /> Raster</> },
                { key: "liste", label: <><List size={15} aria-hidden /> Liste</> },
                { key: "karte", label: <><MapIcon size={15} aria-hidden /> Karte</> },
              ]}
            />
          </div>

          {rows.length === 0 ? (
            <EmptyState
              title="Keine Inserate für diese Kombination."
              hint={
                worst
                  ? `Der Filter «${worst.label}» schliesst am meisten aus — ohne ihn wären es ${worst.gain} Angebote. Oder speichere die Suche: wir melden uns beim nächsten Treffer.`
                  : "Im Moment ist nichts Passendes online. Speichere die Suche, dann melden wir uns beim nächsten Treffer."
              }
            >
              {worst && (
                <Button onClick={() => clearKey(worst!.key)} variant="primary" size="sm">
                  «{worst.label}» entfernen
                </Button>
              )}
              <SaveSearch params={searchQuery} label={aboLabel} />
              {chips.length > 1 && (
                <Button onClick={clearAll} variant="ghost" size="sm">
                  Alle Filter zurücksetzen
                </Button>
              )}
            </EmptyState>
          ) : view === "karte" ? (
            <ResultsMap listings={rows} market={market} radius={f.umkreis} />
          ) : (
            <>
              <div className={view === "liste" ? "grid gap-3" : "grid gap-4 sm:grid-cols-2 xl:grid-cols-3"}>
                {visible.map((l, i) => {
                  const extras: React.ReactNode[] = [];
                  // After the first row: the Fahrprofil tip (only without PLZ)…
                  if (i === (view === "liste" ? 2 : 3) && noProfile) {
                    extras.push(
                      <div key="tip" className={`tip flex flex-wrap items-center justify-between gap-3 p-4 ${view === "raster" ? "sm:col-span-2 xl:col-span-3" : ""}`}>
                        <p className="flex items-center gap-2 text-body text-fg">
                          <MapPin size={18} className="shrink-0 text-accent" aria-hidden />
                          PLZ eingeben, und jedes Auto zeigt Betriebskosten und Entfernung für deinen Ort.
                        </p>
                        <Button variant="secondary" size="sm" onClick={openFahrprofil}>
                          PLZ eingeben
                        </Button>
                      </div>,
                    );
                  }
                  // …and after two rows: the Suchabo.
                  if (i === (view === "liste" ? 5 : 6)) {
                    extras.push(
                      <div key="abo" className={`forest flex flex-wrap items-center justify-between gap-4 rounded-card p-5 ${view === "raster" ? "sm:col-span-2 xl:col-span-3" : ""}`}>
                        <div>
                          <p className="text-h3 font-bold">Nichts verpassen</p>
                          <p className="text-body text-on-forest2">Neue Treffer für «{aboLabel || "diese Suche"}» per E-Mail.</p>
                        </div>
                        <SaveSearch params={searchQuery} label={aboLabel} variant="onForest" />
                      </div>,
                    );
                  }
                  const card =
                    view === "liste" ? (
                      <ListingRow key={l.id} {...cardProps(l)} />
                    ) : (
                      <ListingCard key={l.id} {...cardProps(l)} priority={i < 3} />
                    );
                  return extras.length ? [...extras, card] : card;
                })}
              </div>
              {rows.length > shown && (
                <div className="mt-8 text-center">
                  <Button variant="secondary" onClick={() => setShown((n) => n + PAGE)}>
                    Weitere {Math.min(PAGE, rows.length - shown)} laden
                  </Button>
                  <p className="mt-2 text-small text-fg3">
                    {shown} von {rows.length}
                  </p>
                </div>
              )}
            </>
          )}

          {rows.length > 0 && (
            <p className="mt-6 text-small text-fg3">
              Betrieb pro Monat: Strom zu deinem Tarif, Wartung und kantonale Verkehrssteuer — ohne Finanzierung
              und Versicherung. {activeKeys(f).length === 0 && `${fmtCH(forSale.length)} Inserate online.`}
            </p>
          )}
        </section>
      </div>

      {/* Phone: sticky bar above the tab bar */}
      <div className="fixed inset-x-0 bottom-16 z-40 border-t border-line bg-surface/95 px-4 py-2 backdrop-blur-md md:hidden">
        <div className="flex items-center gap-2">
          <Button variant="primary" size="sm" className="flex-1" onClick={() => setFiltersOpen(true)}>
            <SlidersHorizontal size={15} aria-hidden /> Filter{chips.length > 0 && ` (${chips.length})`}
          </Button>
          <Button variant="secondary" size="sm" className="flex-1" onClick={() => setSortOpen(true)}>
            <ArrowUpDown size={15} aria-hidden /> Sortieren
          </Button>
          <SaveSearch params={searchQuery} label={aboLabel} compact />
        </div>
      </div>

      {filtersOpen && (
        <Sheet
          title="Filter"
          side
          onClose={() => setFiltersOpen(false)}
          footer={
            <>
              <Button variant="ghost" size="sm" onClick={clearAll}>
                Zurücksetzen
              </Button>
              <Button variant="primary" onClick={() => setFiltersOpen(false)}>
                {rows.length} {rows.length === 1 ? "Angebot" : "Angebote"} anzeigen
              </Button>
            </>
          }
        >
          {sidebar}
        </Sheet>
      )}

      {sortOpen && (
        <Sheet title="Sortieren und Ansicht" onClose={() => setSortOpen(false)}>
          <div className="space-y-1">
            {SORTS.map((s) => (
              <button
                key={s.key}
                type="button"
                disabled={s.key === "distanz" && !market.origin}
                onClick={() => {
                  setParam("sort", s.key === "neu" ? null : (s.key as SortKey));
                  setSortOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-control px-3 py-3 text-left text-body disabled:opacity-40 ${
                  sort === s.key ? "bg-soft font-semibold text-accent" : "text-fg hover:bg-surface2"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="mt-5">
            <Segmented<View>
              label="Ansicht"
              value={view}
              onChange={(v) => {
                setParam("ansicht", v === "raster" ? null : v);
                setSortOpen(false);
              }}
              options={[
                { key: "raster", label: "Raster" },
                { key: "liste", label: "Liste" },
                { key: "karte", label: "Karte" },
              ]}
            />
          </div>
          <p className="mt-4 text-small text-fg3">Aktuell: {sortLabel}</p>
        </Sheet>
      )}
    </div>
  );
}
