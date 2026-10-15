import { GitCompareArrows, X } from "lucide-react";
import { LinkButton } from "./ui";
import { useCockpit } from "../hooks/useCockpit";
import { useListings } from "../hooks/useListings";
import { href } from "../lib/url";
import { MAX_COMPARE } from "../stores/cockpit";
import { vehicleShort } from "../utils/format";

/* ============================================================================
   CompareTray — die Leiste, sobald etwas im Vergleich liegt. Auf /vergleich
   selbst ausgeblendet. Der Vergleich ist damit ein Zustand mit eigener
   Anzeige, kein Navigationsziel, das im Leeren endet.
   ============================================================================ */

export default function CompareTray() {
  const { compareIds, toggleCompare, clearCompare } = useCockpit();
  const { listings } = useListings();

  const onVergleich =
    typeof window !== "undefined" &&
    window.location.pathname.replace(/\/$/, "") === href("/vergleich");
  if (compareIds.length === 0 || onVergleich) return null;

  const items = compareIds
    .map((id) => listings.find((l) => l.id === id))
    .filter((l): l is NonNullable<typeof l> => Boolean(l));

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 px-4">
      <div className="overlay-card animate-fade-in pointer-events-auto mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <GitCompareArrows size={16} className="text-fg2" aria-hidden />
          {items.map((l) => (
            <button
              key={l.id}
              onClick={() => toggleCompare(l.id)}
              title="Aus dem Vergleich entfernen"
              className="inline-flex items-center gap-1.5 rounded-chip border border-line bg-surface px-2.5 py-1 text-small text-fg transition-colors hover:border-line2 hover:bg-surface2"
            >
              {vehicleShort(l)}
              <X size={12} className="text-fg3" aria-hidden />
              <span className="sr-only">aus dem Vergleich entfernen</span>
            </button>
          ))}
          <span className="text-small text-fg3 tabular">
            {items.length}/{MAX_COMPARE}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={clearCompare}
            className="rounded-chip px-2 py-1 text-small text-fg3 transition-colors hover:bg-surface2 hover:text-fg"
          >
            Leeren
          </button>
          {items.length >= 2 ? (
            <LinkButton href={href("/vergleich")} variant="primary" size="sm">
              Vergleichen →
            </LinkButton>
          ) : (
            <span className="text-small text-fg3">Noch ein Inserat wählen</span>
          )}
        </div>
      </div>
    </div>
  );
}
