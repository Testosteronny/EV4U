import { useState } from "react";
import { Sun } from "lucide-react";
import { Badge, Button, Disclosure, Num } from "./ui";
import { useCockpit } from "../hooks/useCockpit";
import { useCantonTaxes } from "../hooks/useCantonTaxes";
import { openContextSheet } from "../stores/ui";
import { CARDS_AS_OF, CARD_COMBOS, type Listing } from "../data/evData";
import {
  FUELS,
  FUEL_PRICES_ASOF,
  MAINT_EV_PER_KM,
  MAINT_ICE_PER_KM,
  REF_WEIGHT_KG,
  SOLAR_COST,
  SOLAR_COVER_MAX,
  SOLAR_COVER_MIN,
  cantonTaxFor,
  chAverageTax,
  currentCarEnergy,
} from "../utils/costModel";
import { fmtCH } from "../utils/swiss";

/* ============================================================================
   EngineCore — die Kostenrechnung.

   Zwei Änderungen gegenüber vorher:
   1. Die Eingaben sind hier raus. Sie leben in der Kontextleiste, wo sie auf
      JEDER Seite sichtbar und editierbar sind — das war der Kern des
      Overview-Problems: Zahlen aus unsichtbarem Zustand.
   2. Die beiden analogen Zeigerinstrumente (~340 px hoch, zwei Zahlen) sind
      ein Balkenpaar. Gleiche Aussage, ein Viertel der Fläche, exakt ablesbar.

   Das Modell selbst ist unverändert — siehe README «The cost model».
   ============================================================================ */

/** Ein Vergleichsbalken. Der Akzent markiert das Inserat, nicht das
 *  Bestandsauto — er trägt hier die positive Aussage. */
function Bar({
  label,
  sub,
  value,
  max,
  highlight = false,
}: {
  label: string;
  sub: string;
  value: number;
  max: number;
  highlight?: boolean;
}) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-body font-medium text-fg">{label}</span>
        <span
          className={`text-h3 font-semibold tabular ${highlight ? "text-accent" : "text-fg"}`}
        >
          CHF <Num value={value} />
        </span>
      </div>
      <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-surface2">
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${
            highlight ? "bg-accent" : "bg-fg3"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-small text-fg3">{sub}</p>
    </div>
  );
}

/** Zeile der Aufschlüsselung. */
function Line({
  label,
  note,
  value,
  saving,
}: {
  label: string;
  note?: string;
  value: string;
  saving?: number;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b border-line py-2.5 last:border-b-0">
      <span className="text-body text-fg2">
        {label}
        {note && <span className="ml-2 text-small text-fg3">{note}</span>}
      </span>
      <span className="flex items-baseline gap-3">
        <span className="text-body text-fg tabular">{value}</span>
        {saving !== undefined && saving > 0 && (
          <span className="text-small font-medium text-accent tabular">
            −{fmtCH(saving)}
          </span>
        )}
      </span>
    </div>
  );
}

