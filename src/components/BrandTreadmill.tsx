import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useListings } from "../context/ListingsContext";

/* ============================================================================
   BrandTreadmill — infinite marquee of the brands currently ON the board,
   derived live from the open listings (counts included). Clicking a brand
   jumps straight into the filtered catalogue. Hover pauses the belt.
   The separators alternate + / − — the polarity runs through everything.
   ============================================================================ */

export default function BrandTreadmill() {
  const { active } = useListings();

  const brands = useMemo(() => {
    const counts = new Map<string, number>();
    for (const l of active) counts.set(l.brand, (counts.get(l.brand) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [active]);

  if (brands.length === 0) return null;

  // Track is rendered twice → translateX(-50%) loops seamlessly.
  const lap = (key: string) => (
    <div key={key} className="flex items-center" aria-hidden={key === "b"}>
      {brands.map(([brand, count], i) => (
        <span key={brand} className="flex items-center">
          <span
            className={`mx-6 font-mono text-lg ${i % 2 === 0 ? "text-signal" : "text-muted/50"}`}
          >
            {i % 2 === 0 ? "+" : "−"}
          </span>
          <Link
            to={`/inserate?marke=${encodeURIComponent(brand)}`}
            className="group flex items-baseline gap-2"
          >
            <span className="stretch-expand text-outline whitespace-nowrap text-4xl font-black uppercase tracking-tight transition-all duration-300 group-hover:text-signal group-hover:[-webkit-text-stroke:0px] sm:text-5xl">
              {brand}
            </span>
            <span className="font-mono text-[10px] tracking-[0.2em] text-muted">
              ×{count}
            </span>
          </Link>
        </span>
      ))}
    </div>
  );

  return (
    <section className="border-y border-line py-6" aria-label="Marken auf der Tafel">
      <div className="marquee-mask overflow-hidden">
        <div className="marquee-track">
          {lap("a")}
          {lap("b")}
        </div>
      </div>
    </section>
  );
}
