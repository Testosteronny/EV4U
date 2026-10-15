import { useMemo } from "react";
import ListingCard from "../listing/ListingCard";
import SaveSearch from "../search/SaveSearch";
import { EmptyState, LinkButton } from "../ui";
import { useListings } from "../../hooks/useListings";
import { useMarket } from "../../hooks/useMarket";
import { searchHref } from "../../lib/entries";
import { filterParams } from "../../lib/filters";
import { fmtCH } from "../../utils/swiss";
import type { Listing } from "../../data/evData";

/* ============================================================================
   The used offers of one catalog model, live — the model page is
   prerendered, the stock is not. `summary` sits in the page header (count,
   lowest price, Suchabo); `grid` shows the cards.
   ============================================================================ */

export default function ModelOffers({
  modelSlug,
  brand,
  title,
  mode,
  initial,
}: {
  modelSlug: string;
  /** Brand name as the filter expects it. */
  brand: string;
  title: string;
  mode: "summary" | "grid";
  initial?: Listing[];
}) {
  const { listings } = useListings(initial);
  const offers = useMemo(
    () =>
      listings
        .filter((l) => l.modelSlug === modelSlug && l.status !== "VERKAUFT")
        .sort((a, b) => a.price - b.price),
    [listings, modelSlug],
  );
  const market = useMarket(offers);
  const filter = { marke: brand, modell: modelSlug };
  const params = filterParams(filter).toString();

  if (mode === "summary") {
    return (
      <div className="flex flex-wrap items-center gap-3">
        {offers.length > 0 ? (
          <LinkButton href={searchHref(filter)} variant="primary">
            {offers.length} {offers.length === 1 ? "Occasion" : "Occasionen"} ab CHF {fmtCH(offers[0].price)}
          </LinkButton>
        ) : (
          <span className="text-body text-fg2">Gerade keine Occasion im Angebot.</span>
        )}
        <SaveSearch params={params} label={`${title} Occasionen`} />
      </div>
    );
  }

  if (offers.length === 0) {
    return (
      <EmptyState
        title={`Gerade kein ${title} im Angebot.`}
        hint="Speichere die Suche — wir melden uns, sobald einer inseriert wird."
      >
        <SaveSearch params={params} label={`${title} Occasionen`} variant="primary" />
      </EmptyState>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {offers.slice(0, 6).map((l) => (
        <ListingCard key={l.id} listing={l} monthly={market.monthly.get(l.id)} distance={market.distance.get(l.id)} />
      ))}
    </div>
  );
}