export default function EngineCore({ listing }: { listing: Listing }) {
  const {
    tariff,
    tariffLabel,
    gemeinde,
    annualKm,
    currentFuel,
    currentCons,
    publicShare,
    pv,
  } = useCockpit();
  const { taxes: cantonTaxes, year: taxYear } = useCantonTaxes();

  /** Manuelle Ladekarten-Wahl; null → günstigste Kombination. */
  const [comboChoice, setComboChoice] = useState<string | null>(null);

  /* ---- Das Modell (unverändert) ------------------------------------------ */
  const kwhYear = (annualKm / 100) * listing.consumption;
  const publicKwh = kwhYear * (publicShare / 100);
  const homeKwh = kwhYear - publicKwh;
  const homeCost = homeKwh * tariff;

  const combos = CARD_COMBOS.map((c) => ({
    ...c,
    publicCost: c.monthly * 12 + Math.max(0, publicKwh - c.inclKwh) * c.perKwh,
  }));
  const cheapest = combos.reduce((a, b) => (b.publicCost < a.publicCost ? b : a));
  const chosen = combos.find((c) => c.id === comboChoice) ?? cheapest;

  const evEnergy = homeCost + chosen.publicCost;
  const isCurrentEv = currentFuel === "ELEKTRO";
  const fuelCfg = FUELS[currentFuel];
  const fuelEnergy = currentCarEnergy(currentFuel, currentCons, annualKm, tariff);

  const maintIce = annualKm * (isCurrentEv ? MAINT_EV_PER_KM : MAINT_ICE_PER_KM);
  const maintEv = annualKm * MAINT_EV_PER_KM;
  const maintSavings = maintIce - maintEv;

  const weightKg = listing.weightKg ?? REF_WEIGHT_KG;
  const cantonCode = gemeinde && gemeinde.canton !== "CH" ? gemeinde.canton : null;
  const taxCfg = (cantonCode && cantonTaxes[cantonCode]) || chAverageTax(cantonTaxes);
  const tax = cantonTaxFor(weightKg, taxCfg);
  const taxCurrent = isCurrentEv ? tax.ev : tax.ice;
  const taxSavings = taxCurrent - tax.ev;

  const fuelTotal = fuelEnergy + maintIce + taxCurrent;
  const evTotal = evEnergy + maintEv + tax.ev;
  const savings = fuelTotal - evTotal;
  const barMax = Math.max(fuelTotal, evTotal);

  const solarRate = Math.max(0, tariff - SOLAR_COST);
  const solarLow = homeKwh * SOLAR_COVER_MIN * solarRate;
  const solarHigh = homeKwh * SOLAR_COVER_MAX * solarRate;
  const showSolar = pv === "ja" && homeKwh > 0;

  return (
    <div className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-h2 font-semibold text-fg">Deine Kosten pro Jahr</h2>
          <p className="mt-1 text-body text-fg2">
            Energie, Wartung und Verkehrssteuer — gerechnet mit deinen Werten.
          </p>
        </div>
        <Button onClick={openContextSheet} variant="secondary" size="sm">
          Werte anpassen
        </Button>
      </div>

      {/* Der Vergleich — ersetzt die zwei Zeigerinstrumente */}
      <div className="mt-6 space-y-5">
        <Bar
          label={`Dein ${fuelCfg.label}`}
          sub={`${currentCons.toFixed(1)} ${fuelCfg.unit} · ${fmtCH(annualKm)} km/Jahr`}
          value={fuelTotal}
          max={barMax}
        />
        <Bar
          label={`${listing.brand} ${listing.model}`}
          sub={`${listing.consumption.toFixed(1)} kWh/100 km · ${100 - publicShare} % zuhause`}
          value={evTotal}
          max={barMax}
          highlight
        />
      </div>

      {/* Die eine Zahl, die zählt */}
      <div
        className={`mt-6 rounded-card px-5 py-4 ${
          savings >= 0 ? "bg-accent/[0.08]" : "bg-caution/[0.08]"
        }`}
      >
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div>
            <div className="text-small font-medium text-fg2">
              {savings >= 0 ? "Du sparst" : "Du zahlst mehr"}
            </div>
            <div
              className={`text-display font-semibold tabular ${
                savings >= 0 ? "text-accent" : "text-caution"
              }`}
            >
              CHF <Num value={Math.abs(savings)} />
              <span className="ml-1.5 text-body font-normal text-fg2">pro Jahr</span>
            </div>
          </div>
          <p className="text-small text-fg2">
            Energie <span className="tabular">{fmtCH(fuelEnergy - evEnergy)}</span> ·
            Wartung <span className="tabular">{fmtCH(maintSavings)}</span> · Steuer{" "}
            <span className="tabular">{fmtCH(taxSavings)}</span>
            <br />
            Über 10 Jahre:{" "}
            <span className="font-medium text-fg tabular">
              CHF {fmtCH(Math.abs(savings) * 10)}
            </span>
          </p>
        </div>
        {showSolar && (
          <p className="mt-3 flex items-start gap-2 border-t border-accent/20 pt-3 text-small text-fg2">
            <Sun size={15} className="mt-0.5 shrink-0 text-caution" aria-hidden />
            <span>
              Mit deiner PV-Anlage kommen{" "}
              <span className="font-medium text-fg tabular">
                CHF {fmtCH(solarLow)}–{fmtCH(solarHigh)}
              </span>{" "}
              pro Jahr dazu — je nachdem, wie viel deiner Heimladung
              ({fmtCH(homeKwh)} kWh) du direkt aus der Sonne deckst.
            </span>
          </p>
        )}
      </div>

      {/* Aufschlüsselung */}
      <div className="mt-6">
        <h3 className="text-h3 font-semibold text-fg">Woraus sich das zusammensetzt</h3>
        <div className="mt-2">
          <Line
            label="Zuhause laden"
            note={`${tariffLabel} · ${fmtCH(tariff * 100, 1)} Rp./kWh`}
            value={`${fmtCH(homeKwh)} kWh → CHF ${fmtCH(homeCost)}`}
          />
          <Line
            label="Unterwegs laden"
            note={chosen.primary}
            value={`${fmtCH(publicKwh)} kWh → CHF ${fmtCH(chosen.publicCost)}`}
          />
          <Line
            label="Wartung & Service"
            note={
              isCurrentEv
                ? "beide elektrisch — kein Vorteil"
                : "kein Öl, keine Zündkerzen, Rekuperation schont die Bremsen"
            }
            value={`CHF ${fmtCH(maintEv)}`}
            saving={maintSavings}
          />
          <Line
            label={`Verkehrssteuer ${taxYear}`}
            note={
              cantonCode
                ? `Kanton ${cantonCode} · ${fmtCH(weightKg)} kg · ${taxCfg.discountPct} % E-Rabatt`
                : "CH-Mittel — PLZ setzen für deinen Kanton"
            }
            value={`CHF ${fmtCH(tax.ev)}`}
            saving={taxSavings}
          />
        </div>
      </div>

      {/* Ladekarte */}
      <div className="mt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h3 className="text-h3 font-semibold text-fg">Ladekarte für unterwegs</h3>
          {chosen.id !== cheapest.id && (
            <button
              onClick={() => setComboChoice(null)}
              className="text-small font-medium text-accent transition-colors hover:text-accent-hover"
            >
              Zur Empfehlung zurück
            </button>
          )}
        </div>
        <div className="mt-2 space-y-1.5">
          {combos.map((c) => {
            const isChosen = c.id === chosen.id;
            return (
              <button
                key={c.id}
                onClick={() => setComboChoice(c.id)}
                className={`flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-card border px-4 py-2.5 text-left transition-colors ${
                  isChosen
                    ? "border-accent bg-accent/[0.06]"
                    : "border-line hover:border-line2 hover:bg-surface2"
                }`}
              >
                <span>
                  <span className="flex items-center gap-2 text-body text-fg">
                    {c.primary} + {c.secondary}
                    {c.id === cheapest.id && <Badge tone="positive">günstigste</Badge>}
                  </span>
                  <span className="block text-small text-fg3">{c.network}</span>
                </span>
                <span className="text-small text-fg2">
                  <span className="tabular">
                    {c.monthly === 0 ? "0.—" : c.monthly.toFixed(2)}
                  </span>
                  /Mt ·{" "}
                  <span className="tabular">{c.perKwh.toFixed(2)}</span>/kWh ·{" "}
                  <span className={`font-medium tabular ${isChosen ? "text-accent" : "text-fg"}`}>
                    CHF {fmtCH(c.publicCost)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Der Modelltext — inhaltlich unverändert, aber endlich lesbar gesetzt
          und aus dem Blickfeld geklappt. */}
      <div className="mt-6 border-t border-line pt-4">
        <Disclosure summary="Wie wir rechnen">
          <div className="max-w-prose space-y-2 text-small leading-relaxed text-fg2">
            <p>
              Verglichen werden Energie, Wartung und kantonale Verkehrssteuer für{" "}
              {listing.brand} {listing.model} ({listing.consumption.toFixed(1)} kWh/100 km,{" "}
              {fmtCH(weightKg)} kg) gegen dein heutiges Auto (
              {fuelCfg.label}, {currentCons.toFixed(1)} {fuelCfg.unit}
              {isCurrentEv
                ? ", gerechnet mit deinem Heimtarif"
                : `, ${(fuelCfg.price ?? 0).toFixed(2)} CHF/l — BFS-Durchschnitt ${FUEL_PRICES_ASOF}`}
              ).
            </p>
            <p>
              Wartung nach TCS/ADAC (E-Autos rund 35 % günstiger). Steuer:
              lineares Gewichtsmodell in CHF pro 100 kg je Kanton, Stand {taxYear};
              Hubraum-Kantone über ein Gewichts-Äquivalent. Ladekarten-Tarife
              Stand {CARDS_AS_OF} — Tagespreise in den Anbieter-Apps.
              Versicherung ist nicht eingerechnet.
            </p>
            {showSolar && (
              <p>
                Solar: jede selbst geladene kWh spart deinen Tarif (
                {fmtCH(tariff * 100, 1)} Rp.) minus die entgangene
                Einspeisevergütung ({fmtCH(SOLAR_COST * 100)} Rp.). Angenommen
                werden {SOLAR_COVER_MIN * 100}–{SOLAR_COVER_MAX * 100} % Deckung
                der Heimladung.
              </p>
            )}
          </div>
        </Disclosure>
      </div>
    </div>
  );
}
