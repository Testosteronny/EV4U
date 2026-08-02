import { ChevronRight, GitCompareArrows, Heart } from "lucide-react";
import { ListingThumb } from "./CarGraphic";
import { Badge } from "./ui";
import { useCockpit } from "../hooks/useCockpit";
import { useFavorites } from "../hooks/useFavorites";
import { href } from "../lib/url";
import { fmtCH } from "../utils/swiss";
import { type Listing } from "../data/evData";

/* ============================================================================
   ListingBoard — die dichte Listenansicht.

   Früher die EINZIGE Darstellung des Katalogs: neun Spalten, in denen das
   Foto auf 56×36 px schrumpfte. Jetzt ist sie der Modus für alle, die
   Datenblätter vergleichen wollen — umschaltbar, mit grösserem Bild und
   lesbaren Zellen. `compact` bleibt für eingebettete Listen (Konto, ähnliche
   Inserate).
   ============================================================================ */

const COLS =
  "grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,2.4fr)_repeat(3,minmax(0,1fr))_auto]";
const COLS_COMPACT = "grid-cols-[minmax(0,1fr)_auto]";

export default function ListingBoard({
  listings,
  compact = false,
}: {
  listings: Listing[];
  /** Weniger Spalten, keine Aktionen — für eingebettete Listen. */
  compact?: boolean;
}) {
  const { tariff, compareIds, toggleCompare } = useCockpit();
  const { favorites, toggleFavorite } = useFavorites();
  const cols = compact ? COLS_COMPACT : COLS;

  return (
    <div className="card-flush">
      {!compact && (
        <div
          className={`grid ${cols} items-center gap-x-4 border-b border-line px-4 py-2.5 text-small text-fg3`}
        >
          <span>Inserat</span>
          <span className="hidden text-right md:block">Jahr · km</span>
          <span className="hidden text-right md:block">Reichweite</span>
          <span className="hidden text-right md:block">Strom/100 km</span>
          <span className="text-right">Preis</span>
        </div>
      )}

      {listings.map((l) => {
        const reserved = l.status === "RESERVIERT";
        const per100 = l.consumption * tariff;
        const inCompare = compareIds.includes(l.id);
        const isFav = favorites.includes(l.id);

        return (
          <div
            key={l.id}
            className="group relative border-b border-line last:border-b-0 transition-colors hover:bg-surface2/60"
          >
            <a
              href={href(`/inserat/${l.id}`)}
              className={`grid ${cols} items-center gap-x-4 px-4 py-3 ${
                reserved ? "opacity-65" : ""
              }`}
            >
              <span className="flex min-w-0 items-center gap-3">
                <ListingThumb listing={l} className="hidden h-12 w-[4.5rem] sm:block" />
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-body font-medium text-fg">
                      {l.brand} {l.model}
                    </span>
                    {reserved ? (
                      <Badge tone="caution">Reserviert</Badge>
                    ) : (
                      l.postedDays <= 3 && <Badge tone="positive">Neu</Badge>
                    )}
                  </span>
                  <span className="block truncate text-small text-fg2">
                    {l.segment.toLowerCase()} ·{" "}
                    {l.sellerType === "GARAGE" ? "Garage" : "Privat"} · {l.ort}
                    <span className="md:hidden">
                      {" "}
                      · {l.year} · <span className="tabular">{fmtCH(l.km)}</span> km
                    </span>
                  </span>
                </span>
              </span>

              <span className="hidden text-right text-body text-fg2 tabular md:block">
                {l.year} · {fmtCH(l.km)}
              </span>
              <span className="hidden text-right text-body text-fg2 tabular md:block">
                {l.range} km
              </span>
              <span className="hidden text-right text-body text-fg2 tabular md:block">
                {per100.toFixed(2)}
              </span>

              <span className="flex items-center justify-end gap-3">
                <span className="text-body font-semibold text-fg tabular">
                  {fmtCH(l.price)}
                </span>
                {compact && <ChevronRight size={15} className="text-fg3" aria-hidden />}
                {!compact && <span className="w-[4.75rem]" aria-hidden />}
              </span>
            </a>

            {!compact && (
              <div className="absolute right-4 top-1/2 flex -translate-y-1/2 gap-1.5">
                <button
                  onClick={() => toggleFavorite(l.id)}
                  title={isFav ? "Von der Merkliste entfernen" : "Auf die Merkliste"}
                  className={`grid h-8 w-8 place-items-center rounded-card border transition-colors ${
                    isFav
                      ? "border-accent bg-accent text-on-accent"
                      : "border-line2 bg-surface text-fg2 hover:text-fg"
                  }`}
                >
                  <Heart size={14} fill={isFav ? "currentColor" : "none"} />
                  <span className="sr-only">Merken</span>
                </button>
                <button
                  onClick={() => toggleCompare(l.id)}
                  disabled={reserved}
                  title={
                    reserved
                      ? "Reservierte Inserate lassen sich nicht vergleichen"
                      : inCompare
                        ? "Aus dem Vergleich entfernen"
                        : "Zum Vergleich hinzufügen (max. 3)"
                  }
                  className={`grid h-8 w-8 place-items-center rounded-card border transition-colors disabled:opacity-40 ${
                    inCompare
                      ? "border-accent bg-accent text-on-accent"
                      : "border-line2 bg-surface text-fg2 hover:text-fg"
                  }`}
                >
                  <GitCompareArrows size={14} />
                  <span className="sr-only">Vergleichen</span>
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
