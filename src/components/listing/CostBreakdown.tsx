import { useState } from "react";
import { Sun } from "lucide-react";
import { Badge, Button, Disclosure, Num } from "../ui";
import { useCockpit } from "../../hooks/useCockpit";
import { useCantonTaxes } from "../../hooks/useCantonTaxes";
import { useCosts } from "../../hooks/useCosts";
import { openFahrprofil } from "../../stores/ui";
import { CARDS_AS_OF, type Listing } from "../../data/evData";
import {
  FUELS,
  FUEL_PRICES_ASOF,
  PLUGIN_KWH_PER_100KM,
  SOLAR_COST,
  SOLAR_COVER_MAX,
  SOLAR_COVER_MIN,
} from "../../utils/costModel";
import { vehicleTitle } from "../../utils/format";
import { fmtCH } from "../../utils/swiss";

/* ============================================================================
   Kostenrechnung — one listing against the visitor's current car.

   The inputs live in the Fahrprofil (header chip), so every number here
   comes from state the visitor can see and change anywhere. The
   calculation itself is `computeCosts` — the same function behind the
   «Betrieb/Mt.» on every card and the compare table.
   On the detail page and on /kosten.
   ============================================================================ */

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
        <span className="min-w-0 truncate text-body font-semibold text-fg">{label}</span>
        <span className={`shrink-0 text-h3 font-bold tabular ${highlight ? "text-accent" : "text-fg"}`}>
          CHF <Num value={value} />
          <span className="ml-1 text-small font-normal text-fg3">/Jahr</span>
        </span>
      </div>
      <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-surface2">
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${highlight ? "bg-bar" : "bg-fg3"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-small text-fg3">{sub}</p>
    </div>
  );
}

function Line({ label, note, value, saving }: { label: string; note?: string; value: string; saving?: number }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b border-line py-2.5 last:border-b-0">
      <span className="text-body text-fg2">
        {label}
        {note && <span className="ml-2 text-small text-fg3">{note}</span>}
      </span>
      <span className="flex items-baseline gap-3">
        <span className="text-body text-fg tabular">{value}</span>
        {saving !== undefined && saving > 0 && (
          <span className="text-small font-semibold text-accent tabular">−{fmtCH(saving)}</span>
        )}
      </span>
    </div>
  );
}

