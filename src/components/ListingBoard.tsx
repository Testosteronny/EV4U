import { ArrowUpRight, GitCompareArrows, Heart } from "lucide-react";
import { ListingThumb } from "./CarGraphic";
import { useCockpit } from "../hooks/useCockpit";
import { useFavorites } from "../hooks/useFavorites";
import { href } from "../lib/url";
import { type Listing } from "../data/evData";
import { fmtCH } from "../utils/swiss";

/* ============================================================================
   ListingBoard — the dense catalogue table on /inserate. Every row is a
   <Link> to its /inserat/:id detail page. The compare toggle (max 3) lives
   inside the row but never navigates. Strom/100 km is live from the fixed
   tariff. Plain text throughout — scannability beats theater here.
   ============================================================================ */

const COLS_FULL =
  "grid-cols-[minmax(0,2.2fr)_1fr_auto_auto] md:grid-cols-[minmax(0,2.2fr)_0.9fr_0.9fr_0.9fr_1fr_0.9fr_auto_auto_auto]";
const COLS_COMPACT =
  "grid-cols-[minmax(0,2.2fr)_1fr_auto] md:grid-cols-[minmax(0,2.2fr)_1fr_1fr_1fr_auto]";

export default function ListingBoard({
  listings,
  compact = false,
}: {
  listings: Listing[];
  /** Compact: fewer columns, no compare toggles. */
  compact?: boolean;
}) {
  const { tariff, tariffLabel, compareIds, toggleCompare } = useCockpit();
  const { favorites, toggleFavorite, canFavorite } = useFavorites();
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
          <a
            key={l.id}
            href={href(`/inserat/${l.id}`)}
            className={`group grid ${cols} w-full items-center gap-x-4 border-b border-line/60 px-4 py-4 text-left font-mono transition-colors duration-200 last:border-b-0 hover:bg-panel2/70 sm:px-6 ${
              reserved ? "opacity-60" : ""
            }`}
          >
            <span className="flex min-w-0 items-center gap-3">
              <span
                className={`h-9 w-[3px] shrink-0 transition-colors ${
                  inCompare ? "bg-signal" : "bg-line group-hover:bg-signal/50"
                }`}
                aria-hidden
              />
              <ListingThumb
                listing={l}
                className="hidden h-9 w-14 transition-colors group-hover:border-signal/40 sm:grid"
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold tracking-wide text-ink">
                  {l.brand} {l.model}
                </span>
                <span className="text-[9px] uppercase tracking-[0.2em] text-muted">
                  {l.segment} · {l.sellerType}
                  {isNew && !reserved && <span className="ml-2 text-lume">● NEU</span>}
                </span>
              </span>
            </span>
            {!compact && (
              <span className="hidden text-right text-sm text-ink tabular md:block">
                {l.year} · {fmtCH(l.km / 1000, 0)}T
              </span>
            )}
            {!compact && (
              <span className="hidden text-right text-sm text-ink tabular md:block">
                {l.range} km
              </span>
            )}
            <span
              className={`text-right text-sm font-bold text-ink tabular ${compact ? "hidden md:block" : ""}`}
            >
              {fmtCH(l.price)}
            </span>
            <span className="hidden text-right text-sm font-bold text-signal tabular md:block">
              CHF {per100.toFixed(2)}
            </span>
            <span
              className={`text-right text-[9px] font-bold uppercase tracking-[0.15em] ${
                reserved ? "text-warn" : "text-lume"
              }`}
            >
              {l.status}
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
                      ? "border-signal bg-signal text-nacht"
                      : "border-line text-muted hover:border-signal hover:text-signal"
                }`}
              >
                <GitCompareArrows size={12} />
              </button>
            )}
            {!compact && (
              <button
                title={
                  !canFavorite
                    ? "Merkliste — Login nötig"
                    : isFav
                      ? "Von Merkliste entfernen"
                      : "Auf die Merkliste"
                }
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleFavorite(l.id);
                }}
                className={`hidden h-7 w-8 place-items-center border transition-colors md:grid ${
                  isFav
                    ? "border-signal bg-signal text-nacht"
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
          </a>
        );
      })}

      {/* Board footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-nacht px-4 py-3 font-mono text-[10px] text-muted sm:px-6">
        <span>
          * berechnet mit Tarif {tariffLabel} — {fmtCH(tariff * 100, 1)} Rp./kWh
          {!compact && (
            <span className="ml-3 hidden text-muted/60 md:inline">
              · <GitCompareArrows size={9} className="inline" /> = vergleichen
              (max. 3) · <Heart size={9} className="inline" /> = Merkliste
            </span>
          )}
        </span>
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 bg-lume" aria-hidden />
          {listings.filter((l) => l.status === "AKTIV").length} offen ·{" "}
          {listings.filter((l) => l.status === "RESERVIERT").length} reserviert
        </span>
      </div>
    </div>
  );
}
