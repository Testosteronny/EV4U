import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Avatar, CheckRow, EmptyState } from "../ui";
import { useListings } from "../../hooks/useListings";
import { href } from "../../lib/url";
import { fold } from "../../utils/search";
import type { Listing } from "../../data/evData";

/* ============================================================================
   /modelle — every brand of the catalog with its models and the used
   offers in stock right now. A search field across brand AND model names
   («enyaq» finds Škoda), and «nur mit Angeboten».
   ============================================================================ */

export type BrandSummary = { slug: string; name: string; models: string[] };

export default function ModelIndex({ brands, initial }: { brands: BrandSummary[]; initial?: Listing[] }) {
  const { listings } = useListings(initial);
  const [q, setQ] = useState("");
  const [onlyStock, setOnlyStock] = useState(false);

  const stock = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of listings) if (l.status !== "VERKAUFT") m.set(fold(l.brand), (m.get(fold(l.brand)) ?? 0) + 1);
    return m;
  }, [listings]);

  const term = fold(q.trim());
  const shown = brands
    .map((b) => ({
      ...b,
      offers: stock.get(fold(b.name)) ?? 0,
      hit: term ? b.models.find((m) => fold(m).includes(term)) : undefined,
    }))
    .filter((b) => (!term || fold(b.name).includes(term) || b.hit) && (!onlyStock || b.offers > 0));

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="relative w-full max-w-sm">
          <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg3" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Marke oder Modell"
            aria-label="Marke oder Modell suchen"
            className="field rounded-full pl-9"
          />
        </div>
        <CheckRow checked={onlyStock} onChange={setOnlyStock} label="Nur mit Angeboten" />
      </div>

      {shown.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="Keine Marke gefunden." hint="Der Katalog führt E-Autos, die in Europa angeboten werden oder wurden." />
        </div>
      ) : (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {shown.map((b) => (
            <li key={b.slug}>
              <a href={href(`/modelle/${b.slug}`)} className="card card-hover flex items-center gap-3 p-4">
                <Avatar name={b.name} size={40} />
                <span className="min-w-0">
                  <span className="block truncate text-h3 font-bold text-fg">{b.name}</span>
                  <span className="block truncate text-small text-fg2">
                    {b.hit ?? `${b.models.length} ${b.models.length === 1 ? "Modell" : "Modelle"}`}
                    {b.offers > 0 && (
                      <span className="font-semibold text-accent">
                        {" "}
                        · {b.offers} {b.offers === 1 ? "Angebot" : "Angebote"}
                      </span>
                    )}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
