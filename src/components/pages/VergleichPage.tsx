import { Fragment, useEffect, useMemo, useState } from "react";
import { Link2, X } from "lucide-react";
import { ListingThumb } from "../listing/CarGraphic";
import { FahrprofilLink } from "../layout/Fahrprofil";
import { Button, EmptyState, LinkButton, PageHeader, Toggle } from "../ui";
import { useCockpit } from "../../hooks/useCockpit";
import { useCostsMap } from "../../hooks/useCosts";
import { useListings } from "../../hooks/useListings";
import { useMarket } from "../../hooks/useMarket";
import {
  DRIVE_LABEL,
  EQUIPMENT_ITEMS,
  belowNewPct,
  fmtMonth,
  homeChargeHours,
  fmtDuration,
  isHighVoltage,
  warrantyActive,
  warrantyText,
} from "../../lib/listingFacts";
import { href } from "../../lib/url";
import { MAX_COMPARE } from "../../stores/cockpit";
import { FUELS, type CostResult } from "../../utils/costModel";
import { SELLER_LABEL, vehicleTitle } from "../../utils/format";
import { fmtCH } from "../../utils/swiss";
import type { Listing } from "../../data/evData";

/* ============================================================================
   /vergleich (Konzept §4.4) — up to four cars side by side, grouped rows
   (Preis & Kosten · Batterie · Reichweite & Laden · Alltag · Ausstattung &
   Zustand), the best value per row in green, «Nur Unterschiede».

   A shared link (`?ids=a,b,c`) is adopted into the visitor's own compare
   list once after mount, so the tray, the header and this table can never
   disagree; «Link teilen» writes that link.
   ============================================================================ */

type Ctx = { c: CostResult; distance: number | null; chargeKw: number };

type Row = {
  label: string;
  value: (l: Listing, x: Ctx) => string;
  /** Numeric value for «best»; null = unknown, never best. */
  num?: (l: Listing, x: Ctx) => number | null;
  best?: "min" | "max";
};

const yes = (v: boolean | undefined) => (v === undefined ? "—" : v ? "Ja" : "Nein");

