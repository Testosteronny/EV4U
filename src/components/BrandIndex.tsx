import { useMemo } from "react";
import { useListings } from "../hooks/useListings";
import { href } from "../lib/url";

/* ============================================================================
   Markenindex — die Marken, die gerade auf dem Markt sind, live aus dem
   Bestand. Ein Klick springt in den gefilterten Katalog.
   ============================================================================ */

export default function BrandIndex() {
  const { active } = useListings();

  const brands = useMemo(() => {
    const counts = new Map<string, number>();
    for (const l of active) counts.set(l.brand, (counts.get(l.brand) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [active]);

  if (brands.length === 0) return null;

  return (
    <section className="mx-auto max-w-352 px-4 py-10 sm:px-6" aria-label="Marken im Bestand">
      <div className="eyebrow mb-3">Marken im Bestand</div>
      <div className="flex flex-wrap gap-2">
        {brands.map(([brand, count]) => (
          <a
            key={brand}
            href={`${href("/inserate")}?marke=${encodeURIComponent(brand)}`}
            className="inline-flex items-baseline gap-2 rounded-card border border-line bg-surface px-3 py-2 text-body text-fg transition-colors hover:border-line2 hover:bg-surface2"
          >
            {brand}
            <span className="text-small text-fg3 tabular">{count}</span>
          </a>
        ))}
      </div>
    </section>
  );
}
