import { useCallback, useEffect, useMemo, useState } from "react";
import { BookmarkPlus, Compass, Heart, LayoutGrid, List, X } from "lucide-react";
import ListingBoard from "../ListingBoard";
import ListingCard from "../ListingCard";
import AutoFinder, { type FinderParams } from "../AutoFinder";
import SearchBox from "../SearchBox";
import VehicleFilter, {
  selectionLabels,
  useVehicleSelection,
  type VehicleFilterValue,
} from "../VehicleFilter";
import {
  Badge,
  Button,
  EmptyState,
  FilterChip,
  OptionRow,
  PageHeader,
  Popover,
  Slider,
} from "../ui";
import { useFavorites } from "../../hooks/useFavorites";
import { useListings } from "../../hooks/useListings";
import { useSession } from "../../hooks/useSession";
import {
  AI_KEYS,
  ANBIETER,
  DC_STEPS,
  FILTER_KEYS,
  PRICE_MAX,
  PRICE_MIN,
  PREDICATES,
  RANGE_STEPS,
  SITZE,
  passes,
  readFilters,
  type Filters,
} from "../../lib/filters";
import { supabase } from "../../lib/supabase";
import { SEGMENT_LABEL, SELLER_LABEL } from "../../utils/format";
import { fmtCH } from "../../utils/swiss";
import { SEGMENTS, SORTS, type Listing, type Segment, type SortKey } from "../../data/evData";

/* ============================================================================
   /inserate — der Katalog.

   Gegenüber vorher:
   · Freitextsuche (fehlte komplett)
   · Filter als Popover MIT Trefferzahl je Option, statt einer immer offenen
     Konsole, die ~200 px über dem Falz kostete
   · Reichweite, Ladeleistung und V2X sind echte Filter — vorher konnte sie
     nur das Finder-Quiz setzen, was eine eigene Chip-Sonderbehandlung nötig
     machte. Jetzt gibt es EINE Chip-Reihe für alles Aktive.
   · Raster als Default, Liste als dichter Modus
   · Leerzustand nennt den restriktivsten Filter und bietet ihn zum Entfernen

   Die URL bleibt die einzige Quelle der Wahrheit und die Parameternamen
   bleiben unverändert — gespeicherte Suchen aus der alten Version
   funktionieren weiter. Was ein Parameter bedeutet, steht in lib/filters.ts.
   ============================================================================ */

const SORT_LABEL = (k: SortKey) => SORTS.find((s) => s.key === k)?.label ?? "Sortieren";

