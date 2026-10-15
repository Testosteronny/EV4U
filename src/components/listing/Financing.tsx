import { useState } from "react";
import { Segmented, Slider } from "../ui";
import {
  FINANCING_DEFAULTS,
  FINANCING_TERMS,
  KKG_WARNING,
  financing,
} from "../../utils/costModel";
import { fmtCH } from "../../utils/swiss";

/* ============================================================================
   Finanzierungsrechner (F4) — what the car costs per month if financed.

   An example with the visitor's own assumptions, clearly labelled as such:
   EV4U brokers no credit and names no lender. The KKG warning goes with
   every figure (consumer-credit advertising in Switzerland).
   ============================================================================ */

export function useFinancing(price: number) {
  const [downPct, setDownPct] = useState(FINANCING_DEFAULTS.downPct);
  const [months, setMonths] = useState(FINANCING_DEFAULTS.months);
  const [ratePct, setRatePct] = useState(FINANCING_DEFAULTS.ratePct);
  const down = Math.round((price * downPct) / 100 / 100) * 100;
  return {
    downPct,
    setDownPct,
    months,
    setMonths,
    ratePct,
    setRatePct,
    down,
    result: financing(price, down, months, ratePct),
  };
}

export default function Financing({
  price,
  betrieb,
  state,
}: {
  price: number;
  /** Betrieb pro Monat — added for the all-in monthly figure. */
  betrieb?: number | null;
  /** Shared state, when another part of the page shows the same rate. */
  state?: ReturnType<typeof useFinancing>;
}) {
  const own = useFinancing(price);
  const f = state ?? own;
  return (
    <div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Slider
          label="Anzahlung"
          value={f.downPct}
          min={0}
          max={60}
          step={5}
          onChange={f.setDownPct}
          format={(v) => `${v} % · CHF ${fmtCH(Math.round((price * v) / 100 / 100) * 100)}`}
        />
        <Slider
          label="Zins (Annahme)"
          value={f.ratePct}
          min={0}
          max={12}
          step={0.1}
          unit="%"
          onChange={f.setRatePct}
          format={(v) => fmtCH(v, 1)}
        />
      </div>
      <div className="mt-4">
        <span className="mb-1.5 block text-small font-semibold text-fg2">Laufzeit</span>
        <Segmented
          label="Laufzeit in Monaten"
          size="sm"
          value={String(f.months)}
          onChange={(v) => f.setMonths(Number(v))}
          options={FINANCING_TERMS.map((m) => ({ key: String(m), label: `${m} Mt.` }))}
        />
      </div>

      <div className="mt-5 grid gap-3 rounded-card bg-surface2 p-4 sm:grid-cols-3">
        <div>
          <div className="text-small text-fg2">Rate pro Monat</div>
          <div className="text-h2 font-bold text-fg tabular">CHF {fmtCH(f.result.monthly)}</div>
        </div>
        <div>
          <div className="text-small text-fg2">Finanziert</div>
          <div className="text-h3 font-semibold text-fg tabular">CHF {fmtCH(f.result.financed)}</div>
        </div>
        <div>
          <div className="text-small text-fg2">Zinskosten total</div>
          <div className="text-h3 font-semibold text-fg tabular">CHF {fmtCH(f.result.interest)}</div>
        </div>
        {betrieb != null && (
          <p className="text-small text-fg2 sm:col-span-3">
            Mit dem Betrieb (≈ CHF {fmtCH(betrieb)}/Mt.) sind das{" "}
            <strong className="text-fg tabular">≈ CHF {fmtCH(f.result.monthly + betrieb)} pro Monat</strong>, ohne
            Versicherung.
          </p>
        )}
      </div>
      <p className="mt-3 text-micro text-fg3">
        Beispielrechnung mit deinen Annahmen — kein Angebot. EV4U vermittelt keine Kredite. {KKG_WARNING}
      </p>
    </div>
  );
}
