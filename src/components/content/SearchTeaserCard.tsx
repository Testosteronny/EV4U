import { useMemo } from "react";
import { Search } from "lucide-react";
import SaveSearch from "../search/SaveSearch";
import { LinkButton } from "../ui";
import { useListings } from "../../hooks/useListings";
import { useMarket } from "../../hooks/useMarket";
import { filterChips, passes, readFilters } from "../../lib/filters";
import { href } from "../../lib/url";
import type { Listing } from "../../data/evData";

/* ============================================================================
   <SearchTeaser filter="seg=SUV&preis=40000" /> — MDX embed: a pre-filtered
   search with its live hit count and «Suchabo speichern». Every post ends
   in the marketplace, never in a dead end.
   ============================================================================ */

export default function SearchTeaserCard({
  filter,
  title,
  initial,
}: {
  /** The query exactly as /inserate reads it. */
  filter: string;
  title?: string;
  initial?: Listing[];
}) {
  const { listings } = useListings(initial);
  const f = useMemo(() => readFilters(new URLSearchParams(filter)), [filter]);
  const forSale = useMemo(() => listings.filter((l) => l.status !== "VERKAUFT"), [listings]);
  const market = useMarket(forSale);
  const count = forSale.filter((l) => passes(l, f, market.ctx)).length;
  const label = title ?? filterChips(f).map((c) => c.label).join(" · ");

  return (
    <aside className="not-prose card my-8 flex flex-wrap items-center justify-between gap-4 p-5">
      <div className="min-w-0">
        <p className="eyebrow text-accent">Passende Inserate</p>
        <p className="mt-1 text-h3 font-bold text-fg">{label}</p>
        <p className="text-small text-fg2 tabular">
          {count} {count === 1 ? "Angebot" : "Angebote"} online
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <LinkButton href={`${href("/inserate")}?${filter}`} variant="primary" size="sm">
          <Search size={15} aria-hidden /> Ansehen
        </LinkButton>
        <SaveSearch params={filter} label={label} compact />
      </div>
    </aside>
  );
}
