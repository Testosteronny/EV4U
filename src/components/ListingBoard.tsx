import { Link } from "react-router-dom";
import { ArrowUpRight, GitCompareArrows, Heart } from "lucide-react";
import { useCockpit } from "../context/CockpitContext";
import { type Listing } from "../data/evData";
import { fmtCH } from "../utils/swiss";
import { FlapText } from "./ui";

/* ============================================================================
   ListingBoard — the split-flap classifieds board, shared by the /inserate
   catalogue and the home-page teaser. Every row is a <Link> to its
   /inserat/:id detail page. The compare toggle (max 3) lives inside the row
   but never navigates. STROM/100KM is live from the fixed tariff.
   ============================================================================ */

const COLS_FULL =
  "grid-cols-[minmax(0,2.2fr)_1fr_auto_auto] md:grid-cols-[minmax(0,2.2fr)_0.9fr_0.9fr_0.9fr_1fr_0.9fr_auto_auto_auto]";
const COLS_COMPACT =
  "grid-cols-[minmax(0,2.2fr)_1fr_auto] md:grid-cols-[minmax(0,2.2fr)_1fr_1fr_1fr_auto]";

export default function ListingBoard({
  listings,
  spin = 0,
  compact = false,
}: {
  listings: Listing[];
  spin?: number;
  /** Compact: home teaser — fewer columns, no compare toggles. */
  compact?: boolean;
}) {
  const { tariff, tariffLabel, compareIds, toggleCompare, favorites, toggleFavorite } =
    useCockpit();
  const cols = compact ? COLS_COMPACT : COLS_FULL;

  return (
    <div className="panel overflow-hidden">
      {/* Board header */}
      <div
        className={`grid ${cols} items-center gap-x-4 border-b border-line bg-nacht px-4 py-3 font-mono text-[9px] uppercase tracking-[0.2em] text-muted sm:px-6`}
      >
        <span>Inserat</span>
        {!compact && <span className="hidden text-right md:block">Jahr · km</span>}
        {!compact && <span className="hidden text-right md:block">Reichweite</span>}
        <span className={compact ? "hidden text-right md:block" : "text-right"}>
          Preis
        </span>
        <span className="hidden text-right text-signal md:block">Strom/100 km*</span>
        <span className={compact ? "text-right" : "text-right"}>Status</span>
        {!compact && (
          <span className="hidden w-8 text-center md:block" title="Vergleichen">
            VS
          </span>
        )}
        {!compact && <span className="hidden w-8 md:block" aria-hidden />}
        <span className="w-4" aria-hidden />
      </div>

      {/* Rows */}
      {listings.map((l) => {
        const reserved = l.status === "RESERVIERT";
        const per100 = l.consumption * tariff;
        const inCompare = compareIds.includes(l.id);
        const isFav = favorites.includes(l.id);
        const isNew = l.postedDays <= 3;
        return (
          <Link
            key={l.id}
            to={`/inserat/${l.id}`}
            className={`group grid ${cols} w-full items-center gap-x-4 border-b border-line/60 px-4 py-4 text-left font-mono transition-colors duration-200 last:border-b-0 hover:bg-panel2/70 sm:px-6 ${
              reserved ? "opacity-60" : ""
            }`}
          >
            <span className="flex min-w-0 items-center gap-3">
              <span
                className={`h-8 w-[3px] shrink-0 transition-colors ${
                  inCompare ? "bg-signal" : "bg-line group-hover:bg-signal/50"
                }`}
                aria-hidden
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold tracking-wide text-ink">
                  <FlapText text={`${l.brand} ${l.model}`} spin={spin} />
                </span>
                <span className="text-[9px] uppercase tracking-[0.2em] text-muted">
                  {l.segment} · {l.sellerType}
                  {isNew && !reserved && <span className="ml-2 text-lume">● NEU</span>}
                </span>
              </span>
            </span>
            {!compact && (
              <span className="hidden text-right text-sm text-ink tabular md:block">
                <FlapText text={`${l.year} · ${fmtCH(l.km / 1000, 0)}T`} spin={spin} />
              </span>
            )}
            {!compact && (
              <span className="hidden text-right text-sm text-ink tabular md:block">
                <FlapText text={`${l.range} KM`} spin={spin} />
              </span>
            )}
            <span
              className={`text-right text-sm font-bold text-ink tabular ${compact ? "hidden md:block" : ""}`}
            >
              <FlapText text={fmtCH(l.price)} spin={spin} />
            </span>
            <span className="hidden text-right text-sm font-bold text-signal tabular md:block">
              <FlapText text={`CHF ${per100.toFixed(2)}`} spin={spin} />
            </span>
            <span
              className={`text-right text-[9px] font-bold uppercase tracking-[0.15em] ${
                reserved ? "text-warn" : "text-lume"
              }`}
            >
              <FlapText text={l.status} spin={spin} />
            </span>
            {!compact && (
              <button
                title={inCompare ? "Aus Vergleich entfernen" : "Vergleichen (max. 3)"}
                disabled={reserved}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!reserved) toggleCompare(l.id);
                }}
                className={`hidden h-7 w-8 place-items-center border transition-colors md:grid ${
                  reserved
                    ? "cursor-not-allowed border-line/50 text-muted/40"
                    : inCompare
                      ? "border-signal bg-signal text-white"
                      : "border-line text-muted hover:border-signal hover:text-signal"
                }`}
              >
                <GitCompareArrows size={12} />
              </button>
            )}
            {!compact && (
              <button
                title={isFav ? "Von Merkliste entfernen" : "Auf die Merkliste"}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleFavorite(l.id);
                }}
                className={`hidden h-7 w-8 place-items-center border transition-colors md:grid ${
                  isFav
                    ? "border-signal bg-signal text-white"
                    : "border-line text-muted hover:border-signal hover:text-signal"
                }`}
              >
                <Heart size={12} fill={isFav ? "currentColor" : "none"} />
              </button>
            )}
            <ArrowUpRight
              size={14}
              className="justify-self-end text-muted transition-colors group-hover:text-signal"
            />
          </Link>
        );
      })}

      {/* Board footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-nacht px-4 py-3 font-mono text-[9px] tracking-[0.15em] text-muted sm:px-6">
        <span>
          * BERECHNET MIT TARIF {tariffLabel.toUpperCase()} —{" "}
          {fmtCH(tariff * 100, 1)} RP/KWH
        </span>
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 animate-blink bg-lume" aria-hidden />
          {listings.filter((l) => l.status === "AKTIV").length} OFFEN ·{" "}
          {listings.filter((l) => l.status === "RESERVIERT").length} RESERVIERT
        </span>
      </div>
    </div>
  );
}
