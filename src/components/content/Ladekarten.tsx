import { useState } from "react";
import { Badge, Slider } from "../ui";
import { useCockpit } from "../../hooks/useCockpit";
import { priceCombos } from "../../utils/costModel";
import { CARDS_AS_OF, CARD_COMBOS } from "../../data/evData";
import { fmtCH } from "../../utils/swiss";

/* ============================================================================
   Ladekarten-Vergleich (Konzept §4.10) — the same CARD_COMBOS and the same
   pricing the cost model uses, made interactive: how much you charge on the
   road decides whether a subscription pays off. Km per year and the road
   share start from the Fahrprofil and write back to it.
   ============================================================================ */

const MAX_KWH = 3000;
const COLORS = ["rgb(var(--c-accent))", "rgb(var(--c-caution))", "rgb(var(--c-fg2))"];

export default function Ladekarten() {
  const { annualKm, setAnnualKm, publicShare, setPublicShare } = useCockpit();
  const [cons, setCons] = useState(17);
  const publicKwh = Math.round((annualKm / 100) * cons * (publicShare / 100));
  const combos = priceCombos(publicKwh).sort((a, b) => a.publicCost - b.publicCost);
  const cheapest = combos[0];

  // Cost lines over the yearly road demand, 0 … MAX_KWH.
  const W = 600;
  const H = 220;
  const steps = Array.from({ length: 31 }, (_, i) => (i / 30) * MAX_KWH);
  const series = CARD_COMBOS.map((c, i) => ({
    c,
    color: COLORS[i % COLORS.length],
    pts: steps.map((k) => [k, priceCombos(k).find((x) => x.id === c.id)!.publicCost] as const),
  }));
  const yMax = Math.max(...series.flatMap((s) => s.pts.map((p) => p[1])));
  const x = (k: number) => (k / MAX_KWH) * W;
  const y = (v: number) => H - (v / yMax) * H;

  return (
    <div className="not-prose">
      <div className="card grid gap-5 p-5 sm:grid-cols-3">
        <Slider label="Kilometer pro Jahr" value={annualKm} min={5000} max={40000} step={500} unit="km" onChange={setAnnualKm} />
        <Slider label="Davon unterwegs geladen" value={publicShare} min={0} max={100} step={5} unit="%" onChange={setPublicShare} />
        <Slider
          label="Verbrauch"
          value={cons}
          min={12}
          max={25}
          step={0.5}
          unit="kWh/100 km"
          format={(v) => fmtCH(v, 1)}
          onChange={setCons}
        />
      </div>
      <p className="mt-3 text-body text-fg2">
        Unterwegs geladen: <strong className="text-fg tabular">{fmtCH(publicKwh)} kWh pro Jahr</strong>
      </p>

      <div className="mt-5 grid gap-3">
        {combos.map((c) => (
          <div
            key={c.id}
            className={`card flex flex-wrap items-center justify-between gap-4 p-4 ${c.id === cheapest.id ? "border-accent" : ""}`}
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-h3 font-bold text-fg">
                {c.primary} + {c.secondary}
                {c.id === cheapest.id && <Badge tone="positive">Für dich am günstigsten</Badge>}
              </div>
              <p className="text-small text-fg2">{c.network}</p>
              <p className="text-small text-fg3 tabular">
                {c.monthly === 0 ? "keine Grundgebühr" : `CHF ${c.monthly.toFixed(2)}/Mt.`} · CHF {c.perKwh.toFixed(2)}/kWh
                {c.inclKwh > 0 && ` · ${fmtCH(c.inclKwh / 12)} kWh/Mt. inklusive`}
              </p>
            </div>
            <div className="text-right">
              <div className="text-h2 font-bold text-fg tabular">CHF {fmtCH(c.publicCost)}</div>
              <div className="text-small text-fg2 tabular">
                pro Jahr{publicKwh > 0 && ` · ${fmtCH((c.publicCost / publicKwh) * 100, 1)} Rp./kWh effektiv`}
              </div>
            </div>
          </div>
        ))}
      </div>

      <figure className="card mt-6 p-5">
        <figcaption className="text-h3 font-bold text-fg">Ab wann lohnt sich ein Abo?</figcaption>
        <p className="text-small text-fg2">Kosten pro Jahr je nach Strommenge unterwegs. Der Punkt markiert deinen Wert.</p>
        <svg viewBox={`-8 -8 ${W + 16} ${H + 36}`} className="mt-4 h-auto w-full" role="img" aria-label="Jahreskosten der Ladekarten nach Strommenge">
          <line x1={0} y1={H} x2={W} y2={H} stroke="rgb(var(--c-line2))" />
          {[0, 1000, 2000, 3000].map((k) => (
            <text key={k} x={x(k)} y={H + 20} textAnchor="middle" className="fill-fg3 text-[11px]">
              {fmtCH(k)} kWh
            </text>
          ))}
          {series.map((s) => (
            <polyline
              key={s.c.id}
              fill="none"
              stroke={s.color}
              strokeWidth={2.5}
              points={s.pts.map(([k, v]) => `${x(k)},${y(v)}`).join(" ")}
            />
          ))}
          {publicKwh <= MAX_KWH && (
            <g>
              <line x1={x(publicKwh)} y1={0} x2={x(publicKwh)} y2={H} stroke="rgb(var(--c-fg3))" strokeDasharray="4 4" />
              <circle cx={x(publicKwh)} cy={y(cheapest.publicCost)} r={5} fill="rgb(var(--c-accent))" />
            </g>
          )}
        </svg>
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-small text-fg2">
          {series.map((s) => (
            <li key={s.c.id} className="flex items-center gap-2">
              <span className="inline-block h-1 w-5 rounded-full" style={{ background: s.color }} />
              {s.c.primary}
            </li>
          ))}
        </ul>
      </figure>
      <p className="mt-3 text-small text-fg3">
        Tarife Stand {CARDS_AS_OF}, je Säule und Anbieter verschieden — die Tagespreise stehen in den Apps. Wir erhalten
        keine Provision von den Anbietern.
      </p>
    </div>
  );
}
