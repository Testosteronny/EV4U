import { useMemo } from "react";
import { useListings } from "../hooks/useListings";
import { href } from "../lib/url";

/* ============================================================================
   Brand index — the brands currently on the board, derived live from the
   open listings. One click jumps into the filtered catalogue. A static,
   scannable row (was an infinite marquee — motion cost more clarity than
   it bought).
   ============================================================================ */

export default function BrandTreadmill() {
  const { active } = useListings();

  const brands = useMemo(() => {
    const counts = new Map<string, number>();
    for (const l of active) counts.set(l.brand, (counts.get(l.brand) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [active]);

  if (brands.length === 0) return null;

  return (
    <section className="border-y border-line" aria-label="Marken auf der Tafel">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-2 gap-y-2 px-4 py-5 sm:px-8">
        <span className="mr-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          Marken
        </span>
        {brands.map(([brand, count]) => (
          <a
            key={brand}
            href={href(`/inserate?marke=${encodeURIComponent(brand)}`)}
            className="group flex items-baseline gap-1.5 border border-line bg-panel px-3 py-1.5 transition-colors hover:border-signal/60 hover:text-signal"
          >
            <span className="text-sm font-bold uppercase tracking-wide text-ink transition-colors group-hover:text-signal">
              {brand}
            </span>
            <span className="font-mono text-[10px] text-muted">{count}</span>
          </a>
        ))}
        <a
          href={href("/inserate")}
          className="ml-auto font-mono text-[10px] uppercase tracking-[0.15em] text-muted transition-colors hover:text-signal"
        >
          Alle Inserate →
        </a>
      </div>
    </section>
  );
}