export default function CostBreakdown({ listing }: { listing: Listing }) {
  const { tariff, tariffLabel, gemeinde, annualKm, currentFuel, currentCons, elecShare, publicShare } = useCockpit();
  const { year: taxYear } = useCantonTaxes();

  /** Manual charging-card choice; null → the cheapest combination. */
  const [comboChoice, setComboChoice] = useState<string | null>(null);
  const c = useCosts(listing, comboChoice);
  if (!c) return null;

  const fuelCfg = FUELS[currentFuel];
  const cantonCode = gemeinde && gemeinde.canton !== "CH" ? gemeinde.canton : null;
  const barMax = Math.max(c.currentTotal, c.evTotal);
  const cheaper = c.savings >= 0;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="max-w-prose text-body text-fg2">
          Energie, Wartung und Verkehrssteuer pro Jahr — mit {fmtCH(annualKm)} km und{" "}
          {gemeinde ? `dem Tarif von ${tariffLabel}` : "dem Schweizer Mediantarif"}.
        </p>
        <Button onClick={openFahrprofil} variant="secondary" size="sm">
          Werte anpassen
        </Button>
      </div>

      <div className="mt-5 space-y-5">
        <Bar
          label={`Dein ${fuelCfg.label}`}
          sub={`${fmtCH(currentCons, 1)} ${fuelCfg.unit} · ${fmtCH(annualKm)} km/Jahr`}
          value={c.currentTotal}
          max={barMax}
        />
        <Bar
          label={vehicleTitle(listing)}
          sub={`${fmtCH(listing.consumption, 1)} kWh/100 km · ${100 - publicShare} % zuhause geladen · CHF ${fmtCH(c.evTotal / 12)}/Mt.`}
          value={c.evTotal}
          max={barMax}
          highlight
        />
      </div>

      <div className={`mt-6 rounded-card px-5 py-4 ${cheaper ? "bg-soft" : "bg-caution-bg"}`}>
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div>
            <div className="text-small font-semibold text-fg2">{cheaper ? "Du sparst" : "Du zahlst mehr"}</div>
            <div className={`text-display font-bold tabular ${cheaper ? "text-accent" : "text-caution"}`}>
              CHF <Num value={Math.abs(c.savings)} />
              <span className="ml-1.5 text-body font-normal text-fg2">pro Jahr</span>
            </div>
          </div>
          <p className="text-small text-fg2">
            Energie <span className="tabular">{fmtCH(c.currentEnergy - c.evEnergy)}</span> · Wartung{" "}
            <span className="tabular">{fmtCH(c.maintSavings)}</span> · Steuer{" "}
            <span className="tabular">{fmtCH(c.taxSavings)}</span>
            <br />
            Über 10 Jahre: <span className="font-semibold text-fg tabular">CHF {fmtCH(Math.abs(c.savings) * 10)}</span>
          </p>
        </div>
        {c.solarActive && (
          <p className="mt-3 flex items-start gap-2 border-t border-line pt-3 text-small text-fg2">
            <Sun size={15} className="mt-0.5 shrink-0 text-caution" aria-hidden />
            <span>
              Mit deiner PV-Anlage kommen{" "}
              <span className="font-semibold text-fg tabular">
                CHF {fmtCH(c.solarLow)}–{fmtCH(c.solarHigh)}
              </span>{" "}
              pro Jahr dazu — je nachdem, wie viel der Heimladung ({fmtCH(c.homeKwh)} kWh) direkt aus der Sonne kommt.
            </span>
          </p>
        )}
      </div>

      <div className="mt-6">
        <h3 className="text-h3 font-bold text-fg">Woraus sich das zusammensetzt</h3>
        <div className="mt-2">
          <Line
            label="Zuhause laden"
            note={`${tariffLabel} · ${fmtCH(tariff * 100, 1)} Rp./kWh`}
            value={`${fmtCH(c.homeKwh)} kWh → CHF ${fmtCH(c.homeCost)}`}
          />
          <Line
            label="Unterwegs laden"
            note={c.chosen.primary}
            value={`${fmtCH(c.publicKwh)} kWh → CHF ${fmtCH(c.chosen.publicCost)}`}
          />
          <Line
            label="Wartung & Service"
            note={
              c.currentIsEv
                ? "beide elektrisch — kein Vorteil"
                : fuelCfg.plugIn || currentFuel === "HYBRID"
                  ? "dein Hybrid spart schon an den Bremsen — der Rest bleibt Motorservice"
                  : "kein Öl, keine Zündkerzen, Rekuperation schont die Bremsen"
            }
            value={`CHF ${fmtCH(c.maintEv)}`}
            saving={c.maintSavings}
          />
          <Line
            label={`Verkehrssteuer ${taxYear}`}
            note={
              cantonCode
                ? `Kanton ${cantonCode} · ${fmtCH(c.weightKg)} kg · ${c.taxDiscountPct} % E-Rabatt`
                : "CH-Mittel — PLZ setzen für deinen Kanton"
            }
            value={`CHF ${fmtCH(c.tax.ev)}`}
            saving={c.taxSavings}
          />
        </div>
      </div>

      <div className="mt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h3 className="text-h3 font-bold text-fg">Ladekarte für unterwegs</h3>
          {c.chosen.id !== c.cheapest.id && (
            <button onClick={() => setComboChoice(null)} className="link text-small font-semibold">
              Zur Empfehlung zurück
            </button>
          )}
        </div>
        <div className="mt-2 space-y-1.5">
          {c.combos.map((combo) => {
            const isChosen = combo.id === c.chosen.id;
            return (
              <button
                key={combo.id}
                onClick={() => setComboChoice(combo.id)}
                aria-pressed={isChosen}
                className={`flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-control border px-4 py-2.5 text-left transition-colors ${
                  isChosen ? "border-accent bg-faint" : "border-line hover:border-line2 hover:bg-surface2"
                }`}
              >
                <span>
                  <span className="flex items-center gap-2 text-body text-fg">
                    {combo.primary} + {combo.secondary}
                    {combo.id === c.cheapest.id && <Badge tone="positive">günstigste</Badge>}
                  </span>
                  <span className="block text-small text-fg3">{combo.network}</span>
                </span>
                <span className="text-small text-fg2">
                  <span className="tabular">{combo.monthly === 0 ? "0.—" : combo.monthly.toFixed(2)}</span>/Mt ·{" "}
                  <span className="tabular">{combo.perKwh.toFixed(2)}</span>/kWh ·{" "}
                  <span className={`font-semibold tabular ${isChosen ? "text-accent" : "text-fg"}`}>
                    CHF {fmtCH(combo.publicCost)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6 border-t border-line pt-4">
        <Disclosure summary="Wie wir rechnen">
          <div className="max-w-prose space-y-2 text-small leading-relaxed text-fg2">
            <p>
              Verglichen werden Energie, Wartung und kantonale Verkehrssteuer für {vehicleTitle(listing)} (
              {fmtCH(listing.consumption, 1)} kWh/100 km, {fmtCH(c.weightKg)} kg) gegen dein heutiges Auto (
              {fuelCfg.label}, {fmtCH(currentCons, 1)} {fuelCfg.unit}
              {c.currentIsEv
                ? ", gerechnet mit deinem Heimtarif"
                : `, ${(fuelCfg.price ?? 0).toFixed(2)} CHF/l — BFS-Durchschnitt ${FUEL_PRICES_ASOF}`}
              ).
            </p>
            {currentFuel === "PLUGIN" && (
              <p>
                Beim Plug-in-Hybrid werden die Jahreskilometer aufgeteilt: {100 - elecShare} % auf Benzin zum
                eingetragenen Hybridbetriebs-Verbrauch, {elecShare} % auf Strom zu {PLUGIN_KWH_PER_100KM} kWh/100 km
                und deinem Heimtarif. Steuerlich zählt er als Verbrenner — den E-Rabatt der Kantone gibt es nur für
                reine E-Autos.
              </p>
            )}
            {currentFuel === "HYBRID" && (
              <p>
                Ein Vollhybrid lädt nur sich selbst, sein Strom kommt also aus dem Tank. Steuerlich zählt er als
                Verbrenner — den E-Rabatt der Kantone gibt es nur für reine E-Autos.
              </p>
            )}
            <p>
              Wartung nach TCS/ADAC (E-Autos rund 35 % günstiger). Steuer: lineares Gewichtsmodell in CHF pro 100 kg
              je Kanton, Stand {taxYear}; Hubraum-Kantone über ein Gewichts-Äquivalent. Ladekarten-Tarife Stand{" "}
              {CARDS_AS_OF} — Tagespreise in den Anbieter-Apps. Versicherung und Finanzierung sind nicht
              eingerechnet.
            </p>
            {c.solarActive && (
              <p>
                Solar: jede selbst geladene kWh spart deinen Tarif ({fmtCH(tariff * 100, 1)} Rp.) minus die
                entgangene Einspeisevergütung ({fmtCH(SOLAR_COST * 100)} Rp.). Angenommen werden{" "}
                {SOLAR_COVER_MIN * 100}–{SOLAR_COVER_MAX * 100} % Deckung der Heimladung.
              </p>
            )}
          </div>
        </Disclosure>
      </div>
    </div>
  );
}
