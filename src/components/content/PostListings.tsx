import { useMemo } from "react";
import ListingCard from "../listing/ListingCard";
import { useListings } from "../../hooks/useListings";
import { useMarket } from "../../hooks/useMarket";
import { sorter } from "../../lib/filters";
import type { Listing } from "../../data/evData";

/* ============================================================================
   «Passende Inserate» under a post or guide: the cars of the models the
   post is about (frontmatter `models`), filled up with the newest listings.
   ============================================================================ */

export default function PostListings({ models, initial }: { models: string[]; initial?: Listing[] }) {
  const { listings } = useListings(initial);
  const forSale = useMemo(() => listings.filter((l) => l.status !== "VERKAUFT"), [listings]);
  const market = useMarket(forSale);
  const picked = useMemo(() => {
    const matching = forSale.filter((l) => l.modelSlug && models.includes(l.modelSlug));
    const rest = [...forSale].sort(sorter("neu", market.ctx)).filter((l) => !matching.includes(l));
    return [...matching, ...rest].slice(0, 3);
  }, [forSale, models, market.ctx]);

  if (picked.length === 0) return null;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {picked.map((l) => (
        <ListingCard key={l.id} listing={l} monthly={market.monthly.get(l.id)} distance={market.distance.get(l.id)} />
      ))}
    </div>
  );
}
