import { useEffect, useMemo, useState } from "react";
import ListingRow from "../listing/ListingRow";
import { usePlzResolver } from "../../hooks/usePlzResolver";
import { placeOf, plzOf } from "../../lib/listingFacts";
import { loadPlzPoints } from "../../utils/swiss";
import type { Listing } from "../../data/evData";
import type { Market } from "../../hooks/useMarket";

/* ============================================================================
   Kartenansicht (Konzept F9) — without a map library or tile server.

   Switzerland is drawn as a dot matrix from the coordinates of its 3'172
   postcodes (swisstopo, already baked for the tariff lookup): every 4-km
   cell that holds a postcode is one dot. Listings sit on it as pins per
   place, sized by count; a click lists that place's cars below the map.
   Coordinates are LV95, so the drawing is in kilometres and true to scale.
   ============================================================================ */

const E0 = 2_480_000;
const N1 = 1_300_000;
const W = 360; // km
const H = 230; // km
const CELL = 4; // km

type Place = { key: string; name: string; x: number; y: number; listings: Listing[] };

export default function ResultsMap({
  listings,
  market,
  radius,
}: {
  listings: Listing[];
  market: Market;
  /** Umkreis in km, drawn around the origin. */
  radius: number;
}) {
  const [dots, setDots] = useState<{ x: number; y: number }[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const resolve = usePlzResolver(true);

  useEffect(() => {
    let alive = true;
    void loadPlzPoints().then((pts) => {
      const cells = new Set<string>();
      for (const p of pts) {
        const cx = Math.floor((p.e - E0) / 1000 / CELL);
        const cy = Math.floor((N1 - p.n) / 1000 / CELL);
        cells.add(`${cx},${cy}`);
      }
      if (!alive) return;
      setDots(
        [...cells].map((c) => {
          const [cx, cy] = c.split(",").map(Number);
          return { x: cx * CELL + CELL / 2, y: cy * CELL + CELL / 2 };
        }),
      );
    });
    return () => {
      alive = false;
    };
  }, []);

  const places = useMemo(() => {
    if (!resolve) return [] as Place[];
    const byPlz = new Map<string, Place>();
    for (const l of listings) {
      const plz = plzOf(l);
      const g = plz ? resolve(plz) : null;
      if (!plz || !g || g.estimated) continue;
      const p = byPlz.get(plz) ?? {
        key: plz,
        name: placeOf(l),
        x: (g.e - E0) / 1000,
        y: (N1 - g.n) / 1000,
        listings: [],
      };
      p.listings.push(l);
      byPlz.set(plz, p);
    }
    return [...byPlz.values()];
  }, [listings, resolve]);

  const origin = useMemo(() => {
    if (!market.origin || !resolve) return null;
    const g = resolve(market.origin.zip);
    return g ? { x: (g.e - E0) / 1000, y: (N1 - g.n) / 1000 } : null;
  }, [market.origin, resolve]);

  const unplaced = listings.length - places.reduce((s, p) => s + p.listings.length, 0);
  const current = places.find((p) => p.key === selected) ?? null;

  return (
    <div>
      <div className="card overflow-hidden p-3 sm:p-5">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Karte der Schweiz mit den Inseraten">
          <g className="fill-line2">
            {dots.map((d, i) => (
              <circle key={i} cx={d.x} cy={d.y} r={1.25} />
            ))}
          </g>
          {origin && radius > 0 && (
            <circle
              cx={origin.x}
              cy={origin.y}
              r={radius}
              className="fill-accent/8 stroke-accent"
              strokeWidth={0.6}
              strokeDasharray="3 2"
            />
          )}
          {origin && (
            <g>
              <circle cx={origin.x} cy={origin.y} r={2.6} className="fill-fg" />
              <text x={origin.x + 4} y={origin.y - 3} className="fill-fg text-[7px] font-semibold">
                Du
              </text>
            </g>
          )}
          {places.map((p) => {
            const r = 3.5 + Math.min(5, p.listings.length * 1.2);
            const active = p.key === selected;
            return (
              <g
                key={p.key}
                role="button"
                tabIndex={0}
                aria-label={`${p.name}: ${p.listings.length} ${p.listings.length === 1 ? "Inserat" : "Inserate"}`}
                onClick={() => setSelected(active ? null : p.key)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected(active ? null : p.key);
                  }
                }}
                className="cursor-pointer outline-none"
              >
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={r}
                  className={active ? "fill-forest stroke-volt" : "fill-accent stroke-surface"}
                  strokeWidth={1}
                />
                <text
                  x={p.x}
                  y={p.y + 2.3}
                  textAnchor="middle"
                  className={`pointer-events-none text-[6.5px] font-bold ${active ? "fill-volt" : "fill-on-accent"}`}
                >
                  {p.listings.length}
                </text>
              </g>
            );
          })}
        </svg>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-small text-fg3">
          <span>Ein Punkt je Ort. Antippen zeigt die Inserate dort.</span>
          {unplaced > 0 && <span>{unplaced} ohne Ortsangabe nicht auf der Karte</span>}
        </div>
      </div>

      {current && (
        <div className="mt-5">
          <h2 className="mb-3 text-h3 font-bold text-fg">
            {current.name} · {current.listings.length} {current.listings.length === 1 ? "Inserat" : "Inserate"}
          </h2>
          <div className="grid gap-3">
            {current.listings.map((l) => (
              <ListingRow
                key={l.id}
                listing={l}
                monthly={market.monthly.get(l.id)}
                distance={market.distance.get(l.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
