import { useEffect } from "react";
import { motion } from "framer-motion";
import Hero from "../Hero";
import BrandTreadmill from "../BrandTreadmill";
import BentoHub from "../BentoHub";
import ListingShowcase from "../ListingShowcase";
import { SectionHeader } from "../ui";
import { useListings } from "../../hooks/useListings";
import { href } from "../../lib/url";
import type { Listing } from "../../data/evData";

/* ============================================================================
   Home — the storefront. The live inventory IS the marketing, so the cars
   come first: Hero (value prop + tariff widget) → brand index → freshest
   listings as photo cards → the four action cards (incl. Sprechstunde).
   ============================================================================ */

export default function HomePage({ initial }: { initial?: Listing[] }) {
  const { listings } = useListings(initial);

  // Support deep links like /#beratung (booking CTA from detail pages).
  useEffect(() => {
    const { hash } = window.location;
    if (hash) {
      document.querySelector(hash)?.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  const freshest = [...listings]
    .sort((a, b) => a.postedDays - b.postedDays)
    .slice(0, 6);

  return (
    <>
      <Hero />
      <BrandTreadmill />

      {/* Freshest listings — the goods come before the concept */}
      <section className="border-t border-line bg-panel/40">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-8">
          <SectionHeader
            title="Frische Inserate"
            claim="Die neusten Angebote zuerst — live aus der Datenbank."
          >
            <a
              href={href("/inserate")}
              className="border border-signal bg-signal px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-[0.15em] text-nacht transition-colors hover:bg-signal-dim"
            >
              Alle {listings.length} Inserate →
            </a>
          </SectionHeader>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mt-10"
          >
            <ListingShowcase listings={freshest} />
          </motion.div>
        </div>
      </section>

      <BentoHub />
    </>
  );
}
