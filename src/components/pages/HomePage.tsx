import { useEffect } from "react";
import Hero from "../Hero";
import BrandIndex from "../BrandIndex";
import ConsultStrip from "../ConsultStrip";
import HowItWorks from "../HowItWorks";
import ListingCard from "../ListingCard";
import { LinkButton, SectionHeader } from "../ui";
import { useListings } from "../../hooks/useListings";
import { href } from "../../lib/url";
import type { Listing } from "../../data/evData";

/* ============================================================================
   Startseite — der Bestand ist die Werbung, also kommt er zuerst:
   Hero mit Suche → frische Inserate → wie gerechnet wird → Marken →
   Beratung. Keine Abschnitts-Choreografie; die Seite blendet einmal ein.
   ============================================================================ */

export default function HomePage({ initial }: { initial?: Listing[] }) {
  const { listings, active } = useListings(initial);

  // Deep-Links wie /#beratung (Verweis aus den Detailseiten).
  useEffect(() => {
    const { hash } = window.location;
    if (hash) document.querySelector(hash)?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const freshest = [...active].sort((a, b) => a.postedDays - b.postedDays).slice(0, 8);

  return (
    <div className="animate-fade-in">
      <Hero />

      <section className="mx-auto max-w-352 border-t border-line px-4 py-10 sm:px-6">
        <SectionHeader
          title="Neu auf EV4U"
          lead="Die zuletzt eingestellten Angebote — live aus der Datenbank."
        >
          <LinkButton href={href("/inserate")} variant="secondary" size="sm">
            Alle {listings.length} Inserate →
          </LinkButton>
        </SectionHeader>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {freshest.map((l, i) => (
            <ListingCard key={l.id} listing={l} priority={i < 4} />
          ))}
        </div>
      </section>

      <HowItWorks />
      <BrandIndex />
      <ConsultStrip />
    </div>
  );
}
