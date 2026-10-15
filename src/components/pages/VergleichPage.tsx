import { useEffect, useMemo } from "react";
import { X } from "lucide-react";
import { ListingThumb } from "../CarGraphic";
import { EmptyState, LinkButton, PageHeader } from "../ui";
import { useCockpit } from "../../hooks/useCockpit";
import { useCostsMap } from "../../hooks/useCosts";
import { useListings } from "../../hooks/useListings";
import { useCantonTaxes } from "../../hooks/useCantonTaxes";
import { openContextSheet } from "../../stores/ui";
import { type Listing } from "../../data/evData";
import { href } from "../../lib/url";
import { FUELS, type CostResult } from "../../utils/costModel";
import { SELLER_LABEL, brandName, modelName } from "../../utils/format";
import { fmtCH } from "../../utils/swiss";

/* ============================================================================
   /vergleich — die Autos aus der Leiste nebeneinander, inklusive der
   gerechneten Jahreskosten. Teilbar über ?ids=a,b,c. Kein Navigationsziel
   mehr — man kommt über die Vergleichsleiste oder einen geteilten Link.

   Ein geteilter Link ÜBERNIMMT die Auswahl in den eigenen Vergleich, statt
   danebenher eine zweite, nur lesbare Liste zu führen. Vorher zeigte die
   Seite bei `?ids=` stur die URL-Auswahl: das Entfernen einer Spalte
   veränderte den gespeicherten Vergleich, aber nicht die Tabelle davor.
   ============================================================================ */

type Row = {
  label: string;
  value: (l: Listing, c: CostResult) => string;
  num: (l: Listing, c: CostResult) => number;
  best?: "min" | "max";
};

const ROWS: Row[] = [
  { label: "Preis", value: (l) => `CHF ${fmtCH(l.price)}`, num: (l) => l.price, best: "min" },
  {
    label: "Gegenüber Neupreis",
    value: (l) =>
      l.priceNew && l.priceNew > l.price
        ? `−${Math.round((1 - l.price / l.priceNew) * 100)} % (neu ${fmtCH(l.priceNew)})`
        : "—",
    num: (l) => (l.priceNew ? 1 - l.price / l.priceNew : 0),
    best: "max",
  },
  { label: "Jahrgang", value: (l) => String(l.year), num: (l) => l.year, best: "max" },
  { label: "Kilometerstand", value: (l) => `${fmtCH(l.km)} km`, num: (l) => l.km, best: "min" },
  { label: "Batterie-SOH", value: (l) => `${l.soh} %`, num: (l) => l.soh, best: "max" },
  { label: "WLTP-Reichweite", value: (l) => `${l.range} km`, num: (l) => l.range, best: "max" },
  {
    label: "Verbrauch",
    value: (l) => `${l.consumption.toFixed(1)} kWh/100 km`,
    num: (l) => l.consumption,
    best: "min",
  },
  {
    label: "Laden 10–80 %",
    value: (l) => (l.chargeMin !== null ? `${l.chargeMin} min` : "—"),
    // Ohne Wert gewinnt ein Auto die Zeile nie.
    num: (l) => l.chargeMin ?? Infinity,
    best: "min",
  },
  { label: "Batterie", value: (l) => `${l.battery} kWh`, num: (l) => l.battery },
  { label: "Sitze", value: (l) => String(l.seats), num: (l) => l.seats },
  { label: "Bidirektional", value: (l) => (l.bidi ? "ja" : "—"), num: (l) => (l.bidi ? 1 : 0) },
  {
    label: "Strom pro 100 km",
    value: (_, c) => `CHF ${c.strom100.toFixed(2)}`,
    num: (_, c) => c.strom100,
    best: "min",
  },
  {
    label: "Energie pro Jahr",
    value: (_, c) => `CHF ${fmtCH(c.evEnergy)}`,
    num: (_, c) => c.evEnergy,
    best: "min",
  },
  {
    label: "Ersparnis gegenüber deinem Auto",
    value: (_, c) => `CHF ${fmtCH(c.savings)}`,
    num: (_, c) => c.savings,
    best: "max",
  },
  {
    label: "Anbieter",
    value: (l) => `${SELLER_LABEL[l.sellerType]} · ${l.ort}`,
    num: () => 0,
  },
];