const GROUPS: { title: string; rows: Row[] }[] = [
  {
    title: "Preis & Kosten",
    rows: [
      { label: "Preis", value: (l) => `CHF ${fmtCH(l.price)}`, num: (l) => l.price, best: "min" },
      {
        label: "Unter Neupreis",
        value: (l) => (belowNewPct(l) !== null ? `−${belowNewPct(l)} %` : "—"),
        num: (l) => belowNewPct(l),
        best: "max",
      },
      { label: "Betrieb pro Monat", value: (_, x) => `CHF ${fmtCH(x.c.evTotal / 12)}`, num: (_, x) => x.c.evTotal / 12, best: "min" },
      { label: "Strom pro 100 km", value: (_, x) => `CHF ${x.c.strom100.toFixed(2)}`, num: (_, x) => x.c.strom100, best: "min" },
      { label: "Gegenüber deinem Auto", value: (_, x) => `${x.c.savings >= 0 ? "−" : "+"}CHF ${fmtCH(Math.abs(x.c.savings))}/Jahr`, num: (_, x) => x.c.savings, best: "max" },
    ],
  },
  {
    title: "Batterie",
    rows: [
      { label: "Batteriezustand (SOH)", value: (l) => `${l.soh} %`, num: (l) => l.soh, best: "max" },
      { label: "Batterie netto", value: (l) => `${fmtCH(l.battery, 1)} kWh`, num: (l) => l.battery, best: "max" },
      {
        label: "Batteriegarantie",
        value: (l) => (l.warranty && warrantyActive(l) ? warrantyText(l.warranty) : "—"),
        num: (l) => (l.warranty?.until && warrantyActive(l) ? Number(l.warranty.until.replace("-", "")) : null),
        best: "max",
      },
      { label: "Zellchemie", value: (l) => l.spec?.chemistry ?? "—" },
    ],
  },
  {
    title: "Reichweite & Laden",
    rows: [
      { label: "Reichweite WLTP", value: (l) => `${fmtCH(l.range)} km`, num: (l) => l.range, best: "max" },
      { label: "Verbrauch", value: (l) => `${fmtCH(l.consumption, 1)} kWh/100 km`, num: (l) => l.consumption, best: "min" },
      { label: "DC-Laden max.", value: (l) => (l.dcKw ? `${l.dcKw} kW` : "—"), num: (l) => l.dcKw, best: "max" },
      { label: "DC 10–80 %", value: (l) => (l.chargeMin ? `${l.chargeMin} min` : "—"), num: (l) => l.chargeMin, best: "min" },
      {
        label: "Zuhause 20–80 %",
        value: (l, x) => fmtDuration(homeChargeHours(l, x.chargeKw)),
        num: (l, x) => homeChargeHours(l, x.chargeKw),
        best: "min",
      },
      { label: "800 V", value: (l) => (l.spec ? (isHighVoltage(l) ? "Ja" : "Nein") : "—") },
      { label: "Strom abgeben (V2L)", value: (l) => (l.bidi ? "Ja" : "Nein") },
    ],
  },
  {
    title: "Alltag",
    rows: [
      { label: "Jahrgang", value: (l) => String(l.year), num: (l) => l.year, best: "max" },
      { label: "Kilometerstand", value: (l) => `${fmtCH(l.km)} km`, num: (l) => l.km, best: "min" },
      { label: "Sitze", value: (l) => String(l.seats), num: (l) => l.seats, best: "max" },
      {
        label: "Kofferraum",
        value: (l) => (l.spec?.trunkL ? `${fmtCH(l.spec.trunkL)} l` : "—"),
        num: (l) => l.spec?.trunkL ?? null,
        best: "max",
      },
      {
        label: "Anhängelast",
        value: (l) => (l.spec?.towingKg ? `${fmtCH(l.spec.towingKg)} kg` : "—"),
        num: (l) => l.spec?.towingKg ?? null,
        best: "max",
      },
      { label: "Antrieb", value: (l) => (l.spec ? DRIVE_LABEL[l.spec.drive] : "—") },
      { label: "Entfernung", value: (_, x) => (x.distance !== null ? `${x.distance} km` : "—"), num: (_, x) => x.distance, best: "min" },
    ],
  },
  {
    title: "Ausstattung & Zustand",
    rows: [
      ...EQUIPMENT_ITEMS.map((i) => ({ label: i.label, value: (l: Listing) => yes(l.equipment?.[i.key]) })),
      { label: "Unfallfrei", value: (l) => yes(l.condition?.accidentFree) },
      { label: "Vorbesitzer", value: (l) => (l.condition?.owners !== undefined ? String(l.condition.owners) : "—"), num: (l) => l.condition?.owners ?? null, best: "min" },
      { label: "Letzte MFK", value: (l) => (l.condition?.mfk ? fmtMonth(l.condition.mfk) : "—") },
      { label: "Anbieter", value: (l) => `${SELLER_LABEL[l.sellerType]} · ${l.ort}` },
    ],
  },
];

