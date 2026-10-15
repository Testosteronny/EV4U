import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Search, Sparkles } from "lucide-react";
import { useVehicleSelection } from "./VehicleFilter";
import { Button, Select } from "../ui";
import { useCockpit } from "../../hooks/useCockpit";
import { useMarket } from "../../hooks/useMarket";
import { aiSearch, aiSearchPossible, aiSearchUrl } from "../../lib/aiSearch";
import { searchHref } from "../../lib/entries";
import { DEFAULT_FILTERS, PRICE_STEPS, RADIUS_STEPS, RANGE_STEPS, passes, type Filters } from "../../lib/filters";
import { loadVehicleCatalog } from "../../stores/vehicleCatalog";
import { modelOptionLabel } from "../../lib/vehicleCatalog";
import { brandName } from "../../utils/format";
import { fold } from "../../utils/search";
import { fmtCH } from "../../utils/swiss";
import type { Listing } from "../../data/evData";

/* ============================================================================
   Schnellsuche (Konzept §4.1) — the hero's one job: into a filtered list in
   one step. Writes exactly the parameters the results sidebar reads, so the
   choice arrives there as removable chips. The button carries the live hit
   count; the second line hands a description to the AI search (`suche`),
   with the plain text search as the fallback.
   ============================================================================ */

type Quick = Pick<Filters, "marke" | "modell" | "preis" | "reichweite" | "umkreis">;

