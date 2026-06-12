import { useEffect } from "react";
import { motion } from "framer-motion";
import Hero from "../Hero";
import BrandTreadmill from "../BrandTreadmill";
import BentoHub from "../BentoHub";
import ListingBoard from "../ListingBoard";
import { SectionHeader } from "../ui";
import { useListings } from "../../hooks/useListings";
import { href } from "../../lib/url";

/* ============================================================================
   Home — the storefront. The live inventory IS the marketing:
   Hero (Standort-Fixierung) → brand treadmill (live from the board) →
   Schaltzentrale bento (doors + Sprechstunde) → freshest listings.
   ============================================================================ */

export default function HomePage() {
  const { listings } = useListings();

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
      <BentoHub />

      {/* Freshest listings teaser */}
      <section className="border-t border-line bg-panel/40">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-8">
          <SectionHeader
            index="02"
            title="Frisch auf der Tafel"
            claim="Die neusten Inserate · live"
          >
            <a
              href={href("/inserate")}
              className="border border-line px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.25em] text-muted transition-colors hover:border-signal hover:text-signal"
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
            <ListingBoard listings={freshest} compact />
          </motion.div>
        </div>
      </section>
    </>
  );
}
