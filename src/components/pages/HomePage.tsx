import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, BatteryCharging, Calculator, MapPinned, PhoneCall } from "lucide-react";
import QuickSearch from "../search/QuickSearch";
import { useVehicleSelection } from "../search/VehicleFilter";
import ListingCard from "../listing/ListingCard";
import { Button, Chip, LinkButton, SectionHeader, Select } from "../ui";
import { useCockpit } from "../../hooks/useCockpit";
import { useCosts } from "../../hooks/useCosts";
import { useListings } from "../../hooks/useListings";
import { useMarket } from "../../hooks/useMarket";
import { usePlzResolver } from "../../hooks/usePlzResolver";
import { BODY_ENTRIES, BUDGET_ENTRIES, TOPIC_ENTRIES, entryCount, searchHref, type Entry } from "../../lib/entries";
import { KM_STEPS, YEAR_STEPS, sorter } from "../../lib/filters";
import { modelPath } from "../../lib/listingFacts";
import { href } from "../../lib/url";
import { CATALOG_META, modelOptionLabel } from "../../lib/vehicleCatalog";
import { loadVehicleCatalog } from "../../stores/vehicleCatalog";
import { FUELS } from "../../utils/costModel";
import { vehicleTitle } from "../../utils/format";
import { TARIFF_META, fmtCH } from "../../utils/swiss";
import { GABRIEL, type Listing } from "../../data/evData";

/* ============================================================================
   Start (Konzept v3 §4.1). Job: get a buyer into a filtered list in one
   step, show the stock, let people TRY the USP, recruit sellers.

   Hero with quick search → entry chips with counts → Neu eingetroffen →
   «Was kostet dich ein E-Auto wirklich?» (sets the Fahrprofil, every card
   on the site follows) → Warum EV4U → Beliebte Modelle → Verkaufen with a
   mini Preis-Check → Blog → Beratung.
   ============================================================================ */

export type HomePost = { title: string; href: string; category: string; date: string; description: string };

export default function HomePage({ initial, posts }: { initial?: Listing[]; posts: HomePost[] }) {
  const { listings } = useListings(initial);
  const forSale = useMemo(() => listings.filter((l) => l.status !== "VERKAUFT"), [listings]);
  const market = useMarket(forSale);

  const newest = useMemo(() => [...forSale].sort(sorter("neu", market.ctx)).slice(0, 4), [forSale, market.ctx]);

  return (
    <div className="animate-fade-in">
      {/* ---------- Hero ---------- */}
      <section className="forest">
        <div className="mx-auto max-w-page px-4 pb-10 pt-10 sm:px-6 sm:pb-14 sm:pt-14">
          <h1 className="max-w-3xl text-display font-bold sm:text-display-lg">
            Gebrauchte E-Autos in der Schweiz.
            <span className="block text-volt">Durchgerechnet für deine Gemeinde.</span>
          </h1>
          <div className="mt-7">
            <QuickSearch listings={forSale} />
          </div>
          <p className="mt-5 flex flex-wrap gap-x-5 gap-y-1 text-small text-on-forest2">
            <span>
              <strong className="font-semibold text-on-forest tabular">{forSale.length}</strong> Inserate
            </span>
            <span>
              <strong className="font-semibold text-on-forest tabular">{CATALOG_META.brands}</strong> Marken im Katalog
            </span>
            <span>
              <strong className="font-semibold text-on-forest tabular">{fmtCH(TARIFF_META.municipalities)}</strong>{" "}
              Gemeindetarife {TARIFF_META.period}
            </span>
          </p>
        </div>
      </section>

      {/* ---------- Einstiege ---------- */}
      <section className="mx-auto max-w-page px-4 py-8 sm:px-6" aria-label="Einstiege">
        <div className="grid gap-4">
          <EntryRow title="Karosserie" entries={BODY_ENTRIES} listings={forSale} />
          <EntryRow title="Budget" entries={BUDGET_ENTRIES} listings={forSale} />
          <EntryRow title="Themen" entries={TOPIC_ENTRIES} listings={forSale} />
        </div>
      </section>

      {/* ---------- Neu eingetroffen ---------- */}
      <section className="mx-auto max-w-page border-t border-line px-4 py-10 sm:px-6">
        <SectionHeader
          title="Neu eingetroffen"
          more={{ href: href("/inserate"), label: `Alle ${forSale.length} Inserate` }}
        />
        <div className="no-scrollbar -mx-4 mt-5 flex snap-x gap-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
          {newest.map((l, i) => (
            <div key={l.id} className="w-[82%] shrink-0 snap-start sm:w-auto">
              <ListingCard
                listing={l}
                monthly={market.monthly.get(l.id)}
                distance={market.distance.get(l.id)}
                priority={i < 2}
              />
            </div>
          ))}
        </div>
      </section>

      <CostTeaser listings={forSale} />
      <WhyTiles />
      <PopularModels listings={forSale} />
      <SellTeaser />
      {posts.length > 0 && <BlogTeaser posts={posts} />}
      <AdviceTeaser />
    </div>
  );
}