export default function InseratePage({ initial }: { initial?: Listing[] }) {
  const { listings } = useListings(initial);
  const { favorites, canFavorite } = useFavorites();
  const { session } = useSession();

  // Der vorgerenderte HTML kennt die Query nicht — würden wir sie schon im
  // ersten Client-Render lesen, unterschiede sich der Baum vom Server und
  // React verwirft die Hydration. Also: mit leeren Filtern hydrieren, die
  // URL direkt danach übernehmen (gleiche Strategie wie im Cockpit).
  const [sp, setSpState] = useState(() => new URLSearchParams());
  // Begleittext der KI-Suche. Steht in der URL (damit ein geteilter Link ihn
  // mitbringt), ist aber kein Filter — deshalb eigener State, und raus aus
  // den Params, sobald jemand etwas verstellt.
  const [aiNote, setAiNote] = useState<{ reply: string; unsupported: string[] } | null>(null);

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search);
    if (fromUrl.get("ai") === "1") {
      const reply = fromUrl.get("airx") ?? "";
      const unsupported = (fromUrl.get("aino") ?? "").split("|").filter(Boolean);
      if (reply || unsupported.length) setAiNote({ reply, unsupported });
    }
    AI_KEYS.forEach((k) => fromUrl.delete(k));
    if (fromUrl.toString()) setSpState(fromUrl);
  }, []);

  const setSp = useCallback((next: URLSearchParams) => {
    AI_KEYS.forEach((k) => next.delete(k));
    const query = next.toString();
    history.replaceState(null, "", query ? `${location.pathname}?${query}` : location.pathname);
    setSpState(next);
  }, []);

  const [finderOpen, setFinderOpen] = useState(false);
  const [searchSaved, setSearchSaved] = useState(false);
  const [view, setView] = useState<"grid" | "list">("grid");

  // Ansicht ist eine Vorliebe, kein Zustand der Suche — bleibt aus der URL.
  useEffect(() => {
    try {
      const saved = localStorage.getItem("ev4u.view");
      if (saved === "list" || saved === "grid") setView(saved);
    } catch {
      /* privater Modus */
    }
  }, []);
  const changeView = (v: "grid" | "list") => {
    setView(v);
    try {
      localStorage.setItem("ev4u.view", v);
    } catch {
      /* egal */
    }
  };

  const f = useMemo(() => readFilters(sp), [sp]);
  const sort = (sp.get("sort") ?? "price") as SortKey;

  const set = useCallback(
    (key: string, value: string | number, def: string | number) => {
      const next = new URLSearchParams(sp);
      if (String(value) === String(def)) next.delete(key);
      else next.set(key, String(value));
      setSp(next);
      setSearchSaved(false);
    },
    [sp, setSp],
  );

  /** Marke, Modell und Variante gehen immer zusammen in die URL. */
  const setVehicle = (v: VehicleFilterValue) => {
    const next = new URLSearchParams(sp);
    if (v.marke === "ALLE") next.delete("marke");
    else next.set("marke", v.marke);
    for (const key of ["modell", "variante"] as const) {
      if (v[key]) next.set(key, v[key]);
      else next.delete(key);
    }
    setSp(next);
    setSearchSaved(false);
  };

  const vehicle: VehicleFilterValue = { marke: f.marke, modell: f.modell, variante: f.variante };
  // Den Katalog braucht die Seite erst, wenn ein Modell benannt werden muss.
  const selection = useVehicleSelection(vehicle, f.modell !== "");
  const vehicleLabel = selectionLabels(vehicle, selection);

  const applyFinder = (p: FinderParams) => {
    const next = new URLSearchParams(sp);
    for (const [key, val] of Object.entries(p)) {
      if (val === null) next.delete(key);
      else next.set(key, val);
    }
    setSp(next);
    setFinderOpen(false);
  };

  const brands = useMemo(
    () => Array.from(new Set(listings.map((l) => l.brand))).sort(),
    [listings],
  );

  const rows = useMemo(() => {
    const dir = SORTS.find((s) => s.key === sort)?.dir ?? 1;
    return listings
      .filter((l) => passes(l, f, favorites))
      .sort((a, b) => (a[sort] - b[sort]) * dir);
  }, [listings, favorites, f, sort]);

  /* ---- Facettenzahlen ----------------------------------------------------
     „Wie viele Treffer gäbe dieser Wert, wenn alles ANDERE gesetzt bleibt?“
     Einmal je Filterschlüssel über den Bestand, nicht einmal je Option:
     vorher lief pro geöffnetem Popover und Render ein voller Durchlauf je
     Zeile — bei 12 Inseraten unsichtbar, bei 1'000 nicht mehr. */
  const facets = useMemo(() => {
    const pools = {} as Record<keyof Filters, Listing[]>;
    for (const key of FILTER_KEYS) {
      pools[key] = listings.filter((l) => passes(l, f, favorites, key));
    }
    return <K extends keyof Filters>(key: K, value: Filters[K]) => {
      const probe = { ...f, [key]: value } as Filters;
      return pools[key].filter((l) => PREDICATES[key](l, probe, favorites)).length;
    };
  }, [listings, f, favorites]);

  /* ---- Aktive Filter als eine einzige Chip-Reihe ------------------------- */
  type Chip = { key: keyof Filters; label: string; clear: () => void };
  const chips: Chip[] = [];
  if (f.q) chips.push({ key: "q", label: `«${f.q}»`, clear: () => set("q", "", "") });
  if (f.seg !== "ALLE")
    chips.push({
      key: "seg",
      label: SEGMENT_LABEL[f.seg as Segment] ?? f.seg,
      clear: () => set("seg", "ALLE", "ALLE"),
    });
  if (f.marke !== "ALLE")
    chips.push({
      key: "marke",
      label: vehicleLabel.brand,
      clear: () => setVehicle({ marke: "ALLE", modell: "", variante: "" }),
    });
  if (f.modell)
    chips.push({
      key: "modell",
      label: vehicleLabel.model,
      clear: () => setVehicle({ ...vehicle, modell: "", variante: "" }),
    });
  if (f.variante)
    chips.push({
      key: "variante",
      label: vehicleLabel.variant,
      clear: () => setVehicle({ ...vehicle, variante: "" }),
    });
  if (f.anbieter !== "ALLE")
    chips.push({
      key: "anbieter",
      label: SELLER_LABEL[f.anbieter as "PRIVAT" | "GARAGE"] ?? f.anbieter,
      clear: () => set("anbieter", "ALLE", "ALLE"),
    });
  if (f.sitze !== "ALLE")
    chips.push({
      key: "sitze",
      label: `${f.sitze} Sitze`,
      clear: () => set("sitze", "ALLE", "ALLE"),
    });
  if (f.preis < PRICE_MAX)
    chips.push({
      key: "preis",
      label: `bis CHF ${fmtCH(f.preis)}`,
      clear: () => set("preis", PRICE_MAX, PRICE_MAX),
    });
  if (f.reichweite > 0)
    chips.push({
      key: "reichweite",
      label: `ab ${f.reichweite} km Reichweite`,
      clear: () => set("reichweite", 0, 0),
    });
  if (f.laden > 0)
    chips.push({
      key: "laden",
      label: `ab ${f.laden} kW laden`,
      clear: () => set("laden", 0, 0),
    });
  if (f.v2x)
    chips.push({ key: "v2x", label: "bidirektional", clear: () => set("v2x", "", "") });
  if (f.fav)
    chips.push({ key: "fav", label: "nur Merkliste", clear: () => set("fav", "", "") });

  const clearAll = () => {
    const next = new URLSearchParams();
    const keepSort = sp.get("sort");
    if (keepSort) next.set("sort", keepSort);
    setSp(next);
    setSearchSaved(false);
  };

  /** Welcher einzelne Filter kostet die meisten Treffer? Der Leerzustand
   *  nennt ihn namentlich, statt einen Witz zu machen. */
  let worst: { chip: Chip; gain: number } | null = null;
  if (rows.length === 0) {
    for (const chip of chips) {
      const gain = listings.filter((l) => passes(l, f, favorites, chip.key)).length;
      if (gain > 0 && (!worst || gain > worst.gain)) worst = { chip, gain };
    }
  }

  const saveSearch = async () => {
    if (!supabase || !session) return;
    const label = chips.map((c) => c.label).join(" · ") || "Alle Inserate";
    const { error } = await supabase
      .from("saved_searches")
      .insert({ user_id: session.user.id, label, params: sp.toString() });
    if (!error) setSearchSaved(true);
  };

  return (
    <div className="mx-auto max-w-352 animate-fade-in px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        title={f.fav ? "Merkliste" : "Inserate"}
        lead={
          f.fav
            ? "Die Autos, die du dir gemerkt hast — mit denselben Filtern und Werkzeugen wie der Katalog."
            : "E-Autos von Privaten und Garagen, jedes mit deinen Energiekosten."
        }
      >
        <div className="flex items-center gap-2">
          <Button onClick={() => setFinderOpen(true)} variant="secondary" size="sm">
            <Compass size={15} aria-hidden /> Unsicher? 6 Fragen
          </Button>
          <div className="hidden rounded-card border border-line2 bg-surface2 p-0.5 sm:flex">
            {(
              [
                ["grid", LayoutGrid, "Rasteransicht"],
                ["list", List, "Listenansicht"],
              ] as const
            ).map(([key, Icon, label]) => (
              <button
                key={key}
                onClick={() => changeView(key)}
                aria-pressed={view === key}
                title={label}
                className={`grid h-8 w-8 place-items-center rounded-[7px] transition-colors ${
                  view === key ? "bg-surface text-fg shadow-xs" : "text-fg3 hover:text-fg"
                }`}
              >
                <Icon size={15} aria-hidden />
                <span className="sr-only">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </PageHeader>

      {/* Suche — auf dieser Seite gross, wo der Header keine zeigt */}
      <div className="mt-6 md:hidden">
        <SearchBox initial={f.q} />
      </div>

      {/* Filterzeile */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Popover
          label="Karosserie"
          summary={f.seg !== "ALLE" ? SEGMENT_LABEL[f.seg as Segment] : undefined}
          active={f.seg !== "ALLE"}
        >
          {(close) =>
            SEGMENTS.map((s) => (
              <OptionRow
                key={s}
                label={s === "ALLE" ? "Alle Karosserien" : SEGMENT_LABEL[s]}
                count={facets("seg", s)}
                active={f.seg === s}
                onClick={() => {
                  set("seg", s, "ALLE");
                  close();
                }}
              />
            ))
          }
        </Popover>

        <Popover
          label="Marke & Modell"
          summary={
            f.marke !== "ALLE"
              ? [vehicleLabel.brand, f.modell && vehicleLabel.model].filter(Boolean).join(" ")
              : undefined
          }
          active={f.marke !== "ALLE" || f.modell !== ""}
          width={320}
        >
          {() => (
            <VehicleFilter
              value={vehicle}
              onChange={setVehicle}
              count={(key, val) => facets(key, val)}
              stockBrands={brands}
            />
          )}
        </Popover>

        <Popover
          label="Preis"
          summary={f.preis < PRICE_MAX ? `bis ${fmtCH(f.preis)}` : undefined}
          active={f.preis < PRICE_MAX}
          width={280}
        >
          {() => <PriceFilter value={f.preis} onCommit={(v) => set("preis", v, PRICE_MAX)} />}
        </Popover>

        <Popover
          label="Reichweite"
          summary={f.reichweite > 0 ? `ab ${f.reichweite} km` : undefined}
          active={f.reichweite > 0}
        >
          {(close) =>
            RANGE_STEPS.map((r) => (
              <OptionRow
                key={r}
                label={r === 0 ? "Egal" : `ab ${r} km`}
                count={facets("reichweite", r)}
                active={f.reichweite === r}
                onClick={() => {
                  set("reichweite", r, 0);
                  close();
                }}
              />
            ))
          }
        </Popover>

        <Popover
          label="Anbieter"
          summary={
            f.anbieter !== "ALLE"
              ? SELLER_LABEL[f.anbieter as "PRIVAT" | "GARAGE"]
              : undefined
          }
          active={f.anbieter !== "ALLE"}
        >
          {(close) =>
            ANBIETER.map((a) => (
              <OptionRow
                key={a}
                label={a === "ALLE" ? "Alle Anbieter" : SELLER_LABEL[a]}
                count={facets("anbieter", a)}
                active={f.anbieter === a}
                onClick={() => {
                  set("anbieter", a, "ALLE");
                  close();
                }}
              />
            ))
          }
        </Popover>

        <Popover label="Mehr" active={f.sitze !== "ALLE" || f.laden > 0 || f.v2x} width={280}>
          {() => (
            <div className="space-y-4 px-1 py-1">
              <div>
                <div className="eyebrow mb-1.5">Sitze</div>
                {SITZE.map((s) => (
                  <OptionRow
                    key={s}
                    label={s === "ALLE" ? "Egal" : `${s} Sitze`}
                    count={facets("sitze", s)}
                    active={f.sitze === s}
                    onClick={() => set("sitze", s, "ALLE")}
                  />
                ))}
              </div>
              <div>
                <div className="eyebrow mb-1.5">Schnellladen</div>
                {DC_STEPS.map((d) => (
                  <OptionRow
                    key={d}
                    label={d === 0 ? "Egal" : `ab ${d} kW`}
                    count={facets("laden", d)}
                    active={f.laden === d}
                    onClick={() => set("laden", d, 0)}
                  />
                ))}
              </div>
              <div>
                <div className="eyebrow mb-1.5">Bidirektional</div>
                <OptionRow
                  label="Kann rückspeisen (V2H/V2L/V2G)"
                  count={facets("v2x", true)}
                  active={f.v2x}
                  onClick={() => set("v2x", f.v2x ? "" : "1", "")}
                />
              </div>
            </div>
          )}
        </Popover>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => set("fav", f.fav ? "" : "1", "")}
            aria-pressed={f.fav}
            title={
              canFavorite ? "Nur gemerkte Inserate zeigen" : "Merkliste — Anmeldung nötig"
            }
            className={`inline-flex h-9 items-center gap-1.5 rounded-card border px-3 text-small font-medium transition-colors ${
              f.fav
                ? "border-accent bg-accent/10 text-accent"
                : "border-line2 bg-surface text-fg2 hover:bg-surface2 hover:text-fg"
            }`}
          >
            <Heart size={14} fill={f.fav ? "currentColor" : "none"} aria-hidden />
            <span className="tabular">{favorites.length}</span>
            <span className="sr-only">gemerkte Inserate</span>
          </button>
          <Popover label={SORT_LABEL(sort)} width={220}>
            {(close) =>
              SORTS.map((s) => (
                <OptionRow
                  key={s.key}
                  label={s.label}
                  active={sort === s.key}
                  onClick={() => {
                    set("sort", s.key, "price");
                    close();
                  }}
                />
              ))
            }
          </Popover>
        </div>
      </div>

      {/* Was die KI-Suche gesetzt hat — und was sie nicht konnte. Die Filter
          selbst stehen unten als ganz normale, entfernbare Chips; dieser
          Hinweis erklärt sie nur einmal und verschwindet danach. */}
      {aiNote && (
        <div className="mt-4 flex flex-wrap items-start justify-between gap-3 rounded-card bg-accent/[0.07] px-4 py-3">
          <div className="min-w-0">
            {aiNote.reply && <p className="text-body text-fg">{aiNote.reply}</p>}
            {aiNote.unsupported.length > 0 && (
              <p className="mt-1 text-small text-fg2">
                Dafür gibt es keinen Filter:{" "}
                <span className="text-fg">{aiNote.unsupported.join(", ")}</span> — such
                danach am besten direkt beim Anbieter.
              </p>
            )}
            <p className="mt-1 text-small text-fg3">
              Die Filter unten kannst du einzeln entfernen oder ergänzen.
            </p>
          </div>
          <button
            onClick={() => setAiNote(null)}
            aria-label="Hinweis ausblenden"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-chip text-fg3 transition-colors hover:bg-surface2 hover:text-fg"
          >
            <X size={14} aria-hidden />
          </button>
        </div>
      )}

      {/* Ergebniszeile + aktive Filter — EINE Reihe für alles */}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <p className="text-small text-fg2" aria-live="polite">
          <span className="font-medium text-fg tabular">{rows.length}</span> von{" "}
          <span className="tabular">{listings.length}</span> Inseraten
        </p>
        {chips.map((c) => (
          <FilterChip key={c.key} onRemove={c.clear}>
            {c.label}
          </FilterChip>
        ))}
        {chips.length > 0 && (
          <button
            onClick={clearAll}
            className="text-small text-fg3 underline-offset-2 transition-colors hover:text-fg hover:underline"
          >
            Alle zurücksetzen
          </button>
        )}
        {session && (
          <div className="ml-auto flex items-center gap-2">
            {searchSaved ? (
              <Badge tone="positive">Suche gespeichert</Badge>
            ) : (
              <Button onClick={() => void saveSearch()} variant="ghost" size="sm">
                <BookmarkPlus size={14} aria-hidden /> Suche merken
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Ergebnisse */}
      <div className="mt-5">
        {rows.length > 0 ? (
          view === "grid" ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {rows.map((l, i) => (
                <ListingCard key={l.id} listing={l} priority={i < 4} />
              ))}
            </div>
          ) : (
            <ListingBoard listings={rows} />
          )
        ) : (
          <EmptyState
            title="Keine Inserate für diese Kombination."
            hint={
              worst
                ? `Der Filter «${worst.chip.label}» schliesst am meisten aus — ohne ihn wären es ${worst.gain} Inserate.`
                : "Im Bestand ist gerade nichts Passendes. Speichere die Suche, dann melden wir uns beim nächsten Treffer."
            }
          >
            {worst && (
              <Button onClick={worst.chip.clear} variant="primary" size="sm">
                «{worst.chip.label}» entfernen
              </Button>
            )}
            {chips.length > 1 && (
              <Button onClick={clearAll} variant="secondary" size="sm">
                Alle Filter zurücksetzen
              </Button>
            )}
          </EmptyState>
        )}
      </div>

      {rows.length > 0 && (
        <p className="mt-4 text-small text-fg3">
          Energiekosten sind mit deinen Werten gerechnet — oben in der Leiste
          anpassbar. Diese Suche ist eine URL: Link kopieren, teilen,
          wiederkommen.
        </p>
      )}

      {finderOpen && (
        <AutoFinder
          listings={listings}
          onApply={applyFinder}
          onClose={() => setFinderOpen(false)}
        />
      )}
    </div>
  );
}

/** Preisregler mit lokalem Zustand: die URL (und damit die Neuberechnung des
 *  ganzen Katalogs) wird erst beim Loslassen geschrieben. Vorher schrieb
 *  jedes einzelne Pixel Ziehweg einen History-Eintrag. */
function PriceFilter({
  value,
  onCommit,
}: {
  value: number;
  onCommit: (v: number) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  return (
    <div className="px-1 py-1">
      <Slider
        label="Höchstpreis"
        value={draft}
        min={PRICE_MIN}
        max={PRICE_MAX}
        step={2500}
        unit="CHF"
        onChange={setDraft}
        onCommit={onCommit}
      />
      <p className="mt-2 text-small text-fg3">
        {draft >= PRICE_MAX
          ? "Kein Höchstpreis."
          : `Zeigt Inserate bis CHF ${fmtCH(draft)}.`}
      </p>
    </div>
  );
}
