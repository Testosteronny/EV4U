import { useEffect, useMemo, useState } from "react";
import CostBreakdown from "../listing/CostBreakdown";
import Financing from "../listing/Financing";
import ListingRow from "../listing/ListingRow";
import { FahrprofilForm } from "../layout/Fahrprofil";
import { Disclosure, EmptyState, Field, LinkButton, PageHeader, Segmented, Select } from "../ui";
import { useCockpit, useSimulatedListing } from "../../hooks/useCockpit";
import { useCantonTaxes } from "../../hooks/useCantonTaxes";
import { useCostsMap } from "../../hooks/useCosts";
import { useListings } from "../../hooks/useListings";
import { searchHref } from "../../lib/entries";
import { href } from "../../lib/url";
import { CATALOG_META, catalogEdition } from "../../lib/vehicleCatalog";
import { CARDS_AS_OF, type Listing } from "../../data/evData";
import { FUELS, FUEL_PRICES_ASOF } from "../../utils/costModel";
import { vehicleTitle } from "../../utils/format";
import { TARIFF_META, fmtCH } from "../../utils/swiss";

/* ============================================================================
   /kosten (was /rechenwerk; Konzept §4.7) — «Was kostet mich ein E-Auto?»

   Left: the Fahrprofil, inline (on every other page it is the header chip).
   Right, two modes:
   · Durchrechnen — one car from the stock against your current car, with
     the financing example.
   · Umsteigen (F16) — start from your current car: which listings cost you
     less per month to run? Links into /inserate with «Betrieb bis».
   ============================================================================ */

type Mode = "auto" | "umsteigen";

export default function KostenPage({ initial }: { initial?: Listing[] }) {
  const [mode, setMode] = useState<Mode>("auto");
  useEffect(() => {
    if (new URLSearchParams(location.search).get("modus") === "umsteigen") setMode("umsteigen");
  }, []);
  const switchMode = (m: Mode) => {
    setMode(m);
    history.replaceState(null, "", m === "umsteigen" ? `${location.pathname}?modus=umsteigen` : location.pathname);
  };

  return (
    <div className="mx-auto max-w-page animate-fade-in px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        crumbs={[{ label: "Start", href: href("/") }, { label: "Kosten" }]}
        title="Was kostet mich ein E-Auto?"
        lead="Strom zu deinem Gemeindetarif, Wartung und die Verkehrssteuer deines Kantons — gegen das Auto, das du heute fährst."
      />

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <aside className="card p-5 lg:sticky lg:top-20" aria-label="Deine Werte">
          <h2 className="mb-4 text-h2 font-bold text-fg">Deine Werte</h2>
          <FahrprofilForm />
        </aside>

        <div className="min-w-0">
          <Segmented
            label="Rechenart"
            value={mode}
            onChange={switchMode}
            options={[
              { key: "auto", label: "Ein Auto durchrechnen" },
              { key: "umsteigen", label: "Umsteigen" },
            ]}
          />
          <div className="mt-6">{mode === "auto" ? <OneCar initial={initial} /> : <Switch initial={initial} />}</div>
          <Method />
        </div>
      </div>
    </div>
  );
}