export default function QuickSearch({ listings }: { listings: Listing[] }) {
  const { gemeinde, hydrated } = useCockpit();
  const [q, setQ] = useState<Quick>({ marke: "", modell: "", preis: 0, reichweite: 0, umkreis: 0 });
  const [plz, setPlz] = useState("");
  const [plzTouched, setPlzTouched] = useState(false);
  const [describe, setDescribe] = useState("");
  const [thinking, setThinking] = useState(false);

  // The Fahrprofil's PLZ is the sensible default — until the visitor types.
  useEffect(() => {
    if (hydrated && gemeinde && !plzTouched) setPlz(gemeinde.zip);
  }, [hydrated, gemeinde, plzTouched]);

  const validPlz = /^\d{4}$/.test(plz) ? plz : null;
  const market = useMarket(listings, validPlz);
  const sel = useVehicleSelection({ marke: q.marke, modell: q.modell, variante: "" }, q.marke !== "");

  const f: Filters = { ...DEFAULT_FILTERS, ...q, umkreis: validPlz ? q.umkreis : 0 };
  const count = listings.filter((l) => passes(l, f, market.ctx)).length;

  const brandCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of listings) m.set(fold(l.brand), (m.get(fold(l.brand)) ?? 0) + 1);
    return m;
  }, [listings]);

  // Brands in stock first (with count), then the rest of the catalog.
  const stock = [...new Set(listings.map((l) => l.brand))]
    .map((b) => ({ value: sel.brands.find((x) => fold(x.name) === fold(b))?.name ?? brandName(b), n: brandCounts.get(fold(b)) ?? 0 }))
    .sort((a, b) => a.value.localeCompare(b.value, "de-CH"));
  const rest = sel.brands.filter((b) => !brandCounts.has(fold(b.name))).map((b) => ({ value: b.name, n: 0 }));

  const models = (sel.brand?.models ?? []).map((m) => ({
    value: m.slug,
    label: modelOptionLabel(m),
    n: listings.filter((l) => l.modelSlug === m.slug).length,
  }));

  const target = searchHref(
    { ...q, umkreis: validPlz ? q.umkreis : 0 },
    validPlz && q.umkreis ? { plz: validPlz } : undefined,
  );

  const submitDescription = async () => {
    const term = describe.trim();
    if (!term || thinking) return;
    setThinking(true);
    const result = await aiSearch(term);
    setThinking(false);
    window.location.href = result ? aiSearchUrl(result, term) : searchHref({ q: term });
  };

  return (
    <div className="rounded-overlay bg-surface p-4 text-fg shadow-overlay sm:p-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          window.location.href = target;
        }}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.15fr_1.15fr_1fr_1fr_1.35fr_auto] lg:items-end"
      >
        <Labeled label="Marke">
          <Select
            value={q.marke}
            onFocus={loadVehicleCatalog}
            onPointerDown={loadVehicleCatalog}
            onChange={(e) => setQ({ ...q, marke: e.target.value, modell: "" })}
          >
            <option value="">Alle Marken</option>
            <optgroup label="Im Bestand">
              {stock.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.value} ({b.n})
                </option>
              ))}
            </optgroup>
            {rest.length > 0 && (
              <optgroup label="Weitere Marken">
                {rest.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.value}
                  </option>
                ))}
              </optgroup>
            )}
          </Select>
        </Labeled>
        <Labeled label="Modell">
          <Select
            value={q.modell}
            disabled={!sel.brand}
            onChange={(e) => setQ({ ...q, modell: e.target.value })}
          >
            <option value="">{sel.brand ? "Alle Modelle" : q.marke ? "Lädt…" : "Zuerst Marke wählen"}</option>
            {models.map((m) => (
              <option key={m.value} value={m.value}>
                {m.n > 0 ? `${m.label} (${m.n})` : m.label}
              </option>
            ))}
          </Select>
        </Labeled>
        <Labeled label="Preis bis">
          <Select value={q.preis} onChange={(e) => setQ({ ...q, preis: Number(e.target.value) })}>
            <option value={0}>Beliebig</option>
            {PRICE_STEPS.map((p) => (
              <option key={p} value={p}>
                CHF {fmtCH(p)}
              </option>
            ))}
          </Select>
        </Labeled>
        <Labeled label="Reichweite ab">
          <Select value={q.reichweite} onChange={(e) => setQ({ ...q, reichweite: Number(e.target.value) })}>
            <option value={0}>Beliebig</option>
            {RANGE_STEPS.map((r) => (
              <option key={r} value={r}>
                {r} km WLTP
              </option>
            ))}
          </Select>
        </Labeled>
        <Labeled label="PLZ · Umkreis" group>
          <div className="flex gap-2">
            <input
              value={plz}
              onChange={(e) => {
                setPlzTouched(true);
                setPlz(e.target.value.replace(/\D/g, "").slice(0, 4));
              }}
              inputMode="numeric"
              placeholder="PLZ"
              aria-label="Postleitzahl"
              className="field w-20 shrink-0 tabular"
            />
            <Select
              value={q.umkreis}
              onChange={(e) => setQ({ ...q, umkreis: Number(e.target.value) })}
              aria-label="Umkreis"
              disabled={!validPlz}
              className="min-w-0"
            >
              <option value={0}>Ganze CH</option>
              {RADIUS_STEPS.map((r) => (
                <option key={r} value={r}>
                  {r} km
                </option>
              ))}
            </Select>
          </div>
        </Labeled>
        <Button type="submit" variant="primary" size="lg" className="sm:col-span-2 lg:col-span-1">
          <Search size={18} aria-hidden />
          <span className="tabular" aria-live="polite">
            {count} {count === 1 ? "Angebot" : "Angebote"}
          </span>
        </Button>
      </form>

      {aiSearchPossible() && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submitDescription();
          }}
          className="mt-3 flex items-center gap-2 border-t border-line pt-3"
        >
          <Sparkles size={16} aria-hidden className={`shrink-0 text-accent ${thinking ? "animate-pulse" : ""}`} />
          <input
            value={describe}
            onChange={(e) => setDescribe(e.target.value)}
            maxLength={200}
            placeholder="Oder beschreib es: «Familien-SUV bis 40'000 mit Anhängerkupplung»"
            aria-label="Auto beschreiben"
            className="min-w-0 flex-1 bg-transparent py-1.5 text-body text-fg outline-none placeholder:text-fg3"
          />
          <Button type="submit" variant="ghost" size="sm" disabled={!describe.trim() || thinking}>
            {thinking ? "Sucht…" : "Suchen"}
          </Button>
        </form>
      )}
    </div>
  );
}

/** Label above a field. `group`: several controls, each with its own
 *  aria-label — a <label> may only name one. */
function Labeled({ label, children, group = false }: { label: string; children: ReactNode; group?: boolean }) {
  const Tag = group ? "div" : "label";
  return (
    <Tag className="block min-w-0">
      <span className="mb-1 block text-small font-semibold text-fg2">{label}</span>
      {children}
    </Tag>
  );
}
