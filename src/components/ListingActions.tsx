import { GitCompareArrows, Heart } from "lucide-react";
import { useCockpit } from "../hooks/useCockpit";
import { useFavorites } from "../hooks/useFavorites";
import { MAX_COMPARE } from "../stores/cockpit";
import type { Listing } from "../data/evData";

/* ============================================================================
   Merken + Vergleichen — das Aktionspaar an jedem Inserat.

   Stand vorher dreimal fast identisch im Quelltext (Karte, Liste,
   Detailseite), inklusive dreier Fassungen derselben Tooltips. Ein Paar,
   zwei Varianten: über einem Bild («overlay») oder auf einer Fläche.
   ============================================================================ */

export default function ListingActions({
  listing: l,
  variant = "plain",
  className = "",
}: {
  listing: Listing;
  /** «overlay» sitzt über einem Foto und braucht deshalb Deckung. */
  variant?: "plain" | "overlay";
  className?: string;
}) {
  const { compareIds, toggleCompare } = useCockpit();
  const { favorites, toggleFavorite } = useFavorites();

  const reserved = l.status === "RESERVIERT";
  const isFav = favorites.includes(l.id);
  const inCompare = compareIds.includes(l.id);
  const compareFull = !inCompare && compareIds.length >= MAX_COMPARE;

  const base =
    "grid h-8 w-8 place-items-center rounded-card border transition-colors disabled:cursor-not-allowed disabled:opacity-40";
  const idle =
    variant === "overlay"
      ? "border-line2 bg-canvas/85 text-fg2 backdrop-blur-xs hover:text-fg"
      : "border-line2 bg-surface text-fg2 hover:text-fg";
  const on = "border-accent bg-accent text-on-accent";

  return (
    <div className={`flex gap-1.5 ${className}`}>
      <button
        onClick={() => toggleFavorite(l.id)}
        aria-pressed={isFav}
        title={isFav ? "Von der Merkliste entfernen" : "Auf die Merkliste"}
        className={`${base} ${isFav ? on : idle}`}
      >
        <Heart size={15} fill={isFav ? "currentColor" : "none"} aria-hidden />
        <span className="sr-only">{isFav ? "Gemerkt" : "Merken"}</span>
      </button>
      <button
        onClick={() => toggleCompare(l.id)}
        disabled={reserved || compareFull}
        aria-pressed={inCompare}
        title={
          reserved
            ? "Reservierte Inserate lassen sich nicht vergleichen"
            : compareFull
              ? `Der Vergleich fasst ${MAX_COMPARE} Autos — entferne zuerst eines`
              : inCompare
                ? "Aus dem Vergleich entfernen"
                : "Zum Vergleich hinzufügen"
        }
        className={`${base} ${inCompare ? on : idle}`}
      >
        <GitCompareArrows size={15} aria-hidden />
        <span className="sr-only">
          {inCompare ? "Im Vergleich" : "Vergleichen"}
        </span>
      </button>
    </div>
  );
}