/* ---------- Einstiege ------------------------------------------------------ */

function EntryRow({ title, entries, listings }: { title: string; entries: Entry[]; listings: Listing[] }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-small font-semibold text-fg2">{title}</span>
      <div className="no-scrollbar -mr-4 flex gap-2 overflow-x-auto pr-4 sm:mr-0 sm:flex-wrap sm:pr-0">
        {entries.map((e) => (
          <Chip key={e.label} href={searchHref(e.filter)} count={entryCount(listings, e.filter)}>
            {e.label}
          </Chip>
        ))}
      </div>
    </div>
  );
}

/* ---------- USP: try it ---------------------------------------------------- */

/** PLZ and km/year → the Fahrprofil. The example is a real car from the
 *  stock with typical consumption, so the number is one you can click. */
function CostTeaser({ listings }: { listings: Listing[] }) {
  const { gemeinde, setGemeinde, hydrated, annualKm, setAnnualKm, currentFuel, currentCons, tariff } = useCockpit();
  const [zip, setZip] = useState("");
  const [touched, setTouched] = useState(false);
  const resolve = usePlzResolver(touched || Boolean(gemeinde));

  useEffect(() => {
    if (hydrated && gemeinde && !touched) setZip(gemeinde.zip);
  }, [hydrated, gemeinde, touched]);

  useEffect(() => {
    if (!touched || !resolve || !/^\d{4}$/.test(zip)) return;
    const g = resolve(zip);
    if (g && g.zip !== gemeinde?.zip) setGemeinde(g);
  }, [zip, touched, resolve, gemeinde?.zip, setGemeinde]);

  // The car with the median consumption in stock.
  const example = useMemo(() => {
    const sorted = [...listings].sort((a, b) => a.consumption - b.consumption);
    return sorted[Math.floor(sorted.length / 2)] ?? null;
  }, [listings]);
  const costs = useCosts(example);
  const unknownZip = touched && resolve && /^\d{4}$/.test(zip) && !resolve(zip);

  return (
    <section className="mx-auto max-w-page px-4 py-10 sm:px-6">
      <div className="card grid gap-6 p-5 sm:p-8 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <div>
          <p className="eyebrow text-accent">Ausprobieren</p>
          <h2 className="mt-1 text-h2 font-bold sm:text-display text-fg">Was kostet dich ein E-Auto wirklich?</h2>
          <p className="mt-2 max-w-prose text-body text-fg2">
            Strom zu deinem Gemeindetarif, Wartung und die Verkehrssteuer deines Kantons. Einmal eingeben — danach
            rechnet jede Karte auf EV4U mit deinen Werten.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <label className="block">
              <span className="mb-1 block text-small font-semibold text-fg2">PLZ</span>
              <input
                value={zip}
                onChange={(e) => {
                  setTouched(true);
                  setZip(e.target.value.replace(/\D/g, "").slice(0, 4));
                }}
                inputMode="numeric"
                placeholder="z. B. 4600"
                className="field w-28 tabular"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-small font-semibold text-fg2">km pro Jahr</span>
              <Select value={annualKm} onChange={(e) => setAnnualKm(Number(e.target.value))} className="w-36">
                {[5000, 10000, 15000, 20000, 25000, 30000, 40000].map((k) => (
                  <option key={k} value={k}>
                    {fmtCH(k)} km
                  </option>
                ))}
              </Select>
            </label>
          </div>
          {unknownZip && <p className="mt-2 text-small text-caution">Diese PLZ kennen wir nicht.</p>}
        </div>

        <div className="rounded-card bg-faint p-5 sm:p-6">
          {costs && example ? (
            <>
              <p className="text-small text-fg2">
                {hydrated && gemeinde ? (
                  <>
                    <strong className="text-fg">
                      {gemeinde.name} {gemeinde.canton}
                    </strong>
                    : {fmtCH(tariff * 100, 1)} Rp./kWh
                  </>
                ) : (
                  <>Schweizer Median: {fmtCH(tariff * 100, 1)} Rp./kWh</>
                )}
              </p>
              <p className="mt-3 text-display font-bold text-fg tabular">
                CHF {fmtCH(costs.evTotal / 12)}
                <span className="text-h3 font-semibold text-fg2"> /Monat</span>
              </p>
              <p className="text-body text-fg2">
                Betrieb, am Beispiel{" "}
                <a href={href(`/inserat/${example.id}`)} className="link font-medium">
                  {vehicleTitle(example)}
                </a>{" "}
                ({fmtCH(example.consumption, 1)} kWh/100 km)
              </p>
              {!costs.currentIsEv && costs.savings > 0 && (
                <p className="mt-4 text-h3 font-bold text-accent tabular">
                  CHF {fmtCH(costs.savings)} pro Jahr weniger
                  <span className="block text-body font-normal text-fg2">
                    als dein {FUELS[currentFuel].label} mit {fmtCH(currentCons, 1)} {FUELS[currentFuel].unit}
                  </span>
                </p>
              )}
              <a href={href("/kosten")} className="link mt-4 inline-block text-small font-semibold">
                Genau rechnen →
              </a>
            </>
          ) : (
            <p className="text-body text-fg2">Sobald Inserate geladen sind, steht hier deine Rechnung.</p>
          )}
        </div>
      </div>
    </section>
  );
}

