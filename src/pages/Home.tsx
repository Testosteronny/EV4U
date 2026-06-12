import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import Hero from "../components/Hero";
import BrandTreadmill from "../components/BrandTreadmill";
import BentoHub from "../components/BentoHub";
import ListingBoard from "../components/ListingBoard";
import { SectionHeader } from "../components/ui";
import { useListings } from "../context/ListingsContext";

/* ============================================================================
   Home — the storefront. The live inventory IS the marketing:
   Hero (Standort-Fixierung) → brand treadmill (live from the board) →
   Schaltzentrale bento (doors + Sprechstunde) → freshest listings.
   ============================================================================ */

export default function Home() {
  const { hash } = useLocation();
  const { listings } = useListings();

  // Support deep links like /#beratung (booking CTA from detail pages).
  useEffect(() => {
    if (hash) {
      document.querySelector(hash)?.scrollIntoView({ behavior: "smooth" });
    }
  }, [hash]);

  const freshest = [...listings]
    .sort((a, b) => a.postedDays - b.postedDays)
    .slice(0, 6);

  return (
    <>
      <Hero />
      <BrandTreadmill />
      <BentoHub />

      {/* Freshest listings teaser */}
      <section className="border-t border-line bg-panel/40">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-8">
          <SectionHeader
            index="02"
            title="Frisch auf der Tafel"
            claim="Die neusten Inserate · live"
          >
            <Link
              to="/inserate"
              className="border border-line px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.25em] text-muted transition-colors hover:border-signal hover:text-signal"
            >
              Alle {listings.length} Inserate →
            </Link>
          </SectionHeader>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mt-10"
          >
            <ListingBoard listings={freshest} compact />
          </motion.div>
        </div>
      </section>
    </>
  );
}
