import { GitCompareArrows, Heart } from "lucide-react";
import { useCockpit } from "../../hooks/useCockpit";
import { useMerkliste } from "../../hooks/useMerkliste";
import { MAX_COMPARE } from "../../stores/cockpit";
import type { Listing } from "../../data/evData";

/* ============================================================================
   Merken + Vergleichen — the action pair on every listing. Merken works
   without an account (local-first Merkliste); the compare tray holds four.
   ============================================================================ */

export default function ListingActions({
  listing: l,
  variant = "plain",
  className = "",
}: {
  listing: Listing;
  /** «overlay» sits on a photo and needs a backing. */
  variant?: "plain" | "overlay";
  className?: string;
}) {
  const { compareIds, toggleCompare, hydrated } = useCockpit();
  const { has, toggle } = useMerkliste();

  const saved = has(l.id);
  const inCompare = hydrated && compareIds.includes(l.id);
  const compareFull = !inCompare && compareIds.length >= MAX_COMPARE;
  const sold = l.status === "VERKAUFT";

  const base =
    "grid h-9 w-9 place-items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40";
  const idle =
    variant === "overlay"
      ? "bg-white/90 text-neutral-800 shadow-sm backdrop-blur-sm hover:bg-white dark:bg-black/60 dark:text-white"
      : "border border-line2 bg-surface text-fg2 hover:text-fg";

  return (
    <div className={`flex gap-1.5 ${className}`}>
      <button
        type="button"
        onClick={() => toggle(l)}
        aria-pressed={saved}
        title={saved ? "Von der Merkliste entfernen" : "Auf die Merkliste"}
        className={`${base} ${saved ? "bg-accent text-on-accent" : idle}`}
      >
        <Heart size={16} fill={saved ? "currentColor" : "none"} aria-hidden />
        <span className="sr-only">{saved ? "Gemerkt" : "Merken"}</span>
      </button>
      {!sold && (
        <button
          type="button"
          onClick={() => toggleCompare(l.id)}
          disabled={compareFull}
          aria-pressed={inCompare}
          title={
            compareFull
              ? `Der Vergleich fasst ${MAX_COMPARE} Autos — entferne zuerst eines`
              : inCompare
                ? "Aus dem Vergleich entfernen"
                : "Zum Vergleich hinzufügen"
          }
          className={`${base} ${inCompare ? "bg-accent text-on-accent" : idle}`}
        >
          <GitCompareArrows size={16} aria-hidden />
          <span className="sr-only">{inCompare ? "Im Vergleich" : "Vergleichen"}</span>
        </button>
      )}
    </div>
  );
}