/* ---------- Warum EV4U ----------------------------------------------------- */

const WHY = [
  {
    icon: BatteryCharging,
    title: "Batteriegarantie im Blick",
    text: "Verkäufer geben an, bis wann und bis wie viele km die Batterie garantiert ist. Filterbar, auf jeder Karte.",
  },
  {
    icon: Calculator,
    title: "Echte Kosten",
    text: "Strom zu deinem Gemeindetarif, Wartung und kantonale Verkehrssteuer — pro Monat, für jedes Auto.",
  },
  {
    icon: BadgeCheck,
    title: "Geprüfte Garagen",
    text: "Garagen mit Häkchen haben wir anhand des Handelsregisters (UID) geprüft.",
  },
  {
    icon: MapPinned,
    title: "Schweizer Daten",
    text: `ElCom-Tarife ${TARIFF_META.period} aller Gemeinden, Treibstoffpreise vom BFS, ein Katalog mit ${CATALOG_META.models} Modellen.`,
  },
];

function WhyTiles() {
  return (
    <section className="mx-auto max-w-page px-4 py-10 sm:px-6">
      <SectionHeader title="Warum EV4U" />
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {WHY.map(({ icon: Icon, title, text }) => (
          <div key={title} className="card p-5">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-soft text-accent">
              <Icon size={20} aria-hidden />
            </span>
            <h3 className="mt-3 text-h3 font-bold text-fg">{title}</h3>
            <p className="mt-1 text-body text-fg2">{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- Beliebte Modelle ----------------------------------------------- */

function PopularModels({ listings }: { listings: Listing[] }) {
  const models = useMemo(() => {
    const by = new Map<string, { slug: string; title: string; n: number; min: number; maxRange: number }>();
    for (const l of listings) {
      if (!l.modelSlug) continue;
      const m = by.get(l.modelSlug) ?? { slug: l.modelSlug, title: vehicleTitle(l), n: 0, min: Infinity, maxRange: 0 };
      m.n += 1;
      m.min = Math.min(m.min, l.price);
      m.maxRange = Math.max(m.maxRange, l.range);
      by.set(l.modelSlug, m);
    }
    return [...by.values()].sort((a, b) => b.n - a.n || a.min - b.min).slice(0, 6);
  }, [listings]);

  if (models.length === 0) return null;
  return (
    <section className="mx-auto max-w-page border-t border-line px-4 py-10 sm:px-6">
      <SectionHeader
        title="Beliebte Modelle"
        lead="Daten, Varianten und alle Occasionen eines Modells auf einer Seite."
        more={{ href: href("/modelle"), label: "Alle Modelle" }}
      />
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {models.map((m) => (
          <a key={m.slug} href={href(modelPath(m.slug))} className="card card-hover flex items-center justify-between gap-4 p-4">
            <span className="min-w-0">
              <span className="block truncate text-h3 font-bold text-fg">{m.title}</span>
              <span className="block text-small text-fg2">bis {fmtCH(m.maxRange)} km WLTP</span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-body font-semibold text-fg tabular">ab CHF {fmtCH(m.min)}</span>
              <span className="block text-small text-fg3">
                {m.n} {m.n === 1 ? "Angebot" : "Angebote"}
              </span>
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}

/* ---------- Verkaufen ------------------------------------------------------ */

function SellTeaser() {
  const [v, setV] = useState({ marke: "", modell: "", jahr: 0, km: 0 });
  const sel = useVehicleSelection({ marke: v.marke, modell: v.modell, variante: "" }, v.marke !== "");
  const sp = new URLSearchParams();
  if (v.marke) sp.set("marke", v.marke);
  if (v.modell) sp.set("modell", v.modell);
  if (v.jahr) sp.set("jahr", String(v.jahr));
  if (v.km) sp.set("km", String(v.km));
  const target = `${href("/verkaufen/preis-check")}${sp.size ? `?${sp}` : ""}`;

  return (
    <section className="mx-auto max-w-page px-4 py-10 sm:px-6">
      <div className="forest grid gap-6 rounded-card p-6 sm:p-8 lg:grid-cols-[1fr_1.2fr] lg:items-center">
        <div>
          <h2 className="text-h2 font-bold sm:text-display">Dein E-Auto verkaufen: gratis, an Leute, die E-Autos suchen.</h2>
          <p className="mt-2 text-body text-on-forest2">
            Batterie, Garantie und Ladeleistung stehen bei uns vorne — genau das, wonach Käufer fragen.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <LinkButton href={href("/verkaufen/neu")} variant="onForest">
              Inserat aufgeben
            </LinkButton>
            <a href={href("/verkaufen")} className="inline-flex h-11 items-center text-body font-semibold text-on-forest hover:underline">
              So funktioniert's
            </a>
          </div>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            window.location.href = target;
          }}
          className="rounded-card bg-surface p-4 text-fg sm:p-5"
        >
          <p className="text-h3 font-bold">Gratis Preis-Check</p>
          <p className="text-small text-fg2">Was ist dein Auto wert? Schätzung aus Katalog und Inseraten.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Select
              aria-label="Marke"
              value={v.marke}
              onFocus={loadVehicleCatalog}
              onPointerDown={loadVehicleCatalog}
              onChange={(e) => setV({ ...v, marke: e.target.value, modell: "" })}
            >
              <option value="">Marke</option>
              {sel.brands.map((b) => (
                <option key={b.slug} value={b.name}>
                  {b.name}
                </option>
              ))}
            </Select>
            <Select aria-label="Modell" value={v.modell} disabled={!sel.brand} onChange={(e) => setV({ ...v, modell: e.target.value })}>
              <option value="">Modell</option>
              {(sel.brand?.models ?? []).map((m) => (
                <option key={m.slug} value={m.slug}>
                  {modelOptionLabel(m)}
                </option>
              ))}
            </Select>
            <Select aria-label="Jahrgang" value={v.jahr} onChange={(e) => setV({ ...v, jahr: Number(e.target.value) })}>
              <option value={0}>Jahrgang</option>
              {[...YEAR_STEPS, 2026].reverse().map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
            <Select aria-label="Kilometerstand" value={v.km} onChange={(e) => setV({ ...v, km: Number(e.target.value) })}>
              <option value={0}>Kilometerstand</option>
              {KM_STEPS.map((k) => (
                <option key={k} value={k}>
                  bis {fmtCH(k)} km
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" variant="primary" className="mt-4 w-full">
            Schätzung anzeigen
          </Button>
        </form>
      </div>
    </section>
  );
}

/* ---------- Blog ----------------------------------------------------------- */

function BlogTeaser({ posts }: { posts: HomePost[] }) {
  return (
    <section className="mx-auto max-w-page border-t border-line px-4 py-10 sm:px-6">
      <SectionHeader title="Aus dem Blog" more={{ href: href("/blog"), label: "Alle Beiträge" }} />
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {posts.map((p) => (
          <a key={p.href} href={p.href} className="card card-hover flex flex-col p-5">
            <span className="eyebrow text-accent">{p.category}</span>
            <span className="mt-2 text-h3 font-bold text-fg">{p.title}</span>
            <span className="mt-1 line-clamp-3 text-body text-fg2">{p.description}</span>
            <span className="mt-auto pt-3 text-small text-fg3">
              {new Date(p.date).toLocaleDateString("de-CH", { day: "numeric", month: "long", year: "numeric" })}
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}

/* ---------- Beratung ------------------------------------------------------- */

function AdviceTeaser() {
  return (
    <section className="mx-auto max-w-page px-4 pb-12 pt-4 sm:px-6">
      <div className="card flex flex-wrap items-center justify-between gap-x-8 gap-y-4 p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-soft text-accent">
            <PhoneCall size={19} aria-hidden />
          </span>
          <div>
            <h2 className="text-h3 font-bold text-fg">Unsicher? Zwanzig Minuten mit {GABRIEL.name}.</h2>
            <p className="mt-1 max-w-prose text-body text-fg2">«{GABRIEL.intro}» Kein Verkaufsgespräch.</p>
          </div>
        </div>
        <LinkButton href={href("/beratung")} variant="secondary">
          Termin wählen
        </LinkButton>
      </div>
    </section>
  );
}