export default function VergleichPage({ initial }: { initial?: Listing[] }) {
  const { compareIds, setCompareIds, toggleCompare, chargeKw, currentFuel, hydrated } = useCockpit();
  const { listings } = useListings(initial);
  const [onlyDiff, setOnlyDiff] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("ids");
    if (!raw) return;
    const ids = raw.split(",").filter(Boolean).slice(0, MAX_COMPARE);
    if (ids.length) setCompareIds(ids);
    history.replaceState(null, "", window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const items = useMemo(
    () =>
      compareIds
        .map((id) => listings.find((l) => l.id === id && l.status !== "VERKAUFT"))
        .filter((l): l is Listing => Boolean(l)),
    [compareIds, listings],
  );
  const costs = useCostsMap(items);
  const market = useMarket(items);
  const ctx = (l: Listing): Ctx => ({ c: costs.get(l.id)!, distance: market.distance.get(l.id) ?? null, chargeKw });

  const share = async () => {
    const url = `${location.origin}${href("/vergleich")}?ids=${items.map((l) => l.id).join(",")}`;
    try {
      if (navigator.share) await navigator.share({ title: "EV4U Vergleich", url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      /* dismissed */
    }
  };

  const crumbs = [{ label: "Start", href: href("/") }, { label: "Vergleich" }];

  if (!hydrated || items.length < 2) {
    return (
      <div className="mx-auto max-w-page px-4 py-8 sm:px-6 sm:py-10">
        <PageHeader crumbs={crumbs} title="Vergleich" />
        <div className="mt-8">
          <EmptyState
            title={items.length === 0 ? "Im Vergleich liegt noch nichts." : "Ein Auto vergleicht sich schlecht."}
            hint={`Wähle zwei bis ${MAX_COMPARE} Inserate über das Vergleichs-Symbol auf der Karte oder in der Merkliste.`}
          >
            <LinkButton href={href("/inserate")} variant="primary" size="sm">
              Zu den Inseraten
            </LinkButton>
            <LinkButton href={href("/merkliste")} variant="secondary" size="sm">
              Zur Merkliste
            </LinkButton>
          </EmptyState>
        </div>
      </div>
    );
  }

  const cols = `minmax(9rem,1.1fr) repeat(${items.length}, minmax(10rem,1fr))`;

  return (
    <div className="mx-auto max-w-page animate-fade-in px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader crumbs={crumbs} title="Vergleich" lead={`${items.length} Autos, gerechnet mit deinen Werten.`}>
        <div className="flex flex-wrap items-center gap-4">
          <Toggle checked={onlyDiff} onChange={setOnlyDiff} label="Nur Unterschiede" />
          <Button variant="secondary" size="sm" onClick={() => void share()}>
            <Link2 size={15} aria-hidden /> {copied ? "Link kopiert" : "Link teilen"}
          </Button>
        </div>
      </PageHeader>

      <div className="card mt-6 overflow-x-auto">
        <div role="table" aria-label="Vergleich der ausgewählten Inserate" className="min-w-max">
          <div
            role="row"
            className="grid border-b border-line bg-surface"
            style={{ gridTemplateColumns: cols }}
          >
            <div role="columnheader" className="p-4 text-small font-semibold text-fg3">
              {items.length}/{MAX_COMPARE}
            </div>
            {items.map((l) => (
              <div key={l.id} role="columnheader" className="relative p-4">
                <a href={href(`/inserat/${l.id}`)} className="group block">
                  <ListingThumb listing={l} className="mb-2 h-16 w-full max-w-36 rounded-control" />
                  <span className="block truncate text-body font-bold text-fg group-hover:text-accent">{vehicleTitle(l)}</span>
                  <span className="block text-body font-bold text-fg tabular">CHF {fmtCH(l.price)}</span>
                </a>
                <button
                  type="button"
                  onClick={() => toggleCompare(l.id)}
                  className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full text-fg3 hover:bg-surface2 hover:text-fg"
                >
                  <X size={14} aria-hidden />
                  <span className="sr-only">{vehicleTitle(l)} entfernen</span>
                </button>
              </div>
            ))}
          </div>

          {GROUPS.map((g) => {
            const rows = g.rows.filter((r) => !onlyDiff || new Set(items.map((l) => r.value(l, ctx(l)))).size > 1);
            if (rows.length === 0) return null;
            return (
              <Fragment key={g.title}>
                <div role="row" className="border-b border-line bg-surface2 px-4 py-2">
                  <span role="rowheader" className="eyebrow">
                    {g.title}
                  </span>
                </div>
                {rows.map((r) => {
                  const nums = items.map((l) => r.num?.(l, ctx(l)) ?? null);
                  const known = nums.filter((n): n is number => n !== null);
                  const target =
                    r.best && known.length > 1 && new Set(known).size > 1
                      ? r.best === "min"
                        ? Math.min(...known)
                        : Math.max(...known)
                      : null;
                  return (
                    <div
                      key={r.label}
                      role="row"
                      className="grid border-b border-line last:border-b-0"
                      style={{ gridTemplateColumns: cols }}
                    >
                      <div role="rowheader" className="px-4 py-2.5 text-small text-fg2">
                        {r.label}
                      </div>
                      {items.map((l, i) => {
                        const best = target !== null && nums[i] === target;
                        return (
                          <div
                            key={l.id}
                            role="cell"
                            className={`px-4 py-2.5 text-body tabular ${best ? "bg-faint font-semibold text-accent" : "text-fg"}`}
                          >
                            {r.value(l, ctx(l))}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </Fragment>
            );
          })}
        </div>
      </div>

      <p className="mt-4 max-w-prose text-small text-fg3">
        Grün markiert den besten Wert je Zeile. Betriebskosten mit Strom, Wartung und Verkehrssteuer gegen deinen{" "}
        {FUELS[currentFuel].label}. <FahrprofilLink />
      </p>
    </div>
  );
}