function OneCar({ initial }: { initial?: Listing[] }) {
  const { setListingId } = useCockpit();
  const { active } = useListings(initial);
  const listing = useSimulatedListing(initial);

  if (!listing) {
    return (
      <EmptyState title="Gerade steht kein offenes Inserat bereit." hint="Die Rechnung braucht ein echtes Auto aus dem Bestand.">
        <LinkButton href={href("/inserate")} variant="primary" size="sm">
          Zu den Inseraten
        </LinkButton>
      </EmptyState>
    );
  }

  return (
    <div className="space-y-6">
      <div className="max-w-md">
        <Field label="Auto in der Rechnung" hint="Alle offenen Inserate.">
          <Select value={listing.id} onChange={(e) => setListingId(e.target.value)}>
            {active.map((l) => (
              <option key={l.id} value={l.id}>
                {vehicleTitle(l)} {l.variant ? `${l.variant} ` : ""}— CHF {fmtCH(l.price)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="card p-5 sm:p-6">
        <CostBreakdown listing={listing} />
      </div>
      <div className="card p-5 sm:p-6">
        <h2 className="mb-1 text-h2 font-bold text-fg">Finanzierung</h2>
        <p className="mb-4 text-body text-fg2">Was {vehicleTitle(listing)} pro Monat kostet, wenn du es finanzierst.</p>
        <Financing price={listing.price} />
      </div>
      <div className="card flex flex-wrap items-center justify-between gap-4 p-5">
        <p className="max-w-prose text-body text-fg2">Die Zahlen passen? Dieses Auto steht wirklich zum Verkauf.</p>
        <LinkButton href={href(`/inserat/${listing.id}`)} variant="primary">
          {vehicleTitle(listing)} ansehen
        </LinkButton>
      </div>
    </div>
  );
}

function Switch({ initial }: { initial?: Listing[] }) {
  const { listings } = useListings(initial);
  const { currentFuel, currentCons, annualKm, gemeinde, hydrated } = useCockpit();
  const forSale = useMemo(() => listings.filter((l) => l.status !== "VERKAUFT"), [listings]);
  const costs = useCostsMap(forSale);

  const first = costs.values().next().value;
  const currentMonthly = first ? first.currentTotal / 12 : null;
  const cheaper = useMemo(
    () =>
      forSale
        .map((l) => ({ l, c: costs.get(l.id)! }))
        .filter((x) => x.c && x.c.savings > 0)
        .sort((a, b) => b.c.savings - a.c.savings),
    [forSale, costs],
  );
  const fuel = FUELS[currentFuel];

  if (currentFuel === "ELEKTRO") {
    return (
      <EmptyState
        title="Du fährst schon elektrisch."
        hint="Dann zählt der Vergleich von E-Auto zu E-Auto: sortiere die Inserate nach Betriebskosten."
      >
        <LinkButton href={`${href("/inserate")}?sort=betrieb`} variant="primary" size="sm">
          Nach Betriebskosten sortieren
        </LinkButton>
      </EmptyState>
    );
  }

  return (
    <div className="space-y-6">
      <div className="forest rounded-card p-5 sm:p-6">
        <p className="text-small text-on-forest2">
          Dein {fuel.label} · {fmtCH(currentCons, 1)} {fuel.unit} · {fmtCH(annualKm)} km/Jahr
          {hydrated && gemeinde ? ` · ${gemeinde.name} ${gemeinde.canton}` : ""}
        </p>
        <p className="mt-1 text-display font-bold tabular">
          {currentMonthly !== null ? `CHF ${fmtCH(currentMonthly)} pro Monat` : "—"}
        </p>
        <p className="text-body text-on-forest2">Treibstoff, Wartung und Verkehrssteuer — ohne Versicherung.</p>
        <p className="mt-4 text-h3 font-bold text-volt">
          {cheaper.length === 0
            ? "Kein Inserat ist im Betrieb günstiger."
            : `${cheaper.length} ${cheaper.length === 1 ? "Inserat kostet" : "Inserate kosten"} dich im Betrieb weniger.`}
        </p>
      </div>

      {cheaper.length > 0 && (
        <>
          <div className="grid gap-3">
            {cheaper.slice(0, 6).map(({ l, c }) => (
              <div key={l.id}>
                <ListingRow listing={l} monthly={c.evTotal / 12} />
                <p className="mt-1 px-1 text-small font-semibold text-accent tabular">
                  CHF {fmtCH(c.savings)} pro Jahr weniger als dein {fuel.label}
                </p>
              </div>
            ))}
          </div>
          {currentMonthly !== null && (
            <LinkButton
              href={searchHref({ betrieb: Math.floor(currentMonthly) }, { sort: "betrieb" })}
              variant="primary"
            >
              Alle {cheaper.length} in der Suche ansehen
            </LinkButton>
          )}
        </>
      )}
    </div>
  );
}

function Method() {
  const { year } = useCantonTaxes();
  return (
    <div className="mt-10 border-t border-line pt-6">
      <Disclosure summary="Methode und Datenquellen">
        <ul className="max-w-prose list-disc space-y-1.5 pl-5 text-small text-fg2">
          <li>
            Strom: Tarife {TARIFF_META.period} aller {fmtCH(TARIFF_META.municipalities)} Gemeinden (ElCom, Profil{" "}
            {TARIFF_META.category}, exkl. MwSt.), zugeordnet über das PLZ-Verzeichnis von swisstopo.
          </li>
          <li>Benzin und Diesel: BFS-Landesindex, Durchschnittspreise {FUEL_PRICES_ASOF}.</li>
          <li>Verkehrssteuer: Gewichtsmodell je Kanton, Stand {year}, mit dem E-Rabatt des Kantons.</li>
          <li>Wartung: TCS/ADAC-Vergleiche; E-Autos rund 35 % günstiger als Verbrenner.</li>
          <li>Ladekarten für unterwegs: Tarife Stand {CARDS_AS_OF}.</li>
          <li>
            Verbrauch und Gewicht: Fahrzeugkatalog ({CATALOG_META.models} Modelle, Ausgabe {catalogEdition()}) oder die
            Angabe des Anbieters.
          </li>
          <li>Nicht eingerechnet: Versicherung, Reifen, Wertverlust, Parkplatz.</li>
        </ul>
      </Disclosure>
    </div>
  );
}