export default function VergleichPage({ initial }: { initial?: Listing[] }) {
  const {
    compareIds,
    setCompareIds,
    toggleCompare,
    gemeinde,
    tariff,
    tariffLabel,
    annualKm,
    currentFuel,
    currentCons,
    publicShare,
  } = useCockpit();
  const { year: taxYear } = useCantonTaxes();
  const { listings } = useListings(initial);

  const cantonCode = gemeinde && gemeinde.canton !== "CH" ? gemeinde.canton : null;

  // Ein geteilter Link setzt den eigenen Vergleich — einmal, nach dem Mount
  // (der vorgerenderte HTML kennt die Query nicht). Danach ist `compareIds`
  // die einzige Quelle der Wahrheit, und die Leiste, der Zähler im Header
  // und diese Tabelle können gar nicht mehr auseinanderlaufen.
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("ids");
    if (!raw) return;
    const ids = raw.split(",").filter(Boolean);
    if (ids.length) setCompareIds(ids);
    history.replaceState(null, "", window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const items = useMemo(
    () =>
      compareIds
        .map((id) => listings.find((l) => l.id === id && l.status === "AKTIV"))
        .filter((l): l is Listing => Boolean(l)),
    [compareIds, listings],
  );

  const calcs = useCostsMap(items);

  return (
    <div className="mx-auto max-w-352 animate-fade-in px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        title="Vergleich"
        lead={
          items.length > 0
            ? `${items.length} Inserate nebeneinander, gerechnet mit deinen Werten.`
            : undefined
        }
      />

      {items.length < 2 ? (
        <div className="mt-8">
          <EmptyState
            title={
              items.length === 0
                ? "Im Vergleich liegt noch nichts."
                : "Ein Auto vergleicht sich schlecht."
            }
            hint="Wähle zwei oder drei offene Inserate über das Vergleichs-Symbol auf der Karte — hier stehen sie danach Zeile für Zeile nebeneinander."
          >
            <LinkButton href={href("/inserate")} variant="primary" size="sm">
              Zu den Inseraten
            </LinkButton>
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="card-flush mt-6 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <caption className="sr-only">
                Technische Daten und Jahreskosten der ausgewählten Inserate im
                direkten Vergleich
              </caption>
              <thead>
                <tr className="border-b border-line">
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-small font-medium text-fg3 sm:px-5"
                  >
                    Kriterium
                  </th>
                  {items.map((l) => (
                    <th key={l.id} scope="col" className="px-4 py-3 text-left sm:px-5">
                      <div className="flex items-start justify-between gap-2">
                        <a href={href(`/inserat/${l.id}`)} className="group">
                          <ListingThumb listing={l} className="mb-2 h-14 w-24" />
                          <span className="block text-body font-semibold text-fg group-hover:text-accent">
                            {brandName(l.brand)}
                          </span>
                          <span className="block text-small font-normal text-fg2">
                            {modelName(l.model)}
                          </span>
                        </a>
                        <button
                          onClick={() => toggleCompare(l.id)}
                          title="Aus dem Vergleich entfernen"
                          className="grid h-7 w-7 place-items-center rounded-chip text-fg3 transition-colors hover:bg-surface2 hover:text-fg"
                        >
                          <X size={14} aria-hidden />
                          <span className="sr-only">
                            {brandName(l.brand)} aus dem Vergleich entfernen
                          </span>
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => {
                  const nums = items.map((l) => row.num(l, calcs.get(l.id)!));
                  const target = row.best
                    ? row.best === "min"
                      ? Math.min(...nums)
                      : Math.max(...nums)
                    : null;
                  // Sind alle Werte gleich, ist keiner „der beste“ — sonst
                  // stünde die ganze Zeile grün da und sagte nichts aus.
                  const marks = target !== null && new Set(nums).size > 1;
                  return (
                    <tr key={row.label} className="border-b border-line last:border-b-0">
                      <th
                        scope="row"
                        className="px-4 py-2.5 text-left text-small font-normal text-fg2 sm:px-5"
                      >
                        {row.label}
                      </th>
                      {items.map((l, i) => {
                        const isBest = marks && nums[i] === target;
                        return (
                          <td
                            key={l.id}
                            className={`px-4 py-2.5 text-body tabular sm:px-5 ${
                              isBest ? "font-semibold text-accent" : "text-fg"
                            }`}
                          >
                            {row.value(l, calcs.get(l.id)!)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="mt-4 max-w-prose text-small text-fg3">
            Gerechnet mit {tariffLabel} ({fmtCH(tariff * 100, 1)} Rp./kWh),{" "}
            {fmtCH(annualKm)} km pro Jahr, {100 - publicShare} % Heimladung und der
            je Auto günstigsten Ladekarte. Ersparnis gegenüber deinem{" "}
            {FUELS[currentFuel].label} ({currentCons.toFixed(1)}{" "}
            {FUELS[currentFuel].unit}) inklusive Wartung und Verkehrssteuer{" "}
            {taxYear} {cantonCode ? `Kanton ${cantonCode}` : "(CH-Mittel)"}.
            Grün markiert den Bestwert je Zeile.{" "}
            <button
              onClick={openContextSheet}
              className="text-accent underline-offset-2 hover:underline"
            >
              Werte anpassen
            </button>
          </p>
        </>
      )}
    </div>
  );
}
